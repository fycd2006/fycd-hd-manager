# 資料表載入效能（子專案 1／3）設計

日期：2026-10-19
狀態：待審閱

## 背景

使用者要求全站載入速度、載入體驗與轉場動畫一併最佳化，拆成三個子專案依序進行：

1. **資料載入效能**（本文件）
2. 載入體驗：統一骨架、避免版面位移、錯誤與重試狀態
3. 全站動畫系統：duration／easing token、單一動畫來源、轉場銜接、`prefers-reduced-motion`

子專案 2、3 各自另寫 spec。

### 現況

- 主介面集中在 `src/app/page.tsx`。切換資料表時 `fetchTableData` 以 `Promise.all` 同時抓 fields、**全部** rows、views，期間顯示骨架。
- 前端沒有任何快取，切回看過的表也要整趟重抓；rows GET 回應是 `no-store`。
- 最大的資料表約有數千筆資料列。
- 即時同步（`useRealtimeSync`）只訂閱目前開著的那張表的 Pusher 頻道。
- `mergeServerRows`（`useTableOperations.ts`）合併伺服器資料時，會保留 `pending` 狀態的更新與 `staged` 的搬移。

## 目標與成功條件

- 切回 30 秒內看過的資料表：資料在 100ms 內出現，不顯示骨架。
- 滑鼠停留過才點擊的資料表：「點擊到資料顯示」的時間比現況短，用實測數字佐證（改動前後各量一次）。
- 不裝新套件、不改 API 回應格式、不改即時同步的行為。

## 不在範圍內

- 伺服器端查詢優化（本次只做量測，再依數據另開任務）
- 伺服器端分頁、虛擬捲動調整
- 工作區列表、Dashboard、總表（master view）的載入
- 骨架與動畫的樣式（屬於子專案 2、3）

## 設計

### 1. 快取模組 `src/modules/database/cache/tableDataCache.ts`

純 TypeScript 模組，不依賴 React，可單獨測試。

```ts
interface TableDataEntry {
  fields: TableField[]
  rows: TableRow[]
  views: TableView[]
  fetchedAt: number // Date.now()
}

get(tableId): TableDataEntry | undefined   // 讀取時同時更新 LRU 順序
set(tableId, entry): void
invalidate(tableId): void
clear(): void
load(tableId): Promise<TableDataEntry>      // 抓三支 API 後 set；同一 tableId 進行中的請求共用同一個 Promise
prefetch(tableId): void                     // 見第 3 節的限制；失敗靜默略過
```

- LRU 上限 8 張表，超過時淘汰最久沒用的那張。
- `load` 用模組內的 `fetchJsonStrict` 抓同樣的三個 URL，`res.ok` 為假時拋 `TableLoadError`（帶 `status`）。既有的三個 service 失敗時會回傳 `[]` 而不拋錯，直接沿用會把失敗存成空表。
- 模組層級單例。`clear()` 的同時，也讓進行中的請求結果不會寫進快取（用世代計數器判斷）。

### 2. `fetchTableData` 新流程（`src/app/page.tsx`）

只改這個函式，其他呼叫點（共 12 處）不動。

1. 取得新的 `currentRequestId`，沿用現有的 `tableFetchRequestId` 防競態機制。
2. **有快取**：
   - 立即依序 `setFields`、`mergeServerRows(entry.rows)`，再套用視圖，邏輯與現有的 views 分支相同（含 `activeViewId_${tableId}`）。
   - 不呼叫 `setGridLoading(true)`。
   - 背景呼叫 `tableDataCache.load(tableId)`。回來時如果 `currentRequestId` 已經不是最新就丟棄；否則 `setFields` 和 `mergeServerRows`。views 只在背景結果和快取不同時才更新，不重新套用視圖設定，避免覆蓋使用者剛調整的排序或篩選。
   - 背景重抓失敗不跳錯誤提示，畫面保留快取資料，只在 console 留警告。
3. **沒有快取**：維持現行行為（顯示骨架、抓完寫入、失敗跳提示），只是改經由 `tableDataCache.load`，所以結果會順便存進快取。
4. 需要強制重抓的呼叫點（即時同步的 `fields-reordered`、`rows-batch-changed`、重新連線，以及欄位新增或刪除後）呼叫 `fetchTableData(tableId, { force: true })`：跳過快取直接抓，但仍不顯示骨架，因為畫面上已經有資料。

