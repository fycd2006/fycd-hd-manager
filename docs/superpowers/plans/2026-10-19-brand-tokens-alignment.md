# 全域品牌色 token 對齊 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal：** 讓 `tokens.css` 與 `theme.css` 的品牌色對齊 FYCD 深綠 `#39452B`／橘 `#F58220`，淺色與暗色對比不變差。

**Architecture：** 只改兩個 CSS 定義檔的數值。用一支 node 環境的 jest 測試讀 CSS 原文，鎖住「沒有舊色、主色值、對比度」三件事。

**Tech Stack：** CSS custom properties、Jest（node）

**Spec：** `docs/superpowers/specs/2026-10-19-brand-tokens-alignment-design.md`

## Global Constraints

- 只改 `src/styles/tokens.css`、`src/app/theme.css`，以及新增測試檔；其他 CSS／TSX 不動。
- 數值完全照規格「數值」段落與舊色對應表。
- 不執行 `npm run build`；驗證用 `npm run verify`。

## Review Focus

- 暗色模式由 `.theme-dark` class（不是 `data-theme`）觸發：測試要解析 `[data-theme='dark'],\n.theme-dark` 這個選擇器區塊，不要只比對 `[data-theme='dark'] {`。
- `theme.css` 在 `tokens.css` 之後載入，淺色 `--accent-primary` 以它為準：測試兩個檔都要檢查。
- 色碼大小寫與 `rgba(` 內空白不一致（`rgba(234,88,12` vs `rgba(234, 88, 12`）：舊色比對要正規化。
- 作用中儲存格外框（`grid.css:272` 的 `--accent-primary` outline）在暗色底要看得見：對比度斷言要涵蓋暗色。
- tokens.css 底部 scrollbar 用寫死的綠色 rgba：要一起換成 `rgba(57, 69, 43, a)`，不然舊色掃描會失敗。

---

### Task 1：品牌 token 測試與數值修正

**Files：**
- Create：`src/styles/__tests__/brandTokens.test.ts`
- Modify：`src/styles/tokens.css`（`:root` 21–37 行、暗色區塊、utility class 與 scrollbar）
- Modify：`src/app/theme.css:21-30`

**Interfaces：**
- 測試內部的輔助函式（只在本檔使用）：`readCss(rel: string): string`、`block(css: string, selectorStart: string): string`（回傳該選擇器 `{…}` 的內容）、`tokenValue(blockCss: string, name: string): string`、`contrast(hexA: string, hexB: string): number`（WCAG 2.x 相對亮度比）。

- [ ] **Step 1：寫失敗測試**，`describe('brand tokens')`，案例：
  - `has no legacy brand colors`：對兩個檔，`css.toLowerCase().replace(/\s+/g, '')` 後不包含 `#ea580c`、`#f97316`、`#c2410c`、`#3f6212`、`#365314`、`#4d7c0f`、`#f7fee7`、`#818cf8`、`rgba(234,88,12`、`rgba(63,98,18`。
  - `uses brand values`：tokens `:root` 的 `--accent-primary` 是 `#DD6410`、`--brand-green-main` 是 `#39452B`、`--brand-orange-main` 是 `#DD6410`；theme `:root` 的 `--accent-primary` 是 `#DD6410`；tokens 暗色區塊的 `--accent-primary` 是 `#DD6410`，`--accent-gradient` 不含 `#818cf8`（不分大小寫）。
  - `keeps readable contrast`：`contrast(accentPrimaryLight, '#FFFFFF') >= 3`；`contrast(darkAccentPrimary, darkBgPrimary) >= 3`；`contrast(darkAccentSecondary, darkBgPrimary) >= 3`。

- [ ] **Step 2：執行並確認失敗**
  Run：`npx jest src/styles/__tests__/brandTokens.test.ts`
  Expected：前兩個案例 FAIL（找到 `#ea580c`、值不符）；對比度案例中，暗色主色 `#3F6212` 對 `#12131a` 的那一條 FAIL。

- [ ] **Step 3：照規格「數值」與舊色對應表修改 `tokens.css`、`theme.css`**；`.badge-orange` 改用 `var(--brand-orange-light)`。

- [ ] **Step 4：執行並確認通過**
  Run：`npx jest src/styles/__tests__/brandTokens.test.ts`
  Expected：3 個案例都 PASS。

### Task 2：視覺檢查、驗證、審查、commit

**Files：** 不改程式（有破版才回 Task 1 調數值）

- [ ] **Step 1：** `npm run verify` 全部通過。
- [ ] **Step 2：** 用 `preview_start` 啟動 dev server，打開一張有資料的表格，分別截淺色與暗色的表格＋工具列（點一個儲存格讓作用中外框出現），確認按鈕、作用中外框、側欄 logo 漸層看得清楚、沒有破版。截完 `preview_stop`。
- [ ] **Step 3：** 交 `reviewer` 子代理審查（比較基準 `main`）；處理回饋後重跑 verify。
- [ ] **Step 4：** commit（含規格與計畫檔）：

```bash
git add src/styles/tokens.css src/app/theme.css src/styles/__tests__/brandTokens.test.ts docs/superpowers/specs/2026-10-19-brand-tokens-alignment-design.md docs/superpowers/plans/2026-10-19-brand-tokens-alignment.md
git commit -m "fix(theme): align global brand tokens with FYCD green/orange"
```
