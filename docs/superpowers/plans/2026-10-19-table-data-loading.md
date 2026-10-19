# 資料表載入效能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 切換資料表時，看過的表立即顯示、hover 過的表提早載入，並用 Server-Timing 量出伺服器端瓶頸。

**Architecture:** 新增純 TS 的 `tableDataCache`（LRU＋請求去重＋預載節流）與純函式 `runTableLoad`（stale-while-revalidate 流程）；`page.tsx` 的 `fetchTableData` 改成呼叫 `runTableLoad` 的薄包裝。hover／閒置預載用兩個小 hook 接到 Sidebar、Dashboard 與 page。rows／fields／views GET 加 `Server-Timing` 標頭。

**Tech Stack:** Next.js 16、React 19、TypeScript、Jest（node／jsdom）、@testing-library/react。不裝新套件。

**Spec:** `docs/superpowers/specs/2026-10-19-table-data-loading-design.md`

## Global Constraints

- 不裝新套件、不改 API 回應 body 格式、不改即時同步的訂閱行為。
- LRU 上限 `8`；預載新鮮度 `30_000` ms；預載並行上限 `2`；hover 延遲 `120` ms；閒置預載 `3` 張；最近清單最多 `5` 筆；`requestIdleCallback` 退回 `setTimeout(…, 1500)`。
- localStorage key：`recentTables_${workspaceId}`；讀寫一律 try/catch。
- 前端效能紀錄只在 `process.env.NODE_ENV === 'development'` 輸出。
- 不跑 `npm run build`；驗證用 `npm run verify`。commit 前先 `preview_stop` 停掉 dev server。
- 改到 `services/`（`rowQuery.ts`）→ 最後審查以 model `opus` 呼叫 `reviewer`。
- 回報與 commit 訊息用繁體中文；commit 結尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## 與 spec 的兩處偏離（實作時照這裡）

1. `fieldService`／`rowService`／`viewService` 的 fetch 失敗時回傳 `[]` 而不拋錯，快取會把失敗當成「空表」存起來。所以 `tableDataCache.load` 改用模組內的 `fetchJsonStrict`（同樣的 URL，`res.ok` 為假時拋 `TableLoadError`，帶 `status`），不走那三個 service。
2. fields／views GET 經過 `withApiHandler`，handler 量不到授權時間，所以只送 `handler;dur=…`；rows GET 自己呼叫 `authorizeAction`，可以分段送 `auth`、`query`、`populate`、`total`。

## Review Focus

1. **快速來回切換**（A→B→A，B 的請求還沒回來）：舊回應不可寫入畫面，也不能讓骨架卡住 → Task 3 測試 `discards result when no longer current`。
2. **請求失敗**（500 或斷網）：不可存成空表；有快取時保留畫面不跳提示，沒快取時跳提示 → Task 2 `does not cache failed loads`、Task 3 `keeps cached data on background failure`。
3. **權限被撤銷或表被刪**（背景重抓回 403／404）：快取必須作廢並呼叫 `onError`，不能繼續顯示 → Task 3 `invalidates and reports on 403/404`。
4. **登出後同一分頁換人登入**：快取清空，清空前已發出的請求回來後也不能寫回 → Task 2 `ignores in-flight load after clear`、Task 4 登出測試。
5. **localStorage 無法使用**（隱私模式或拋錯）：最近清單回傳空陣列，不影響其他功能 → Task 6 `returns [] when storage throws`。

---

### Task 0: 建立工作分支

- [ ] **Step 1:** 用 `superpowers:using-git-worktrees` 從 `main` 建 worktree，分支 `feat/table-data-cache`（主 checkout 的 `feat/sidebar-collapse-toggle` 有未 commit 的改動，不要動它）。
- [ ] **Step 2:** 把主 checkout 未追蹤的 spec 與本計畫兩個檔案複製進 worktree，然後 `npm ci`。
- [ ] **Step 3:** `npm run verify`，預期全部通過（建立基準）。
- [ ] **Step 4:** commit 兩份文件：`docs: 資料表載入效能 spec 與實作計畫`。

