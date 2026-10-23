# 未登入入口頁改版設計

日期：2026-10-19｜相關：PR #24（工作區總覽改版，同樣的 CSS Module＋頁面 token 做法）

## 目標

未登入使用者從首屏骨架到登入卡片，色調一致（暖米白／深綠／橘），桌機版不再是一張小卡浮在空白中，暗色偏好的使用者全程看到暗色。

## 現況問題（已重現）

1. `src/app/page.tsx` authLoading 骨架用冷色 slate（#e2e8f0、#fafafa、#0f172a），登入頁是暖米白，切換時色調跳動。
2. 骨架是 SSR 首屏，`themeState.theme` 掛載前一律 `light`：暗色使用者一定先看到亮色骨架。`layout.tsx` 已在首次繪製前設好 `html[data-theme]`，CSS 依此屬性切換即可。
3. 800px 寬：**無水平溢出**（`scrollWidth` = 800）。「多一欄」是骨架固定渲染 240px 側欄，真正 app 在 `<1024px` 隱藏側欄（`layout.css` `.layout__col-1`）。
4. 桌機 `AuthScreen` 只有一張 420px 卡片，缺品牌說明。
5. `page.tsx` 第二個 `if (authState.authLoading)` 分支不可達。

## 設計

### 1. 骨架元件 `AppShellSkeleton`

- 新檔 `src/modules/database/components/auth/AppShellSkeleton.tsx`＋`AppShellSkeleton.module.css`，從 `auth/index.ts` 匯出。
- 結構沿用現有：頂部橘綠漸層線、側欄（Logo icon＋5 條）、工具列（3 塊）、格子（表頭＋7 列 × 5 欄）。
- 根元素 `role="status"`、`aria-busy="true"`、`aria-label`（i18n `auth.loadingWorkspace`），內部骨架塊 `aria-hidden`。
- 配色只用 `--shell-*` token：
  - 亮：bg #FAF8F3、surface #FFFFFF、border #E7E1D3、skeleton base #EFEADF
  - 暗（`:global([data-theme='dark'])` 與 `:global(.theme-dark)`）：bg #12131A、surface #181922、border #242637、skeleton base #1F202E
  - 在根元素覆寫 `--skeleton-base`／`--skeleton-shine`，沿用 `.fycd-skeleton` shimmer。
- 響應式：`<1024px` 隱藏側欄；`<768px` 格子第 4、5 欄隱藏、工具列第 3 塊隱藏。
- 頂部線動畫在 `prefers-reduced-motion` 下停止。
- `page.tsx` authLoading 分支改為 `<>{brandOverlay}<AppShellSkeleton /></>`，`brandOverlay` 仍是 Fragment 第 0 個子元素；刪除不可達的第二個 authLoading 分支；移除因此不再使用的 import／變數（僅限本次造成的）。

### 2. 登入頁版型

- `AuthScreen` 根 `.page` 在 ≥960px 改為兩欄 grid（左 `minmax(360px, 44%)`、右 1fr），<960px 維持現有單卡置中。
- 左欄 `<aside className={styles.brandPanel}>`：深綠底 #39452B、`FycdLogo variant="full" tone="onDark"`、標語（h2）、三點功能（`<ul>`，每點一個 lucide 圖示）、底部 3px 橘色細線。<960px `display:none`。
- 右欄：現有卡片與語言選單，內容不變（卡片內 Logo 保留）。
- 新增 i18n（zh-TW／en，`auth` 底下）：
  - `brandTagline`：伙食團的資料，一處整理、全員同步／Your team's data, organized in one place and in sync.
  - `brandFeatureTables`：像試算表一樣直覺的資料表與多種檢視／Spreadsheet-simple tables with multiple views
  - `brandFeatureTeams`：團隊工作區與角色權限／Team workspaces with role-based access
  - `brandFeatureRealtime`：即時同步與留言，變更一目瞭然／Real-time sync and comments keep everyone current
  - `loadingWorkspace`：正在載入工作區／Loading workspace
- 卡片進出場、搖晃、模式切換動畫不變；左欄不參與 `leaving` 淡出（品牌層會整個覆蓋）。

### 3. 暗色

- AuthScreen 所有寫死色碼改為 `--auth-*` token；暗色由 `:global([data-theme='dark'])` 覆寫，值對齊 PR #24：bg #12131A、card #181922、border #242637、input bg #1F202E、text #F1F5F9／#B6BCC8／#8B93A3、primary 按鈕 #4A5A37（hover #56683F）、連結 #A3B38A、橘 #F58220；錯誤框改半透明紅。
- 左欄暗色 #1C2216。
- 品牌層 `FYCDBrandLoading` 不在本次範圍。

## 不做

- 不改登入／註冊邏輯、驗證規則、API。
- 不動已登入後的 app 版面與 `FYCDBrandLoading`。

## 測試

- `AppShellSkeleton`：渲染 `role="status"`、`aria-busy`；側欄、工具列、表頭＋7 列各 5 格的結構。
- `AuthScreen`：品牌面板渲染標語與三點功能（i18n key）；既有測試全部保持通過。
- `page.tsx` 無單元測試，靠 typecheck 與截圖驗證。
- 截圖：1440／800／375 寬 × 亮／暗，含骨架（停用腳本的 SSR HTML）與登入頁；確認無水平捲動。
- `npm run verify` 全部通過。
