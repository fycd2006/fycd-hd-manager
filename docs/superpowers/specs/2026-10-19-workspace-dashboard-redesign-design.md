# 工作區總覽（WorkspaceDashboard）視覺改版設計

日期：2026-10-19
範圍：`src/modules/database/components/dashboard/WorkspaceDashboard.tsx`（登入後首頁）

## 目標

品牌一致性：統一配色、支援暗色模式、文案全部走 i18n。沿用現有 FYCD 品牌色，維持現有版面三段結構，不改 props 介面與資料流。

入口頁（AuthScreen、品牌載入層、載入骨架）不在本次範圍，另案處理。

## 現況問題

- 品牌暖色（`#E7E1D3`、`#39452B`）與冷灰（`#94a3b8`、`#f1f5f9`、`#cbd5e1`、`#71717a`）、靛藍 `#4f46e5` 混用；範本按鈕用天藍、粉紅、綠、黃加 emoji。
- 整頁寫死淺色，暗色主題下破版。
- 「DATABASE COUNT」「TOTAL TABLES」寫死英文，「跨表總表」「← 返回工作區總覽」寫死中文。
- `t('dashboard.description')` 在語系檔不存在（只有 `subtitle`），畫面顯示原始 key。
- 資料表列是帶 `onClick` 的 `div`，鍵盤無法操作；hover 用 `onMouseEnter` 改 style。
- inline style、Tailwind、`<style>` 標籤三種寫法並存。
- 資料庫卡片列出全部資料表，卡片高度參差；`minmax(360px, 1fr)` 在窄螢幕橫向溢出。

## 做法

新增 `WorkspaceDashboard.module.css`，收掉所有 inline style、Tailwind class 與 `<style>` 標籤（比照 `AuthScreen.module.css`）。整頁只用模組內 `--dash-*` 變數，不寫死色碼。全域 `tokens.css` 不動（其品牌色與實際品牌不符，另案處理）。

### 配色 token

定義在根元素 `.root`；暗色以 `:global(.theme-dark) .root` 覆寫，沿用外層既有的 `theme-dark` class，元件不新增主題 props。

| 變數 | 用途 | 淺色 | 暗色 |
|---|---|---|---|
| `--dash-bg` | 頁面底色 | `#FAF8F3` | `#12131A` |
| `--dash-surface` | 卡片底色 | `#FFFFFF` | `#181922` |
| `--dash-surface-muted` | 次要底色 | `#F5F0E6` | `#1F202E` |
| `--dash-border` | 邊框 | `#E7E1D3` | `#242637` |
| `--dash-border-strong` | hover 邊框 | `#D3CCBA` | `#34374D` |
| `--dash-text` | 主文字 | `#1A1D16` | `#F1F5F9` |
| `--dash-text-secondary` | 次文字 | `#52554B` | `#B6BCC8` |
| `--dash-text-muted` | 弱文字 | `#7A7D70` | `#8B93A3` |
| `--dash-primary` | 主按鈕底 | `#39452B` | `#4A5A37` |
| `--dash-primary-hover` | 主按鈕 hover | `#2C3621` | `#56683F` |
| `--dash-primary-fg` | 綠色圖示與文字 | `#39452B` | `#A3B38A` |
| `--dash-primary-soft` | 綠色淡底 | `#EEF0E8` | `rgba(163,179,138,.12)` |
| `--dash-accent` | 橘色色塊 | `#F58220` | `#F58220` |
| `--dash-accent-fg` | 橘色文字與圖示 | `#DD6410` | `#F58220` |
| `--dash-accent-soft` | 橘色淡底 | `#FFF1E5` | `rgba(245,130,32,.14)` |
| `--dash-focus` | 焦點外框 | `#F58220` | `#F58220` |

主按鈕白字對比在兩種主題下都 ≥ 4.5:1。

### 版面與元件

