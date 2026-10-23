# 表格視圖顯示與密度 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 grid view 有三段個人字級、依視圖保存的四段列高、依列高自動多行截斷，以及統一的字級／高度／數字對齊。

**Architecture:** 純函式 `computeGridDisplay(rowHeight, fontScale)` 算出一組 CSS 變數與 `multiline` 旗標，由 `TableWorkspaceView` 掛到內容容器（變數 + `grid-display--multiline` class）。儲存格顯示改用 `grid.css` 的共用 class（`grid-cell-text`、`grid-cell-tags`、`grid-cell-numeric`）讀變數，不再寫死字級與 `nowrap`。列高沿用 `columnWidths` 的儲存路徑存進 `TableView.rowHeight`；字級存 localStorage。

**Tech Stack:** Next.js 16 / React 19、Prisma 6、zod、Jest + Testing Library（jsdom）。

**Spec:** `docs/superpowers/specs/2026-10-18-grid-display-density-design.md`

## Global Constraints

- 工作目錄：worktree `C:\dev\fycd-hd-manager\.claude\worktrees\grid-display-density`，分支 `feat/grid-display-density`。不要在主 checkout 動手（那裡有別人未 commit 的 `GridViewCell.tsx` 等修改）。
- 不可執行 `npm run build`；每個 task 結束前跑該 task 的 jest，最後一個 task 跑 `npm run verify`。
- 列高值 `small | medium | large | extra` = 32／56／88／128px；null 或不合法 → `small`。
- 字級值 `standard | large | xlarge`：內容 13／15／17px、次要 11／13／14px、表頭 12／14／15px；行高 = round(內容 × 1.5)。
- localStorage key `fycd.grid.fontScale`；讀寫例外或不合法值 → `standard`，不 toast。
- 有效列高 = max(列高, 行高 + 8)；lineClamp = max(1, floor((有效列高 − 8) ÷ 行高))；表頭高 = max(36, round(表頭字級 × 1.5) + 14)。
- 數字類 = `number`、`autonumber`：靠右、`tabular-nums`，移除 monospace。
- 改 `prisma/schema.prisma` 前必須取得使用者同意（CLAUDE.md）；不可執行 `prisma db push`／`migrate`，只跑 `prisma generate`（由 `build:check`／typecheck 流程帶到）。
- 不刪、不弱化既有測試；ESLint 新錯誤不可 suppress。
- 介面文字用繁體中文：列高選項「小／中／大／特大」，字級選項「標準／大／特大」，區塊標題「字級」。

## Review Focus

1. 舊資料 `rowHeight` 為 null 的視圖、複製舊視圖 → 都應得到 `small`，複製出的視圖列高與來源相同（Task 3 測試）。
2. localStorage 存了垃圾值（如 `"huge"`）或 `getItem` 拋錯 → `standard`，畫面照常（Task 2 測試）。
3. 特大字級 + 小列高：有效列高必須被撐到 34px，不能切字（Task 1 測試 `xlarge/small`）。
4. 切換列高後 virtualizer 必須依新的 `--row-height` 重新量測，不出現列重疊（Task 4 由既有 `GridViewAutoScroll` 測試與瀏覽器實測涵蓋；`--row-height` 一律為帶 `px` 的整數字串，`getRowHeightPx` 的 `parseInt` 才讀得到）。
5. 列高 > 小時，選項／協作者標籤換行後不得撐破列高（`grid-cell-tags` 需 `overflow: hidden` + `max-height: 100%`；Task 5 測試 class 存在，瀏覽器實測確認）。

---

### Task 1: `computeGridDisplay` 純函式

**Files:**
- Create: `src/modules/database/utils/gridDisplay.ts`
- Test: `src/modules/database/utils/__tests__/gridDisplay.test.ts`

