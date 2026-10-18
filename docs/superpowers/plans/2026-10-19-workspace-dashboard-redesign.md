# 工作區總覽視覺改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `WorkspaceDashboard` 改用品牌一致的配色、支援暗色模式、文案全走 i18n、資料表列可用鍵盤操作。

**Architecture:** 新增同目錄的 `WorkspaceDashboard.module.css`，以 `--dash-*` 變數承載配色，暗色由外層既有的 `.theme-dark` 經 `:global(.theme-dark) .root` 覆寫。元件 props 與回呼時機不變；只改呈現、文案與資料表列的結構。

**Tech Stack:** Next.js 16、React 19、CSS Modules、lucide-react、Jest ＋ @testing-library/react（jsdom）。

**Spec:** `docs/superpowers/specs/2026-10-19-workspace-dashboard-redesign-design.md`

## Global Constraints

- 只動：`WorkspaceDashboard.tsx`、新增的 `WorkspaceDashboard.module.css`、`src/lib/i18n/locales/zh-TW.json`、`src/lib/i18n/locales/en.json`、新增的 `dashboard/__tests__/WorkspaceDashboard.test.tsx`。
- `WorkspaceDashboardProps` 不變；`page.tsx`、`tokens.css`、其他元件不改。
- 不安裝新套件（沒有 `@testing-library/user-event`，用 `fireEvent`）。
- 配色只能用 spec「配色 token」表的 16 個 `--dash-*` 變數與其淺／暗色值，元件內不得出現色碼。
- UI 文案只能經 `t()` 取得；新增的 12 個 key 與其 zh-TW／en 值照 spec「i18n」表逐字使用。
- `TABLE_PREVIEW_LIMIT = 5`；搜尋中不套用上限。
- 焦點外框 `:focus-visible` 用 `--dash-focus`；`prefers-reduced-motion: reduce` 時關閉 transition。
- 每個 task 結束跑 `npx jest src/modules/database/components/dashboard` 通過；最後跑 `npm run verify`。commit 前先停掉 dev server（`preview_stop`），否則 `prisma generate` 會 EPERM。
- 前端規則寫「樣式用 `src/styles/` 下的 SCSS」，本案依 spec 採同目錄 CSS Module（比照 `AuthScreen.module.css`），已經使用者核可。

## Review Focus

1. 資料庫剛好 5 張表 → 不顯示「顯示全部」按鈕。（Task 3 測試）
2. 搜尋字串符合資料庫名稱 → 該資料庫全部資料表都顯示，不被 5 張上限截斷。（Task 3 測試）
3. 展開某資料庫後再搜尋、再清空搜尋 → 回到該資料庫先前的展開狀態，不報錯。（Task 3 測試）
4. `activeWorkspace` 為 `null` → 標題用 `dashboard.cloudWorkspace` 後備文字，不顯示跨表總表與新增資料庫按鈕，不崩潰。（Task 1 測試）
5. 資料表名稱很長 → 單行省略號，不撐破卡片。（Task 4 截圖檢查，jsdom 測不到）

---

### Task 1: i18n key 與文案改走 `t()`

**Files:**
- Create: `src/modules/database/components/dashboard/__tests__/WorkspaceDashboard.test.tsx`
- Modify: `src/lib/i18n/locales/zh-TW.json`、`src/lib/i18n/locales/en.json`（`dashboard` 區塊）
- Modify: `src/modules/database/components/dashboard/WorkspaceDashboard.tsx`

**Interfaces:**
- Produces：測試檔的 `renderDashboard(overrides?: Partial<WorkspaceDashboardProps>)` helper，以 `<I18nProvider>` 包住並提供預設 props（`currentUser = { id: 1, username: 'jeff', role: 'admin' }`、一個含兩個資料庫的 `activeWorkspace`、`onSelectTable = jest.fn()`）；後續 task 沿用。另輸出 `makeDatabase(id: number, name: string, tableCount: number): Database`，資料表 id 為 `id * 100 + i`、名稱 `表{i}`（i 從 1 起）。
- Mock：`lucide-react`（Proxy，同 `Modals.test.tsx`）、`@/modules/database/components/navigation/LangPicker`（回傳 `null`）、`@/components/animate-ui/primitives/texts/sliding-number`（`SlidingNumber` 渲染 `<span>{number}</span>`）、`@/modules/database/components/views/master`（`MasterGridView` 渲染 `<div data-testid="master-grid" />`）。

- [ ] **Step 1: 寫失敗測試**

