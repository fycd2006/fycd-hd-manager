# 主畫面品牌一致化、PWA 啟動畫面與資料表載入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native, chosen by user). Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把摺紙雙色品牌延伸到儀表板／側邊欄、PWA 圖示與 iOS 啟動圖、手機與桌機資料表骨架。

**Architecture:** 樣式值替換＋既有 `FycdLogo` 元件；PWA PNG 由一次性腳本以本機 headless 瀏覽器渲染並 commit；啟動圖尺寸集中在 `src/lib/brand/splashScreens.ts` 供腳本與 `layout.tsx` 共用；骨架以 CSS media query 切換兩種版型。

**Tech Stack:** Next.js 16 metadata／manifest、Jest、Node 腳本＋Edge/Chrome headless。

**Spec:** `docs/superpowers/specs/2026-10-18-brand-dashboard-pwa-design.md`

## Global Constraints

- 品牌色：`#39452B`、`#2C3621`、`#F58220`、`#DD6410`、`#F5F0E6`、`#FAF8F3`、`#E7E1D3`、`#EEF0E8`、`#FFF1E5`。
- 不改版面結構、功能、文案；不安裝套件；不刪舊圖檔；不執行 `npm run build`。
- commit 前停掉 dev server（Prisma DLL 鎖定）。

## Review Focus

1. iOS `startupImage` media 字串錯一個字就完全不生效 → Task 2 測試逐字比對一筆。
2. 腳本找不到瀏覽器時要明確失敗，不能產出空檔 → Task 2 腳本行為（人工執行時確認錯誤訊息）。
3. 手機骨架與桌機骨架同時在 DOM，螢幕閱讀器不該讀兩次 → Task 3：非顯示中的版型由 CSS `display:none` 隱藏（display:none 也會從無障礙樹移除）。
4. 側邊欄收合時 28px 方塊內的 icon 不可溢出 → Task 1 以固定 `height={14}` 並 `overflow:hidden`。
5. maskable 圖示被圓形裁切時 HD 不可被切到 → Task 2 icon 佔寬 56%，產出後以 Read 檢視。

---

### Task 1: 主畫面品牌一致化

**Files:** Modify `src/modules/database/components/dashboard/WorkspaceDashboard.tsx`、`src/modules/database/components/sidebar/Sidebar.tsx`；Test `src/modules/database/components/__tests__/brandConsistency.test.ts`

- [ ] **Step 1: 測試** `brandConsistency.test.ts`（node 環境，`fs.readFileSync` 兩個檔案）：
  - `dashboard and sidebar no longer use legacy brand assets`：兩檔皆不含 `logo.png`、`#059669`、`#10b981`、`from-blue-600`、`#7c3aed`、`#bef264`。
  - `dashboard and sidebar render the FycdLogo`：兩檔皆含 `from '@/components/brand/FycdLogo'` 與 `<FycdLogo`。
- [ ] **Step 2: Run** `npx jest brandConsistency` — Expected: FAIL。
- [ ] **Step 3: 實作** 依 spec「1. 主畫面」逐項替換；Sidebar 兩處 HD 方塊改為 `background:'#F5F0E6'`、`overflow:'hidden'`，內放 `<FycdLogo variant="icon" height={14} />`。
- [ ] **Step 4: Run** `npx jest brandConsistency` 與 `npx tsc --noEmit` — Expected: PASS／無錯。
- [ ] **Step 5: Commit** `feat(ui): align dashboard and sidebar with brand`

### Task 2: PWA 圖示與 iOS 啟動圖

**Files:** Create `src/lib/brand/splashScreens.ts`、`scripts/generate-brand-icons.mjs`、`public/brand/*.png`；Modify `src/app/manifest.ts`、`src/app/layout.tsx`；Test `src/app/__tests__/manifest.test.ts`、`src/lib/brand/__tests__/splashScreens.test.ts`

