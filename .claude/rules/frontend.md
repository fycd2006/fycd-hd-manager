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
- 欄位型別在 `fields/FieldRegistry.ts` 註冊；未註冊的型別會靜默退回 pass-through，新型別務必註冊並補測試。
- 樣式用 `src/styles/` 下的 SCSS（Baserow 衍生），不以 Tailwind 為主。
- `MasterGridView.tsx`（3k+ 行）、`GridView.tsx`（3k+ 行）、`GridViewCell.tsx`（2k+ 行）極易互相影響：只做最小改動，改完必跑相關 `__tests__`，不要順手重構。
- UI 文案一律繁體中文。

## 錯誤紀錄

（格式：`- 根因 → 以後做法`，一到兩行，必須可執行）
