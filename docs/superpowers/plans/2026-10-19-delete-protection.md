# 刪除保護 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 工作區／資料庫改軟刪除並可從「最近刪除」還原、刪除前輸入名稱確認；刪使用者保留留言；還原欄位恢復 lookup／rollup；還原欄位需結構權限。

**Architecture:** 新服務 `containerTrash.ts` 以「同一時間戳」軟刪除／還原工作區、資料庫、資料表（沿用資料表刪除既有做法），`authorizeAction` 把已刪除容器視為不存在；新 API `/api/trash` 列出與還原；前端加名稱確認視窗與「最近刪除」視窗。

**Tech Stack:** Next.js 16 route handlers、Prisma 6（TiDB／MySQL）、React 19、Jest（mock prisma）、Testing Library。

**Spec:** `docs/superpowers/specs/2026-10-19-delete-protection-design.md`

## Global Constraints

- 保留天數 30 天（與 cron 既有 `RETENTION_DAYS = 30` 一致）。
- 權限：工作區刪除／還原 `canManageWorkspace`；資料庫、資料表刪除／還原 `canManageStructure`；欄位回收站還原／永久刪除 `canManageStructure`；資料列維持 `canEditData`。
- 已刪除使用者的留言作者顯示字串固定為 `已刪除的使用者`。
- 錯誤回應沿用 `NextResponse.json({ error }, { status })`；還原前置條件不成立回 400：`請先還原工作區`／`請先還原資料庫`。
- 不執行 `npm run build`；不經使用者同意不跑 `prisma db push`。測試全用 mock prisma。
- 每個任務完成前 `npm run verify` 必須通過（commit hook 也會跑）。
- 改到 `src/lib/authorize.ts` 或 `services/` 的任務，最後的全分支審查用 opus reviewer。

## Review Focus

- 刪除工作區後，該工作區的資料表 id 直接打 `/api/tables/<id>/rows` 必須 404（靠資料表時間戳＋authorize）→ Task 3 測試 tableId 路徑。
- 工作區刪除前已單獨刪除的資料表，還原工作區後仍維持刪除 → Task 2 測試。
- 使用者已是某工作區成員但只有 viewer／editor 角色時，「最近刪除」不能列出也不能還原該工作區或資料庫 → Task 5 測試。
- lookup 的 `targetFieldId` 指向其他資料表中已刪除欄位時，不得回傳舊值 → Task 7 測試。
- 刪除名稱前後空白：輸入 `" 名稱 "` 不算相符（完全相等才啟用）→ Task 10 測試。

---

### Task 1: Schema 變更

**Files:**
- Modify: `prisma/schema.prisma`（`Workspace`、`Database`、`RowComment`）

- [ ] **Step 1:** `Workspace`、`Database` 各加 `deletedAt DateTime?` 與 `@@index([deletedAt])`。`RowComment` 的 `userId Int?`、`user User? @relation(fields: [userId], references: [id], onDelete: SetNull)`。
- [ ] **Step 2:** `npx prisma generate`，再 `npm run typecheck`。預期因 `RowComment.user` 變可為 null 而出錯的地方：留言路由與面板（Task 9 處理）；若 typecheck 在此就失敗，於該處加最小的 null 處理讓它通過，行為改動留給 Task 9。
- [ ] **Step 3:** `npm run verify` 通過後 commit：`feat(db): add soft-delete columns for workspace/database and keep comments of deleted users`。
- [ ] **Step 4:** 在回報中提醒使用者：部署前需要 `db push`（只新增欄位與放寬 null），由使用者決定何時執行。

### Task 2: containerTrash 服務

**Files:**
- Create: `src/modules/database/services/containerTrash.ts`
- Test: `src/modules/database/services/__tests__/containerTrash.test.ts`
- Modify: `src/app/api/tables/[tableId]/route.ts`（還原改呼叫 `restoreTable`，行為不變）

