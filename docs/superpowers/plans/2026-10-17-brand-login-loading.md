# 品牌 Logo、登入與載入體驗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以新的摺紙雙色 FYCD HD 向量字標，重做登入卡片、登入→品牌載入銜接與骨架 shimmer。

**Architecture:** 新增純 inline SVG 的 `FycdLogo` 元件作為唯一品牌來源；`AuthScreen` 改用 CSS module ＋ `motion/react` 做進場、模式切換與錯誤動畫；`FYCDBrandLoading` 改用 `FycdLogo` 並新增 `onEntered`，讓 `page.tsx` 在覆蓋完成後才卸載登入卡片；骨架共用 `components.css` 的 `.fycd-skeleton`。

**Tech Stack:** Next.js 16、React 19、`motion/react`（已安裝）、CSS modules、Jest ＋ Testing Library（jsdom 以檔頭 `@jest-environment jsdom` 開啟）。

**Spec:** `docs/superpowers/specs/2026-10-17-brand-login-loading-design.md`

## Global Constraints

- 品牌色：Deep Olive `#39452B`、Vibrant Orange `#F58220`、Orange Deep `#DD6410`、Warm Ivory `#F5F0E6`。
- 登入／註冊／忘記／重設密碼的行為、API 呼叫、驗證規則、i18n key、現有文案一律不變。
- `prefers-reduced-motion: reduce` 時新動畫停用或改即時淡入。
- 不安裝新套件；不刪除 `public/` 舊檔；不動 `GridView.tsx`／`MasterGridView.tsx`。
- UI 文案繁體中文；完成前 `npm run verify` 必須通過（不要執行 `npm run build`）。
- jsdom 沒有 `window.matchMedia`：凡會用到的測試要在檔內 mock（回傳 `{ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }`，reduced-motion 案例回傳 `matches: true`）。

## Review Focus

1. reduced motion 或 session 已播過（略過路徑）時，`onEntered` 仍必須被呼叫，否則 `AuthScreen` 永不卸載、畫面卡住 → Task 3 測試。
2. 登入失敗時 `leaving` 要回到 false，卡片恢復可操作並顯示錯誤 → Task 5 實作、Task 6 瀏覽器實測（`page.tsx` 無單元測試）。
3. 同頁兩個 `FycdLogo`（例如載入層＋登入卡片同時存在）gradient id 不可衝突 → Task 1 測試。
4. 深色主題下骨架 shimmer 不可是亮白光帶 → Task 2 以 class 存在＋CSS 規則人工檢查。
5. `leaving` 期間重複按送出不可再次呼叫 `onLogin` → Task 4 測試。

---

### Task 1: `FycdLogo` 元件與 favicon

**Files:**
- Create: `src/components/brand/FycdLogo.tsx`
- Create: `src/components/brand/FycdLogo.module.css`
- Create: `src/app/icon.svg`
- Test: `src/components/brand/__tests__/FycdLogo.test.tsx`

**Interfaces:**
- Produces: `export function FycdLogo(props: FycdLogoProps): JSX.Element`，
  `export interface FycdLogoProps { variant?: 'full' | 'icon'; tone?: 'brand' | 'onDark' | 'mono'; animated?: boolean; height?: number | string; className?: string; style?: React.CSSProperties }`（預設 `variant='full'`、`tone='brand'`、`animated=false`、`height=40`）。
- 根 `<svg>` 帶 `role="img"`、`aria-label="FYCD HD"`、`data-variant`、`data-tone`；FYCD 群組 `data-part="fycd"`、HD 群組 `data-part="hd"`、摺紙暗面群組 `data-part="fold"`。

**幾何（原型 `logo5.html` 方案 C，直接採用）：**
- 外層 `<g transform="translate(46 0) skewX(-17)">`。
- FYCD（fill＝stroke＝FYCD 色，`stroke-width=3`、`stroke-linejoin=round`）：
  `M0 0H82V25H27V39H66V62H27V100H0Z`、`M86 0H116L130 31L144 0H174L143 57V100H116V57Z`、`M272 0H228C198 0 180 19 180 47V53C180 81 198 100 228 100H272V75H232C215 75 207 67 207 53V47C207 33 215 25 232 25H272Z`、evenodd `M278 0H330C358 0 377 19 377 47V53C377 81 358 100 330 100H278ZM305 25V75H326C342 75 350 67 350 53V47C350 33 342 25 326 25Z`
- HD（`transform="translate(392 -24) scale(1.24)"`，`stroke-width=2.4`）：
  `M0 0H29V37H67V0H96V100H67V63H29V100H0Z`、evenodd `M104 0H156C190 0 210 21 210 50C210 79 190 100 156 100H104ZM133 26V74H153C171 74 181 64 181 50C181 36 171 26 153 26Z`
