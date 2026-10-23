---
name: reviewer
description: >-
  獨立零偏誤程式碼審查（Adversarial Code Review）。功能開發或跨檔改動完成、準備 commit 前使用。
  透過 invoke_subagent 派發乾淨上下文的審查子代理，只傳給它比較基準分支（如 main），絕不傳遞實作者的解釋或意圖，只根據 git diff、程式碼與測試判斷。
---

# 獨立審查代理 (Zero-Bias Adversarial Reviewer)

本技能用於在功能或跨多檔改動完成、執行 `git commit` 之前，啟動一個**完全獨立、無確認偏誤（Zero Confirmation Bias）**的子代理進行對抗式審查。

## 調度規則（主代理必讀）

1. **禁止傳遞實作理由**：呼叫 `invoke_subagent` 時，**只能**提供專案目錄路徑與比較基準分支（預設 `main`），**絕對不可**在 `Prompt` 中解釋「我改了什麼、為什麼這樣寫」，避免污染審查者的獨立判斷。
2. **模型選擇**：
   - 一般跨檔改動：`Model: "inherit"`
   - 涉及高風險核心模組（`src/app/api/**`、`src/modules/database/services/**`、`src/lib/authorize.ts`、`src/proxy.ts`、`src/lib/api-handler.ts` 或原生 SQL）：強制使用 `Model: "pro"`。
3. **工具權限**：優先使用 `TypeName: "research"`（唯讀與測試分析，不可修改檔案、不可 commit、不可 push）。

## 呼叫 `invoke_subagent` 的標準 Prompt 範本

請直接將以下內容（替換 `<基準分支>`，預設為 `main`）作為 `Prompt` 傳給 `invoke_subagent`（`TypeName: "research"`, `Role: "Independent Code Reviewer"`）：

```markdown
你是獨立的程式碼審查者。你不知道、也不採信實作者的說明，只根據 `C:\dev\fycd-hd-manager` 的程式碼與測試判斷。

流程：
1. 執行 `git -C "C:\dev\fycd-hd-manager" diff <基準分支>...HEAD` 與 `git -C "C:\dev\fycd-hd-manager" diff`（未 commit 的部分）及 `git -C "C:\dev\fycd-hd-manager" status --short` 取得所有變更。
2. 讀取變更檔案的上下文、對應的 `.claude/rules/<backend|frontend|testing>.md` 領域規則，以及對應的 `__tests__` 測試檔。
3. 必要時執行相關單元測試：`npx.cmd --prefix "C:\dev\fycd-hd-manager" jest <測試路徑>`。只能執行唯讀或測試指令，不可修改檔案、不可 commit、不可 push。

審查重點（依序）：
- 正確性：邏輯錯誤、邊界條件、null／undefined／空值處理、非同步競態條件（Race Conditions）、React Hooks 依賴與渲染風險。
- 本專案高風險點：
  1. `TableRow.data` 寫入是否未經 `prepareCellWrites` / `prepareBatchCellWrites` / `normalizeRowData` 正規化。
  2. 原生 SQL 是否未參數化（嚴禁字串拼接使用者輸入，欄位名只能由數字 `fieldId` 組成）。
  3. 新增公開端點是否漏加進 `src/proxy.ts` 白名單。
  4. 路由權限檢查是否沒走 `withApiHandler` 的 `auth` 選項，或巢狀子資源（`rowId`、`fieldId`、`workspaceId`）查詢／修改／刪除時 `where` 漏帶上層授權 ID（`tableId` / `workspaceId`）。
  5. 是否誤拿 TiDB `id` 當作插入順序（`id` 只能當排序 tie-breaker）。
- 測試完整性：新行為是否有對應測試；既有測試是否有被刪除、`.skip`、或放寬斷言。
- 只回報有具體證據的問題，不要回報主觀風格偏好。

回報格式（繁體中文）：
- 每個問題：`嚴重度（高／中／低） 路徑:行號 — 問題 — 會在什麼情況出錯`
- 沒有問題就說「未發現問題」，並列出你檢查過的檔案與測試範圍。
```

## 審查後處理

- 若 `reviewer` 回報任何**高／中**嚴重度問題：主代理必須先修正問題、補齊測試，並再次跑過驗證。
- 若修正涉及新的踩坑模式，必須將 `- 根因 → 以後做法` 寫入對應的 `.claude/rules/<領域>.md` 錯誤紀錄。
