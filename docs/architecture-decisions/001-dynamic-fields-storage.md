# Architecture Decision Record (ADR): 動態欄位儲存策略 (Dynamic Field Storage)

## 1. 標題與狀態
- **標題**: 使用 JSON Payload (Schemaless) 取代動態 DDL (Schema-based) 來實作使用者自訂欄位
- **狀態**: 已接受 (Accepted)
- **日期**: 2026-08-09
- **技術棧**: Next.js, Prisma ORM, TiDB (MySQL 相容)

## 2. 背景與問題 (Context)
在開發類似 Airtable/Baserow 的資料庫管理系統時，核心需求是允許使用者「無限期、隨時」新增、刪除、修改資料表的欄位。
傳統的關聯式資料庫設計（Schema-based）需要對真實資料表執行 `ALTER TABLE`，這與我們目前的架構（Prisma 作為全端強型別 ORM）產生了深度的衝突。我們需要決定如何儲存使用者自訂的資料列 (Rows)。

## 3. 評估的方案 (Considered Options)

### 方案 A: 完全動態 Schema (Baserow / NocoDB 模式)
- **實作方式**: 後端攔截使用者的欄位變更操作，直接對 TiDB 執行 `ALTER TABLE ADD COLUMN`。
- **優點**:
  - 資料庫原生的型別約束 (Constraints)。
  - 查詢、排序、篩選效能最佳 (B-Tree 索引)。
- **缺點 (為何不採用)**:
  - **Prisma 限制**: Prisma Client 依賴編譯期的 `schema.prisma`。動態產生的表格與欄位，Prisma 完全無法提供 TypeScript 型別，也無法使用 `findMany` 等 ORM API，必須全面退回撰寫 Raw SQL。
  - **技術債龐大**: 若要維持 Prisma (處理系統表) 與 Raw SQL (處理使用者表) 混用，需要引入 `Kysely` 或 `Atlas` 等額外工具，大幅增加架構複雜度。
  - **DDL 鎖表風險**: 頻繁的線上 `ALTER TABLE` 可能導致效能抖動。

### 方案 B: JSON Payload 模式 (目前採用)
- **實作方式**: 建立固定的實體表 `TableRow`，並使用一個 `data: String @db.Text` (或 `Json`) 欄位將整列資料打包儲存。
- **優點**:
  - **開發速度與型別安全**: 完美契合 Prisma ORM，架構單純。
  - **無鎖表風險**: 新增 100 個欄位也只是 JSON 結構改變，無需更改資料庫 Schema。
- **缺點 (必須承受的代價)**:
  - **資料一致性風險**: 缺乏資料庫約束，髒資料（如歷史遺留的舊 JSON Key）極易產生。必須在應用程式層（App Layer）實作極度嚴格的清洗與正規化邏輯。
  - **長期效能瓶頸**: 當資料量達到數十萬筆，針對 JSON 內部欄位進行 `ORDER BY` 或 `LIKE` 篩選時，無法使用傳統索引，會退化為 Full Table Scan。
  - **Schema 演進成本**: 若未來決定將高頻使用的 JSON 欄位獨立成實體欄位，需要撰寫複雜的 Data Migration Script。

## 4. 決策 (Decision)
我們決定繼續維持 **「方案 B: JSON Payload 模式」**，因為這是在現有（Prisma + Next.js）技術棧中，**CP 值最高且最不增加額外技術債**的選擇。

## 5. 未來的優化藍圖 (Future Mitigation Strategy: "The Third Way")
為了解決方案 B 的「長期效能瓶頸」，我們制定了基於 **TiDB (MySQL) 原生能力** 的漸進式升級路線，而**不需要**替換 Prisma 或引入新的 ORM 工具：

1. **升級為原生 JSON 型別**: 未來可將 `String @db.Text` 轉換為 Prisma 支援的 `Json` 型別。
2. **虛擬生成欄位 (Generated Columns)**:
   當某個欄位成為查詢瓶頸時，直接透過 Prisma Migration 對 `TableRow` 執行：
   ```sql
   ALTER TABLE TableRow ADD COLUMN v_field_X VARCHAR(255) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.field_X')));
   ```
3. **建立表達式索引 (Expression Index)**: 
   針對上述生成的虛擬欄位建立 B-Tree 索引，即可在不破壞 JSON 結構的前提下，獲得接近實體欄位的查詢效能。

## 6. 總結
本決策接受了 JSON 帶來的「維運與清洗成本」，以換取「Prisma 的開發效率與系統穩定性」。前端與後端的資料合併邏輯（React Shallow Merge）必須嚴格過濾廢棄的 JSON Key（如純數字 Key `5` 必須強制轉為 `field_5` 並刪除舊 Key），以防止資料殘留或閃爍現象。