- 摺紙暗面：同 HD 路徑再畫一層，fill／stroke 用 `linearGradient`（objectBoundingBox，`x1=0 y1=0 x2=1 y2=1`，stop `.5` 亮橘、stop `.5` 暗橘）。
- viewBox：`full` = `8 -30 704 136`；`icon` = `400 -30 312 136`（icon 不渲染 FYCD 群組）。
- tone 配色：`brand` FYCD `#39452B`／HD `#F58220`／暗面 `#DD6410`；`onDark` FYCD `#F5F0E6`、其餘同 brand；`mono` 全部 `currentColor` 且不渲染 fold 群組。

- [ ] **Step 1: Write the failing test** — 檔頭 `@jest-environment jsdom`，案例：
  - `renders full variant with fycd, hd and fold parts`：`getByRole('img', { name: 'FYCD HD' })`；`container.querySelector('[data-part="fycd"]')`、`hd`、`fold` 皆存在。
  - `icon variant omits the FYCD wordmark`：`[data-part="fycd"]` 為 null；svg `viewBox` 為 `400 -30 312 136`。
  - `mono tone renders no fold layer`：`[data-part="fold"]` 為 null。
  - `gradient ids are unique per instance`：render 兩個 `<FycdLogo />`，收集所有 `linearGradient` 的 id，`new Set(ids).size === ids.length`。
  - `animation classes only when animated`：`animated` 時根 svg 的 `className` 含 `animated`（CSS module 在 next/jest 下回傳 key 名），未設定時不含。
- [ ] **Step 2: Run** `npx jest src/components/brand` — Expected: FAIL（模組不存在）。
- [ ] **Step 3: Implement** `FycdLogo.tsx`（`'use client'`，gradient id 用 `useId()` 並去掉冒號）與 `FycdLogo.module.css`：`.animated [data-part="fycd"]` 自左 40px 淡入 0.75s `cubic-bezier(.2,.8,.2,1)`；`[data-part="hd"]` 自右 40px 淡入、延遲 0.1s；`[data-part="fold"]` `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` 0.7s `cubic-bezier(.7,0,.2,1)`、延遲 0.7s，`animation-fill-mode: both`；`@media (prefers-reduced-motion: reduce)` 下 `.animated *{animation:none}`。
- [ ] **Step 4: Create** `src/app/icon.svg`：icon variant 的靜態 SVG（viewBox `400 -30 312 136`，brand 配色，gradient id 固定 `fold`）。
- [ ] **Step 5: Run** `npx jest src/components/brand` — Expected: PASS。
- [ ] **Step 6: Commit** `feat(brand): add FycdLogo vector wordmark and favicon`

### Task 2: 骨架 shimmer

**Files:**
- Modify: `src/styles/components.css`（`fycdRowPulse` 之後）
- Modify: `src/modules/database/components/views/{kanban/KanbanViewSkeleton,gallery/GalleryViewSkeleton,calendar/CalendarViewSkeleton,timeline/TimelineViewSkeleton,form/FormViewSkeleton}.tsx`、`src/modules/database/components/table/WorkspaceGridSkeleton.tsx`
- Modify: `src/app/page.tsx` 的 authLoading 骨架（約 880–947 行）
- Test: `src/modules/database/components/views/__tests__/DatabaseViewsSkeletons.test.tsx`（只新增案例）

**Interfaces:**
- Consumes: `FycdLogo`（Task 1）。
- Produces: 全域 class `fycd-skeleton`。

- [ ] **Step 1: Write the failing test** — 在既有 describe 內新增 `each view skeleton uses the shared shimmer class`：依現有寫法分別 render 5 個視圖 loading 狀態，斷言 `container.querySelectorAll('.fycd-skeleton').length > 0`；另一案例 render `WorkspaceGridSkeleton` 做同樣斷言。
- [ ] **Step 2: Run** `npx jest DatabaseViewsSkeletons` — Expected: 新案例 FAIL，舊案例 PASS。
- [ ] **Step 3: Implement CSS** — `.fycd-skeleton{position:relative;overflow:hidden;background:var(--skeleton-base,#EEF0F2)}`；`::after` 為 `linear-gradient(100deg, transparent 20%, rgba(255,255,255,.65) 50%, transparent 80%)`，`transform:translateX(-100%)` → `translateX(100%)`，1.4s `ease-in-out` infinite；`.theme-dark .fycd-skeleton{--skeleton-base:#1F2937}` 且 `::after` 光帶改 `rgba(255,255,255,.06)`；reduced motion 時 `::after{animation:none;display:none}`。
- [ ] **Step 4: Apply** — 各 Skeleton 的灰色佔位方塊加 `className="fycd-skeleton"`，移除該方塊 inline 的 `backgroundColor` 與 `fycdRowPulse` 動畫（保留尺寸、圓角、間距）；頂部品牌條漸層改 `linear-gradient(90deg, #39452B 0%, #F58220 50%, #39452B 100%)`。`page.tsx` 骨架同樣處理，並把 `<img src="/logo.png">` 換成 `<FycdLogo variant="icon" height={24} />`。
- [ ] **Step 5: Run** `npx jest DatabaseViewsSkeletons` — Expected: 全部 PASS（舊斷言不得修改）。
- [ ] **Step 6: Commit** `feat(ui): unify skeleton shimmer with brand colors`

