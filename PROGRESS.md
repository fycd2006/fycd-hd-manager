# PROGRESS

## 目前進度
- 分支 `chore/dev-guardrails`：建立開發規範，分 5 階段。階段 1～4 已完成；下一步階段 5（總檢查）。

## 已做的決定
- 驗證統一走 `npm run verify`；`build:check` 不碰資料庫，原 `npm run build`（部署用）不動。
- ESLint 舊錯誤用 bulk suppressions 凍結，新錯誤一律失敗；不裝 Prettier，只用 `eslint --fix`。
- Claude 的 commit 由 PreToolUse hook 跑 verify；人手動 commit 由 `.githooks/pre-commit`（免裝套件）。
- 領域規則放 `.claude/rules/`（依路徑載入）；操作流程做成專案 skill（`/bugfix`、`/new-field-type`、`/handoff`）。
- 子代理 explorer（haiku、唯讀）、reviewer（sonnet，核心／安全改動用 opus）；opusplan 不設為預設（Superpowers 規劃不在 plan mode）。
- 9 個無關設計 skill 停用於個人 `.claude/settings.local.json`；狀態列在 `~/.claude/settings.json`。
- 協作走分支 + PR，讓 fycd2006 審查規範變更。

## 下一步
- 階段 5：總檢查，push 並開 PR。

## 待辦
- [ ] 補測試：`rowValidation`、`createRow`、`field`、fields API 權限、`trash`／`workspace`（約 45 案例）
- [ ] 確認 `npm run build` 的 `db push --accept-data-loss` 是否會刪掉 `schemaService` 建的 generated column（需可讀的 DB）
- [ ] README 修正：`npm run migrate:dev` 不存在、缺 `.env.example`、漏列 GEMINI／RESEND 變數（需與 fycd2006 確認）
- [ ] 重開 Claude app 讓 PATH 含 node 後，評估移除 hook 指令裡的 nodejs 備援路徑
- [ ] 新工作階段實測 explorer／reviewer（子代理只在啟動時載入，本階段無法實測；CLI 也未登入）
- [ ] 新工作階段用 `/memory` 確認 rules 依路徑載入、`/skills` 確認 9 個 skill 已停用
- [ ] stylelint 在 CI 使用但不在 devDependencies
