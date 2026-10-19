# 資料表載入基準量測

日期：2026-10-20
對應 spec：`docs/superpowers/specs/2026-10-19-table-data-loading-design.md`

## 環境

- 本機 `next dev --webpack`（worktree `feat/table-data-cache`，port 3100），連到 `.env.local` 的 TiDB serverless。
- 內建瀏覽器（Chromium），已登入。
- 量測表 T：「成全名單」（id 510004，37 筆，含需要填充的關聯欄位）。對照表 U：「成全任務表」（id 510006，9 筆）。
- **資料量與 spec 假設不同**：這個資料庫各表最多只有 46 筆，不是數千筆。數千筆的情境要在正式資料上另外量。

## 量法

在頁面上執行腳本：記下 `t0 = performance.now()`，對側欄 `a[data-sidebar="menu-sub-button"]` 中文字等於表名的連結呼叫 `.click()`，再用 `requestAnimationFrame` 輪詢，直到同時符合兩個條件：

- 頁面上沒有任何 `.fycd-skeleton`
- `.grid-view` 的 `innerText` 包含該表第一列的值（T 是「陳希」，U 是「邀約初一十五獻供吃晚餐/求道」）

符合時記下 `t1 - t0`。API 分段取自 `performance.getEntriesByType('resource')` 的 `duration` 與 `serverTiming`。

> 數字只在瀏覽器面板可見時有效。面板隱藏時頁面會被節流，同一個情境量到約 5 秒，不採用。

## 結果（點擊到資料顯示，ms）

| 情境 | 改動前（3 次） | 改動前中位數 | 改動後中位數 |
|---|---|---|---|
| (a) 首次開 T | 與 (b) 走相同路徑（沒有快取） | ≈ 981 | |
| (b) 切到 U 再切回 T | 996、981、784 | 981 | |
| (c) hover 500ms 後點擊 T | 1142、1068、1075 | 1075 | |
| (d) 進入工作區 3 秒後點最近開過的表 | 不適用（尚無預載） | ≈ 981 | |

(c) 比 (b) 慢約 100ms，在誤差範圍內：改動前 hover 不會觸發任何載入。

## API 分段（切回 T 一次的樣本，ms）

| 請求 | 瀏覽器耗時 | Server-Timing |
|---|---|---|
| `GET /api/tables/510004/fields` | 276 | handler=48 |
| `GET /api/tables/510004/rows` | 499 | auth=146、query=90、populate=170、total=406 |
| `GET /api/tables/510004/views` | 324 | handler=81 |

各表 rows 端點單獨請求（`pageSize=1`）的 Server-Timing：`auth` 穩定約 **127–144ms**，`query` 約 125–215ms。有關聯欄位的表（id 5、510004、510014）`populate` 為 85–185ms，其他表接近 0。

## 發現

1. **每次切表，三支 API 都被請求兩次**：同一次點擊出現兩組 fields／rows／views 請求。切表 effect 和其他呼叫點重複觸發了 `fetchTableData`，等於整整多一倍的伺服器負載。Task 4 改寫 `fetchTableData` 時應一併確認原因。
2. **授權每次約 130ms**，三支並行請求各付一次，是 fields／views 耗時的大宗：handler 只有 50–80ms，瀏覽器卻量到 276–466ms。
3. **`populate` 在有關聯欄位的表上占 rows 的 40% 左右**（170 / 406ms）。

## 建議（改動後量測完成時更新）

（Task 7 填寫）