### Task 3: `FYCDBrandLoading` 改版

**Files:**
- Modify: `src/components/fycd/FYCDBrandLoading.tsx`、`src/components/fycd/FYCDBrandLoading.module.css`
- Test: `src/components/fycd/__tests__/FYCDBrandLoading.test.tsx`

**Interfaces:**
- Consumes: `FycdLogo`（Task 1）。
- Produces: props 新增 `onEntered?: () => void`；其餘 `show`、`workspaceReady`、`onExitComplete` 不變。保證：每次 `show` 由 false→true 只呼叫 `onEntered` 一次，**包含** reduced motion 與 sessionStorage 已播過的略過路徑（略過路徑先 `onEntered` 再 `onExitComplete`）。

- [ ] **Step 1: Write the failing tests**（jsdom，`jest.useFakeTimers()`，mock matchMedia，每案例前 `sessionStorage.clear()`）：
  - `renders the vector logo without the skip hint or external svg`：`show` 時 `getByRole('img', { name: 'FYCD HD' })`；`queryByText(/按 Esc/)` 為 null；`container.querySelector('img')` 為 null。
  - `calls onEntered once after the enter transition`：advance 300ms 後 `onEntered` 呼叫 1 次；再 rerender 相同 props 仍為 1 次。
  - `calls onEntered on reduced motion`：matchMedia `matches: true`，不 advance timers 也已呼叫 1 次。
  - `calls onEntered before onExitComplete when already shown this session`：`sessionStorage.setItem('fycd_brand_loading_shown','true')`，兩者皆呼叫且 `onEntered` 的 `mock.invocationCallOrder[0]` 較小。
  - `Escape skips and completes`：`fireEvent.keyDown(window,{key:'Escape'})`、advance 400ms，`onExitComplete` 呼叫 1 次。
- [ ] **Step 2: Run** `npx jest src/components/fycd` — Expected: FAIL。
- [ ] **Step 3: Implement** — 內容換成 `<FycdLogo variant="full" animated height=...>`（寬 `min(72vw, 420px)`）＋下方進度條（`.progress` 寬 120px 高 2px、底軌 `rgba(57,69,43,.15)`、`::after` 橘色 40% 寬滑塊 1.2s 左右循環）；移除 `<img>` 與提示文字；enter 計時器（250ms，與現有 enter phase 一致）結束時呼叫 `onEntered`，reduced motion 與 session 略過路徑同步呼叫；以 ref 保證每次 show 只呼叫一次。CSS：overlay 背景 `#F5F0E6`（移除強制白底的三段規則）、`.phase-exit{opacity:0;transform:scale(1.04);transition:opacity .4s ease, transform .4s ease}`；退場計時由 350ms 改 400ms。
- [ ] **Step 4: Run** `npx jest src/components/fycd` — Expected: PASS。
- [ ] **Step 5: Commit** `feat(loading): brand loading uses vector logo and reports onEntered`

### Task 4: `AuthScreen` 改版

**Files:**
- Modify: `src/modules/database/components/auth/AuthScreen.tsx`
- Create: `src/modules/database/components/auth/AuthScreen.module.css`
- Test: `src/modules/database/components/auth/__tests__/AuthScreen.test.tsx`

**Interfaces:**
- Consumes: `FycdLogo`（Task 1）。
- Produces: `AuthScreenProps` 新增 `leaving?: boolean`（預設 false）；其餘 props 不變。

- [ ] **Step 1: Write the failing tests**（jsdom；mock `@/lib/i18n/i18nContext` 回傳 `t: k => k`；mock `@/modules/database/components/navigation/LangPicker` 為 `() => null`；mock matchMedia）：
  - `shows the brand logo`：`getByRole('img', { name: 'FYCD HD' })`。
  - `switches to register via the mode link`：點 `auth.registerNow` 按鈕 → `onAuthModeChange` 以 `'register'` 呼叫。
  - `reset-password validation still blocks mismatched passwords`：`authMode='reset-password'`，兩欄輸入 `Abcdefg1`／`Abcdefg2` 送出 → 顯示 `auth.passwordMismatch`、`onResetPassword` 未呼叫。
  - `primary button is aria-busy while submitting`：`onLogin` 回傳未 resolve 的 promise，送出後 submit 按鈕 `aria-busy="true"`。
  - `does not submit again while leaving`：`leaving` 為 true 時送出表單，`onLogin` 未呼叫。
  - `error message is announced`：傳 `errorMessage="登入失敗"` → `getByRole('alert')` 文字含「登入失敗」。
