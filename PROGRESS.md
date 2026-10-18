# PROGRESS

## 目前進度
- PR #1–#17 全部已合併。最近一批：成員／搬移／留言／通知越權修正（#7、#8、#10）、API 路由測試（#9）、分組選取修正與編輯健檢報告（#12）、統一寫入驗證層（#17，29 種型別 fail-closed，9 條寫入路徑共用 `services/cellWrite.ts`）。
- 編輯健檢報告：`docs/audits/2026-10-17-editing-audit.md`，6 個子專案中已完成 1（分組選取）、2（統一寫入驗證層）。
- 本機 worktree 都已合併，可以清掉：`C:\dev\fycd-hd-manager-{ci,docs,review,tests,fix,fix2,move,group,hookfix,cellwrite}`。主 checkout 停在已合併的 `feat/brand-login-loading`，有未追蹤的 `.claude/launch.json`。

## 已做的決定
- 驗證統一走 `npm run verify`（CI 同指令）；`npm run build` 會 db push，本機不跑。ESLint 舊錯誤凍結、新錯誤一律失敗。
- 儲存格寫入一律經 `prepareCellWrites`／`prepareBatchCellWrites`，不直接呼叫 `FieldRegistry.validateValue`；批次部分寫入並回 `rejected`，單格 PATCH 整筆拒絕。
- 未知單選／多選值在有 `canEditData` 時自動新增選項（公開表單、總表覆寫拒絕）；新增時 `SELECT … FOR UPDATE` 鎖欄位。
- 最新留言可寫入，新留言作者／時間（台北時區）由伺服器設定；唯讀欄位收到空值視為未提供。
- `field-updated` 事件送給包含發起者在內的所有人；其他事件仍排除發起者。
- AI 審查用 claude-code-action（訂閱 token），只留評論不擋合併；漏洞關卡只擋 production critical。

## 下一步
- 設定 main 分支保護：Settings → Rules → New branch ruleset，必要檢查勾 `npm run verify`、`npm audit (production)`（目前沒有任何 ruleset）。
- 開始健檢子專案 3「刪除保護」（W1、W3、S4、S6）：先跑 `superpowers:brainstorming`，範圍見健檢報告第 5 節與建議表。

## 待辦
- [ ] **安全（待與 fycd2006 討論）**：`/api/auth/forgot-password` 回應直接帶 `resetToken`，知道帳號 + Email 即可重設密碼
- [ ] **安全**：總表覆寫沒驗證 `masterViewId`／`srcTableId` 屬於該工作區（可跨工作區寫入）
- [ ] 系統 admin 權限只看 session token 的 `role` → 被降級／刪除的 admin 最多 7 天仍有權限
- [ ] `invitation-info` 公開且 id 連號 → 可列出工作區名稱與建立者
- [ ] login 可列舉帳號、接受明文密碼 fallback；profile 改密碼不檢查強度；`users/[id]` role 無白名單
- [ ] 健檢子專案 4–6：展開編輯修正（R1–R6）、結構變更安全（S1–S3、S5、S7）、UX 打磨
- [ ] 寫入層範圍外：密碼雜湊、既有壞資料清理、前端即時驗證、刪除後復原會重新署名留言
- [ ] 批次 link_row 不做雙向同步與授權檢查；move 信任前端送來的搬移內容
- [ ] 欄位 PATCH／DELETE 未擋已軟刪除欄位；前端 `restoreTrashItem` 用 PATCH 但路由只有 POST
- [ ] 升級 Prisma 7（清剩餘 production high 漏洞）；確認 `npm run build` 的 db push 是否會刪 generated column
- [ ] E2E（`e2e/` 有 Playwright spec 無設定檔）與真資料庫整合測試；UI 測試在高負載下會 5 秒逾時
- [ ] 舊 grid 測試用不存在的 `.grid-cell` 而空轉；`SelectCellEditor.tsx` 是沒被引用的死程式碼