**Interfaces:**
- `export interface SplashScreen { width: number; height: number; dpr: number }`（CSS 寬高）
- `export const SPLASH_SCREENS: SplashScreen[]`（12 筆，依 spec 像素尺寸換算：430×932@3、393×852@3、428×926@3、390×844@3、375×812@3、414×896@3、414×896@2、375×667@2、744×1133@2、820×1180@2、834×1194@2、1024×1366@2）
- `export function splashFileName(s: SplashScreen): string` → `splash-${s.width*s.dpr}x${s.height*s.dpr}.png`
- `export function toStartupImages(): { url: string; media: string }[]` → url `/brand/<file>`，media `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`
- 腳本為 `.mjs`，不能 import TS：腳本內以註解註明與 `splashScreens.ts` 同步，並在 Task 2 測試中比對腳本內清單與 TS 常數一致（讀檔解析 `[w, h, dpr]` 陣列）。

- [ ] **Step 1: 測試**
  - `splashScreens.test.ts`：`SPLASH_SCREENS.length === 12`；`splashFileName({width:430,height:932,dpr:3}) === 'splash-1290x2796.png'`；`toStartupImages()[0].media` 等於上列格式逐字；每個 `public/brand/<file>` 存在；腳本內清單與常數一致。
  - `manifest.test.ts`：`background_color === '#F5F0E6'`、`theme_color === '#39452B'`；icons 為 `/brand/icon-192.png`（192x192, any）、`/brand/icon-512.png`（512x512, any）、`/brand/maskable-512.png`（512x512, maskable）；每個 src 存在於 `public/`。
- [ ] **Step 2: Run** `npx jest manifest splashScreens` — Expected: FAIL。
- [ ] **Step 3: 實作** `splashScreens.ts`；`generate-brand-icons.mjs`（瀏覽器路徑：`BROWSER_PATH` → Edge → Chrome；不存在就 `process.exit(1)` 並印出訊息；每個輸出以 `--headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=W,H --screenshot=<path> file:///<tmp html>` 產生，tmp HTML 放 `os.tmpdir()`）；執行腳本產出 PNG；更新 `manifest.ts`、`layout.tsx`（`themeColor`、`icons.apple`、`appleWebApp.startupImage: toStartupImages()`）。
- [ ] **Step 4: 檢視** Read `public/brand/icon-512.png`、`maskable-512.png`、`splash-1170x2532.png`，確認置中、未裁切。
- [ ] **Step 5: Run** `npx jest manifest splashScreens` — Expected: PASS。
- [ ] **Step 6: Commit** `feat(pwa): brand icons, maskable icon and iOS splash screens`

### Task 3: 資料表骨架手機版型與進度條

**Files:** Modify `src/modules/database/components/table/WorkspaceGridSkeleton.tsx`、`src/modules/database/components/table/GridView.tsx`（進度條樣式）、`src/styles/components.css`；Test `src/modules/database/components/table/__tests__/WorkspaceGridSkeleton.test.tsx`

- [ ] **Step 1: 測試**（jsdom）：
  - `renders both desktop and mobile layouts`：`.fycd-grid-skeleton-desktop`、`.fycd-grid-skeleton-mobile` 皆存在。
  - `mobile layout uses the shared shimmer`：mobile 內 `.fycd-skeleton` 數量 ≥ 8。
  - `mobile layout shows loading text`：`loadingText="載入資料中"` 時 mobile 內含該文字。
- [ ] **Step 2: Run** `npx jest WorkspaceGridSkeleton` — Expected: FAIL。
- [ ] **Step 3: 實作** 現有內容包進 desktop 容器；新增 mobile 窄表格（spec 3）；`components.css`：`.fycd-grid-skeleton-mobile{display:none}`，`@media (max-width:768px){.fycd-grid-skeleton-desktop{display:none}.fycd-grid-skeleton-mobile{display:flex}}`；`GridView.tsx` 進度條漸層改 `transparent 0%, #39452B 35%, #F58220 65%, transparent 100%`、陰影 `rgba(245,130,32,0.35)`。
- [ ] **Step 4: Run** `npx jest WorkspaceGridSkeleton DatabaseViewsSkeletons` — Expected: PASS。
- [ ] **Step 5: Commit** `feat(ui): mobile table skeleton and brand refetch bar`

### Task 4: 驗證與審查

- [ ] `npm run verify` 全過。
- [ ] `reviewer` 子代理（基準 `6290df8`，本批改動起點）審查；處理 Critical／Important。
- [ ] push 到 `feat/brand-login-loading`（PR #13）。
