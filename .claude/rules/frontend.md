---
paths:
  - "src/modules/database/components/**"
  - "src/modules/database/hooks/**"
  - "src/modules/database/context/**"
  - "src/modules/database/store/**"
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/styles/**"
---

# 前端規則

- 表格狀態集中在 `context/TableContext.tsx`，元件透過 `useTableContext()` 取用；不要另建平行的狀態來源。
- 行為邏輯放在對應 hook（`useRowOperations`、`useCellEdit`、`useViewConfig`、`useFieldOperations`、`useMoveOperations`、`useRealtimeSync`、`useTableCSV`），元件只負責呈現。
- 視圖由 `components/views/DatabaseViewRouter.tsx` 分派；新增視圖要在這裡註冊。
- 欄位型別在 `fields/FieldRegistry.ts` 註冊；未註冊的型別一律拒絕寫入，新型別務必註冊並補測試。
- 樣式用 `src/styles/` 下的 SCSS（Baserow 衍生），不以 Tailwind 為主。
- `MasterGridView.tsx`（3k+ 行）、`GridView.tsx`（3k+ 行）、`GridViewCell.tsx`（2k+ 行）極易互相影響：只做最小改動，改完必跑相關 `__tests__`，不要順手重構。
- UI 文案一律繁體中文。

## 錯誤紀錄

（格式：`- 根因 → 以後做法`，一到兩行，必須可執行）

- GridView 分組時畫面順序和 `rows` 順序不同，選取範圍卻用 `rows` 索引取 min..max、換列用 ±1，Delete／貼上／填滿／刪列會動到其他分組或收合的列 → 列範圍和上下列一律走 `orderedRowIndices`／`rowsOnScreenBetween`（畫面順序），首尾列用 `firstRowOnScreen`／`lastRowOnScreen`，不要寫 `rows[r]` 搭配 `r++` 或 `rows.length - 1`
- `page.tsx` 三個 return 分支各自渲染 `FYCDBrandLoading`，登入後切分支時載入層重新掛載、重播淡入而閃爍 → 跨分支要延續的元件放在每個分支「同一種根元素（Fragment）的同一個子位置」，共用同一個 JSX 變數（見 `brandOverlay`）
- 用 `<label>` 包住含按鈕的欄位，點標籤文字會觸發排在 input 前面的按鈕（「忘記密碼」）→ 標籤與 input 用 `useId()` ＋ `htmlFor` 綁定，不要用 label 包整個欄位
- 最新留言格子寫死 `WebkitLineClamp: 2`，列高調高（44／60／80px）仍只顯示兩行 → 格子內多行文字不要寫死行數，用固定 `lineHeight` ＋ `maxHeight: 'round(down, 100%, <行高>)'` 依列高顯示整數行
- 格子編輯器掛在 portal（`document.body`）時，編輯結束移除節點不會觸發 `onMouseLeave`，`isCellHovered` 卡 true，選別格後原格殘留灰底 → 格子的 hover 狀態在 `isEditing` 變 true 時清除（render 期間比對 prev，不用 effect 呼叫 setState），新增 portal 型編輯器時確認這點
- 品牌載入層在 `workspaceReady` 已為 true 時 650ms 就退場，Logo 動畫還沒出現 → 有進場動畫的遮罩要設最短顯示時間（`MIN_VISIBLE_MS`），reduced motion 例外
- 篩選選單（`constants/fieldTypes.ts`）提供 `date_equal`／`date_before`／`date_after`，前端 `evaluateCellCondition` 卻沒處理，選了也無作用 → 新增篩選運算子時同時改 `constants/fieldTypes.ts` 與 `components/views/grid/cells/utils.ts` 的 `evaluateCellCondition`，並在 `components/views/grid/__tests__/` 加一個以該運算子為例的 `it.each` 測試
