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
