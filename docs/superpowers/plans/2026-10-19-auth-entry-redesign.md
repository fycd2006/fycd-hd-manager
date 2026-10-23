# 未登入入口頁改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首屏骨架與登入頁色調一致、骨架響應式對齊真實版面、桌機登入頁加品牌面板、全程支援暗色。

**Architecture:** 骨架抽成 `AppShellSkeleton`（CSS Module＋`--shell-*` token，依 `html[data-theme]` 切暗色），`page.tsx` 只負責掛載；`AuthScreen` 色碼改 `--auth-*` token、根元素改兩欄 grid、左欄新增品牌面板。

**Tech Stack:** Next.js 16、React 19、CSS Modules、motion/react、lucide-react、Jest＋Testing Library。

**Spec:** `docs/superpowers/specs/2026-10-19-auth-entry-redesign-design.md`

## Global Constraints

- 不執行 `npm run build`；驗證用 `npm run verify`。
- 品牌色：深綠 #39452B、橘 #F58220、暖米白 #F5F0E6；暗色值對齊 PR #24（bg #12131A、surface #181922、border #242637、muted #1F202E）。
- 暗色選擇器同時寫 `:global([data-theme='dark'])` 與 `:global(.theme-dark)`（前者 SSR 首屏即生效）。
- UI 文案走 i18n，zh-TW 與 en 同步新增，key 放在 `auth` 底下。
- `brandOverlay` 必須維持是每個 return 分支 Fragment 的第 0 個子元素。
- 最小改動：不動登入邏輯、`FYCDBrandLoading`、已登入版面。

## Review Focus

- 暗色偏好的使用者 SSR 首屏：骨架必須直接是暗色（不能先亮後暗）→ 截圖驗證以停用腳本的 SSR HTML、`data-theme="dark"` 檢查。
- 800px 寬：骨架不顯示側欄、無水平捲動 → 截圖＋`scrollWidth` 檢查。
- 375px 手機：登入頁無左欄、卡片不貼邊、無水平捲動 → 截圖檢查。
- 錯誤提示與 `leaving` 淡出在兩欄版型下仍只作用於卡片 → 既有 AuthScreen 測試＋手動輸入錯誤帳密截圖。
- 暗色下錯誤框、輸入框 focus、主按鈕對比可讀 → 暗色截圖檢查。

---

### Task 1: AppShellSkeleton 與 page.tsx 接線

**Files:**
- Create: `src/modules/database/components/auth/AppShellSkeleton.tsx`
- Create: `src/modules/database/components/auth/AppShellSkeleton.module.css`
- Create: `src/modules/database/components/auth/__tests__/AppShellSkeleton.test.tsx`
- Modify: `src/modules/database/components/auth/index.ts`（匯出 `AppShellSkeleton`）
- Modify: `src/app/page.tsx:900-982`（authLoading 分支、刪除不可達分支）
- Modify: `src/lib/i18n/locales/zh-TW.json`、`en.json`（`auth.loadingWorkspace`：正在載入工作區／Loading workspace）

**Interfaces:**
- Produces: `export default function AppShellSkeleton(): JSX.Element`；`index.ts` 中 `export { default as AppShellSkeleton } from './AppShellSkeleton'`。

- [ ] **Step 1: 寫失敗測試**（i18n mock 同 `AuthScreen.test.tsx`，`t` 回傳 key）

```tsx
test('renders an accessible loading status', () => {
  render(<AppShellSkeleton />)
  const status = screen.getByRole('status', { name: 'auth.loadingWorkspace' })
  expect(status).toHaveAttribute('aria-busy', 'true')
})

test('renders sidebar, toolbar and a 5-column grid with header + 7 rows', () => {
  const { container } = render(<AppShellSkeleton />)
  expect(container.querySelector('[data-part="sidebar"]')).toBeInTheDocument()
  expect(container.querySelectorAll('[data-part="toolbar"] .fycd-skeleton')).toHaveLength(3)
  const rows = container.querySelectorAll('[data-part="grid-row"]')
  expect(rows).toHaveLength(8)
  rows.forEach(r => expect(r.querySelectorAll('.fycd-skeleton')).toHaveLength(5))
})
```

- [ ] **Step 2:** `npx jest src/modules/database/components/auth/__tests__/AppShellSkeleton.test.tsx` → FAIL（找不到模組）。
- [ ] **Step 3: 實作元件與 CSS**：結構與現有骨架相同（頂部漸層線、側欄 Logo icon＋寬度 [85,65,75,55,80]% 五條、工具列 110/75/75px、格子表頭 32px＋7 列 34px），骨架塊外層 `aria-hidden="true"`。CSS 只用 `--shell-*`（亮：bg #FAF8F3、surface #FFFFFF、border #E7E1D3、skeleton base #EFEADF、shine rgba(255,255,255,0.7)；暗：bg #12131A、surface #181922、border #242637、base #1F202E、shine rgba(255,255,255,0.05)），根元素設定 `--skeleton-base: var(--shell-skel)` 等。`@media (max-width:1023px)` 隱藏側欄；`(max-width:767px)` 隱藏每列第 4、5 格與工具列第 3 塊；`prefers-reduced-motion` 停止頂部線動畫。根元素 `position:fixed; inset:0; display:flex; overflow:hidden`。
- [ ] **Step 4:** 跑 Step 2 指令 → PASS。
- [ ] **Step 5: 接線 page.tsx**：authLoading 分支 return `<>{brandOverlay}<AppShellSkeleton /></>`；刪除第二個 `if (authState.authLoading)` 分支；若 `FycdLogo` 在 page.tsx 已無其他用途，移除該 import。`npm run typecheck` → 無錯誤。
- [ ] **Step 6: Commit**（commit 前停掉 dev server）`feat(auth): 暖色響應式首屏骨架 AppShellSkeleton`