**Interfaces:**
- Produces:
  - `export const ROW_HEIGHTS = ['small','medium','large','extra'] as const; export type RowHeight = typeof ROW_HEIGHTS[number]`
  - `export const FONT_SCALES = ['standard','large','xlarge'] as const; export type FontScale = typeof FONT_SCALES[number]`
  - `export const ROW_HEIGHT_LABELS: Record<RowHeight,string>`（小／中／大／特大）、`FONT_SCALE_LABELS: Record<FontScale,string>`（標準／大／特大）
  - `export function normalizeRowHeight(v: unknown): RowHeight`、`normalizeFontScale(v: unknown): FontScale`
  - `export interface GridDisplay { rowHeightPx: number; headerHeightPx: number; fontSizePx: number; fontSizeSmPx: number; fontSizeHeadPx: number; lineHeightPx: number; lineClamp: number; multiline: boolean; cssVars: Record<string,string> }`
  - `export function computeGridDisplay(rowHeight: RowHeight, fontScale: FontScale): GridDisplay`
  - `cssVars` 鍵：`--row-height`、`--grid-header-height`、`--grid-font-size`、`--grid-font-size-sm`、`--grid-font-size-head`、`--grid-line-height`（皆為 `"<n>px"`）、`--grid-line-clamp`（純整數字串）

- [ ] **Step 1: 寫失敗測試** — `it.each` 涵蓋 4×3 組合的 `[rowHeightPx, lineClamp]`：
  - standard：small `[32,1]`、medium `[56,2]`、large `[88,4]`、extra `[128,6]`
  - large（行高 23）：`[32,1]`、`[56,2]`、`[88,3]`、`[128,5]`
  - xlarge（行高 26）：small `[34,1]`、medium `[56,1]`、large `[88,3]`、extra `[128,4]`
  - `multiline === lineClamp > 1`
  - 表頭高：standard 36、large 36、xlarge 37（round(22.5)=23 → 23+14=37）
  - `computeGridDisplay('medium','standard').cssVars` toEqual `{'--row-height':'56px','--grid-header-height':'36px','--grid-font-size':'13px','--grid-font-size-sm':'11px','--grid-font-size-head':'12px','--grid-line-height':'20px','--grid-line-clamp':'2'}`
  - `normalizeRowHeight(null|undefined|'huge'|3)` → `'small'`；`normalizeRowHeight('large')` → `'large'`；`normalizeFontScale` 同理退回 `'standard'`

- [ ] **Step 2: 確認失敗** — `npx jest src/modules/database/utils/__tests__/gridDisplay.test.ts`，預期 FAIL（module not found）。

- [ ] **Step 3: 實作 `gridDisplay.ts`**，數值照 Global Constraints；`Math.round` 算行高與表頭。

- [ ] **Step 4: 確認通過**（同上指令，PASS）。

- [ ] **Step 5: Commit** — `feat(grid): add computeGridDisplay for row height and font scale`

### Task 2: `useGridFontScale` hook

**Files:**
- Create: `src/modules/database/hooks/useGridFontScale.ts`
- Test: `src/modules/database/hooks/__tests__/useGridFontScale.test.ts`（`@jest-environment jsdom`）

**Interfaces:**
- Consumes: `FontScale`、`normalizeFontScale`（Task 1）
- Produces: `export const GRID_FONT_SCALE_KEY = 'fycd.grid.fontScale'`；`export function useGridFontScale(): [FontScale, (v: FontScale) => void]`

- [ ] **Step 1: 寫失敗測試**（`renderHook` + `act`）：
  - 無存值 → `'standard'`
  - 預存 `'large'` → `'large'`
  - 預存 `'huge'` → `'standard'`
  - `set('xlarge')` 後 state 為 `'xlarge'` 且 `localStorage.getItem(GRID_FONT_SCALE_KEY) === 'xlarge'`
  - `jest.spyOn(Storage.prototype,'getItem').mockImplementation(() => { throw new Error() })` → `'standard'` 不拋錯；`setItem` 拋錯時 `set('large')` 不拋錯且 state 仍更新為 `'large'`

- [ ] **Step 2: 確認失敗**。
- [ ] **Step 3: 實作** — `useState(() => readSafely())` 於 SSR（`typeof window === 'undefined'`）回 `standard`；setter 先 setState 再 try/catch 寫入。
- [ ] **Step 4: 確認通過**。
- [ ] **Step 5: Commit** — `feat(grid): persist per-user grid font scale in localStorage`

### Task 3: 列高依視圖持久化（需使用者同意 schema 變更）

