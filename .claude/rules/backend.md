---
paths:
  - "src/app/api/**"
  - "src/modules/database/services/**"
  - "src/lib/**"
  - "src/proxy.ts"
  - "prisma/**"
  - "scripts/**"
---

# 後端規則

- 資料庫是 TiDB v8.5.3 serverless（MySQL 相容，非原生 MySQL）。`relationMode = "prisma"`：沒有 DB 層外鍵，關聯完整性靠程式碼。
- 使用者資料表不用 DDL：所有列存在 `TableRow.data`（Json，鍵為 `field_<id>`），欄位定義在 `TableField`（型別設定在 `options`）。理由見 `docs/architecture-decisions/001`。
- 儲存格值沒有 DB 約束：寫入前一律經過 `services/rowValidation.ts` 與 `utils/normalizeRowData`。不要寫入未正規化的 JSON（曾發生雙重編碼）。
- 刪除或改名欄位時，要處理 `TableRow.data` 裡殘留的 key（`scripts/auditOrphans.ts` 可稽核）。
- 篩選／排序／搜尋／分頁下推到 SQL：`services/rowQuery.ts`（快慢雙路徑、keyset 分頁）。TiDB `AUTO_INCREMENT` 不保證隨時間遞增，`id` 只能當 tie-breaker，不可當插入順序。
- `schemaService.ts` 會在執行期對 `TableRow` 建立 generated column 與索引，這些不在 `schema.prisma` 中；`prisma db push --accept-data-loss` 可能刪掉它們。
- 原生 SQL 一律參數化（`$executeRaw` tagged template 或 `$executeRawUnsafe(sql, ...params)`），不可把使用者輸入串進 SQL 字串；欄位名只能由數字 `fieldId` 組成。
- 路由一律用 `withApiHandler`（`src/lib/api-handler.ts`）包裝：Zod 驗證、限流、RBAC 用它的 `auth` 選項，不要在 handler 內自行判斷權限。
- `src/proxy.ts` 是所有 `/api/*` 的登入閘門；新增公開端點必須加進它的白名單。
- 業務邏輯放 `src/modules/database/services/`，路由檔只做請求／回應轉換。
- 公式／lookup／rollup 重算走 `services/rowCascade.ts`（前 50 筆同步，其餘背景分批）；雙向 link_row 走 `linkRowSync.ts`。

## 錯誤紀錄

（格式：`- 根因 → 以後做法`，一到兩行，必須可執行）
- 欄位 PATCH／DELETE 依 URL `tableId` 授權，卻只用 `where: { id: fid }` 讀寫欄位，可跨工作區改刪別人的欄位 → 巢狀路由（`[tableId]/.../[xxxId]`）讀寫子資源時，`where` 必須同時帶 `tableId`，或查出後比對 `record.tableId === tid`，不符回 404
- `workspaces/[id]/members` 與 `accept-invite` 只用 `getSessionUser()` 確認登入、沒檢查工作區角色，任何人可把自己加成任一工作區 admin → 帶 `workspaceId` 的路由一律先 `authorizeAction({ workspaceId, action })`（成員管理用 `canManageMembers`）；用 id 刪子資源時改 `deleteMany({ where: { id, workspaceId } })`，`count === 0` 回 404；改或移除成員角色後呼叫 `invalidateWorkspaceRoleCache`
- `rows/move` 只授權來源與目標表，卻直接用前端給的 `sourceRowId` 執行 `delete({ where: { id } })`，可硬刪任何工作區的資料列 → body 裡帶的子資源 id（rowId、fieldId 等）在任何寫入前先用 `findMany({ where: { id: { in }, tableId, deletedAt: null } })` 確認全數屬於已授權的表，數量不符回 404；刪除也帶 `tableId`
- `rows/comments` GET 依 URL `tableId` 授權，卻只用 query 的 `rowId` 查留言，可讀其他工作區留言 → query string 帶的子資源 id 也要先 `findFirst({ where: { id, tableId } })` 確認屬於授權的表，找不到回 404，再讀關聯資料
- 通知「接受邀請」把通知 payload 的 `workspaceId`／`role` 當授權依據每次 upsert，被移除者可用舊通知重新加入 → 成員資格只能來自現有成員或仍存在且 email 相符的 `WorkspaceInvitation`；已處理（`read`）的通知回 409，不覆寫既有角色
- 寫入路徑各自驗證導致同一個值結果不同 → 新增的寫入路徑一律呼叫 `prepareCellWrites`（批次用 `prepareBatchCellWrites`），不要直接呼叫 `FieldRegistry.validateValue`
- rollup 下拉選單送 `avg`／`min`／`max`／`concat`，`rowQuery.ts` 只認 `sum`／`count`／`average`，其餘靜默算成 0 → 新增或改 `rollupFunction` 選項時，同步改 `rowQuery.ts` 的 rollup 分支，並在 `rowQuery.test.ts` 的 `it.each` 加一列
- 資料表軟刪除後 authorizeAction 以 deletedAt: null 查表，PATCH 還原永遠 404 → 需要讀已刪除項目的路徑用 includeDeleted: true，新增還原路徑時補測試