### Task 1: Server-Timing 標頭與改動前量測

**Files:**
- Create: `src/lib/serverTiming.ts`、`src/lib/__tests__/serverTiming.test.ts`
- Modify: `src/app/api/tables/[tableId]/rows/route.ts`（GET）、`src/modules/database/services/rowQuery.ts`（`QueryOptions`、兩處 `populateRows(` 呼叫，約第 515、565 行）、`src/app/api/tables/[tableId]/fields/route.ts`（GET）、`src/app/api/tables/[tableId]/views/route.ts`（GET）
- Test: `src/app/api/tables/[tableId]/rows/__tests__/route.test.ts`、`fields/__tests__`、`views/__tests__` 既有檔案各加一案
- Create: `docs/audits/2026-10-19-table-loading-baseline.md`

**Interfaces:**
- Produces: `createServerTiming(): ServerTiming`，其中 `interface ServerTiming { time<T>(name: string, fn: () => Promise<T>): Promise<T>; add(name: string, ms: number): void; header(): string }`。`header()` 格式為 `name;dur=12.3, name2;dur=4.0`（小數一位，同名累加）。
- Produces: `QueryOptions.timing?: ServerTiming`；`getPopulatedTableRows` 用 `timing?.time('populate', …)` 包住兩處 `populateRows`。

- [ ] **Step 1: 寫失敗測試** `serverTiming.test.ts`：
  - `formats entries with one decimal`：`add('auth', 12.34); add('total', 5)` → `header()` 等於 `'auth;dur=12.3, total;dur=5.0'`
  - `accumulates same name`：`add('populate', 1); add('populate', 2)` → 含 `'populate;dur=3.0'`
  - `time() records duration and returns value`：`await t.time('x', async () => 42)` 回傳 `42`，`header()` 符合 `/^x;dur=\d+\.\d$/`
  - `time() records even when fn throws`：fn 拋錯 → 錯誤往外丟，`header()` 仍含 `x;dur=`
- [ ] **Step 2:** `npx jest src/lib/__tests__/serverTiming.test.ts`，預期 FAIL（模組不存在）。
- [ ] **Step 3:** 實作 `src/lib/serverTiming.ts`，計時用 `performance.now()`。
- [ ] **Step 4:** 同一指令，預期 PASS。
- [ ] **Step 5: 路由測試**：在三個既有路由測試檔各加 `sets Server-Timing header on GET`。rows 斷言 header 含 `auth;dur=`、`query;dur=`、`populate;dur=`、`total;dur=`；fields／views 斷言含 `handler;dur=`。跑測試，預期 FAIL。
- [ ] **Step 6: 實作路由**：rows GET 依序 `time('auth', authorizeAction…)`；把 `getPopulatedTableRows` 的整段時間減掉 populate 後 `add('query', …)`；`add('total', …)` 是整個 `executeQuery` 的時間。header 加進現有的 `noCacheHeaders`，錯誤回應不必帶。fields／views 的 handler 改成 `return NextResponse.json(data, { headers: { 'Server-Timing': t.header() } })`，計時涵蓋 handler 本體。
- [ ] **Step 7:** 跑三個路由測試檔與 `rowQuery` 相關測試，預期 PASS。
- [ ] **Step 8: 改動前量測**。`preview_start` dev server，用 `.claude/launch.json` 內的設定。在內建瀏覽器開啟資料列數最多的那張表（以下稱 T，約數千筆），用 `javascript_tool` 量三個情境，每個 3 次取中位數：
  - (a) 首次開 T
  - (b) 切到別張表再切回 T
  - (c) hover 側欄 T 的項目 500ms 後點擊

  量法：`t0 = performance.now()` 後對側欄項目 `.click()`，用 `requestAnimationFrame` 輪詢，直到骨架元素消失且至少出現一列資料，記下 `t1 - t0`。同時用 `performance.getEntriesByType('resource')` 取 `/api/tables/<T>/` 三支請求的 `duration` 與 `serverTiming`。實際用的選擇器寫進報告，改動後要用同一套重量。
