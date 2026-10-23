---
name: superpowers-dev
description: >-
  新功能開發或跨多檔改動的 SOTA 閉環工作流（對齊 Claude Superpowers 流程）：
  包含 1. 規格釐清與邊界探詢 (Brainstorm/Spec) → 2. 實作計畫 (Plan) → 3. 測試驅動開發 (TDD) → 4. 獨立子代理審查 (Reviewer) → 5. 全體驗證與經驗沉澱 (Verify & Learn)。
  當需求涉及新功能、架構調整或跨多檔修改時必須啟動此技能。
---

# Superpowers 閉環開發流程 (Spec → Plan → TDD → Review → Verify)

當任務屬於「新功能」或「跨多檔改動」（非單檔 < 20 行的小修改）時，必須嚴格遵循以下五階段閉環流程，禁止直接跳過規劃與測試開始寫實作碼。

## 階段 1：規格釐清與邊界探詢 (Brainstorm & Spec)
1. **先讀上下文**：讀取 `PROGRESS.md` 與相關的 `.claude/rules/<backend|frontend|testing>.md`（可使用 `research` 子代理快速定位相關模組，節省主 Context）。
2. **拒絕猜測**：檢視需求是否有模糊地帶、多種解讀、權限邊界、資料結構相容性或 UI 狀態（Loading / Error / Empty / 競態）。
3. **主動提問**：若有任何不確定，使用 `ask_question` 工具或條列選項向使用者確認，直到規格無歧義為止。

## 階段 2：最小化實作計畫 (Surgical Plan)
1. 列出要修改或新增的檔案清單、資料流向與驗證條件（格式：`步驟 → 驗證方式`）。
2. 遵循 **Karpathy Guidelines**：最小改動、不預先過度抽象、不順手重構無關程式碼。
3. 若涉及重大架構變更、資料表 Schema、安裝套件或刪除檔案，必須先獲得使用者同意。

## 階段 3：測試驅動開發 (TDD Red-Green-Refactor)
1. **Red（先寫失敗測試）**：在對應的 `src/**/__tests__/` 撰寫涵蓋核心行為與邊界條件的單元測試，執行 `npx jest <路徑>` 確認測試因功能尚未實作而失敗。
2. **Green（最小實作）**：撰寫通過測試所需的最小程式碼（每次編輯後 Hook 會自動執行 `eslint --fix`，若有殘留錯誤會透過 `PostInvocation` 強制要求立即修正）。
3. **Refactor（清理）**：僅清理本次改動產生的冗餘程式碼，確保測試持續通過。嚴禁刪除、`.skip` 或弱化任何既有測試。

## 階段 4：獨立對抗式審查 (Zero-Bias Adversarial Review)
1. 在準備 commit 前，啟動 `reviewer` 技能（呼叫 `invoke_subagent`，只給比較基準分支如 `main`，不給實作說明）。
2. 若涉及 `services/`、`authorize.ts`、`proxy.ts`、`api-handler.ts` 或原生 SQL，必須指定 `Model: "pro"`。
3. 根據審查結果修正所有高／中風險問題。

## 階段 5：全體驗證與錯誤免疫 (Verify & Distill)
1. 執行 `npm run verify`（依序執行 `typecheck` → `lint --quiet` → `jest` → `build:check`）。
2. **注意**：若 `npm run dev` 正在背景執行，跑 `verify` 或 `commit` 前請先停止 dev server，避免 Prisma query engine DLL 鎖定導致 `EPERM`。
3. 全部通過後才可宣告「完成」或執行 `git commit`（Commit 時 `PreToolUse` Hook 也會再次自動把關）。
4. 若開發過程中發現新的潛在陷阱，於 `.claude/rules/<領域>.md` 的「錯誤紀錄」新增一行 `- 根因 → 以後做法`。
