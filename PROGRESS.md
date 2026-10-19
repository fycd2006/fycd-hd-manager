# PROGRESS

## 目前進度
- 安全與測試工作已全部合併：PR #1–#17（開發規範、CI verify、README、Claude review＋漏洞關卡、members／rows-move／comments／通知越權修正、API 路由測試、commit hook 修正、UI 與統一寫入驗證）。
- 目前工作區在 `feat/brand-login-loading`（已追蹤 origin），不是 `main`。未 commit 變更：`.claude/launch.json`（未追蹤，非本次工作）。
- 開放 PR：#18 `docs/handoff-2026-10-18`（也改 PROGRESS.md，與本檔可能衝突，以先合併者為準）。
- 工作區總覽改版（`feat/workspace-dashboard-redesign` 的 Task 1–4）已全部併入 `main`（PR #25 之前）；Task 5 驗證通過（verify 1048 tests）。reviewer 審查後在 `fix/dashboard-review-followups` 修正：暗色字標改 `onDark`（由 `page.tsx` 傳 `theme`）、淺色 muted／accent 文字加深到 AA、鉛筆按鈕 aria-label 帶資料表名、搜尋框加 aria-label、移除表列上無法觸發的雙擊重新命名。

## 已做的決定
- 驗證統一走 `npm run verify`；CI 跑同一指令。`npm run build` 含 `db push --accept-data-loss`，本機不執行。
- ESLint 舊錯誤凍結在 suppressions，新錯誤失敗；漏洞關卡只擋 production critical。
- 安全修正一律：先 `authorizeAction`，再確認子資源屬於同一張表／工作區，寫入與刪除都帶 `tableId`／`workspaceId`。
- 改 API 路由安全邏輯時，commit 前交 reviewer（opus）審查。

## 下一步
- 確認 `main` 分支保護是否已設定（必要檢查 `npm run verify`、`npm audit (production)`）；尚未確認。
- 確認 Claude GitHub App 與 secret `CLAUDE_CODE_OAUTH_TOKEN` 是否已設定；尚未確認。
- 決定 PR #18 與本檔的先後：合併後把本檔再同步一次。

## 待辦
- [ ] **安全（待與 fycd2006 討論）**：forgot-password 回應直接帶 `resetToken`，知道帳號＋Email 即可重設他人密碼
- [ ] **安全**：系統 admin 權限只看 session token 的 role，不查資料庫；被降級／刪除的 admin 最多 7 天仍有權限
- [ ] **安全**：`invitation-info` 公開且 id 連號，可列出工作區名稱與建立者帳號
- [ ] login 可列舉帳號（錯誤訊息不同）；接受明文密碼 fallback；500 回傳 `error.message`
- [ ] profile 改密碼沒檢查強度；`users/[id]` PATCH 的 role 沒白名單；members 預設角色 `member` 未定義於 permissions
- [ ] `rows/move` 搬移內容由前端提供，未從來源列讀取
- [ ] 升級 Prisma 7（清掉剩餘 production high 漏洞）
- [ ] 欄位 PATCH／DELETE 未擋已軟刪除欄位；前端 `restoreTrashItem` 用 PATCH 但路由只有 POST
- [ ] 確認 `npm run build` 的 `db push --accept-data-loss` 是否會刪 `schemaService` 建的 generated column（已在 PR #1 詢問）
- [ ] `FieldRegistry.get()` 對未註冊型別 fail-open，用 `/bugfix` 評估
- [ ] E2E（`e2e/` 有 Playwright spec 但無設定檔）與真資料庫整合測試：需先規劃
