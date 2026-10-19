# 全域品牌色 token 對齊 — 設計

日期：2026-10-19

## 目標

全域 tokens 的品牌色和實際 FYCD 品牌色（深綠 `#39452B`、橘 `#F58220`）對不上，要修正。表格、工具列、側欄等吃這些 token 的元件，在淺色與暗色下都不能破版，對比度也不能比現在差。

## 現況盤點

- 定義源有兩個：`src/styles/tokens.css`（經由 `globals.css` 載入）和 `src/app/theme.css`。`layout.tsx` 先載入 globals 再載入 theme，所以淺色的 `--accent-primary` 實際上是 theme.css 的值；暗色的 `[data-theme='dark']`／`.theme-dark` specificity 比較高，由 tokens.css 決定。
- `--accent-primary` 約 25 處使用（grid、toolbar、layout、components.css，以及 Form／Gallery／Kanban view），同時當文字色、白字的底色、外框。
- `--accent-secondary`（15 處）主要當文字色；`--accent-gradient`（9 處）是側欄 logo、按鈕、今日標記等的底色。
- `--brand-orange-*` 只有 `latest-comment.css` 在用（按鈕底色、文字）；`--brand-green-*` 只有 tokens.css 自己的 utility class 在用。
- 暗色把主色換成綠 `#3F6212`，放在深底上看不清；`--accent-gradient` 還混了靛藍 `#818cf8`。
- 元件裡另外還有約 370 處寫死的舊色（ViewToolbar、MobileBottomNav、GridViewCell 等），**不在本次範圍**。

## 決定

1. 橘色維持「操作／作用中」角色，綠色維持「結構」角色。互動用途用可讀的深橘 `#DD6410`（白字 3.6:1，與舊 `#EA580C` 相同；暗色底上當文字 5.2:1）。品牌原橘 `#F58220` 用在漸層、次要強調、focus。數值取自 PR #24 已驗證的 `--dash-*`。
2. 範圍只有 `tokens.css` 與 `theme.css`：改 token 值，也把這兩個檔裡 utility class 寫死的舊色換掉。
3. `--brand-orange-main` 用 `#DD6410`，避免 latest-comment 按鈕的對比度變差。

## 數值

淺色（`tokens.css :root`）：

| Token | 新值 |
|---|---|
| `--border-active` | `#DD6410` |
| `--bg-cell-active` | `#FFF1E5` |
| `--brand-orange-main` / `-hover` / `-light` / `-glow` | `#DD6410` / `#C2560F` / `#FFF1E5` / `rgba(221, 100, 16, 0.2)` |
| `--brand-green-main` / `-hover` / `-light` / `-border` | `#39452B` / `#2C3621` / `#EEF0E8` / `#4A5A37` |
| `--accent-primary` / `--accent-secondary` | `#DD6410` / `#F58220` |
| `--accent-gradient` / `--cta-gradient` | `linear-gradient(135deg, #DD6410 0%, #F58220 100%)` |

淺色（`theme.css :root`）：`--accent-primary #DD6410`、`--accent-primary-hover #C2560F`、`--accent-soft #FFF1E5`、`--accent-soft-hover #FFE4CC`、`--border-focus #F58220`。

暗色（`tokens.css [data-theme='dark'], .theme-dark`）：

| Token | 新值 |
|---|---|
| `--bg-cell-hover` | `rgba(163, 179, 138, 0.05)` |
| `--bg-cell-active` | `rgba(245, 130, 32, 0.14)` |
| `--border-active` | `#F58220` |
| `--accent-primary` / `--accent-secondary` | `#DD6410` / `#F58220` |
| `--accent-gradient` | `linear-gradient(135deg, #DD6410 0%, #F58220 100%)` |

Utility class 寫死的舊色對應：

- `rgba(234, 88, 12, a)` → `rgba(221, 100, 16, a)`
- `#C2410C` → `#C2560F`
- `#EA580C` → `#DD6410`
- `#F97316` → `#F58220`
- `#3F6212` → `#39452B`
- `rgba(63, 98, 18, a)` → `rgba(57, 69, 43, a)`

`.badge-orange` 引用了不存在的 `--accent-orange-light`，改成 `--brand-orange-light`。`.btn-orange` 的 fallback 漸層一起更新。

## 測試

新增 `src/styles/__tests__/brandTokens.test.ts`（node 環境，用 `fs` 讀兩個 CSS 檔）：

- 兩個檔都沒有舊色：`#EA580C`、`#F97316`、`#C2410C`、`#3F6212`、`#365314`、`#4D7C0F`、`#F7FEE7`、`#818CF8`、`rgba(234, 88, 12`、`rgba(63, 98, 18`（不分大小寫、容許空白差異）。
- 淺色（tokens 與 theme）和暗色的 `--accent-primary` 都是 `#DD6410`；`--brand-green-main` 是 `#39452B`。
- 對比度（WCAG 相對亮度）：`--accent-primary` 配 `#FFFFFF` ≥ 3:1；暗色 `--accent-primary` 與 `--accent-secondary` 對暗色 `--bg-primary` ≥ 3:1。

## 驗證

`npm run verify` 全部通過；dev server 截淺色與暗色的表格與工具列，檢查沒有破版、作用中儲存格與按鈕看得清楚。

## 不做

元件與其他 `styles/*.css` 裡寫死的舊色，另開後續工作分批處理。
