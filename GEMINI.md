# GEMINI.md

本檔案為 Google Antigravity 代理在此儲存庫協同開發之最高指導規範。
本專案與 Claude 共同維護，所有規則、Hooks 與錯誤紀錄庫均保持 100% 雙向同步。

@[AGENTS.md](AGENTS.md)
@[CLAUDE.md](CLAUDE.md)
@[.agents/rules/karpathy-guidelines.md](.agents/rules/karpathy-guidelines.md)
@[.claude/rules/backend.md](.claude/rules/backend.md)
@[.claude/rules/frontend.md](.claude/rules/frontend.md)
@[.claude/rules/testing.md](.claude/rules/testing.md)

---

## ⚠️ 核心禁令與安全守則（最高優先級）

1. **嚴禁執行 `npm run build`**：
   - `npm run build` 包含 `prisma db push --accept-data-loss`，會直接抹除或損毀遠端/本機 TiDB 資料庫！（已由 `.agents/hooks.json` 的 `PreToolUse` 進行系統級攔截）
   - **檢查編譯請一律使用**：`npm run build:check`
2. **驗證守門（完成前必跑）**：
   - 任何改動宣告「完成」或執行 `git commit` 前，必須執行 `npm run verify` 且全部通過（依序包含：`typecheck` → `lint --quiet` → `jest` → `build:check`）。
   - 通過前**不可說「完成」**；失敗必須修到通過為止。
3. **禁止弱化測試**：
   - 嚴禁為了讓測試通過而刪除、跳過（`.skip`）或放寬斷言。
4. **重大變更前確認**：
   - 刪除檔案、修改資料庫結構、執行部署、安裝新 npm 套件、改動權限設定前，必須先明確取得使用者同意。
5. **最小改動原則**：
   - 只改需求要求的部分，嚴格貼合既有風格，不順手重構未受影響的程式碼；只清理自己本次改動造成的未使用程式碼。

---

## 🛡️ 自動化閉環護欄 (Lifecycle Hooks)

本專案於 [`.agents/hooks.json`](.agents/hooks.json) 啟用了與 Claude 完全對齊的三道自動化護欄：
1. **`PreToolUse` (`run_command`)** — [`pre-commit-verify.mjs`](.claude/hooks/pre-commit-verify.mjs)：
   - 自動攔截並拒絕 `npm run build` 與 `prisma db push --accept-data-loss`。
   - 偵測到 `git commit` 時（自動透過 [`commit-target.cjs`](.claude/hooks/commit-target.cjs) 解析目標 worktree），強制先跑完 `npm run verify`，失敗即回傳 `decision: "deny"` 阻擋 commit。
2. **`PostToolUse` (`edit_file|write_file`)** — [`post-edit-lint.mjs`](.claude/hooks/post-edit-lint.mjs)：
   - 每次編輯或寫入檔案後，立即定位該檔案所屬 worktree 並執行 `eslint --fix`（排除 [`eslint-suppressions.json`](eslint-suppressions.json) 凍結的舊錯）。
3. **`PostInvocation`** — [`post-invocation-lint.mjs`](.agents/hooks/post-invocation-lint.mjs)：
   - 若 `eslint --fix` 後仍有殘留語法或規則錯誤，自動透過 `injectSteps` + `force_continue` 將錯誤注入對話，強制代理當場修好才准繼續。

---

## 🔄 開發流程分流與專屬 Skills

- **小修改**（單檔、< 20 行、不影響其他模組）：直接實作並執行 `npm run verify`（優先於完整規劃流程）。
- **新功能或跨多檔改動**：
  - 啟動 **`superpowers-dev`** skill（[`.agents/skills/superpowers-dev/SKILL.md`](.agents/skills/superpowers-dev/SKILL.md)）：依序執行「1. 規格釐清 (Brainstorm/Spec) → 2. 最小化計畫 (Plan) → 3. 測試驅動開發 (TDD) → 4. 獨立子代理審查 (`reviewer`) → 5. `npm run verify` 全過」。
  - Commit 前必須執行 **`reviewer`** skill（[`.agents/skills/reviewer/SKILL.md`](.agents/skills/reviewer/SKILL.md)）：透過 `invoke_subagent` 啟動零偏誤獨立審查（只給比較基準如 `main`，不傳實作說明；若涉及 `services/`、`authorize.ts`、`proxy.ts`、`api-handler.ts` 或原生 SQL，強制以 `Model: "pro"` 呼叫）。
- **修復 Bug**：
  - 啟動 **`bugfix`** skill（[`.agents/skills/bugfix/SKILL.md`](.agents/skills/bugfix/SKILL.md)）：釐清 → `research` 定位 → 寫失敗重現測試（跑 jest 確認失敗）→ 說明根因 → 最小修正 → `npm run verify` 全過 → 填寫錯誤紀錄。
- **新增欄位型別**：
  - 啟動 **`new-field-type`** skill（[`.agents/skills/new-field-type/SKILL.md`](.agents/skills/new-field-type/SKILL.md)）逐項接齊所有核心位置與補齊測試。
- **進度交接**：
  - 開始任務前務必先讀取 `PROGRESS.md`。
  - 使用者要暫停或換任務時，啟動 **`handoff`** skill（[`.agents/skills/handoff/SKILL.md`](.agents/skills/handoff/SKILL.md)）更新 `PROGRESS.md`（維持 40 行以內），並提醒是否 `/compact` 或重開對話。
- **程式碼定位與檢索**：
  - 優先調用 `research` 子代理（對應 Claude 的 `explorer`）進行唯讀搜尋，保持主上下文乾淨。

---

## 💻 Windows / PowerShell 環境注意事項

1. **npm / npx 指令呼叫**：若在 Windows PowerShell 遇到 `npm.ps1 cannot be loaded because running scripts is disabled`，請改用 `npm.cmd` 或 `npx.cmd`（例如 `npm.cmd run verify`）。
2. **路徑格式**：PowerShell 環境請使用正確的 Windows 相對路徑或原生路徑，避免使用 Git Bash 特有的 `/c/...` 格式導致 Node 腳本解析失敗。
3. **檔案鎖定衝突**：`npm run dev` 執行中時 commit 可能會因為 `prisma generate` 查詢引擎 DLL 被鎖定而噴出 `EPERM` 錯誤。在執行 commit / verify 前請先確保 dev server 處於停止狀態。