### Task 2: AuthScreen 品牌面板與兩欄版型

**Files:**
- Modify: `src/modules/database/components/auth/AuthScreen.tsx`
- Modify: `src/modules/database/components/auth/AuthScreen.module.css`
- Modify: `src/modules/database/components/auth/__tests__/AuthScreen.test.tsx`
- Modify: `src/lib/i18n/locales/zh-TW.json`、`en.json`（`auth.brandTagline`、`brandFeatureTables`、`brandFeatureTeams`、`brandFeatureRealtime`，文案照規格）

**Interfaces:**
- Consumes: `FycdLogo` 的 `tone="onDark"`。
- Produces: CSS class `brandPanel`、`main`（右欄）；AuthScreen props 不變。

- [ ] **Step 1: 寫失敗測試**

```tsx
test('shows the brand panel with tagline and three features', () => {
  render(<AuthScreen {...baseProps()} />)
  const panel = screen.getByRole('complementary')
  expect(within(panel).getByRole('heading', { name: 'auth.brandTagline' })).toBeInTheDocument()
  const items = within(panel).getAllByRole('listitem')
  expect(items.map(li => li.textContent)).toEqual([
    'auth.brandFeatureTables', 'auth.brandFeatureTeams', 'auth.brandFeatureRealtime',
  ])
})
```

- [ ] **Step 2:** `npx jest src/modules/database/components/auth/__tests__/AuthScreen.test.tsx -t "brand panel"` → FAIL。
- [ ] **Step 3: 實作**：`.page` 內第一個子元素 `<aside className={styles.brandPanel}>`（`FycdLogo variant="full" tone="onDark" height={40}`、`<h2>` 標語、`<ul>` 三項，圖示依序 `Table2`、`Users`、`Zap`，`aria-hidden`），第二個子元素 `<main className={styles.main}>` 包住現有 langPicker 與 shell。CSS：`@media (min-width:960px)` `.page` 改 `display:grid; grid-template-columns:minmax(360px,44%) 1fr; padding:0`，`.brandPanel` 底 #39452B、內距 56px、底部 3px #F58220 線；`<960px` `.brandPanel{display:none}`、`.main` 維持現有置中行為。langPicker 改相對 `.main` 定位。
- [ ] **Step 4:** 跑整個 AuthScreen 測試檔 → 全部 PASS。
- [ ] **Step 5: Commit** `feat(auth): 桌機登入頁加入品牌面板`

### Task 3: AuthScreen 暗色 token

**Files:**
- Modify: `src/modules/database/components/auth/AuthScreen.module.css`

- [ ] **Step 1:** 新增 `.page` 上的 `--auth-*` 變數，把檔內所有寫死色碼換成變數（亮色值等於現值）。暗色覆寫依規格「3. 暗色」的值；左欄暗色 #1C2216；錯誤框暗色 bg rgba(239,68,68,0.12)、border rgba(239,68,68,0.3)、text #FCA5A5。
- [ ] **Step 2:** `rg -n "#[0-9a-fA-F]{3,6}" AuthScreen.module.css` → 只剩變數定義區塊內的色碼。
- [ ] **Step 3:** AuthScreen 測試 → PASS。
- [ ] **Step 4: Commit** `feat(auth): 登入頁支援暗色`

### Task 4: 截圖檢查與 verify

- [ ] **Step 1:** dev server 下，1440／800／375 寬 × 亮／暗截圖：登入頁（`localStorage.theme_preference` 切換後重新載入）、SSR 骨架（fetch `/` 去掉 script 後 `document.write`，並設 `data-theme`）。每張確認 `document.documentElement.scrollWidth === clientWidth`、800 寬骨架無側欄、暗色骨架首屏即暗。
- [ ] **Step 2:** 輸入錯誤帳密，確認錯誤框只出現在卡片內（亮／暗）。
- [ ] **Step 3:** 停掉 dev server，`npm run verify` → 全部通過。
- [ ] **Step 4:** 在 `.claude/rules/frontend.md` 錯誤紀錄加一行：SSR 首屏依 React 主題 state 上色會先亮後暗 → 首屏元件用 `html[data-theme]` 的 CSS 選擇器上色。
- [ ] **Step 5:** 交 `reviewer` 子代理（基準 `main`）審查，處理意見後開 PR。