### 3. 快取一致性

| 情境 | 處理 |
|---|---|
| 自己在目前這張表編輯 | 離開該表（`activeTableId` 改變）時，把當下的 fields、rows、views 寫回快取，`fetchedAt` 不變 |
| 別人修改了不是目前開著的表 | 切回時一律背景重抓並合併 |
| 刪除資料表 | `invalidate(tableId)` |
| 登出、切換帳號 | `useAuthStore.logout` 之後呼叫 `clear()` |
| 切換工作區 | 不清空；不同工作區的 tableId 不會重複，只受 LRU 上限約束 |

寫回快取時排除 `staged` 搬移中的列，以 `mergeServerRows` 合併後的 rows 為準，避免把暫時狀態存進快取。

### 4. 預先載入

觸發條件（都只寫進快取，不改目前畫面）：

1. **Hover**：側欄的資料表項目、Dashboard 的資料表預覽列，停留 120ms 呼叫 `prefetch`，離開就取消計時。`Sidebar` 新增選填 prop `onTablePrefetch?: (tableId: number) => void`，Dashboard 元件同樣處理。
2. **觸控**：在 `pointerdown` 且 `pointerType !== 'mouse'` 時立即 `prefetch`。
3. **閒置**：進入工作區後，用 `requestIdleCallback` 依序預載「該工作區最近開過的 3 張表」（不含目前這張），一次一張。最近開過的清單存在 localStorage 的 `recentTables_${workspaceId}`（最多 5 筆），讀寫都包 try/catch。不支援 `requestIdleCallback` 時退回 `setTimeout(…, 1500)`。

限制：

- 快取 `fetchedAt` 在 30 秒內就跳過。
- 預載同時最多 2 個請求；`load`（真正切表）不受這個限制。
- `navigator.connection?.saveData` 為真，或 `effectiveType` 是 `2g`／`slow-2g` 時，閒置預載整個停用，hover 預載仍保留。

### 5. 量測

- **伺服器**：rows、fields、views 三支 GET 回應加上 `Server-Timing` 標頭。rows 分 `auth`、`query`、`populate`、`total`（`getPopulatedTableRows` 內部回傳各段耗時，或在路由層分段計時）；fields、views 經過 `withApiHandler`，handler 量不到授權時間，只送 `handler`。只加標頭，不改回應內容。
- **前端**：`fetchTableData` 用 `performance.mark` 和 `performance.measure` 記錄 `table-switch:<tableId>`，標註命中快取或未命中；只在 `process.env.NODE_ENV === 'development'` 時輸出到 console。
- **報告**：實作完成後，在瀏覽器量同一張數千筆的表的三種情境：首次開啟、切回、hover 後點擊。數據連同 Server-Timing 分段寫進 `docs/audits/2026-10-19-table-loading-baseline.md`，改動前後各量一次。依結果建議下一步要不要做伺服器端優化。

## 測試

- `tableDataCache` 單元測試：LRU 淘汰順序、`get` 更新順序、同表請求共用 Promise、`invalidate`／`clear`、`clear` 後進行中的請求不寫入、30 秒內不重複預載、預載並行上限 2、預載失敗不拋錯。
- `fetchTableData` 行為（抽出成可測試的函式或 hook）：有快取時不設 loading 並觸發背景重抓；背景結果在切走後被丟棄；背景重抓不覆蓋 pending 編輯；未命中時維持原行為；`force` 跳過快取。
- `Sidebar`：hover 120ms 觸發 `onTablePrefetch`，少於 120ms 移開不觸發；觸控 `pointerdown` 立即觸發。
- 登出後快取被清空。
- rows GET 路由測試：回應帶有 `Server-Timing` 標頭。
- 全部通過 `npm run verify`，並在瀏覽器實測、附上數據。

## 風險

- **記憶體**：8 張表 × 數千筆可能占用數十 MB。如果實測過高，把上限調成 5。
- **資料過時**：快取資料顯示到背景重抓完成前，最多舊幾百毫秒；別人的修改在背景重抓回來後才會出現。這是 stale-while-revalidate 的既定取捨。
- **`page.tsx` 很大**：只動 `fetchTableData` 和離開表時寫回快取的 effect，不順手重構其他部分。