**Interfaces:**
- Produces:
  - `softDeleteWorkspace(workspaceId: number, now?: Date): Promise<void>`
  - `softDeleteDatabase(databaseId: number, now?: Date): Promise<void>`
  - `restoreWorkspace(workspaceId: number): Promise<RestoreResult>`
  - `restoreDatabase(databaseId: number): Promise<RestoreResult>`
  - `restoreTable(tableId: number): Promise<RestoreResult>`
  - `type RestoreResult = { ok: true; tableIds: number[] } | { ok: false; status: 400 | 404; error: string }`

軟刪除：一個 `prisma.$transaction`，對容器本身與其下 `deletedAt: null` 的資料庫／資料表／欄位／資料列 `updateMany` 設為 `now`（欄位、資料列以 `tableId in [...]` 篩選）。還原：先讀容器 `deletedAt`（null 或不存在回 404 `找不到已刪除的項目`），把子項 `deletedAt` 等於該值者設 null，再清容器；回傳受影響的資料表 id 供快取失效。

- [ ] **Step 1: 寫失敗測試**（mock `@/lib/prisma`，`$transaction` 以 callback 傳入同一個 mock tx）
  - `softDeleteWorkspace stamps workspace, its live databases, tables, fields and rows with the same timestamp`：斷言每個 `updateMany` 的 `data.deletedAt` 是同一個 `now`，且 where 含 `deletedAt: null`。
  - `restoreWorkspace only clears children deleted at the same timestamp`：容器 `deletedAt = T`，斷言子項 `updateMany` where 含 `deletedAt: T`。
  - `restoreDatabase refuses when its workspace is deleted` → `{ ok: false, status: 400, error: '請先還原工作區' }`，沒有任何 `updateMany`。
  - `restoreTable refuses when its database is deleted` → `error: '請先還原資料庫'`。
  - `restoreTable returns 404 for a table that is not deleted`。
- [ ] **Step 2:** `npx jest src/modules/database/services/__tests__/containerTrash.test.ts` → FAIL（模組不存在）。
- [ ] **Step 3:** 實作上述介面；`tables/[tableId]/route.ts` 的 PATCH 還原分支改呼叫 `restoreTable`（該路由的授權問題由 Task 3 的 `includeDeleted` 處理）。
- [ ] **Step 4:** 同一指令 → PASS；`npx jest src/app/api/tables/\[tableId\]/__tests__` 仍 PASS。
- [ ] **Step 5:** commit `feat(trash): container soft delete and restore service`。

### Task 3: authorizeAction 排除已刪除容器

**Files:**
- Modify: `src/lib/authorize.ts`
- Test: `src/lib/__tests__/authorize.test.ts`

**Interfaces:**
- Produces: `authorizeAction(options: { workspaceId?; databaseId?; tableId?; action; includeDeleted?: boolean })`

規則（`includeDeleted` 不為 true 時）：tableId 路徑沿用 `deletedAt: null`（時間戳已涵蓋隨容器刪除的表）；databaseId 路徑找不到或 `deletedAt` 非 null 回 404 `找不到對應的資料庫`；直接給 workspaceId 時查 `workspace.findFirst({ where: { id, deletedAt: null } })`，不存在回 404 `找不到對應的工作區`。`includeDeleted: true` 時三條路徑都不篩 `deletedAt`。

- [ ] **Step 1: 寫失敗測試**
  - `returns 404 for a deleted workspace`、`returns 404 for a deleted database`。
  - `returns 404 for a table stamped deleted with its workspace`（findFirst 回 null）。
  - `includeDeleted resolves a deleted workspace and still checks the role`（成員 viewer + `canManageWorkspace` → 403）。
- [ ] **Step 2:** `npx jest src/lib/__tests__/authorize.test.ts` → 新案例 FAIL。
- [ ] **Step 3:** 實作；`tables/[tableId]/route.ts` PATCH 在 `body.deletedAt === null` 時以 `includeDeleted: true` 授權。
- [ ] **Step 4:** 同指令 PASS，`npx jest src/app/api` 全 PASS（其他路由測試 mock 了 authorize，應不受影響）。
- [ ] **Step 5:** commit `feat(authz): treat soft-deleted workspaces and databases as missing`。

### Task 4: /api/workspaces 改軟刪除