**Files:**
- Modify: `prisma/schema.prisma`（`model TableView`，`aggregations` 之後）
- Modify: `src/app/api/tables/[tableId]/views/route.ts`（`updateViewSchema`、PATCH 解構與 `data`）
- Modify: `src/modules/database/types/index.ts`（`TableView` 約 :90、`ViewConfigPatch` 約 :104）
- Modify: `src/modules/database/hooks/useViewConfig.ts`（state、`applyViewConfig`、`handleDuplicateView` 的 `viewConfig`、reset 函式、return）
- Test: `src/app/api/tables/[tableId]/views/__tests__/route.test.ts`（擴充）
- Test: `src/modules/database/hooks/__tests__/useViewConfig.test.ts`（新建；`jest.mock` 掉 `viewService`）

**Interfaces:**
- Consumes: `ROW_HEIGHTS`、`RowHeight`、`normalizeRowHeight`（Task 1）
- Produces: `TableView.rowHeight?: string | null`；`ViewConfigPatch.rowHeight?: RowHeight`；`useViewConfig` 回傳新增 `rowHeight: RowHeight` 與 `setRowHeight(v: RowHeight): void`（設定 state 並呼叫 `saveViewConfig(activeViewId, { rowHeight: v })`；`activeViewId` 為 null 時只改 state）

- [ ] **Step 0: 停下來向使用者確認** schema 新增 `rowHeight String? @default("small")`（純新增欄位，部署 `db push` 時新增、不刪資料）。未同意不得繼續本 task。
- [ ] **Step 1: 寫失敗測試（API）**：
  - PATCH body `{ viewId: 5, rowHeight: 'large' }` → 200，`prisma.tableView.update` 的 `data` 含 `rowHeight: 'large'`
  - PATCH `{ viewId: 5, rowHeight: 'huge' }` → 400，`update` 未被呼叫
  - PATCH 未帶 `rowHeight` → `data` 不含 `rowHeight` 鍵
- [ ] **Step 2: 寫失敗測試（hook）**：
  - `applyViewConfig({..., rowHeight: null})` 後 `rowHeight === 'small'`；`rowHeight: 'extra'` → `'extra'`；`'huge'` → `'small'`
  - `setRowHeight('medium')` → `viewService.updateViewConfig` 被以 `(tableId, viewId, expect.objectContaining({ rowHeight: 'medium' }))` 呼叫
  - `handleDuplicateView` 對 `rowHeight: 'large'` 的來源視圖 → 存檔 payload 含 `rowHeight: 'large'`
- [ ] **Step 3: 確認失敗** — `npx jest "src/app/api/tables/\[tableId\]/views" src/modules/database/hooks/__tests__/useViewConfig.test.ts`。
- [ ] **Step 4: 實作** — schema 欄位；zod `rowHeight: z.enum(ROW_HEIGHTS).optional()`；PATCH 比照 `groupByField` 寫法加入 `data`；types；hook 照 Interfaces（reset 函式一併重設為 `'small'`）。
- [ ] **Step 5: 確認通過**，並跑 `npm run typecheck`（會帶出 `prisma generate` 後的型別）。
- [ ] **Step 6: Commit** — `feat(views): persist row height per view`

### Task 4: 串接 CSS 變數與工具列選單

**Files:**
- Modify: `src/app/page.tsx`（刪 :235 `rowHeightSize` state；從 `useViewConfig` 解構 `rowHeight, setRowHeight`；:1233 附近 props 改傳）
- Modify: `src/modules/database/components/views/TableWorkspaceView.tsx`（:48 prop 型別、:357 三元運算）
- Modify: `src/modules/database/components/toolbar/ViewToolbar.tsx`（:70 props、:1656 選單）
- Test: `src/modules/database/components/toolbar/__tests__/ViewToolbarDisplayMenu.test.tsx`（新建）

**Interfaces:**
- Consumes: `computeGridDisplay`、`ROW_HEIGHT_LABELS`、`FONT_SCALE_LABELS`、`FONT_SCALES`、`ROW_HEIGHTS`（Task 1）；`useGridFontScale`（Task 2）；`rowHeight`／`setRowHeight`（Task 3）
- Produces: prop 名稱改為 `rowHeight: RowHeight` / `setRowHeight`，新增 `fontScale: FontScale` / `setFontScale`（`ViewToolbar` 與 `TableWorkspaceView` 都用這四個名字）。內容容器帶 `display.cssVars` 並在 `display.multiline` 時加 class `grid-display--multiline`。