```tsx
it('指標卡標籤走 i18n', () => {
  renderDashboard()
  expect(screen.getByText('資料庫數')).toBeInTheDocument()
  expect(screen.getByText('資料表數')).toBeInTheDocument()
  expect(screen.queryByText('DATABASE COUNT')).not.toBeInTheDocument()
  expect(screen.queryByText('dashboard.description')).not.toBeInTheDocument()
})
it('歡迎列用 welcomeLine', () => {
  renderDashboard()
  expect(screen.getByText('歡迎回來，jeff · 管理者')).toBeInTheDocument()
})
it('跨表總表可進入與返回', () => {
  renderDashboard()
  fireEvent.click(screen.getByRole('button', { name: /跨表總表/ }))
  expect(screen.getByTestId('master-grid')).toBeInTheDocument()
  expect(screen.getByText(`${workspace.name} · 跨表總表`)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '返回工作區總覽' }))
  expect(screen.queryByTestId('master-grid')).not.toBeInTheDocument()
})
it('空工作區的範本按鈕帶正確 key', () => {
  const onCreateFromTemplate = jest.fn()
  renderDashboard({ activeWorkspace: { ...workspace, databases: [] }, onShowDatabaseModal: jest.fn(), onCreateFromTemplate })
  ;[['專案範本', 'project'], ['CRM 範本', 'crm'], ['財務範本', 'finance'], ['人資範本', 'hr']].forEach(([label, key]) => {
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onCreateFromTemplate).toHaveBeenLastCalledWith(key)
  })
})
it('activeWorkspace 為 null 時用後備標題且不顯示工作區按鈕', () => {
  renderDashboard({ activeWorkspace: null, onShowDatabaseModal: jest.fn() })
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('雲端工作區')
  expect(screen.queryByRole('button', { name: /跨表總表/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /新增資料庫/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/components/dashboard`
Expected: 前三個與範本測試 FAIL（找不到「資料庫數」、`welcomeLine`、`返回工作區總覽`、範本按鈕文字含 emoji）；null 測試可能已通過。

- [ ] **Step 3: 加 12 個 key（照 spec 表），把元件內寫死文案換成 `t()`**

- `welcomeLine` 的 `role` 參數傳 `t('dashboard.adminRole')`／`t('dashboard.memberRole')`；舊的 `welcomeBack` 徽章與 `t('dashboard.description')` 段落移除。
- 範本按鈕文字只放 `t('dashboard.templateXxx')`，emoji 移除（圖示在 Task 4 換）。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/components/dashboard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/locales/zh-TW.json src/lib/i18n/locales/en.json src/modules/database/components/dashboard
git commit -m "feat(dashboard): move dashboard copy to i18n"
```

### Task 2: 資料表列改為可鍵盤操作的按鈕

**Files:**
- Modify: `src/modules/database/components/dashboard/WorkspaceDashboard.tsx`（資料表列區塊）
- Test: `src/modules/database/components/dashboard/__tests__/WorkspaceDashboard.test.tsx`

**Interfaces:**
- Consumes：Task 1 的 `renderDashboard`、`makeDatabase`。
- Produces：資料表列結構為 `<div className={styles.tableRow}>` 內含兩個並列按鈕：開啟按鈕（accessible name = 資料表名稱，`onClick → onSelectTable(id)`、`onDoubleClick → 重新命名`）與鉛筆按鈕（`aria-label = t('nav.renameTable')`）。class 名稱 `tableRow`、`tableOpen`、`iconBtn` 供 Task 4 樣式使用。

- [ ] **Step 1: 寫失敗測試**

```tsx
it('資料表列是按鈕，點擊開啟資料表', () => {
  const onSelectTable = jest.fn()
  renderDashboard({ onSelectTable })
  fireEvent.click(screen.getByRole('button', { name: '表1' }))
  expect(onSelectTable).toHaveBeenCalledWith(101)
})
it('鉛筆按鈕只觸發重新命名', () => {
  const onSelectTable = jest.fn(); const onShowRenameModal = jest.fn(); const onSetRenameId = jest.fn()
  renderDashboard({ onSelectTable, onShowRenameModal, onSetRenameId, onSetRenameType: jest.fn(), onSetRenameNameValue: jest.fn() })
  fireEvent.click(screen.getAllByRole('button', { name: '重新命名資料表' })[0])
  expect(onSetRenameId).toHaveBeenCalledWith(101)
  expect(onShowRenameModal).toHaveBeenCalled()
  expect(onSelectTable).not.toHaveBeenCalled()
})
it('沒有巢狀按鈕', () => {
  const { container } = renderDashboard({ onShowRenameModal: jest.fn() })
  expect(container.querySelectorAll('button button')).toHaveLength(0)
})
```

（`'重新命名資料表'` 以 `zh-TW.json` 的 `nav.renameTable` 實際值為準；若不同，改用該值。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/components/dashboard -t "按鈕"`
Expected: FAIL（找不到 role=button 名為「表1」）