**Files:**
- Modify: `src/app/api/workspaces/route.ts`（GET、DELETE）
- Test: `src/app/api/workspaces/__tests__/route.test.ts`

- [ ] **Step 1: 寫失敗測試**
  - `DELETE delete_workspace soft deletes via softDeleteWorkspace and never calls prisma.workspace.delete`（mock `containerTrash`）。
  - `DELETE delete_workspace counts only live workspaces`：斷言 `workspace.count` 以 `{ where: { deletedAt: null } }` 呼叫，count 為 1 時回 400。
  - `DELETE delete_database soft deletes via softDeleteDatabase`，權限仍 `canManageStructure`。
  - `GET excludes deleted workspaces and databases`：斷言 `findMany` 的 where 含 `deletedAt: null`、databases include 含 `where: { deletedAt: null }`。
- [ ] **Step 2:** `npx jest src/app/api/workspaces/__tests__/route.test.ts` → FAIL。
- [ ] **Step 3:** 實作。GET 中「沒有工作區就自動建立」的判斷也只看未刪除的工作區（同一個查詢結果，不需另外處理）。成功訊息改為 `工作區已移到最近刪除`／`資料庫已移到最近刪除`。
- [ ] **Step 4:** 同指令 PASS。
- [ ] **Step 5:** commit `feat(workspaces): soft delete workspaces and databases`。

### Task 5: /api/trash 列表與還原

