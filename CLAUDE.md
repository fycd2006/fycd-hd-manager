# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 專案

FYCD HD Manager（北科伙食團資料庫管理系統）：類 Airtable／Baserow 的 no-code 資料庫平台。Next.js 16 + React 19、Prisma 6 on TiDB serverless、Redis（選用）、Pusher。領域細節在 `.claude/rules/`，改到相關檔案時自動載入。

- **不要執行 `npm run build`**：它會 `prisma db push --accept-data-loss` 到 `DATABASE_URL`，可能刪資料。編譯檢查用 `npm run build:check`。
- 環境變數（`.env.local`）：必填 `DATABASE_URL`、`SESSION_SECRET`（≥32 字元）；選填 `REDIS_URL`、`CRON_SECRET`、`PUSHER_*`、`GEMINI_API_KEY`、`GEMINI_MODEL`、`RESEND_API_KEY`、`RESEND_FROM_EMAIL`。

## 指令

`npm run dev`（webpack 模式）｜`npm run verify`（全部驗證）｜`npm run typecheck`｜`npm run lint`｜`npm test`（單檔 `npx jest <路徑>`、單案例 `npx jest -t "<名稱>"`）｜`npm run build:check`

## 驗證規則

- 改動完成前必須 `npm run verify` 全部通過（typecheck → lint 錯誤 → jest → build:check）。失敗就修到通過；通過前不可說「完成」。
- ESLint 舊錯誤凍結在 `eslint-suppressions.json`，新錯誤一律算失敗。修掉舊錯誤後跑 `npx eslint . --prune-suppressions`；不可用 `--suppress-*` 壓新錯誤。
- Hooks（`.claude/settings.json`）會在編輯後對該檔 `eslint --fix`、在 `git commit` 前跑 `verify`。人手動 commit 由 `.githooks/pre-commit` 把關（每個 clone 執行一次 `git config core.hooksPath .githooks`）。

## 工作規則

- 一律用繁體中文回覆；回報只講結論與重點，不貼大量程式碼。
- 先讀、先計畫、再動手；不確定就問，不要猜。有多種解讀時列出來，不要默默選一個。
- 禁止為了讓測試通過而刪除、跳過或弱化測試。
- 刪除檔案、修改資料庫、部署、安裝新套件、改動權限設定前，必須先取得使用者同意。
- 寫 hooks、子代理、plugin、skill、環境變數設定前，先查 https://code.claude.com/docs；查不到就說，不要編造。
- 最小改動：只改需求要求的部分，符合既有風格，不順手重構；只清理自己造成的未使用程式碼。
- 用可驗證的成功條件推進：修 bug 先寫重現測試，重構前後測試都要通過。

## 開發流程分流

- **小修改**（單檔、<20 行、不影響其他模組）：直接實作並 verify，不走 brainstorm。此規則優先於 Superpowers 的預設流程。
- **新功能或跨多檔改動**：走 Superpowers 完整流程（brainstorm → 計畫 → TDD），commit 前交給 `reviewer` 子代理審查；改到 `services/`、`src/lib/authorize.ts`、`src/proxy.ts`、`api-handler.ts` 或原生 SQL 時，以 model `opus` 呼叫 reviewer。
- **修 bug**：用 `/bugfix`。**新增欄位型別**：用 `/new-field-type`。
- 不確定屬於哪一類，先問使用者。
- 搜尋定位程式碼優先用 `explorer` 子代理（haiku），不要用內建 Explore（跑主模型，較貴）。

## 提醒使用者（我無法自己執行這些指令）

- 一個功能完成並 commit 後，提醒是否 `/clear`。
- context 用量過半時提醒 `/compact`（使用者狀態列會顯示百分比）；實作到一半時不建議壓縮。
- 使用者要暫停或換任務時，先用 `/handoff` 更新 `PROGRESS.md`。

## 錯誤紀錄

每修完一個 bug，在對應的 `.claude/rules/<領域>.md`「錯誤紀錄」段落加一行，跨領域的記在下方。格式 `- 根因 → 以後做法`，必須具體可執行（例：「改 `schema.prisma` 前先確認 `schemaService` 建的 generated column 不會被 `db push` 刪掉」），不寫「注意資料庫」這類空話。單一段落超過 15 條時合併重複項。

- `pre-commit-verify.mjs` 固定在 hook 所在 checkout 跑 verify，從其他 worktree commit 時驗證錯程式碼 → hook 要從 stdin 的 `cwd` 與命令裡的 `cd`／`git -C` 算出目標目錄（`commit-target.cjs`），再 `git rev-parse --show-toplevel` 定位；目標沒有 node_modules 就阻擋，不退回主 checkout
- app 建在 `.claude/worktrees/` 下的 worktree 被主 checkout 的 eslint／tsc 掃進來，舊錯誤不在 suppressions 裡，害主 checkout 的 verify 失敗 → `eslint.config.mjs` 的 globalIgnores 與 `tsconfig.json` 的 exclude 要包含 `.claude/worktrees`

## 進度交接

- 開始新工作前先讀 `PROGRESS.md`。
- 使用者要暫停或換任務前，用 `/handoff` 更新 `PROGRESS.md`（目前進度、已做的決定、下一步、待辦），保持 40 行以內。

## 文件索引

- `PROGRESS.md`：目前進度、決定與待辦
- `.claude/rules/backend.md`／`frontend.md`／`testing.md`：各領域規則與錯誤紀錄（依路徑自動載入）
- `.claude/agents/`（explorer、reviewer）、`.claude/skills/`（bugfix、new-field-type、handoff）
- `docs/architecture-decisions/001-dynamic-fields-storage.md`：為何用 JSON 存資料列而非 DDL
- `docs/architecture-decisions/002-cross-table-master-view-architecture.md`：跨表總表（master view）架構
- `src/modules/database/ARCHITECTURE.md`／`QUICK_START.md`：前端模組結構與 hooks 使用方式
- `.agents/rules/karpathy-guidelines.md`：完整版編碼準則（上方工作規則為濃縮版）
- `todo.md`：原作者的架構審查清單