1. **表頭**（四層精簡為兩層）：左側為小號 `FycdLogo`、標題「{工作區} 總覽」及一行 `welcomeLine`；拿掉綠點徽章與說明段落。右側按鈕分層：語言切換與成員為次要（白底加邊框），跨表總表為綠色外框，新增資料庫為綠底主按鈕。手機版維持兩欄換行。
2. **指標卡**：維持資料庫數、資料表數兩張；標籤走 i18n；圖示底色分別用 `--dash-primary-soft`、`--dash-accent-soft`；保留 `SlidingNumber`。
3. **資料庫卡片**：
   - 每張最多顯示 5 張資料表（常數 `TABLE_PREVIEW_LIMIT = 5`），超過時顯示「顯示全部（n）」／「收合」切換，展開狀態以資料庫 id 記在元件 state。
   - 搜尋中不套用上限，符合的資料表全部顯示。
   - 資料表列：主體為 `<button>`（點擊開啟、雙擊重新命名），鉛筆為並列的獨立 `<button>`，不巢狀；兩者都有 `:focus-visible` 橘色外框。
   - 卡片欄寬改為 `minmax(min(360px, 100%), 1fr)`。
4. **空狀態**：「建立資料庫」為綠底主按鈕；四個範本按鈕改為統一中性樣式（`--dash-surface` 加邊框），搭配 lucide 圖示（`FolderKanban`、`Briefcase`、`Wallet`、`Users`），取代 emoji 與糖果色。
5. **搜尋框**：焦點樣式改用 CSS `:focus-visible`。
6. **跨表總表**：頂部返回列使用 token 與 i18n，返回按鈕套次要按鈕樣式。
7. **動態**：只保留 hover／焦點過渡；`prefers-reduced-motion: reduce` 時關閉 transition。

不改：`WorkspaceDashboardProps`、各回呼的呼叫時機、`page.tsx` 與其他元件。

### i18n

`zh-TW.json`、`en.json` 的 `dashboard` 下新增：

| key | zh-TW | en |
|---|---|---|
| `databaseCountLabel` | 資料庫數 | Databases |
| `tableCountLabel` | 資料表數 | Tables |
| `masterView` | 跨表總表 | Master view |
| `backToOverview` | 返回工作區總覽 | Back to overview |
| `masterViewTitle` | {workspace} · 跨表總表 | {workspace} · Master view |
| `showAllTables` | 顯示全部（{count}） | Show all ({count}) |
| `showLess` | 收合 | Show less |
| `templateProject` | 專案範本 | Project |
| `templateCrm` | CRM 範本 | CRM |
| `templateFinance` | 財務範本 | Finance |
| `templateHr` | 人資範本 | HR |
| `welcomeLine` | 歡迎回來，{username} · {role} | Welcome back, {username} · {role} |

移除 `t('dashboard.description')` 呼叫；`subtitle` key 保留不刪。改完後總覽頁不得有寫死的 UI 文案（`FycdLogo` 字標除外）。

## 測試

新增 `src/modules/database/components/dashboard/__tests__/WorkspaceDashboard.test.tsx`（jsdom ＋ `I18nProvider`，比照 `Modals.test.tsx`；mock `MasterGridView`）。先寫測試再實作。

1. 指標卡標籤顯示「資料庫數」「資料表數」，不出現「DATABASE COUNT」。
2. 資料表列為 `button`，按 Enter 呼叫 `onSelectTable(id)`；鉛筆按鈕觸發重新命名且不呼叫 `onSelectTable`。
3. 7 張表的資料庫預設顯示 5 張；點「顯示全部（7）」顯示 7 張；點「收合」回到 5 張。
4. 搜尋時只顯示符合的資料表，且不受 5 張上限限制。
5. 空狀態四個範本按鈕以 `project`／`crm`／`finance`／`hr` 呼叫 `onCreateFromTemplate`。
6. 點跨表總表顯示返回列，點返回回到總覽。

視覺驗證：瀏覽器窗格截淺色、暗色、手機寬度三張圖（需使用者先登入）。

## 完成條件

- `npm run verify` 全部通過。
- 三張截圖無冷灰色與配色破洞，暗色模式文字可讀。
- commit 前交 `reviewer` 子代理審查。

## 範圍外（後續另案）

- 全域 `tokens.css` 品牌色修正（`#EA580C`→`#F58220`、`#3F6212`→`#39452B`）。
- 入口頁：載入骨架改暖色系、窄螢幕溢出、品牌感加強。
- `page.tsx:971` 不可達的重複 `authLoading` 分支。
