# Todo

> 依 2026-08-12 架構審查更新的優先級清單。舊的 Baserow 對標清單已完成並移除（產出見 `BASEROW_COMPARISON_REPORT.md`）。

## 安全性

- ✅ API 授權補強（rows/fields/views/trash/tables 補上 `authorizeAction`）
- ✅ Session token 加入 7 天過期機制
- ✅ Cron 端點改為 fail-closed（未設 `CRON_SECRET` 拒絕執行）
- ✅ 全域登入檢查 `src/proxy.ts`（Next 16 proxy，涵蓋所有 `/api/*`）
- ✅ `build` 腳本移除 `prisma db push --accept-data-loss`，改用 `prisma migrate` 流程

## 效能

- ✅ rows 過濾/排序/搜尋/分頁下推到 DB 層（`rowQuery.ts` 快慢雙路徑）
- ✅ PUT reorder 改用批次 raw SQL（消除 N+1 交易迴圈）
- ✅ 修復 `data` 欄位雙重編碼（寫入端根因 + 126 列資料正規化）
- ✅ 雙向 link_row 同步改為可追蹤的佇列或 await（目前 fire-and-forget）

## 架構與測試

- ✅ jest 加入 devDependencies，補 API 授權回歸測試
- ✅ 拆分巨型元件（`GridViewCell.tsx` 中的 `LatestCommentModal` 已拆分）
- ✅ 公式表達式解析抽成共用 helper（目前重複三份）
- ✅ 確認模板建庫按鈕是否接回 UI（`handleCreateDatabaseFromTemplate` 已接回 WorkspaceDashboard empty state）
- ✅ 表單視圖設定加「分享表單」按鈕（串接 `/api/tables/[id]/form-share`）
