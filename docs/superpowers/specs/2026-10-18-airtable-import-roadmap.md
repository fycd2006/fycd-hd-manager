# Airtable 完整匯入：總覽與拆分

日期：2026-10-18

## 目標

讓「公開共享連結」「Personal Access Token」「貼上 JSON」三種方式都能完整匯入一個 Airtable Base（數千筆以內，一次請求同步完成）：
所有資料列、link_row 雙向關聯、lookup／rollup、公式、欄位格式設定、視圖。平台缺的功能先補齊，匯入時直接對應，不退回成靜態值。

## 範圍外

- 圖片：gallery 視圖的封面圖、附件圖片預覽、附件轉存。一律在匯入結果標示「不支援」，附件只保留 Airtable 原網址（會過期）。
- 合併到既有資料表：匯入一律建立新資料庫。

## 已確認的決定

- 匯入失敗時刪除本次建立的資料庫與其下所有資料，不留半成品。
- 三種來源統一成同一個中間格式，由 `services/airtableImport.ts` 分階段寫入（表與欄位 → link_row → lookup／rollup／公式 → 資料列 → 回填關聯 → 重算 → 視圖）。
- 欄位以 Airtable 欄位 id 對應，不以名稱對應；同表重名欄位自動加「(2)」。
- 公式盡量轉換；仍無法轉換者退回靜態欄位並在匯入結果列出原始公式。

## 現況缺口（2026-10-18 盤點）

- PAT 匯入只抓結構（meta API），沒有抓 records → 空表。
- link_row 被轉成逗號字串，options 沒有 `targetTableId`／`relatedFieldId`。
- lookup／rollup 沿用 Airtable options，沒對應到 `relationFieldId`／`targetFieldId`／`rollupFunction`。
- 共享連結沒處理分頁；欄位以名稱對應；逐列 `create`、沒有失敗清理；視圖沒匯入。
- 平台：rollup UI 送 `avg` 但後端判斷 `average`，min／max／concat 未實作；日期欄位沒有含時間／格式／時區設定；公式引擎缺 Airtable 常用函式。

## 子專案（依序，每個各自 spec → 計畫 → 實作）

1. **rollup 修正與補齊**：修 `avg`／`average` 不一致（`/bugfix`），補 min、max、concat 等函式。
2. **日期欄位補強**：含時間、日期格式、時區（`/new-field-type` 檢查清單）。
3. **視圖補強**：多重排序、OR 篩選群組、缺少的篩選運算子（先盤點現況）。
4. **公式引擎補強**：補 Airtable 常用函式（DATETIME_FORMAT、DATEADD、SWITCH、ARRAYJOIN 等），供轉換器使用。
5. **Airtable 匯入核心**：三種來源完整抓取（含分頁、視圖）、轉換器、`services/airtableImport.ts`、匯入結果報告與視窗顯示。