- [ ] **Step 9:** 寫 `docs/audits/2026-10-19-table-loading-baseline.md`：環境、T 的列數與欄位數、三情境的表格（改動前）、三支 API 的 Server-Timing 分段；「改動後」欄先留給 Task 7 填。
- [ ] **Step 10:** `preview_stop`，`npm run verify` 通過後 commit：`feat(api): 資料表讀取端點加 Server-Timing，記錄載入基準`。

### Task 2: `tableDataCache` 模組

**Files:**
- Create: `src/modules/database/cache/tableDataCache.ts`、`src/modules/database/cache/__tests__/tableDataCache.test.ts`

**Interfaces:**
- Produces（全部具名匯出）：
  - `interface TableDataEntry { fields: TableField[]; rows: TableRow[]; views: TableView[]; fetchedAt: number }`
  - `class TableLoadError extends Error { status: number }`（斷網時 `status = 0`）
  - `tableDataCache.get(tableId: number): TableDataEntry | undefined`（同時更新 LRU 順序）
  - `tableDataCache.set(tableId: number, entry: TableDataEntry): void`
  - `tableDataCache.invalidate(tableId: number): void`
  - `tableDataCache.clear(): void`（世代 +1，清空進行中的請求表）
  - `tableDataCache.load(tableId: number): Promise<TableDataEntry>`（同表進行中的請求共用 Promise；成功且世代未變才 `set`；失敗拋 `TableLoadError`，不寫入）
  - `tableDataCache.prefetch(tableId: number): void`（快取 `fetchedAt` 在 30 秒內則略過；預載並行數 ≥2 時略過，不排隊；錯誤吞掉）
  - `__resetTableDataCacheForTests(): void`
  - 方法不可依賴 `this`（物件字面值加閉包），因為 Task 5 會直接傳 `tableDataCache.prefetch` 當 callback。
- 型別從 `../types` 匯入。`fetchJsonStrict` 用 `cache: 'no-store'` 抓 `/api/tables/${id}/fields`、`/rows`、`/views`（rows 照 `rowService.fetchRows` 帶 `Cache-Control: no-cache` header）。

- [ ] **Step 1: 寫失敗測試**（node 環境；`global.fetch = jest.fn()` 依 URL 回應；`jest.useFakeTimers()` 加上 `jest.setSystemTime` 控制時間；`beforeEach` 呼叫 reset）：
  - `load stores entry with fetchedAt`：`load(1)` 後 `get(1)` 的 rows 等於 mock 的 rows，`fetchedAt === Date.now()`
  - `dedupes concurrent loads`：同時兩次 `load(1)`，fetch 共呼叫 3 次（不是 6 次），兩個 Promise 結果相同
  - `evicts least recently used beyond 8`：依序 set 1..8、`get(1)`、set 9 → `get(2)` 為 undefined，`get(1)` 仍在
  - `does not cache failed loads`：rows 回 500 → `load(1)` reject 為 `TableLoadError` 且 `status === 500`；`get(1)` 為 undefined
  - `ignores in-flight load after clear`：`load(1)` 還沒 resolve 時 `clear()`，resolve 後 `get(1)` 為 undefined
  - `invalidate removes entry`
  - `prefetch skips fresh entry`：set 時 `fetchedAt = now`，前進 29_999ms 後 `prefetch(1)` 不呼叫 fetch；前進到 30_001ms 會呼叫
  - `prefetch caps concurrency at 2`：fetch 永不 resolve，`prefetch(1)`、`prefetch(2)`、`prefetch(3)` → 只有表 1、2 的 URL 被請求
  - `prefetch swallows errors`：fetch reject 時沒有 unhandled rejection（用 `await Promise.resolve()` 刷微任務後斷言沒拋錯），且 `get` 為 undefined