- [ ] **Step 1: 寫失敗測試** — render `ViewToolbar`（最小必要 props，其餘 `jest.fn()`），點「列高」按鈕開選單：
  - 看得到「小」「中」「大」「特大」與區塊標題「字級」及「標準」「大」「特大」
  - 點列高「大」→ `setRowHeight` 以 `'large'` 呼叫
  - 點字級「特大」→ `setFontScale` 以 `'xlarge'` 呼叫，且選單不關閉（列高選項點擊後才關閉，維持現狀）
  - 工具列按鈕的「已啟用」樣式判斷改為 `rowHeight !== 'small' || fontScale !== 'standard'`
  - 若兩組「大」「特大」文字重複導致 `getByText` 歧義，用 `within(getByRole('group', { name: '列高' }))` / `name: '字級'` 區分（兩個 `<ul>` 加 `role="group"` 與 `aria-label`）
- [ ] **Step 2: 確認失敗**。
- [ ] **Step 3: 實作** — `page.tsx` 呼叫 `useGridFontScale()`；`TableWorkspaceView` 以 `useMemo(() => computeGridDisplay(rowHeight, fontScale))` 取代 :357 的三元運算並展開 `cssVars` 到 style；選單第二個 `<ul>` 放字級三選項（沿用列高選項樣式）。
- [ ] **Step 4: 確認通過**，另跑 `npx jest src/modules/database/components/views` 確認既有 grid 測試全過。
- [ ] **Step 5: Commit** — `feat(grid): wire row height and font scale into toolbar and grid vars`

### Task 5: 儲存格顯示改用共用 class（換行、字級、數字對齊）

**Files:**
- Modify: `src/modules/database/components/views/grid/GridViewCell.tsx`（顯示分支約 :1596–:2085；編輯器分支只改 `fontSize`）
- Modify: `src/modules/database/components/views/grid/cells/{SelectCellEditor,LongTextCellEditor,LinkRowCellEditor,FormulaCell}.tsx`（只改字級）
- Modify: `src/styles/grid.css`
- Test: `src/modules/database/components/views/grid/__tests__/GridViewCellDisplay.test.tsx`（新建）

**Interfaces:**
- Consumes: Task 4 掛上的 CSS 變數與 `grid-display--multiline` class
- Produces（`grid.css`，後備值即 standard/small）：
  - `.grid-cell-text`：`display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:var(--grid-line-clamp,1); overflow:hidden; white-space:pre-wrap; overflow-wrap:anywhere; font-size:var(--grid-font-size,13px); line-height:var(--grid-line-height,20px)`
  - `.grid-cell-tags`：`display:flex; gap:4px; flex-wrap:nowrap; overflow:hidden; max-height:100%; align-items:center`；`.grid-display--multiline .grid-cell-tags { flex-wrap:wrap; align-content:flex-start; align-items:flex-start }`
  - `.grid-cell-tag`：`font-size:var(--grid-font-size-sm,11px)`（標籤 pill 的字級）
  - `.grid-cell-numeric`：`width:100%; text-align:right; font-variant-numeric:tabular-nums; font-size:var(--grid-font-size,13px)`
  - `.grid-display--multiline .grid-view__column.grid-cell--wrap { align-items:flex-start; padding-top:4px }`

- [ ] **Step 1: 寫失敗測試** — 以既有 grid 測試的 props 寫法 render `GridViewCell`（非編輯狀態）：
  - `text`、`long_text`、`url`、`email`、`phone`、`date`、`lookup`、預設分支：文字節點的容器有 class `grid-cell-text`，且 inline style 不含 `font-size`、`white-space`
  - `single_select`、`multiple_select`、`collaborator`、`link_row`：容器有 `grid-cell-tags`，inline style 不含 `flex-wrap`；pill 有 `grid-cell-tag`
  - `number`、`autonumber`：容器有 `grid-cell-numeric`，inline style 不含 `font-family`
  - 文字型與標籤型的儲存格外層 div 有 `grid-cell--wrap`；`number`、`boolean`、`rating` 沒有
