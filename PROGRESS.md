# PROGRESS

## 目前進度
- 分支 `feat/unified-cell-write`：統一儲存格寫入層（`prepareCellWrites`／`prepareBatchCellWrites`），單格 PATCH、新增列（含公開表單）、批次、move、AI agent、總表覆寫、Airtable 匯入全走同一套驗證（編輯稽核 F1–F3、F5–F16、C3、C4）。一致性測試 `rows/__tests__/writePathConsistency.test.ts`。
- 先前已合併 PR #1–#6；待審 PR：`fix/members-authz`、`fix/rows-move-scope`、`test/api-routes`。

## 已做的決定
- 驗證統一走 `npm run verify`；CI 也跑同一個指令（`verify.yml`）。`build:check` 不碰資料庫，`npm run build`（部署用）不動。
- ESLint 舊錯誤用 bulk suppressions 凍結，新錯誤一律失敗；不裝 Prettier／stylelint。
- AI 審查用 `anthropics/claude-code-action` + code-review plugin，認證用訂閱 token `CLAUDE_CODE_OAUTH_TOKEN`；只留評論不擋合併。
- 漏洞關卡只擋 production critical；剩下的 high 來自 prisma 6，升 Prisma 7 後改擋 high。
- 子代理 explorer（haiku）、reviewer（sonnet，核心／安全用 opus）；協作走分支 + PR。

## 下一步
- 設定 main 分支保護（必要檢查 `npm run verify`、`npm audit (production)`）。
- 安裝 Claude GitHub App，加 secret `CLAUDE_CODE_OAUTH_TOKEN`（`claude setup-token`）。
- 審查並合併三個待審 PR；兩個 fix 分支都在 `.claude/rules/backend.md` 加錯誤紀錄，後合併的需解衝突。

## 待辦
- [ ] **安全（待與 fycd2006 討論）**：`/api/auth/forgot-password` 回應直接帶 `resetToken`，知道帳號 + Email 即可重設任何人密碼；重設連結用 `origin` header 組成。前端 `page.tsx`／`AuthScreen` 依賴此流程
- [ ] `rows/move` 搬移內容由前端提供而非從來源列讀取（來源列範圍已在 `fix/rows-move-scope` 修正）
- [ ] **安全**：`rows/comments` GET 依 URL tableId 授權，但只用 `rowId` 查留言 → 可讀其他工作區留言（POST 有比對 tableId）
- [ ] **安全**：通知「接受邀請」不檢查是否已處理 → 被移除的成員可用舊通知重新加入或恢復舊角色
- [ ] 系統 admin 權限只看 session token 的 `role`，不回資料庫確認 → 被降級／刪除的 admin 最多 7 天仍有權限
- [ ] `invitation-info` 公開且 id 連號 → 可列出所有工作區名稱與建立者帳號
- [ ] login：帳號不存在與密碼錯誤回不同訊息（可列舉帳號）；接受明文密碼 fallback；500 回傳 `error.message`
- [ ] profile 改密碼沒檢查密碼強度；`users/[id]` PATCH 的 role 沒白名單；members 預設角色 `'member'` 在 permissions 未定義（落到 viewer）
- [ ] 升級 Prisma 7（清掉剩餘 production high 漏洞）
- [ ] 欄位 PATCH／DELETE 未擋已軟刪除欄位 → 評估是否回 404
- [ ] 前端 `restoreTrashItem` 用 PATCH，路由只有 POST；trash POST 找不到紀錄回 500
- [ ] 確認 `npm run build` 的 `db push --accept-data-loss` 是否會刪 `schemaService` 建的 generated column（已在 PR #1 詢問）
- [ ] `FieldRegistry.get()` 對未註冊型別 fail-open → 用 `/bugfix` 評估
- [ ] E2E（`e2e/` 已有 Playwright spec 但無設定檔）與真資料庫整合測試：需先規劃
- [ ] 統一寫入層範圍外：密碼雜湊、既有壞資料清理、前端即時驗證、文字長度／索引（S7、F17）、欄位型別變更時的值轉換（S1）
