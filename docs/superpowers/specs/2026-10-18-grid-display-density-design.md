# 表格視圖顯示與密度（字級、列高、換行、視覺一致）

日期：2026-10-18｜分支：`feat/grid-display-density`｜屬「grid view 編輯體驗優化」子專案 A（共 A 顯示與密度、B 操作手感、C 試算表級功能、D 儲存回饋、E 手機觸控，各自獨立 spec）

## 目標

解決四個顯示痛點：字太小不好讀、內容被截斷看不全、顯示設定不會記住、視覺不一致／擁擠。

成功條件：

- 使用者可在三段字級間切換，重新整理後保留（個人、瀏覽器端）。
- 列高依視圖保存到資料庫，切換視圖帶入各自設定，重新整理後保留。
- 列高 > 小時，文字型儲存格依可用高度換行，超出顯示「…」；不會出現被切半的文字行。
- 儲存格、表頭、列號、選項標籤的字級來自同一組 CSS 變數；列高與表頭高度預設值只有一處定義。
- 數字類欄位靠右、使用 `tabular-nums`。
- `npm run verify` 通過。

## 不在範圍

- 編輯器（`*CellEditor`、inline input）的互動行為；只讓其字級跟隨變數。
- 逐欄設定換行、自訂任意字級數值、深色模式配色。
- `MasterGridView`（跨表總表）、kanban／gallery 視圖。
- 子專案 B–E 的任何內容。

## 1. 行為規格

### 列高（依視圖，團隊共用）

| 值 | 名稱 | 高度 |
|---|---|---|
| `small` | 小 | 32px |
| `medium` | 中 | 56px |
| `large` | 大 | 88px |
| `extra` | 特大 | 128px |

參照 Airtable 的 Short／Medium／Tall／Extra tall。舊視圖（欄位為 null）視為 `small`。

### 字級（個人，localStorage）

| 值 | 名稱 | 內容字級 | 次要字級（列號、標籤、提示） | 表頭字級 |
|---|---|---|---|---|
| `standard` | 標準 | 13px | 11px | 12px |
| `large` | 大 | 15px | 13px | 14px |
| `xlarge` | 特大 | 17px | 14px | 15px |

- localStorage key：`fycd.grid.fontScale`，所有表格共用；讀寫失敗或值不合法時用 `standard`。
- 行高固定為內容字級 × 1.5（四捨五入到整數 px）。
- 有效列高下限：`有效列高 = max(列高, 行高 + 8)`，確保字級放大後單行不被切。
- 表頭高度：`max(36, 表頭字級 × 1.5 + 14)`。

### 換行

- 可顯示行數 `lineClamp = max(1, floor((有效列高 − 8) ÷ 行高))`（上下內距各 4px）。
- `lineClamp = 1`：單行 + 「…」（維持現狀）。
- `lineClamp > 1`：文字型（text、long_text、email、url、phone、formula 文字結果）以 `-webkit-line-clamp` 多行截斷；儲存格內容改為頂端對齊。
- 標籤型（single／multiple select、link_row、collaborator 類）在 `lineClamp > 1` 時改為 `flex-wrap: wrap`，超出高度隱藏。
- 數字、日期、布林、評分等單值欄位不換行、垂直置中。

範例：標準（行高 20px）1／2／4／6 行；大（23px）1／2／3／5 行；特大（26px）1／1／3／4 行（依序為小／中／大／特大列高）。

### 視覺一致

- 移除 `GridViewRow`／`grid.css` 中 32／36／40px 互相矛盾的 `--row-height` 後備值，統一由外層變數提供。
- 表頭高度統一（現況 TSX 36px、CSS 44px）。
- number、currency、percent、autonumber、count 類欄位：`text-align: right` + `font-variant-numeric: tabular-nums`，不再強制 monospace。

## 2. 架構與資料流

### CSS 變數（掛在 `TableWorkspaceView` 的內容容器）

`--row-height`、`--grid-header-height`、`--grid-font-size`、`--grid-font-size-sm`、`--grid-font-size-head`、`--grid-line-height`、`--grid-line-clamp`

### 新單元

- `src/modules/database/utils/gridDisplay.ts`：純函式 `computeGridDisplay(rowHeight, fontScale)` 回傳上述所有數值與 CSS 變數物件；匯出兩個型別與合法值清單、`ROW_HEIGHTS`、`FONT_SCALES` 常數。前端與 API 白名單共用合法值清單。
- `src/modules/database/hooks/useGridFontScale.ts`：讀寫 localStorage，try/catch 包覆，回傳 `[fontScale, setFontScale]`。

### 列高持久化（沿用 columnWidths 路徑）

1. `prisma/schema.prisma` `TableView` 新增 `rowHeight String? @default("small")`（純新增欄位；部署時 `db push` 新增，不刪資料）。
2. `src/app/api/tables/[tableId]/views/route.ts`：zod 加 `rowHeight: z.enum([...]).optional()`，不合法回 400；更新時寫入；複製視圖時帶上。
3. `types/index.ts`：`TableView`／view config 型別加 `rowHeight`。
4. `useViewConfig.ts`：載入時解析（null／不合法 → `small`），提供 `rowHeight` 與 `setRowHeight`（樂觀更新 + 呼叫既有 save；失敗走既有 toast）。
5. `page.tsx` 移除 `rowHeightSize` 全域 state，`ViewToolbar`／`TableWorkspaceView` 改從 view config 取得。

### 改動的元件

- `TableWorkspaceView.tsx`：以 `computeGridDisplay` 產生變數，取代現有列高三元運算。
- `GridViewCell.tsx`：各型別顯示分支的寫死字級改用變數；文字型與標籤型套用換行規則；數字類對齊。
- `GridViewHead.tsx`、`GridViewRow.tsx`：表頭、列號、列高改讀變數。
- `GridView.tsx`：既有 `--row-height` 監聽與 virtualizer 重新量測維持；群組標題等寫死字級中與儲存格同層級者改用變數。
- `src/styles/grid.css`：字級與高度改用變數，刪除矛盾後備值。
- `ViewToolbar.tsx`：列高選單更新高度值，並新增「字級」區塊（三個選項）。
- `*CellEditor.tsx`：只改字級為變數。

## 3. 錯誤處理

- view 的 `rowHeight` 為 null 或不合法 → `small`。
- localStorage 不可用（隱私模式、封鎖）→ `standard`，不報錯、不 toast。
- 列高存檔 API 失敗 → 沿用 `useViewConfig` 既有失敗處理（toast），畫面保留樂觀值。
- API 收到不合法 `rowHeight` → 400。

## 4. 測試

- `gridDisplay`：4 列高 × 3 字級的 lineClamp、有效列高下限、表頭高度、變數物件鍵值。
- `useGridFontScale`：預設值、寫入後讀回、localStorage 拋錯時退回 `standard`、不合法值退回。
- views API：`rowHeight` 合法值寫入、不合法值 400、複製視圖帶上。
- `useViewConfig`：載入 null → `small`、載入 `large`、`setRowHeight` 呼叫 save。
- `GridViewCell`：`--grid-line-clamp` > 1 時文字型套用多行截斷、標籤型 wrap、數字類靠右。
- 既有 grid 測試全數保持通過（不刪、不弱化）。
- 瀏覽器實測：若本機有可用資料庫，於 dev server 切換 3 字級 × 4 列高截圖確認；否則以 jest 與 `npm run verify` 為準，並在回報中註明未做實測。
