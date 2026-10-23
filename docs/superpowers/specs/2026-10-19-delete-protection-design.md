# 刪除保護（健檢子專案 3）設計

日期：2026-10-19
涵蓋：`docs/audits/2026-10-17-editing-audit.md` 的 W1、W3、S4、S6

## 目標

讓誤刪可以挽回：工作區與資料庫改為軟刪除，30 天內可從「最近刪除」還原，刪除前要輸入名稱確認；刪除使用者不再帶走他的留言；欄位從回收站還原後，引用它的 lookup／rollup 一起恢復；還原欄位需要結構權限。

成功條件：

- 刪除工作區／資料庫後，資料仍在資料庫中，一般 API 都看不到也存取不到；有權限的人能在「最近刪除」還原，還原後內容與刪除前相同（不含刪除前就已各自刪除的項目）。
- 超過 30 天的已刪除工作區／資料庫由 cron 永久刪除。
- 刪除使用者後，他在別人資料列上的留言仍在，作者顯示「已刪除的使用者」。
- 刪除欄位再還原，引用它的 lookup／rollup 設定不變、值恢復計算。
- 只有 `canEditData` 的使用者不能還原或永久刪除欄位。

## 現況（2026-10-19）

- 資料表已是軟刪除：`DELETE /api/tables/[tableId]` 把資料表、其欄位與資料列蓋上同一個 `deletedAt`；`PATCH` 帶 `deletedAt: null` 時只還原時間戳相同的子項。但 `authorizeAction({ tableId })` 只找 `deletedAt: null` 的資料表，所以已刪除的資料表其實無法經由這條 API 還原。
- 工作區／資料庫是 `prisma.*.delete`，cascade 硬刪除（`api/workspaces/route.ts` DELETE）。前端只有 `confirm()`（`app/page.tsx`）。
- `RowComment.user` 為 `onDelete: Cascade`。
- 欄位軟刪除時呼叫 `cleanupFieldDependencies`（`services/rowCascade.ts`），把 lookup／rollup 的 `relationFieldId`／`targetFieldId` 設為 null。
- 回收站路由 `api/tables/[tableId]/trash` 的還原與永久刪除都只要 `canEditData`。
- 前端沒有任何回收站畫面；`services/trash.ts` 沒有被引用。
- cron `trash-cleanup` 每次清除超過 30 天的資料列、資料表、欄位。

## 設計

### 1. 資料模型

- `Workspace`、`Database` 新增 `deletedAt DateTime?`，並加 `@@index([deletedAt])`。
- `RowComment.userId` 改 `Int?`，關聯改 `onDelete: SetNull`。
- 兩者都只是新增或放寬欄位，`db push` 不刪資料。實際執行 `db push` 前先取得使用者同意。

### 2. 軟刪除與還原語意

沿用資料表的「同一時間戳」做法，抽成共用服務 `src/modules/database/services/containerTrash.ts`：

- `softDeleteWorkspace(id, now)`：在 transaction 中把工作區、其下 `deletedAt` 為 null 的資料庫、資料表、欄位、資料列都設為 `now`。
- `softDeleteDatabase(id, now)`：同上，從資料庫往下。
- `restoreWorkspace(id)`／`restoreDatabase(id)`：讀出容器的 `deletedAt`，只把子項中 `deletedAt` 等於該值的清為 null，再清容器本身。刪除前就各自刪除的項目（時間戳不同）維持刪除。
- 還原資料庫時，若所屬工作區已刪除，拒絕（400「請先還原工作區」）。
- 還原資料表時，若所屬資料庫已刪除，拒絕（400「請先還原資料庫」）。
- 完成後呼叫既有的總表快取失效（`invalidateMasterViewCacheForTable`，對受影響的資料表）。

「至少保留一個工作區」改為只計算 `deletedAt: null` 的工作區（仍是全站計數，W2 不在此範圍）。

### 3. 授權

- `authorizeAction` 依 `workspaceId`／`databaseId`／`tableId` 解析時，已刪除的工作區、資料庫（以及原本就有的已刪除資料表）一律視為不存在，回 404。
- 新增選項 `includeDeleted: true`，只給還原路徑使用，允許解析已刪除的容器。
- 權限：工作區刪除與還原用 `canManageWorkspace`；資料庫、資料表的刪除與還原用 `canManageStructure`。
- `GET /api/workspaces` 等列表查詢排除已刪除的工作區與資料庫。

### 4. 「最近刪除」API

