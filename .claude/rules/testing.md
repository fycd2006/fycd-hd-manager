---
paths:
  - "**/__tests__/**"
  - "e2e/**"
  - "jest.config.js"
---

# 測試規則

- Jest 只收 `src/**/__tests__/**`，放別處不會被執行。單檔：`npx jest <路徑>`；單案例：`npx jest -t "<名稱>"`。
- 預設環境是 node；React 元件測試在檔案開頭加 `/** @jest-environment jsdom */`。
- 單元測試不連資料庫：用 `jest.mock('@/lib/prisma', () => ({ ... }))` 只 mock 用到的 model 方法；權限用 `jest.mock('@/lib/authorize')`，即時推播用 `jest.mock('@/lib/pusher-server')`。
- 修 bug 先寫能重現的失敗測試，再修到通過。
- 禁止刪除、`.skip`、`.only` 或放寬斷言來讓測試通過。
- `e2e/` 的 Playwright spec 沒有設定檔，不在 `verify` 內；要跑需另外確認環境。

## 錯誤紀錄

（格式：`- 根因 → 以後做法`，一到兩行，必須可執行）

- jest 預設 worker 數是核心數 − 1（22 核心開 21 個），jsdom worker 合計約 5.4 GB，加上 dev server／其他 session 就分頁，MasterGridView、AiComponents 等元件測試隨機「Exceeded timeout of 5000 ms」→ `jest.config.js` 保持 `maxWorkers: '50%'`；再遇到隨機逾時，先比較同時跑 3 份 `npx jest` 與加 `--maxWorkers` 的結果，不要調高 testTimeout
