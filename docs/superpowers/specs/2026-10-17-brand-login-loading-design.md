# 品牌 Logo、登入與載入體驗重新設計

日期：2026-10-17｜分支：`feat/brand-login-loading`

## 目標

讓登入與載入流程具備沉穩極簡、高質感的品牌體驗：新的向量字標與進場動畫、精緻的登入卡片、登入到工作區之間無閃爍的銜接，以及一致的骨架 shimmer。

成功條件：

- 全流程（開頁 → 登入 → 品牌載入 → 工作區）沒有突兀的跳切或白閃。
- 品牌載入不再下載 2.4 MB 資源；Logo 為純向量 inline SVG（< 10 KB）。
- `prefers-reduced-motion: reduce` 時所有新動畫停用或改為即時淡入。
- 登入、註冊、忘記／重設密碼的行為與 API 呼叫完全不變。
- `npm run verify` 通過。

## 不在範圍內

- 登入／註冊邏輯、API、session、權限。
- 登入頁深色模式（維持品牌米白底）。
- `apple-icon`、`manifest` 的 PNG 圖示，`Sidebar`／`WorkspaceDashboard` 等其他位置的 `logo.png`。
- 刪除舊的 `public/FYCD_HD_*.svg`、`logo.png`（停用但保留，是否刪除另行決定）。

## 品牌規格

| Token | 值 | 用途 |
| --- | --- | --- |
| Deep Olive | `#39452B` | FYCD 字母、主按鈕 |
| Vibrant Orange | `#F58220` | HD 亮面 |
| Orange Deep | `#DD6410` | HD 摺紙暗面 |
| Warm Ivory | `#F5F0E6` | 登入頁與載入畫面底色 |

字標：粗體無襯線字母，整體 `skewX(-17°)`；FYCD 為橄欖綠、HD 放大 1.24 倍且為橘色。HD 每個字母沿對角線硬切成亮橘／暗橘兩色（摺紙效果），無劃線、無葉子。字母轉角以同色 2–3 單位 `stroke-linejoin: round` 微圓化。原型：scratchpad 的 `logo5.html` 方案 C。

## 元件設計

### 1. `src/components/brand/FycdLogo.tsx`（新增）

- 純 inline SVG，路徑常數寫在檔內；`role="img"`、`aria-label="FYCD HD"`。
- Props：
  - `variant: 'full' | 'icon'`（`icon` 只有 HD 與摺紙暗面，viewBox 裁到 HD）
  - `tone: 'brand' | 'onDark' | 'mono'`（`onDark`：FYCD 改米白；`mono`：全部 `currentColor`、無暗面）
  - `animated?: boolean`（預設 false）
  - `className?`、`style?`、`height?`
- 動畫（`animated` 時，CSS keyframes 寫在同目錄 `FycdLogo.module.css`）：
  1. FYCD 自左 40px 淡入滑入，0.75s `cubic-bezier(.2,.8,.2,1)`
  2. HD 自右 40px 淡入滑入，延遲 0.1s
  3. 摺紙暗面以 `clip-path: inset()` 由左向右展開，0.7s，延遲 0.7s
- `prefers-reduced-motion: reduce`：不播放動畫，直接顯示完成狀態。
- 同一頁可同時渲染多個實例：所有 SVG 內部 id（gradient）以 `useId()` 產生，避免衝突。

### 2. `src/app/icon.svg`（新增）

HD icon 版（亮／暗兩色），讓 Next.js 自動產生 favicon `<link>`。`layout.tsx` 的 `icons.apple` 與 OpenGraph 圖不變。

### 3. 登入卡片 `AuthScreen.tsx` ＋ `AuthScreen.module.css`（新增）

- 把重複的 inline style 收進 CSS module：`.page`、`.card`、`.field`、`.input`、`.iconLeft`、`.toggle`、`.primaryBtn`、`.linkBtn`、`.error`。focus 樣式用 `:focus-visible` 與 `:focus`，取代 `onFocus`／`onBlur` 改 style 的寫法；重設密碼欄位也套用同一組樣式（目前缺 focus 樣式）。
- 版面：頁面 `#F5F0E6`；卡片白底、`1px` 暖灰細框、`0 1px 2px` 與 `0 24px 48px -24px` 兩層柔和陰影、圓角 20px、最大寬 420px；頂部 `FycdLogo variant="full" animated`（高 44px），下方副標題保留現有 i18n 文字。
- 主按鈕：`#39452B`，hover 加深並上移 1px，`:active` 縮至 0.98；送出中顯示 14px 旋轉 spinner＋現有「處理中」文字，`aria-busy="true"`。
- 動畫（使用已安裝的 `motion` 套件）：
  - 卡片進場：opacity 0→1、y 12→0，0.45s。
  - 模式切換（login／register／forgot／reset）：`AnimatePresence mode="wait"`，表單內容淡出／淡入並微位移，卡片高度以 `layout` 平滑過渡。
  - 錯誤訊息：高度展開＋淡入，出現時整張卡片做一次 6px 左右輕晃（0.35s）。
  - `useReducedMotion()` 為 true 時改用無位移的即時切換。
