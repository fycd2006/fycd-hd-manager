# 資料表載入基準量測

日期：2026-10-20
對應 spec：`docs/superpowers/specs/2026-10-19-table-data-loading-design.md`

## 環境

- 本機，worktree `feat/table-data-cache`（port 3100），連到 `.env.local` 的 TiDB serverless。
- 內建瀏覽器（Chromium），已登入，面板可見。
- 兩種伺服器：
  - `next dev --webpack`
  - production：`npm run build:check` 只編譯、不 db push，再 `next start`
- 改動前：commit `64ba1d9`（已有 Server-Timing、沒有快取）。改動後：commit `982567b`。
- 量測表 T：「成全名單」（id 510004，37 筆，有需要填充的關聯欄位）。對照表 U：「成全任務表」（id 510006，9 筆）。
- **資料量與 spec 假設不同**：這個資料庫各表最多只有 46 筆，不是數千筆。數千筆的情境要在正式資料上另外量。

## 量法

在頁面上執行腳本：

1. 記下 `t0 = performance.now()`。
2. 對側欄 `a[data-sidebar="menu-sub-button"]` 中文字等於表名的連結呼叫 `.click()`。
3. 用 `requestAnimationFrame` 輪詢，直到頁面上沒有任何 `.fycd-skeleton`，且 `.grid-view` 的 `innerText` 包含該表第一列的值（T 是「陳希」）。
4. 記下 `t1 - t0`。

各情境的做法：

- (a) 先把 `activeTableId` 設成 U、清掉 `recentTables_1`，再重新整理頁面，讓記憶體裡沒有快取，然後點 T。
- (c) 依序送 `pointerover`／`pointerenter`（`pointerType: 'mouse'`），停 500ms 後點擊。
- (d) 把 `recentTables_1` 設成 `[510004, 510006]` 後重新整理，等 3 秒再點 T。

每個情境量 3 次，取中位數。

> 數字只在瀏覽器面板可見時有效。面板隱藏時頁面會被節流，同一個情境量到約 5 秒，不採用。

## 結果：點擊到資料顯示（ms，中位數）

| 情境 | 改動前 dev | 改動前 production | 改動後 dev | 改動後 production |
|---|---|---|---|---|
| (a) 首次開 T | ≈ 981（與 b 同路徑） | ≈ 589（與 b 同路徑） | 777（715、1235、777） | **502**（502、611、499） |
| (b) 切到 U 再切回 T | 981（996、981、784） | 589（589、601、574） | 244（224、244、348） | **103**（114、103、101） |
| (c) hover 500ms 後點擊 | 1075（1142、1068、1075） | 577（625、577、525） | 329（324、329、339，表各不同） | **85**（85、78、116，表各不同） |
| (d) 進入工作區 3 秒後點最近開過的表 | 不適用 | ≈ 589 | — | **98**（82、100、98） |

每次切表送出的請求數：改動前是 **6 個**（fields、rows、views 各兩次），改動後是 **3 個**。

## 成功條件

| 條件 | 結果 |
|---|---|
| 切回 30 秒內看過的表，資料在 100ms 內出現、不顯示骨架 | **大致達成**。production 中位數 103ms，略高於 100ms。dev 模式為 244ms。全程沒有出現骨架。資料在點擊當下同步寫入（console 的 `cache-hit` 為 0ms），剩下的時間是 React 渲染與一段 160ms 的容器轉場動畫。 |
| hover 過才點擊，等待時間比現況短 | **達成**。production 從 577ms 降到 85ms，dev 從 1075ms 降到 329ms。 |

## API 分段（改動前 dev，切回 T 一次的樣本，ms）

| 請求 | 瀏覽器耗時 | Server-Timing |
|---|---|---|
| `GET /api/tables/510004/fields` | 276 | handler=48 |
| `GET /api/tables/510004/rows` | 499 | auth=146、query=90、populate=170、total=406 |
| `GET /api/tables/510004/views` | 324 | handler=81 |

各表 rows 端點單獨請求（`pageSize=1`）的 Server-Timing：`auth` 穩定約 **127–144ms**，`query` 約 125–215ms。有關聯欄位的表（id 5、510004、510014）`populate` 為 85–185ms，其他表接近 0。

記憶體：開過 9 張表之後，JS heap 約 45MB，遠低於 spec 風險段的 150MB 門檻，LRU 上限維持 8。

## 發現

1. **改動前，每次切表三支 API 都被請求兩次**。切表時 `CLEAR_TABLE_OPERATIONS` 換掉了 `operations` 的參照，連帶 `mergeServerRows`、`fetchTableData` 也換成新的參照，切表 effect 因此又跑一次。改動後用 `switchedTableIdRef` 限制 effect 只在 id 實際改變時執行，請求數減半，首次開表在 production 也從約 589ms 降到 502ms。
2. **授權每次約 130ms**，三支並行請求各付一次，是 fields／views 耗時的大宗：handler 只有 50–80ms，瀏覽器卻量到 276–466ms。
3. **`populate` 在有關聯欄位的表上，占 rows 總時間的 40% 左右**（170 / 406ms）。
4. **命中快取後還剩約 100ms**（production），全部花在前端：React 重新渲染整個 `page.tsx`，加上主內容容器 160ms 的轉場動畫。

## 建議

1. **伺服器端（另開任務）**：先處理授權。三支 GET 各自做一次約 130ms 的授權查詢，把 session 與工作區角色的查詢結果在單一請求內共用，或短時間快取在 Redis，可省下首次開表的大部分等待。其次是 `populate`：只有有關聯欄位的表受影響，可以考慮批次查詢關聯目標。
2. **前端渲染與轉場**：命中快取後剩下的 100ms，交給子專案 2（載入體驗）和子專案 3（動畫系統），包括切表時的容器動畫長度，以及是否能縮小重新渲染的範圍。
3. **大表**：在數千筆的正式資料上重量 (a) 與 (b)，確認快取的記憶體用量與背景合併的成本。