**Files:**
- Create: `src/app/api/trash/route.ts`（GET）、`src/app/api/trash/restore/route.ts`（POST）
- Test: `src/app/api/trash/__tests__/route.test.ts`、`src/app/api/trash/restore/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `restoreWorkspace/restoreDatabase/restoreTable`；Task 3 的 `includeDeleted`。
- Produces: `GET /api/trash` → `{ items: TrashEntry[] }`；`type TrashEntry = { type: 'workspace' | 'database' | 'table'; id: number; name: string; parentName: string | null; deletedAt: string; daysLeft: number }`（放 `src/modules/database/types` 供前端用）。`POST /api/trash/restore` body `{ type, id }` → `{ message: '還原成功' }`。

列表：系統 admin 看全部工作區，其他人看自己是成員的工作區，角色以 `getRolePermissions(role)` 判斷。工作區需 `canManageWorkspace`；資料庫需所屬工作區未刪除且 `canManageStructure`；資料表需資料庫與工作區都未刪除、`table.deletedAt !== database.deletedAt`，且 `canManageStructure`。`daysLeft = max(0, 30 - floor((now - deletedAt) / 1 天))`。依 `deletedAt` 新到舊排序。

還原：`authorizeAction({ <type>Id: id, action, includeDeleted: true })`，再呼叫對應還原函式，`ok: false` 時以其 status／error 回應；成功後對回傳的 `tableIds` 呼叫 `invalidateMasterViewCacheForTable`（失敗只 warn）。

- [ ] **Step 1: 寫失敗測試**
  - GET：`lists a deleted workspace only for members with canManageWorkspace`（viewer 看不到）、`omits tables deleted together with their database`、`computes daysLeft from deletedAt`（刪除 3 天前 → 27）、`returns 401 without session`。
  - POST：`restores a workspace through restoreWorkspace with includeDeleted authorization`、`passes through 400 when restoreDatabase says the workspace is deleted`、`rejects unknown type with 400`、`returns the authorize error when the role lacks permission`。
- [ ] **Step 2:** `npx jest src/app/api/trash` → FAIL。
- [ ] **Step 3:** 實作。
- [ ] **Step 4:** 同指令 PASS。
- [ ] **Step 5:** commit `feat(trash): recently deleted list and restore API`。

### Task 6: cron 清除工作區／資料庫，永久清欄位時清參照

**Files:**
- Modify: `src/app/api/cron/trash-cleanup/route.ts`
- Test: `src/app/api/cron/trash-cleanup/__tests__/route.test.ts`

順序：資料列 → 資料表 → 欄位（先 `findMany` 取 id，`deleteMany` 後對每個 id 呼叫 `cleanupFieldDependencies`）→ 資料庫 → 工作區。摘要加 `deletedDatabases`、`deletedWorkspaces`。

- [ ] **Step 1: 寫失敗測試**：`purges databases and workspaces deleted more than 30 days ago`（where 同既有欄位案例的 cutoff 斷言）、`cleans lookup/rollup references for each purged field`（mock `rowCascade`，斷言以各 id 呼叫）、既有 401／503 案例也斷言新的 deleteMany 沒被呼叫。
- [ ] **Step 2:** `npx jest src/app/api/cron` → FAIL。
- [ ] **Step 3:** 實作。
- [ ] **Step 4:** PASS。
- [ ] **Step 5:** commit `feat(cron): purge expired workspaces and databases`。

### Task 7: S4 欄位軟刪除保留 lookup／rollup 參照

**Files:**
- Modify: `src/app/api/tables/[tableId]/fields/[fieldId]/route.ts`（DELETE 移除 `cleanupFieldDependencies`）
- Modify: `src/app/api/tables/[tableId]/trash/route.ts`（DELETE `field` 在 transaction 後呼叫 `cleanupFieldDependencies(targetId)`）
- Modify: `src/modules/database/services/rowQuery.ts`（`populateRows`）
- Test: 對應的 `__tests__/route.test.ts`、`src/modules/database/services/__tests__/rowQuery.test.ts`

`populateRows`：收集所有 lookup／rollup 的 `relationFieldId`、`targetFieldId`，以一次 `prisma.tableField.findMany({ where: { id: { in }, deletedAt: null }, select: { id: true } })` 取得仍存在的 id；任一端不在其中的參照不放進 `activeRelationFields`（該欄位值維持未計算）。

- [ ] **Step 1: 寫失敗測試**
  - 欄位路由：`DELETE soft deletes without clearing lookup/rollup references`（`cleanupFieldDependencies` 未被呼叫）。
  - 回收站路由：`DELETE field permanently clears lookup/rollup references`。
  - rowQuery：`skips a lookup whose target field is soft deleted`（Review Focus：目標欄位在其他表）、`computes the lookup again once the target field is active`。
- [ ] **Step 2:** 跑三個測試檔 → FAIL。
- [ ] **Step 3:** 實作。
- [ ] **Step 4:** PASS；`npx jest src/modules/database/services` 全 PASS（既有 `rowCascade.test.ts` 不需改）。
- [ ] **Step 5:** commit `fix(fields): keep lookup/rollup references until a field is purged`。

### Task 8: S6 回收站欄位操作需要結構權限

**Files:**
- Modify: `src/app/api/tables/[tableId]/trash/route.ts`（POST、DELETE）
- Test: `src/app/api/tables/[tableId]/trash/__tests__/route.test.ts`

先讀 body／query 取得 `type`，`field` 用 `canManageStructure`，`row` 用 `canEditData`，再授權。

- [ ] **Step 1: 寫失敗測試**：`POST restoring a field requires canManageStructure`、`DELETE purging a field requires canManageStructure`（斷言 `authorizeAction` 的 action 參數）、`row restore still uses canEditData`。
- [ ] **Step 2:** FAIL。 **Step 3:** 實作。 **Step 4:** PASS。
- [ ] **Step 5:** commit `fix(trash): require structure permission to restore or purge fields`。

### Task 9: W3 已刪除使用者的留言

**Files:**
- Modify: `src/app/api/tables/[tableId]/rows/comments/route.ts`（GET 回傳前把 `user: null` 換成 `{ username: '已刪除的使用者', role: null }`）
- Modify: `src/modules/database/components/modals/RowCommentsPanel.tsx`（若 Task 1 加了暫時處理，改為依 API 字串顯示；`'系統 (System)'` 後備只留給 `-999` 系統紀錄）
- Test: `src/app/api/tables/[tableId]/rows/comments/__tests__/route.test.ts`

- [ ] **Step 1:** 失敗測試 `GET labels comments of deleted users as 已刪除的使用者`。
- [ ] **Step 2:** FAIL。 **Step 3:** 實作。 **Step 4:** PASS。
- [ ] **Step 5:** commit `fix(comments): keep comments of deleted users`。

### Task 10: 刪除名稱確認視窗

**Files:**
- Create: `src/modules/database/components/modals/DeleteConfirmModal.tsx`
- Modify: `src/modules/database/components/modals/index.ts`（匯出）、`src/app/page.tsx`（兩處 `onDeleteWorkspaceOrDb` 改開視窗；兩處 `onDeleteTable` 的 confirm 文案）、`src/lib/i18n/locales/zh-TW.json`、`en.json`
- Test: `src/modules/database/components/modals/__tests__/DeleteConfirmModal.test.tsx`

**Interfaces:**
- Produces: `DeleteConfirmModal({ open, kind: 'workspace' | 'database', name, onConfirm: () => Promise<void> | void, onClose })`

文案（zh-TW）：標題 `刪除工作區「{name}」？`／`刪除資料庫「{name}」？`；說明 `會移到「最近刪除」，30 天內可以還原，之後永久刪除。`；提示 `請輸入名稱「{name}」確認`。資料表 confirm 改為 `確定要刪除資料表「{name}」？30 天內可以在「最近刪除」還原。`。i18n key 放 `trash.*`。page.tsx 兩個分支共用同一份 state（`pendingDelete: { action, id, label } | null`），視窗只渲染一次，失敗時以既有 `uiActions.addToast(error, 'error')` 顯示。

- [ ] **Step 1: 寫失敗測試**：`keeps the delete button disabled until the exact name is typed`（含 Review Focus：`" 名稱 "` 不啟用）、`calls onConfirm once when confirmed`、`Escape／取消 calls onClose`。
- [ ] **Step 2:** FAIL。 **Step 3:** 實作，樣式沿用 `RenameModal`。 **Step 4:** PASS。
- [ ] **Step 5:** commit `feat(ui): require typing the name to delete a workspace or database`。

### Task 11: 「最近刪除」視窗與側欄入口

**Files:**
- Create: `src/modules/database/components/modals/RecentlyDeletedModal.tsx`
- Modify: `src/modules/database/services/trash.ts`（新增 `fetchRecentlyDeleted(): Promise<TrashEntry[]>`、`restoreRecentlyDeleted(type, id): Promise<{ ok: boolean; error?: string }>`）
- Modify: `src/modules/database/components/sidebar/Sidebar.tsx`（導覽區在「成員管理」後加 `nav.recentlyDeleted` 項目，prop `onOpenRecentlyDeleted?: () => void`）、`src/app/page.tsx`（掛視窗，還原成功後 `wsActions.fetchWorkspaces()`）、i18n 兩檔
- Test: `src/modules/database/components/modals/__tests__/RecentlyDeletedModal.test.tsx`

視窗依類型分組（工作區、資料庫、資料表），每列顯示名稱、所屬名稱、`剩 {n} 天`、「還原」按鈕；空清單顯示 `沒有最近刪除的項目`；還原失敗在該列下顯示 API 錯誤訊息。

- [ ] **Step 1: 寫失敗測試**（mock `fetch`）：`lists items grouped by type with days left`、`restores an item and calls onRestored`、`shows the API error when restore is refused`、`shows the empty state`。
- [ ] **Step 2:** FAIL。 **Step 3:** 實作。 **Step 4:** PASS。
- [ ] **Step 5:** commit `feat(ui): recently deleted modal with restore`。

### Task 12: 收尾

- [ ] **Step 1:** `npm run verify` 全部通過。
- [ ] **Step 2:** 在 `.claude/rules/backend.md` 錯誤紀錄加：`資料表軟刪除後 authorizeAction 以 deletedAt: null 查表，PATCH 還原永遠 404 → 需要讀已刪除項目的路徑用 includeDeleted: true，新增還原路徑時補測試`。
- [ ] **Step 3:** 更新 `PROGRESS.md`（子專案 3 完成、`db push` 待使用者執行）。
- [ ] **Step 4:** commit `docs: record delete protection progress`，交 reviewer（opus，基準 `main`）審查全分支。