- 新增 prop `leaving?: boolean`：為 true 時卡片淡出並縮至 0.98（0.25s），供登入成功後銜接使用。
- 所有現有 props、驗證規則、文案、i18n key 不變。

### 4. 登入 → 載入銜接（`page.tsx`、`FYCDBrandLoading.tsx`）

- `page.tsx`：登入／註冊成功時，現在 `showBrandLoading` 為 true 會立即卸載 `AuthScreen`。改成先傳 `leaving` 讓卡片淡出，品牌載入層以淡入覆蓋在上方，等覆蓋完成（`onEntered` 回呼）後再卸載 `AuthScreen`，中間沒有空白幀。失敗時行為不變（`setShowBrandLoading(false)` ＋錯誤）。
- `FYCDBrandLoading.tsx`：
  - 背景改為 `#F5F0E6`；內容改為 `FycdLogo variant="full" animated`（寬 `min(72vw, 420px)`），下方 2px 寬 120px 的不定進度條（橄欖綠底軌＋橘色滑塊循環）。
  - 移除 `<img src=".../FYCD_HD_Premium_Sequential_PremiumGreen.svg?t=...">` 與「按 Esc 或點擊畫面跳過」文字；Esc／點擊略過、`sessionStorage` 只播一次、`workspaceReady` 觸發退場等邏輯保留。
  - 退場：opacity 1→0 並 scale 1→1.04，0.4s。
  - 新增 `onEntered?: () => void`，進場淡入完成時呼叫一次。
- `FYCDBrandLoading.module.css` 對應更新；reduced motion 時只做 200ms 淡入淡出。

### 5. 骨架 shimmer（`components.css` ＋ 6 個 Skeleton ＋ `page.tsx`）

- `src/styles/components.css` 新增 `.fycd-skeleton`：底色 `var(--skeleton-base, #EEF0F2)`，`::after` 以斜向淺色光帶 `translateX(-100%)→100%`、1.4s 無限循環；`.theme-dark` 下改深色底與低亮度光帶；reduced motion 停止 `::after` 動畫。
- 6 個 Skeleton（Kanban／Gallery／Calendar／Timeline／Form／WorkspaceGrid）與 `page.tsx` 的 App 骨架：灰色佔位方塊加上 `className="fycd-skeleton"`（保留原尺寸 inline style、移除與 shimmer 衝突的 `backgroundColor`／`fycdRowPulse`）；頂部品牌條改為 `#39452B → #F58220 → #39452B` 漸層，沿用 `fycdBarShimmer`。
- `page.tsx` 骨架的 `<img src="/logo.png">` 換成 `FycdLogo variant="icon"`（高 24px）。
- `GridView.tsx`／`MasterGridView.tsx` 不動。

## 錯誤處理

- `FycdLogo` 無外部資源，不會載入失敗。
- 若 `onEntered` 因 reduced motion 或略過而沒有轉場事件，`FYCDBrandLoading` 仍需在進場狀態設定後同步呼叫 `onEntered`，避免 `AuthScreen` 永遠不卸載。
- 登入失敗時清除 `leaving`，卡片回到正常狀態並顯示錯誤動畫。

## 測試

- `src/components/brand/__tests__/FycdLogo.test.tsx`（新增）：`full` 含 FYCD 與 HD 群組、`icon` 不含 FYCD 群組、`aria-label` 存在、兩個實例的 gradient id 不重複、`animated` 才加動畫 class、`mono` 不渲染暗面。
- `src/components/fycd/__tests__/FYCDBrandLoading.test.tsx`（新增）：不再渲染「按 Esc」文字與外部 SVG `<img>`；Esc 會觸發 `onExitComplete`；`onEntered` 會被呼叫一次。
- `AuthScreen` 測試（新增）：三種模式切換仍呼叫 `onAuthModeChange`；重設密碼的前端驗證錯誤仍顯示；送出中按鈕 `aria-busy`。
- 既有 `DatabaseViewsSkeletons.test.tsx` 必須繼續通過（不修改斷言；若因結構變動失敗，先確認是行為改變而非弱化測試）。
- `npm run verify`；最後在 Browser 面板用 dev server 實際走一次登入流程與 reduced-motion 檢查。
