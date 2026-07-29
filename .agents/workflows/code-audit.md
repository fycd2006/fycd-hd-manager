---
description: 對 TypeScript/React 專案進行全方位語意層程式碼檢核（包含正確性、React Hooks 風險、安全性、效能、可維護性與測試覆蓋率）
---

# Code Audit Workflow Guidelines

本工作流用於對 Repository 或指定 PR Diff 進行全方位程式碼檢核與語意分析。

## 檢核六大維度

### 1. 正確性 (Correctness)
- 邊界條件處理（如 `null` / `undefined` / 空字串 / 0 除數防禦）
- 非同步競態條件 (Async Race Conditions) 與未捕獲之 Promise Rejection
- 類型安全（避免不必要的 `any` 強制轉型或未防護的型別斷言）

### 2. React 特定風險 (React-Specific Risks)
- **Hooks 規則**: 嚴格遵守 React Rules of Hooks，禁止在條件句、迴圈或 early return 後呼叫 Hooks
- **useEffect 依賴陣列**: 確保依賴完整，避免過期閉包 (Stale Closures) 或無限重跑
- **元件重新渲染優化**: 避免在渲染過程中內聯建立物件或函式導致子元件無謂重繪

### 3. 安全性 (Security)
- **XSS / HTML 注入**: 檢視 DOM 渲染（避免未處置的 `dangerouslySetInnerHTML`）
- **身份驗證與 Session 安全**: 密碼 Hash 演算法、HMAC 簽名驗證與 Session Cookie 配置
- **API 限流 (Rate Limiting)**: 敏感端點（如登入、註冊）必須有抗爆破保護

### 4. 效能 (Performance)
- **資料庫與 API 效能**: 消除 N+1 查詢，批次併發寫入/更新，減少資料庫 Round-trip
- **前端 Render 範圍**: 大表/大列表虛擬化渲染 (Virtualization)，組件狀態階層適度解開

### 5. 可維護性 (Maintainability)
- 程式碼結構模組化，避免單一檔案過大（超過 500 行應思考拆分）
- 命名規範一致性，保持高內聚低耦合

### 6. 測試覆蓋率 (Testing)
- 核心商業邏輯與 API Handler 應具備可驗證之單元測試或自動化測試