- [ ] **Step 3: 把資料表列 `div onClick` 改為 Interfaces 描述的兩個並列按鈕**

`ChevronRight` 留在開啟按鈕內、`aria-hidden`。資料庫標題旁的鉛筆按鈕同樣補 `aria-label = t('nav.renameDatabase')`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/components/dashboard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/components/dashboard
git commit -m "feat(dashboard): make table rows keyboard accessible"
```

### Task 3: 每張卡片最多顯示 5 張資料表

**Files:**
- Modify: `src/modules/database/components/dashboard/WorkspaceDashboard.tsx`
- Test: `src/modules/database/components/dashboard/__tests__/WorkspaceDashboard.test.tsx`

**Interfaces:**
- Consumes：Task 1 helper、Task 2 的資料表列按鈕（以名稱 `表{i}` 查詢）。
- Produces：模組層常數 `const TABLE_PREVIEW_LIMIT = 5`；元件 state `expandedDbIds: Set<number>`（`useState<Set<number>>(() => new Set())`）。

- [ ] **Step 1: 寫失敗測試**

```tsx
const ws7 = () => ({ ...workspace, databases: [makeDatabase(1, '庫A', 7), makeDatabase(2, '庫B', 5)] })
it('超過 5 張只顯示前 5 張，可展開與收合', () => {
  renderDashboard({ activeWorkspace: ws7() })
  expect(screen.queryByRole('button', { name: '表6' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '顯示全部（7）' }))
  expect(screen.getByRole('button', { name: '表7' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '收合' }))
  expect(screen.queryByRole('button', { name: '表6' })).not.toBeInTheDocument()
})
it('剛好 5 張不顯示展開按鈕', () => {
  renderDashboard({ activeWorkspace: { ...workspace, databases: [makeDatabase(2, '庫B', 5)] } })
  expect(screen.queryByRole('button', { name: /顯示全部/ })).not.toBeInTheDocument()
})
it('搜尋資料表時不套用上限', () => {
  renderDashboard({ activeWorkspace: ws7() })
  fireEvent.change(screen.getByPlaceholderText('搜尋資料庫或資料表...'), { target: { value: '表' } })
  expect(screen.getAllByRole('button', { name: '表7' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: /顯示全部/ })).not.toBeInTheDocument()
})
it('搜尋符合資料庫名稱時顯示該庫全部資料表', () => {
  renderDashboard({ activeWorkspace: ws7() })
  fireEvent.change(screen.getByPlaceholderText('搜尋資料庫或資料表...'), { target: { value: '庫A' } })
  expect(screen.getByRole('button', { name: '表7' })).toBeInTheDocument()
})
it('展開後搜尋再清空，保留展開狀態', () => {
  renderDashboard({ activeWorkspace: ws7() })
  fireEvent.click(screen.getByRole('button', { name: '顯示全部（7）' }))
  const input = screen.getByPlaceholderText('搜尋資料庫或資料表...')
  fireEvent.change(input, { target: { value: '表1' } })
  fireEvent.change(input, { target: { value: '' } })
  expect(screen.getByRole('button', { name: '表7' })).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/components/dashboard -t "5 張|搜尋|展開"`
Expected: 第一、五個 FAIL（表6 仍顯示、找不到「顯示全部（7）」）

- [ ] **Step 3: 實作**

可見資料表 = 搜尋中（`searchQuery.trim()` 非空）或 `expandedDbIds.has(db.id)` 時全部，否則 `slice(0, TABLE_PREVIEW_LIMIT)`。僅在「非搜尋中且 `tables.length > TABLE_PREVIEW_LIMIT`」時渲染切換按鈕，文字為 `t('dashboard.showAllTables', { count })` 或 `t('dashboard.showLess')`，class `showMore`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/components/dashboard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/components/dashboard
git commit -m "feat(dashboard): cap table preview at five per database"
```

### Task 4: CSS Module、品牌 token 與暗色模式

**Files:**
- Create: `src/modules/database/components/dashboard/WorkspaceDashboard.module.css`
- Modify: `src/modules/database/components/dashboard/WorkspaceDashboard.tsx`
- Test: `src/modules/database/components/dashboard/__tests__/WorkspaceDashboard.test.tsx`

**Interfaces:**
- Consumes：Task 2 的 `tableRow`／`tableOpen`／`iconBtn`、Task 3 的 `showMore` class 名稱。
- Produces：`.root` 上定義 spec 表中 16 個 `--dash-*` 變數；`:global(.theme-dark) .root` 覆寫暗色值。其餘 class 依區塊命名（`inner`、`header`、`actions`、`btnSecondary`、`btnOutline`、`btnPrimary`、`metrics`、`metricCard`、`metricIcon`、`metricIconAccent`、`grid`、`dbCard`、`search`、`empty`、`templates`、`templateBtn`、`masterBar`）。

- [ ] **Step 1: 寫失敗測試**

```tsx
it('元件內沒有寫死色碼的 inline style', () => {
  const { container } = renderDashboard({ onShowRenameModal: jest.fn() })
  const offenders = Array.from(container.querySelectorAll<HTMLElement>('[style]'))
    .filter(el => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(el.getAttribute('style') ?? ''))
  expect(offenders).toHaveLength(0)
})
it('空狀態同樣沒有寫死色碼', () => {
  const { container } = renderDashboard({ activeWorkspace: { ...workspace, databases: [] }, onShowDatabaseModal: jest.fn(), onCreateFromTemplate: jest.fn() })
  expect(Array.from(container.querySelectorAll('[style]')).filter(el => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(el.getAttribute('style') ?? ''))).toHaveLength(0)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/components/dashboard -t "色碼"`
Expected: FAIL（現有大量 inline 色碼）

- [ ] **Step 3: 建立 CSS Module 並改寫元件**

- 移除所有 inline style、Tailwind class、`<style>` 標籤與 `onMouseEnter/Leave/onFocus/onBlur` 改 style 的程式；hover／focus 改在 CSS。
- 表頭照 spec「版面與元件 1」：`FycdLogo variant="full" height={18}`、`h1`、`welcomeLine` 兩層。
- 資料庫卡片格線 `grid-template-columns: repeat(auto-fill, minmax(min(360px, 100%), 1fr))`；資料表名稱單行省略。
- 範本按鈕圖示：`FolderKanban`（project）、`Briefcase`（crm）、`Wallet`（finance）、`Users`（hr），`aria-hidden`。
- 原 `@media (max-width: 768px)` 規則（內距 `20px 16px max(100px, calc(env(safe-area-inset-bottom) + 80px)) 16px`、間距 20px、按鈕兩欄）搬進模組。
- `tablesMap` 的 `color: '#4f46e5'` 改為不帶 color（`MasterGridView` 接受 `color?`）；移除後確認未使用的 import（`Sparkles`、`ArrowUpRight` 等）一併清掉，只清本檔原本就未使用且本次碰到的。
- `@media (prefers-reduced-motion: reduce)` 關閉 transition。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/components/dashboard`
Expected: PASS（含 Task 1–3 全部測試）

- [ ] **Step 5: 視覺檢查**

`preview_start {name: "dev"}`，請使用者在窗格登入後，截三張圖：淺色 1280px、暗色 1280px（切主題）、`resize_window preset: mobile`。檢查：無冷灰／靛藍、暗色文字可讀、長資料表名稱單行省略、窄螢幕無橫向捲動。截完 `resize_window preset: desktop` 並 `preview_stop`。

- [ ] **Step 6: Commit**

```bash
git add src/modules/database/components/dashboard
git commit -m "feat(dashboard): brand tokens, dark mode and CSS module styles"
```

### Task 5: 全量驗證與審查

**Files:** 無新增；必要時修正前面 task 的檔案。

- [ ] **Step 1: 跑全部驗證**

Run: `npm run verify`
Expected: typecheck、lint、jest、build:check 全部通過，無新的 ESLint 錯誤。

- [ ] **Step 2: 交 `reviewer` 子代理審查**

只傳比較基準 `main`（本分支起點含未合併的 `chore/brand-logo-cleanup` commit，請一併告知 reviewer 只看 `847ae0e..HEAD`）。依回饋修正後重跑 Step 1。

- [ ] **Step 3: 更新 PROGRESS.md（`/handoff`）並提醒使用者是否 `/clear`**
