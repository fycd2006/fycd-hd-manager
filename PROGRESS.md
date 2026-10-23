# PROGRESS

## 目前進度
- PR #1–#31 全部已合併。最近一批：側欄收合切換（#28）、工作區總覽 reviewer 追蹤修正（#29）、刪除保護機制（#30）、資料表讀取快取與預載（#31）。
- Airtable 匯入子專案 3（視圖補強）：分支 `feat/airtable-views`。包含多條件群組過濾、多值運算子、相對日期、多層排序與分組規則保存；schema 新增 `TableView.sortRules`／`groupByRules`。
- 編輯健檢報告：`docs/audits/2026-10-17-editing-audit.md`，6 個子專案已完成 1（分組選取）、2（統一寫入驗證層）、3（刪除保護，PR #30 已合併）。
- 主 checkout 停在 `feat/sidebar-collapse-toggle`，有未追蹤與暫存修改，勿動。

## 已做的決定
- 驗證統一走 `npm run verify`（CI 同指令）；`npm run build` 會 db push，本機不跑。ESLint 舊錯誤凍結、新錯誤一律失敗。
- 儲存格寫入一律經 `prepareCellWrites`／`prepareBatchCellWrites`；批次部分寫入並回 `rejected`，單格 PATCH 整筆拒絕。
- 安全修正一律：先 `authorizeAction`，再確認子資源屬於同一張表／工作區；改 API 安全邏輯時 commit 前交 reviewer（opus）。
- 總表覆寫可寫入其他工作區的來源表是刻意設計，不視為漏洞（2026-10-18 確認）。
- AI 審查用 claude-code-action（訂閱 token），只留評論不擋合併；漏洞關卡只擋 production critical。

## 下一步
- 設定 main 分支保護：目前沒有任何 ruleset，需 repo admin 在 Settings → Rules 設定（必要檢查 `npm run verify`、`npm audit (production)`）。
- 部署前需執行 `db push`（新增 Workspace／Database 的 `deletedAt`、RowComment.userId 改可為 null、TableView 的 `sortRules` 與 `groupByRules`；不刪資料），由使用者決定時機。

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