- [ ] **Step 2: Run** `npx jest src/modules/database/components/auth` — Expected: FAIL。
- [ ] **Step 3: Implement CSS module** — `.page`（`min-height:100vh`、`#F5F0E6`、置中、padding 20px）、`.card`（白底、`1px solid #E7E1D3`、`border-radius:20px`、`max-width:420px`、`box-shadow:0 1px 2px rgba(57,69,43,.06),0 24px 48px -24px rgba(57,69,43,.18)`、padding `36px 32px`）、`.field`、`.label`、`.inputWrap`、`.iconLeft`、`.input`（高 42px、圓角 12px、`#FAF8F3` 底、`1px solid #E4DED0`；`:focus` 邊框 `#39452B`、白底、`box-shadow:0 0 0 3px rgba(57,69,43,.14)`）、`.toggle`、`.primaryBtn`（`#39452B`、hover `#2C3621` 並 `translateY(-1px)`、`:active scale(.98)`、`[aria-busy=true]` 不可點）、`.spinner`（14px、白色 2px 邊框、0.7s 旋轉）、`.linkBtn`、`.error`（`#FEF2F2`／`#991B1B`）。
- [ ] **Step 4: Implement component** — 以 CSS module class 取代所有 inline style 與 `onFocus`／`onBlur`／`onMouseEnter` 改 style 的寫法（四個模式的欄位共用同一組 class）；頂部 `<FycdLogo variant="full" animated height={44} />` 取代 `<img>` 與 `<h1>`（h1 文字改為視覺隱藏，保留語意）；`motion/react`：卡片 `initial={{opacity:0,y:12}} animate={leaving?{opacity:0,scale:.98}:{opacity:1,y:0,scale:1}}`（0.45s，leaving 0.25s）、`layout`；表單以 `AnimatePresence mode="wait"` 依 `authMode` 為 key 切換（opacity＋y 8px，0.2s）；錯誤區塊 `role="alert"`，`AnimatePresence` 高度展開，出現時卡片 `animate` x `[0,-6,6,-3,3,0]` 0.35s；`useReducedMotion()` 為 true 時所有位移改 0、duration 0。`handleSubmit` 開頭加 `if (submitting || leaving) return`。送出中按鈕 `aria-busy={submitting}` 並顯示 `.spinner`＋`t('notifications.processing')`。
- [ ] **Step 5: Run** `npx jest src/modules/database/components/auth` — Expected: PASS。
- [ ] **Step 6: Commit** `feat(auth): refined login card with motion and brand logo`

### Task 5: 登入 → 載入銜接

**Files:**
- Modify: `src/app/page.tsx`（`!authState.currentUser` 分支，約 963–1051 行；state 宣告約 117 行）

**Interfaces:**
- Consumes: `AuthScreen` 的 `leaving`（Task 4）、`FYCDBrandLoading` 的 `onEntered`（Task 3）。

- [ ] **Step 1: Implement** — 新增 `const [authCovered, setAuthCovered] = useState(false)`。未登入分支：`AuthScreen` 改為在 `!authCovered` 時渲染（取代 `!showBrandLoading`），並傳 `leaving={showBrandLoading}`；`FYCDBrandLoading` 傳 `onEntered={() => setAuthCovered(true)}`。登入／註冊失敗分支在 `setShowBrandLoading(false)` 旁加 `setAuthCovered(false)`；`handleExitComplete` 內也 `setAuthCovered(false)`。
- [ ] **Step 2: Run** `npm run typecheck` — Expected: 無錯誤。
- [ ] **Step 3: Commit** `feat(auth): cross-fade login card into brand loading`

（`page.tsx` 為 1000+ 行的頁面元件、無既有測試；此 Task 的行為由 Task 3／4 的 `onEntered`、`leaving` 測試加上 Task 6 的瀏覽器實測覆蓋。）

### Task 6: 全面驗證

- [ ] **Step 1: Run** `npm run verify` — Expected: typecheck、lint、jest、build:check 全部通過；失敗就修到通過。
- [ ] **Step 2: 瀏覽器實測**（`.claude/launch.json` 設定 `npm run dev`，`preview_start`）：清除 `sessionStorage` 後走一次登入成功、登入失敗、註冊、忘記密碼→重設密碼；確認無白閃、錯誤會晃動、失敗後卡片恢復；以 `resize_window` 的 mobile 檢查卡片版面；以 DevTools 模擬 reduced motion 檢查無位移動畫。
- [ ] **Step 3:** 交給 `reviewer` 子代理（比較基準 `main`）審查，處理意見後 commit。
