# PROGRESS

## 目前進度
- PR #1–#38 全部已合併至 `main`。
- 側邊欄完成仿 Claude 網頁版升級：收合時完全不留窄欄（0px），左上角保留一顆平滑微縮的展開按鈕；滑鼠碰到展開按鈕時面板平滑浮出（Peek 懸停覆蓋，不推擠內容寬度），滑鼠移開或按 Esc 自動收回；支援點擊鎖定展開、Ctrl/⌘+B 全域快捷鍵、localStorage 記憶收合狀態、Portal 下拉選單開啟時防收回；收合時桌面工具列與儀表板自動退縮 48px 防遮擋；全面對齊 Design Tokens 與深色模式。
- 本地 `npm run verify` 全部通過（typecheck、lint、jest 40 套件 276 測試、build:check）。

## 已做的決定
- 全站設計 Token 唯一真相來源為 `src/styles/tokens.css`；深色模式一律使用 `[data-theme='dark']` / `.theme-dark`，禁止使用失效的 Tailwind `dark:*-slate-*` / `.dark` 選擇器。
- 側邊欄改以 GPU 合成層 `transform: translate3d` 平滑位移；收合時主版面佔滿 100% 寬度，透過 `@media (min-width: 1024px)` 補償工具列左側間隔。
- 驗證統一走 `npm run verify`；`npm run build` 會 db push 抹除資料，嚴禁本機執行。ESLint 舊錯凍結、新錯即失敗。
- 儲存格寫入一律經 `prepareCellWrites`／`prepareBatchCellWrites`；安全修正一律先 `authorizeAction`。

## 下一步
- 提醒使用者執行 `/compact` 或切換新對話。
- 接續待辦清單中之安全漏洞或展開編輯／結構變更修正。

## 待辦
- [ ] **安全（待與 fycd2006 討論）**：forgot-password 回應直接帶 `resetToken`，知道帳號＋Email 即可重設他人密碼
- [ ] **安全**：系統 admin 權限只看 session token 的 role，不查資料庫；被降級／刪除的 admin 最多 7 天仍有權限
- [ ] **安全**：`invitation-info` 公開且 id 連號，可列出工作區名稱與建立者帳號
- [ ] login 可列舉帳號、接受明文密碼 fallback；profile 改密碼不檢查強度；`users/[id]` role 無白名單
- [ ] 健檢子專案 4–6：展開編輯修正（R1–R6）、結構變更安全（S1–S3、S5、S7）、UX 打磨
- [ ] 批次 link_row 不做雙向同步與授權檢查；move 信任前端送來的搬移內容
- [ ] 欄位 PATCH／DELETE 未擋已軟刪除欄位；前端 `restoreTrashItem` 用 PATCH 但路由只有 POST
- [ ] 升級 Prisma 7（清剩餘 production high 漏洞）；確認 `npm run build` 的 db push 是否會刪 generated column
- [ ] `FieldRegistry.get()` 對未註冊型別 fail-open，用 `/bugfix` 評估
- [ ] 視圖：前端存分組時 `groupByField` 送 JSON 陣列，後端同步主欄位失效；篩選多值選單的連結／協作者候選值不認 JSON 字串儲存格
- [ ] E2E（`e2e/` 有 Playwright spec 無設定檔）與真資料庫整合測試；舊 grid 測試用不存在的 `.grid-cell` 而空轉
- [ ] **安全**：資料表 PATCH／還原帶 databaseId 時只檢查來源工作區權限，可把資料表搬進其他工作區的資料庫
