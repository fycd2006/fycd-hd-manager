# PROGRESS

## 目前進度
- 開發規範 5 階段全部完成，分支 `chore/dev-guardrails` 已 push，PR #1 open 等 fycd2006 審查：https://github.com/fycd2006/fycd-hd-manager/pull/1
- 分支 `test/core-services`（從 `chore/dev-guardrails` 開）：核心服務補 51 個測試，並修正欄位 PATCH／DELETE 跨表越權（IDOR，回 404）。尚未 push。

## 已做的決定
- 驗證統一走 `npm run verify`；`build:check` 不碰資料庫，原 `npm run build`（部署用）不動。
- ESLint 舊錯誤用 bulk suppressions 凍結，新錯誤一律失敗；不裝 Prettier，只用 `eslint --fix`。
- Claude 的 commit 由 PreToolUse hook 跑 verify（腳本內 regex 判斷，含 `git -C`）；人手動 commit 由 `.githooks/pre-commit`。
- 領域規則放 `.claude/rules/`（依路徑載入）；操作流程做成專案 skill（`/bugfix`、`/new-field-type`、`/handoff`）。
- 子代理 explorer（haiku、唯讀）、reviewer（sonnet，核心／安全改動用 opus）；opusplan 不設為預設（Superpowers 規劃不在 plan mode）。
- 9 個無關設計 skill 停用於個人 `.claude/settings.local.json`；狀態列在 `~/.claude/settings.json`。
- 協作走分支 + PR。PR #1 合併前，新工作從 `chore/dev-guardrails` 開分支，才有 verify 與 hooks。

## 下一步
- 確認後 push `test/core-services` 並開 PR（base 視 PR #1 是否已合併決定）。
- 同時追蹤 PR #1 的審查意見與 fycd2006 對 `npm run build` 的答覆。

## 待辦
- [x] 補測試：rowValidation／createRow／欄位路由／trash／workspaces／authorize 跨工作區（51 案例）
- [ ] 欄位 PATCH／DELETE 未擋已軟刪除欄位（可改回收站欄位、重複刪除會覆寫 deletedAt）→ 評估是否一併回 404
- [ ] 前端 `services/trash.ts` 的 `restoreTrashItem` 用 PATCH，路由只有 POST（目前無人呼叫）；trash POST 找不到紀錄回 500 而非 404
- [ ] 其餘 API 路由仍無測試（34 個中約 14 個有）
- [ ] 確認 `npm run build` 的 `db push --accept-data-loss` 是否會刪掉 `schemaService` 建的 generated column（已在 PR #1 詢問）
- [ ] `FieldRegistry.get()` 對未註冊型別 fail-open（不驗證、無預設、generated column 退回 VARCHAR(255)、無 log）→ 用 `/bugfix` 評估
- [ ] README 修正：`npm run migrate:dev` 不存在、缺 `.env.example`、漏列 GEMINI／RESEND 變數（需與 fycd2006 確認）
- [ ] 新工作階段用 `/memory` 確認 rules 依路徑載入、`/skills` 確認 9 個 skill 已停用
- [ ] 重開 Claude app 讓 PATH 含 node 後，評估移除 hook 指令裡的 nodejs 備援路徑
- [ ] stylelint 在 CI 使用但不在 devDependencies