- [ ] **Step 2:** `npx jest src/modules/database/cache`，預期 FAIL。
- [ ] **Step 3:** 實作。LRU 用 `Map` 的插入順序（get 時先 delete 再 set）。
- [ ] **Step 4:** 同一指令，預期 PASS。
- [ ] **Step 5:** commit：`feat(cache): 新增資料表資料快取（LRU、請求去重、預載節流）`。

### Task 3: `runTableLoad` 載入流程

**Files:**
- Create: `src/modules/database/cache/runTableLoad.ts`、`src/modules/database/cache/__tests__/runTableLoad.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `tableDataCache`、`TableDataEntry`、`TableLoadError`
- Produces:
  ```ts
  interface RunTableLoadDeps {
    cache: Pick<typeof tableDataCache, 'get' | 'load' | 'invalidate'>
    isCurrent: () => boolean
    applyFull: (entry: TableDataEntry) => void        // 寫入 fields、rows，並套用視圖設定
    applyRefresh: (entry: TableDataEntry, viewsChanged: boolean) => void // 背景結果：只寫入 fields、rows；viewsChanged 才 setViews
    setLoading: (loading: boolean) => void
    onError: (error: unknown) => void                  // 呼叫端負責跳提示
  }
  runTableLoad(tableId: number, opts: { force?: boolean }, deps: RunTableLoadDeps): Promise<'cache-hit' | 'cache-miss'>
  ```
  - 有快取且非 `force`：`applyFull(cached)` → 回傳的 Promise 等背景 `load` 完成才 resolve。結果若 `isCurrent()` 為真就 `applyRefresh(fresh, !sameViews(cached.views, fresh.views))`。`sameViews` 比較 `JSON.stringify(views)`。過程中不呼叫 `setLoading`。
  - 有快取且 `force`：跳過 `applyFull`，直接背景 `load`，成功後 `applyRefresh`，同樣不設 loading。
  - 沒有快取：`setLoading(true)` → `load` → 若 `isCurrent()` 為真則 `applyFull` → `finally` 中若 `isCurrent()` 為真則 `setLoading(false)`。
  - 錯誤：`isCurrent()` 為假就忽略。`TableLoadError` 的 status 是 403 或 404 時先 `cache.invalidate(tableId)` 再 `onError`。其他錯誤在有快取時只 `console.warn`，沒有快取時 `onError`。

- [ ] **Step 1: 寫失敗測試**（用假的 `cache` 物件與 `jest.fn()` 依賴）：
  - `cache hit applies immediately without loading`：`applyFull` 收到 cached；`setLoading` 從未被呼叫；回傳 `'cache-hit'`
  - `cache hit refreshes in background`：`applyRefresh` 收到 fresh，views 相同時 `viewsChanged === false`，不同時為 `true`
  - `cache miss toggles loading`：`setLoading` 依序收到 `true`、`false`；`applyFull` 收到 fresh
  - `discards result when no longer current`：load resolve 前 `isCurrent` 改回傳 false → `applyFull`／`applyRefresh` 都沒被呼叫，`setLoading(false)` 也沒被呼叫
  - `keeps cached data on background failure`：有快取、load reject 500 → `onError` 沒被呼叫，`applyFull` 只被呼叫一次
  - `invalidates and reports on 403/404`：有快取、load reject `TableLoadError(403)` → `cache.invalidate(tableId)` 與 `onError` 都被呼叫
  - `cache miss failure reports error`：load reject → `onError` 被呼叫，`setLoading` 最後為 `false`
  - `force skips applyFull`：有快取加上 `{ force: true }` → `applyFull` 沒被呼叫，`applyRefresh` 被呼叫，`setLoading` 沒被呼叫
- [ ] **Step 2:** `npx jest src/modules/database/cache/__tests__/runTableLoad.test.ts`，預期 FAIL。
- [ ] **Step 3:** 實作。
- [ ] **Step 4:** 同一指令，預期 PASS。
- [ ] **Step 5:** commit：`feat(cache): 新增 stale-while-revalidate 載入流程`。

### Task 4: 接進 `page.tsx`、即時同步與登出

**Files:**
- Modify: `src/app/page.tsx`（`fetchTableData` 約 348–386 行；切表 effect 約 450–470 行；刪除資料表的兩處 `fetch(\`/api/tables/${tableId}\`, { method: 'DELETE' })` 約 1144、1195 行；`onRefreshRows` 約 1330 行）
- Modify: `src/modules/database/hooks/useRealtimeSync.ts`（重新連線、`fields-reordered`、`rows-batch-changed` 三處，以及參數型別）
- Modify: `src/modules/database/hooks/useFieldOperations.ts`（參數型別；欄位新增或刪除後的重抓呼叫）
- Modify: `src/modules/database/store/useAuthStore.ts`（`logout`）
- Test: `src/modules/database/store/__tests__/useAuthStore.test.ts`（沒有就建立，`@jest-environment jsdom`）

**Interfaces:**
- Consumes: `tableDataCache`（Task 2）、`runTableLoad`（Task 3）
- Produces: `fetchTableData(tableId: number, opts?: { force?: boolean }): Promise<void>`，`useRealtimeSync` 與 `useFieldOperations` 的參數型別跟著改。

- [ ] **Step 1: 寫失敗測試** `logout clears table data cache`：先 `tableDataCache.set(1, …)`，mock `authService.logout`，`renderHook(useAuthStore)` 後呼叫 `logout()` → `tableDataCache.get(1)` 為 undefined。
- [ ] **Step 2:** 跑測試，預期 FAIL。
- [ ] **Step 3:** `logout` 在 `authService.logout()` 之後呼叫 `tableDataCache.clear()`。跑測試，預期 PASS。
- [ ] **Step 4: 改 `fetchTableData`**：保留 `tableFetchRequestId`，改成呼叫 `runTableLoad`。
  - `applyFull`：沿用原本的 `setFields`、`mergeServerRows`、views 分支（含 `activeViewId_${tableId}` 和 `resetViewState`）。
  - `applyRefresh`：`setFields`、`mergeServerRows`；`viewsChanged` 時只 `setViews`。
  - `onError` 沿用原本的 `loadTableFailed` 提示。
  - 開發模式下用 `performance.mark('table-switch:start:<id>')` 和 `performance.measure('table-switch:<id>:<cache-hit|cache-miss>', …)`，然後 `console.debug` 輸出 duration。
- [ ] **Step 5: 改切表 effect**：
  - (a) 每次 render 用 effect 把 `{ tableId, fields, rows, views }` 存進 `snapshotRef`。
  - (b) `activeTableId` 改變時，先把 `snapshotRef.current` 寫回快取：只在前一張表存在且快取裡有它時才寫；`fetchedAt` 沿用原值；rows 排除 `operations` 中屬於該表、狀態為 `staged` 且類型為 `move` 的 `rowIds`。
  - (c) 只有在 `tableDataCache.get(新表)` 不存在時，才執行原本的 `setGridLoading(true)`、`setFields([])`、`setRows([])`。
- [ ] **Step 6:** 兩處刪除資料表成功後呼叫 `tableDataCache.invalidate(tableId)`。即時同步的三處、欄位新增或刪除後的重抓、`onRefreshRows`，都改成傳 `{ force: true }`。
- [ ] **Step 7:** 若 `useTableOperations` 既有測試沒有涵蓋「`mergeServerRows` 保留 pending 更新」，補上 `mergeServerRows keeps pending update over server value`（Review Focus 相關）。
- [ ] **Step 8:** `npm run typecheck && npx jest src/modules/database`，預期通過。
- [ ] **Step 9: 瀏覽器驗證**：`preview_start`。
  - 開 T → 切到 U → 切回 T：確認沒有骨架閃一下，console 出現 `cache-hit`。
  - 在 T 改一格 → 切走再切回：值還在。
  - 登出再登入：第一次開表出現骨架（快取已清空）。
  - 結束後 `preview_stop`。
- [ ] **Step 10:** `npm run verify` 通過後 commit：`feat(table): 切換資料表改用快取，切回立即顯示並背景更新`。

### Task 5: hover／觸控預載

**Files:**
- Create: `src/modules/database/cache/useHoverPrefetch.ts`、`src/modules/database/cache/__tests__/useHoverPrefetch.test.tsx`
- Modify: `src/modules/database/components/sidebar/Sidebar.tsx`（Props 介面約 87 行；資料表項目 `SidebarMenuSubButton` 約 598 行）、`src/modules/database/components/dashboard/WorkspaceDashboard.tsx`（Props 約 29 行；`styles.tableOpen` 按鈕約 319 行）、`src/app/page.tsx`（三處 `<Sidebar`（約 1097、1267、1287 行，若後兩處是 `MobileBottomNav` 則不需要）與 `<WorkspaceDashboard` 傳入 `onTablePrefetch={tableDataCache.prefetch}`）
- Test: `src/modules/database/components/sidebar/__tests__/Sidebar.test.tsx`、`dashboard/__tests__/WorkspaceDashboard.test.tsx` 各加一案

**Interfaces:**
- Produces: `useHoverPrefetch(onPrefetch?: (tableId: number) => void): (tableId: number) => { onPointerEnter: PointerEventHandler; onPointerLeave: PointerEventHandler; onPointerDown: PointerEventHandler }`
  - `pointerType === 'mouse'` 時，enter 後過 120ms 才呼叫；120ms 內 leave 就取消。
  - `pointerdown` 且 `pointerType !== 'mouse'` 時立即呼叫。
  - unmount 時清除計時器；`onPrefetch` 為 undefined 時回傳的 handler 不做事。
- Produces: `Sidebar` 與 `WorkspaceDashboard` 的 Props 新增 `onTablePrefetch?: (tableId: number) => void`。

- [ ] **Step 1: 寫失敗測試** `useHoverPrefetch.test.tsx`（jsdom、fake timers，用一個測試元件把 handler 掛到 `<button>`，以 `fireEvent.pointerEnter(el, { pointerType: 'mouse' })` 觸發）：
  - `fires after 120ms hover`：前進 119ms 未呼叫，前進到 120ms 呼叫一次，參數是 tableId
  - `cancels when leaving early`：enter → 前進 100ms → leave → 再前進 100ms，未呼叫
  - `fires immediately on touch pointerdown`：`pointerType: 'touch'` 立即呼叫
  - `ignores mouse pointerdown`
- [ ] **Step 2:** 跑測試，預期 FAIL。
- [ ] **Step 3:** 實作 hook。
- [ ] **Step 4:** 跑測試，預期 PASS。
- [ ] **Step 5: 元件測試**：Sidebar `prefetches table on hover`、Dashboard `prefetches table on hover`。fireEvent 加計時器前進 120ms 後，`onTablePrefetch` 收到該表 id。跑測試，預期 FAIL。
- [ ] **Step 6:** 接上 Sidebar、Dashboard 與 `page.tsx`。跑測試，預期 PASS。
- [ ] **Step 7:** `npm run verify` 通過後 commit：`feat(sidebar): hover 或觸控資料表時預先載入`。

### Task 6: 閒置預載最近開過的表

**Files:**
- Create: `src/modules/database/cache/recentTables.ts`、`src/modules/database/cache/useIdlePrefetch.ts`、`src/modules/database/cache/__tests__/recentTables.test.ts`、`src/modules/database/cache/__tests__/useIdlePrefetch.test.tsx`
- Modify: `src/app/page.tsx`（`activeTableId` 有值時呼叫 `pushRecentTable`；在頂層呼叫 `useIdlePrefetch`）

**Interfaces:**
- Produces: `getRecentTables(workspaceId: number): number[]`、`pushRecentTable(workspaceId: number, tableId: number): void`（移到最前、去重、最多 5 筆）
- Produces: `useIdlePrefetch(params: { workspaceId: number | null; activeTableId: number | null; validTableIds: number[]; prefetch: (tableId: number) => void }): void`
  - `workspaceId` 改變時排程：取 `getRecentTables` 中屬於 `validTableIds`、且不是 `activeTableId` 的前 3 張。
  - 每次閒置回呼預載一張，然後再排下一次（一次一張）。
  - 有 `requestIdleCallback` 就用，否則 `setTimeout(…, 1500)`。
  - `navigator.connection?.saveData` 為真，或 `effectiveType` 是 `2g`／`slow-2g` 時整個不做。
  - unmount 或 `workspaceId` 改變時取消排程。
- `validTableIds` 由 page 從目前工作區的 databases 攤平取得（避免預載已刪除或其他工作區的表）。

- [ ] **Step 1: 寫失敗測試** `recentTables.test.ts`（jsdom）：
  - `push moves to front and dedupes`：push 1、2、1 → `[1, 2]`
  - `caps at 5`：push 1..6 → `[6, 5, 4, 3, 2]`
  - `scoped by workspace`：工作區 1 的清單不影響工作區 2
  - `returns [] when storage throws`：`jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error() })` → `[]`；同樣 mock `setItem` 拋錯時 `push` 不拋錯
  - `returns [] on malformed JSON`
- [ ] **Step 2:** 跑測試，預期 FAIL → 實作 → 跑測試，預期 PASS。
- [ ] **Step 3: 寫失敗測試** `useIdlePrefetch.test.tsx`（fake timers；刪掉 `window.requestIdleCallback` 以走 setTimeout 路徑）：
  - `prefetches up to 3 recent tables excluding active, one per idle tick`：最近清單 `[5, 4, 3, 2, 1]`，active=4，valid 全部 → 依序預載 5、3、2，每 1500ms 一張，不會出現 1
  - `skips tables not in validTableIds`
  - `disabled when saveData`：用 `Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })` → 從未呼叫
  - `cancels on unmount`：unmount 後前進計時器，不再呼叫
- [ ] **Step 4:** 跑測試，預期 FAIL → 實作 → 跑測試，預期 PASS。
- [ ] **Step 5:** 接進 `page.tsx`。`npm run verify` 通過後 commit：`feat(cache): 閒置時預載最近開過的資料表`。

### Task 7: 改動後量測與收尾

**Files:**
- Modify: `docs/audits/2026-10-19-table-loading-baseline.md`、`PROGRESS.md`、`.claude/rules/frontend.md`（只在過程中修了 bug 時才加錯誤紀錄）

- [ ] **Step 1:** `preview_start`，用 Task 1 Step 8 的同一套腳本與選擇器重量三個情境，各 3 次取中位數。另外記錄 (d)：進入工作區後等 3 秒，再點最近開過的表。
- [ ] **Step 2: 填寫報告**：
  - 「改動後」欄。
  - 檢查成功條件：(b) 在 100ms 內，(c) 比改動前短。沒達成就照實寫，並寫明原因與建議。
  - 依 Server-Timing 分段建議伺服器端下一步（例如 `populate` 占大宗時要優化哪段），只寫建議不實作。
  - 用 `performance.memory`（Chromium）記錄開過 8 張表後的 JS heap 大小。超過 150MB 時建議把 LRU 上限調成 5（spec 風險段）。
- [ ] **Step 3:** `preview_stop`。更新 `PROGRESS.md`：子專案 1 完成，下一步是子專案 2「載入體驗」的 brainstorming。
- [ ] **Step 4:** 以 model `opus` 呼叫 `reviewer` 子代理，比較基準 `main`。處理回饋時照 `superpowers:receiving-code-review`。
- [ ] **Step 5:** `npm run verify` 通過後 commit：`docs: 資料表載入改動後量測與進度更新`。