- [ ] **Step 2: 確認失敗**。
- [ ] **Step 3: 實作** — 各顯示分支移除寫死的 `fontSize`／`whiteSpace`／`lineHeight`／`maxHeight`／`flexWrap`／`fontFamily: 'monospace'`（number、autonumber），改加 class，保留顏色與 padding；外層 div 依型別加 `grid-cell--wrap`（型別清單寫成模組常數 `WRAP_FIELD_TYPES`）。外層 inline `alignItems: 'center'` 移到 `grid.css` 的 `.grid-view__column`，否則 multiline 規則蓋不過。次要字級（ƒ 符號、計數提示等 11–12px）改 `var(--grid-font-size-sm)`。編輯器與四個 cells 檔案的 13px → `var(--grid-font-size)`、11–12px → `var(--grid-font-size-sm)`。
- [ ] **Step 4: 確認通過**，另跑 `npx jest src/modules/database/components/views` 全過。
- [ ] **Step 5: Commit** — `feat(grid): wrap and scale cell text via shared grid classes`

### Task 6: 表頭、列號、高度預設值一致化

**Files:**
- Modify: `src/modules/database/components/views/grid/GridViewHead.tsx`（:109–113 表頭高度、欄名字級）
- Modify: `src/modules/database/components/views/grid/GridViewRow.tsx`（:158–159、:228–229 後備值，列號字級）
- Modify: `src/modules/database/components/views/grid/GridViewCell.tsx`（外層 div 的 `var(--row-height, 32px)`）
- Modify: `src/styles/grid.css`（:45、:156 表頭 44px；:213 `36px`、:222 `40px`、:263 `min-height: 36px`；:46、:160、:214、:226、:241、:247、:285 字級）
- Test: `src/modules/database/components/views/grid/__tests__/GridViewHeadDisplay.test.tsx`（新建）

**Interfaces:**
- Consumes: Task 1 的 CSS 變數名稱

- [ ] **Step 1: 寫失敗測試** — render `GridViewHead`：表頭容器 inline `height` 為 `var(--grid-header-height, 36px)`；欄名字級為 `var(--grid-font-size-head, 12px)`。render `GridViewRow`：列 `height` 為 `var(--row-height, 32px)`、列號字級 `var(--grid-font-size-sm, 11px)`。
- [ ] **Step 2: 確認失敗**。
- [ ] **Step 3: 實作** — 所有 `--row-height` 後備值統一 `32px`；表頭 TSX 與 CSS 統一讀 `--grid-header-height`（後備 36px）；`grid.css` 的 13px → `var(--grid-font-size,13px)`、12px（表頭）→ `var(--grid-font-size-head,12px)`、11px → `var(--grid-font-size-sm,11px)`；`.cell-wrapper` 的 `min-height:36px` 刪除。`GridView.tsx` 群組標題（約 :2348–:2436）的欄位名與值 12px／11px 改 `var(--grid-font-size-head)`／`var(--grid-font-size-sm)`；選單、toast、浮層等非表格內容不動。用 `rg "row-height, (36|40)px|min-height: 36px" src` 確認無殘留。
- [ ] **Step 4: 確認通過**，另跑 `npx jest src/modules/database/components` 全過。
- [ ] **Step 5: Commit** — `refactor(grid): unify header, row and font defaults`

### Task 7: 整體驗證與審查

- [ ] **Step 1:** `npm run verify`，預期 typecheck／lint／jest／build:check 全過；失敗就修到過。
- [ ] **Step 2: 瀏覽器實測**（本機有可用資料庫時）— 停掉主 checkout 的 dev server 以免 DLL 鎖；`preview_start` 開 dev server，切換 3 字級 × 4 列高，截圖確認：無切半行文字、標籤換行不撐破列、數字靠右、捲動無列重疊、重新整理後兩項設定都保留。無資料庫則在回報註明未實測。
- [ ] **Step 3:** 以比較基準 `main` 呼叫 `reviewer` 子代理（model sonnet；本計畫未動 `services/`、`authorize.ts`、`proxy.ts`、`api-handler.ts`、原生 SQL）。處理意見後重跑 verify。
- [ ] **Step 4:** 在 `.claude/rules/frontend.md` 錯誤紀錄視需要補一行（僅在過程中修到 bug 時）；更新 `PROGRESS.md`。
