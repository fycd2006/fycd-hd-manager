# 主畫面品牌一致化、PWA 啟動畫面與資料表載入

日期：2026-10-18｜分支：`feat/brand-login-loading`（併入 PR #13）｜前置：`2026-10-17-brand-login-loading-design.md`

## 目標

把 2026-10-17 定案的 FYCD HD 摺紙雙色品牌延伸到登入後的主畫面、PWA 安裝後的啟動畫面，以及手機／電腦的資料表載入畫面。

成功條件：

- 儀表板、側邊欄不再出現 `logo.png`、翠綠 `#059669`／`#10b981`、藍紫漸層按鈕。
- PWA：manifest 的圖示為品牌 PNG（含獨立 maskable），`background_color` `#F5F0E6`、`theme_color` `#39452B`；iOS 有各尺寸 `apple-touch-startup-image`。
- 資料表骨架在 ≤768px 呈現窄表格版型，重新載入的頂部進度條為品牌漸層。
- 以程式碼驗證（jest＋`npm run verify`）；本機無資料庫，不做登入後的瀏覽器實測。

## 不在範圍

- 儀表板版面結構、功能、文案；`MasterGridView`／`GridView`（views/grid）內部；深色模式重新配色。
- `layout.tsx` OpenGraph 圖（維持 `logo.png`）、刪除舊圖檔。

## 品牌值（沿用）

Deep Olive `#39452B`、Olive Hover `#2C3621`、Vibrant Orange `#F58220`、Orange Deep `#DD6410`、Warm Ivory `#F5F0E6`。新增：主畫面底 `#FAF8F3`、暖灰邊框 `#E7E1D3`、淡橄欖 `#EEF0E8`、淡橘 `#FFF1E5`。

## 1. 主畫面

`WorkspaceDashboard.tsx`（只換樣式值與 Logo 元素）：

- 頁首：移除 `<img src="/logo.png">` 與橘色「FYCD HD Manager」小字，改 `<FycdLogo variant="full" height={18} />`，其下維持 `<h1>`。
- 外層背景 `#fafafa` → `#FAF8F3`；卡片與分隔線 `#e4e4e7` → `#E7E1D3`。
- 「新增資料庫」按鈕：Tailwind 藍紫漸層 class 換成 `#39452B` 實心（hover `#2C3621`、`active:scale-[0.98]` 保留）。
- 「跨表總表」按鈕：邊框 `#bef264`／文字 `#365314`／hover `#f7fee7`、`#a3e635` → 邊框 `#39452B` 40% 透明、文字與圖示 `#39452B`、hover 底 `#EEF0E8`。
- 統計卡圖示底：資料庫 `#F4F4F5`／`#18181B` → `#EEF0E8`／`#39452B`；資料表 `#f5f3ff`／`#7c3aed` → `#FFF1E5`／`#DD6410`。
- 其餘 `#3F6212` 圖示色 → `#39452B`。

`Sidebar.tsx`：

- 工作區首字方塊 `#059669` → `#39452B`。
- 底部使用者區兩處 `linear-gradient(135deg, #10b981, #059669)` 的「HD」方塊 → 米白底 `#F5F0E6` 方塊內放 `<FycdLogo variant="icon" height={14} />`（尺寸維持 28／32px）。

## 2. PWA 啟動畫面

- `scripts/generate-brand-icons.mjs`（新增，手動執行，不進 verify）：以 HTML＋inline SVG 模板呼叫本機 Edge／Chrome headless `--screenshot`（路徑可由 `BROWSER_PATH` 覆寫，找不到就報錯退出），輸出到 `public/brand/`：
  - `icon-192.png`、`icon-512.png`：米白底、HD icon 佔寬 70%。
  - `maskable-512.png`：米白底、HD icon 佔寬 56%（在 80% 安全區內）。
  - `apple-touch-icon.png`：180×180，同 icon。
  - `splash-<w>x<h>.png`：米白底、完整字標寬為短邊 50%，置中。尺寸（直向像素）：1290×2796、1179×2556、1284×2778、1170×2532、1125×2436、1242×2688、828×1792、750×1334、1488×2266、1640×2360、1668×2388、2048×2732。
  - 尺寸清單與對應的 CSS 裝置寬高／DPR 匯出成 `src/lib/brand/splashScreens.ts` 的常數 `SPLASH_SCREENS`，腳本與 layout 共用。
- `manifest.ts`：`background_color: '#F5F0E6'`、`theme_color: '#39452B'`；icons：192 any、512 any、512 maskable（各自檔案）。
- `layout.tsx`：`viewport.themeColor` `#39452B`；`icons.apple` → `/brand/apple-touch-icon.png`；`appleWebApp.startupImage` 由 `SPLASH_SCREENS` 產生 `{ url, media }`，media 為 `(device-width: Wpx) and (device-height: Hpx) and (-webkit-device-pixel-ratio: D) and (orientation: portrait)`。

## 3. 資料表載入

- `WorkspaceGridSkeleton`：根元素內同時渲染 `.fycd-grid-skeleton-desktop`（現有寬表格）與 `.fycd-grid-skeleton-mobile`（窄表格：首欄 44px 列號＋固定首欄 140px＋2 欄、列高 44px、8 列、有 `loadingText` 時在上方顯示），`components.css` 以 `@media (max-width: 768px)` 切換顯示。
- `table/GridView.tsx` 重新載入進度條漸層 `#52A628`／`#EA580C` → `#39452B`／`#F58220`，陰影改橘色低透明。

## 測試

- `src/app/__tests__/manifest.test.ts`：配色值；三個 icon 路徑與 purpose；每個 icon 檔存在於 `public/`。
- `src/lib/brand/__tests__/splashScreens.test.ts`：`SPLASH_SCREENS` 12 筆、每個 PNG 存在、`toStartupImages()` 產生的 media 字串格式。
- `WorkspaceGridSkeleton` 測試：同時有 desktop／mobile 版型、mobile 有 `.fycd-skeleton`、傳 `loadingText` 時 mobile 顯示文字。
- `Sidebar`／`WorkspaceDashboard` 原始碼檢查測試：不含 `logo.png`、`#059669`、`#10b981`、`from-blue-600`。
- `npm run verify`；產生的 PNG 以 Read 檢視抽查（icon、maskable、一張 splash）。