- `GET /api/trash`：回傳目前使用者可還原的項目。
  - 工作區：使用者在該工作區有 `canManageWorkspace`。
  - 資料庫：所屬工作區未刪除，且使用者有 `canManageStructure`。
  - 資料表：所屬資料庫與工作區都未刪除，資料表本身已刪除，且使用者有 `canManageStructure`。只列出單獨被刪除的資料表（時間戳與所屬資料庫不同）；隨容器一起刪除的資料表不單獨列出。
  - 每項欄位：`type`（workspace／database／table）、`id`、`name`、所屬名稱（工作區／資料庫）、`deletedAt`、`daysLeft`。
- `POST /api/trash/restore`，body `{ type, id }`：依類型呼叫第 2 節的還原函式。
- 不提供手動永久刪除，到期由 cron 處理。

### 5. cron

`trash-cleanup` 在現有三步之後，加上永久刪除 `deletedAt` 超過 30 天的資料庫與工作區（靠 cascade 清子項）。回傳摘要加 `deletedDatabases`、`deletedWorkspaces`。

### 6. 前端

- 新元件 `DeleteConfirmModal`：說明「會移到最近刪除，30 天後永久刪除」，要輸入正確名稱，刪除按鈕才會啟用。刪工作區、資料庫時改用它，取代 `page.tsx` 裡的 `confirm()`。
- 刪資料表維持一般確認，但文字改成「可在最近刪除中於 30 天內還原」。
- 側欄加「最近刪除」入口，打開 `RecentlyDeletedModal`：依類型分組列出項目、剩餘天數與「還原」按鈕；還原失敗時顯示 API 回傳的錯誤訊息；還原成功後重新載入工作區列表。
- 文案放 i18n，沿用既有品牌樣式。

### 7. W3：留言作者

- 留言 API 對 `user` 為 null 的留言回傳作者為「已刪除的使用者」（不回 null 給前端）。
- `RowCommentsPanel` 等顯示處不需要依賴 `user` 物件存在。
- 最新留言欄位的 JSON 內本就存作者名稱，不受影響。

### 8. S4：lookup／rollup 參照

- 欄位軟刪除時不再呼叫 `cleanupFieldDependencies`。
- `rowQuery` 建立 `activeRelationFields` 時，排除 `relationFieldId` 或 `targetFieldId` 指向已刪除欄位的參照，視為未設定。
- 永久刪除欄位（回收站 DELETE、cron 清除欄位）時才呼叫 `cleanupFieldDependencies`。cron 一次清多個欄位時，對每個被清除的欄位 id 呼叫。

### 9. S6：回收站權限

`api/tables/[tableId]/trash`：`type === 'field'` 的還原（POST）與永久刪除（DELETE）改成需要 `canManageStructure`；`row` 維持 `canEditData`。

## 錯誤處理

- 名稱確認只在前端（視窗按鈕在名稱完全相符前停用），API 不另外驗證名稱。
- 找不到項目、無權限：分別回 404／403，沿用現有 `NextResponse.json({ error })` 格式。
- 還原的前置條件不成立（上層容器已刪除）：回 400，附明確訊息。
- 軟刪除與還原都在單一 transaction 內，失敗時整筆不生效。

## 測試

- `containerTrash`：刪除時的時間戳連帶、還原只清相同時間戳、上層已刪除時拒絕還原。
- `authorizeAction`：已刪除的工作區／資料庫／資料表回 404；`includeDeleted` 時可解析。
- `api/workspaces` DELETE：工作區與資料庫改為軟刪除，權限不變；保留至少一個「未刪除」工作區。
- `api/trash` GET／restore：依權限過濾、隨容器刪除的資料表不單獨列出、各種拒絕情況。
- cron：清除超過 30 天的工作區與資料庫；永久清除欄位時清掉 lookup／rollup 參照。
- `rowQuery`：參照指向已刪除欄位時不計算、還原後恢復。
- 留言路由：作者已刪除時回傳「已刪除的使用者」。
- 回收站路由：只有 `canEditData` 不能還原或永久刪除欄位。
- UI：`DeleteConfirmModal` 名稱不符時按鈕停用；`RecentlyDeletedModal` 列出項目並呼叫還原。

## 不在範圍內

- 資料表內的欄位／資料列回收站畫面，以及 `restoreTrashItem` 用錯 PATCH 的修正。
- W2（至少保留一個工作區改成看使用者自己的）、W4（改名長度上限）。
- 回收站內的手動永久刪除。
