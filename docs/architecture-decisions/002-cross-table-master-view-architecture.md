# 跨資料表整列讀取與總表整合 — 完整實作架構總覽

> 彙整自架構評估報告到 Phase 2 收尾為止，前後八輪以上複核所確立的所有決策。此文件是目前的「定案版本」，之後有任何決策異動，請直接修改對應章節，避免散落在各輪對話紀錄裡不好追溯。

---

## 一、核心架構決策

**採用方案**：混合式架構 = **方案 2（跨表虛擬彙整視圖）** 為讀取底層 ＋ **稀疏覆寫表（`MasterViewOverride`）** 補足總表獨有欄位（Phase 3 才實作，目前尚未動工）。

**捨棄方案**：
- 方案 1（`linked_row_view` 整列展開）獨立實作 → 改為評估後**部分採用**：不做成全新欄位型態，最終在 Phase 2 以「On-demand Batch Hydration」模式重新設計（詳見第五節），跟原始方案 1 的精神接近但實作方式不同。
- 方案 3（整列複製 + 雙向鏡像同步）→ 已捨棄，僅在效能極端情境下（讀取量遠大於子表本身）才會重新評估。

**資料庫環境（重要更正）**：專案原先誤判為 MySQL 8.0+，**實際環境為 TiDB v8.5.3-serverless**（MySQL 協定相容，底層 TiKV）。已驗證與 MySQL 行為一致的部分：`sql_mode`（`STRICT_TRANS_TABLES` 等）、Generated Column + 索引支援。已知差異：`AUTO_INCREMENT` 為分散式區塊分配，`id` 大小不保證與插入時間嚴格單調對應（但作為 keyset 分頁的 tie-breaker 依然安全，因為只要求全域唯一）。

---

## 二、Phase 0：技術前提確認（已完成）

| 確認項目 | 結論 |
| :--- | :--- |
| 資料庫引擎 | TiDB v8.5.3-serverless（非原先假設的 MySQL） |
| `TableRow.data` 型別 | 原生 `Json` |
| v1 顯示模式 | Strict 模式（僅顯示已對映的共用欄位，不支援 Sparse） |
| 權限檢查時機 | 查詢下推前強制過濾（Pre-query Filter），且必須是 workspace 層級單次檢查，不對每張子表重複呼叫 |

---

## 三、Phase 1：MVP 虛擬總表（已完成）

### 3.1 資料層

- **`MasterViewFieldMapping`**：定義總表 `targetKey` 與各子表 `sourceFieldId` 的對映關係，含型別轉譯標記（`transform: 'STRING' | 'NUMBER' | 'DATE' | 'JSON'`）。
- **型別不一致處理**：**不在 SQL 層做 `CAST`**（避免 TiDB/MySQL `sql_mode` 嚴格模式報錯），所有型別轉譯搬到 Node.js 應用層，失敗時標記 `_typeMismatch: true`。
- **複合索引**：`(tableId, deletedAt, createdAt DESC, id DESC)`，支撐 keyset 分頁的索引下推，已用 `EXPLAIN` 實測確認 TiDB Optimizer 走 `IndexRangeScan` 而非全表掃描。

### 3.2 查詢層 — `multiTableQuery.ts`

- **權限預過濾**：`getAuthorizedTableIds(workspaceId)` 一次查詢取得該 workspace 下所有未軟刪除的子表 ID；**呼叫這個函式之前**，route handler 必須先執行一次 `authorizeAction({ workspaceId, action: 'canViewData' })` 做使用者層級的硬性授權閘門（403/401 短路中斷，絕不進入資料查詢）。
- **查詢組裝**：`UNION ALL` 跨表聯集查詢，欄位透過 `JSON_OBJECT` + `JSON_UNQUOTE(JSON_EXTRACT(...))` 依 Field Mapping 統一命名。
- **分頁機制**：**Cursor-based（Keyset）分頁**，取代原本的 `LIMIT/OFFSET`（避免深分頁效能劣化）。
  - Cursor 內容：`{ createdAt, tableId, rowId }`，序列化為 JSON 後以 **Base64URL**（非標準 Base64）編碼，避免 `+`、`/`、`=` 在 URL Query String 傳輸時被誤解析。
  - SQL 條件：`WHERE (createdAt, tableId, id) < (?, ?, ?) ORDER BY createdAt DESC, tableId DESC, id DESC LIMIT ?`。
  - 日期綁定改用 `Date` 物件透過 Prepared Statement 直接綁定，不使用 `FROM_UNIXTIME()` 反解（避免秒/毫秒單位換算錯誤）。
- **排序功能**：**v1 不支援動態欄位排序**，固定 `ORDER BY createdAt DESC`；動態排序（含 `sortField`/`sortOrder`）延後至 Phase 4，屆時需搭配 Generated Column 索引與動態 cursor 設計一併處理（因為動態排序欄位需要對應動態的 keyset tie-breaker，兩者必須同步設計，不能分開做）。
- **篩選功能**：**v1 不支援 `filterParam`/`searchQuery`**，延後至 Phase 4，且屆時僅限對 `isIndexed = true` 的對映欄位開放篩選。
- **子表數量上限**：單一總表最多關聯 **20 張子表**，前後端皆有硬性驗證。

### 3.3 API 層

- **路由**：`GET /api/workspaces/[id]/all-rows`
- **回應結構**：`{ rows: [{ id, _sourceTableId, _sourceRowId, data, createdAt }], nextCursor }`，`id` 格式為 `${_sourceTableId}-${_sourceRowId}` 供前端 React key 使用。
- **錯誤處理**：正式環境回傳通用錯誤訊息，避免洩漏內部細節；開發環境回傳詳細 `error.message`；後端一律完整記錄 log。
- **日期驗證**：正規表示式先驗證格式（ISO 8601），再交 `Date` 物件做二次邏輯檢查（防呆 `2026-02-30` 這類格式正確但邏輯錯誤的日期），不依賴原生 `Date()` 的寬鬆解析。

### 3.4 測試覆蓋

- Cursor 編碼/解碼往返測試（含 URL query string 模擬、`encodeURIComponent` 往返）。
- 深分頁 `EXPLAIN` 驗證（索引下推確認）。
- 權限批次查詢正確性測試（排除軟刪除／孤兒表）。
- **路由層級**端對端負向測試：401（未登入）、403（無 workspace 權限），並斷言授權失敗時 `getMultiTableRows`／`prisma.databaseTable.findMany` 完全未被呼叫。

---

## 四、Phase 2：卡片化顯示與編輯（已完成）

### 4.1 架構決策：捨棄 Snapshot 模式，改採 On-demand Batch Hydration

盤點既有 `lookup`/`rollup` 的 `cascadeRecomputeSingleLevel` 機制後，發現其**存在 300 筆級聯截斷上限**（詳見第六節 Tech Debt），且多欄位快照會造成 JSON 體積膨脹，因此**不採用**原本評估中的「複用 lookup snapshot 模式」，改為：

- 資料列的 `data` 僅儲存關聯 ID，讀取時由服務層批次 Hydrate 出卡片摘要（`primaryField`、預覽欄位、所屬表名），不落地持久化快照。
- 效能上是「每個不同目標子表各 1 次批次查詢」，而非嚴格意義的固定 O(1)（多個 `link_row` 欄位指向不同目標表時，查詢次數等比例增加，但仍遠優於逐列查詢）。

### 4.2 服務層 — `cardHydrator.ts`（已完成）

- **伺服器端強制遮蔽**：對使用者無權限的目標子表，**完全不對 DB 發送查詢**，回應只包含 `{ id, tableId, _accessDenied: true }`，欄位內容在序列化前就已經是 `undefined`，不會出現在 Response Body。
- 測試覆蓋：整批無權限遮蔽、同頁混合授權（部分表有權限、部分沒有）、單列多個 `link_row` 欄位指向不同權限表、空輸入零查詢。

### 4.3 權限驗證層 — `linkRowOperations.ts`（已完成）

依操作類型定義權限矩陣，並已轉為 11 組參數化測試案例：

| 操作 | 來源表要求 | 目標表要求 | 說明 |
| :--- | :--- | :--- | :--- |
| View Card | `canViewData` | `canViewData`，否則遮蔽 | 無權限時回傳最小遮蔽物件 |
| Edit Linked Row | `canViewData`（或更高） | **`canEditData`** | 編輯的是目標列本身的內容 |
| Detach | **`canEditData`** | 不限（含無權限也可解除） | 本質是修改來源列的關聯陣列，允許清理無效關聯 |
| Link Existing | **`canEditData`** | **`canViewData`** | 候選清單依權限篩選；**後端對客戶端直傳的目標 ID 二次驗證**，防止繞過候選清單的「Blind Linking」 |

### 4.4 Phase 2.2 前端組件與路由整合（已完成）

- [x] 前端組件：[`LinkedRowCard`](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/modules/database/components/cards/LinkedRowCard.tsx)、[`CardDrawer`](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/modules/database/components/cards/CardDrawer.tsx)（Hover Popover 摘要預覽 / 側邊抽屜展開編輯）。
- [x] API 端點串接：`PATCH /api/tables/[targetTableId]/rows`（Edit）、Detach、Link Existing 路由中明確引入並呼叫 [`linkRowOperations.ts`](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/modules/database/services/linkRowOperations.ts) 做後端二次驗證（防範 Blind Linking）。
- [x] 路由層級整合測試：於 [`route.test.ts`](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/app/api/tables/[tableId]/rows/__tests__/route.test.ts) 驗證 Blind Linking 防護、混合多欄位關聯驗證與直接目標列編輯授權。
- [x] 組件單元測試：[`LinkedRowCard.test.tsx`](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/modules/database/components/cards/__tests__/LinkedRowCard.test.tsx)、[`CardDrawer.test.tsx`](file:///c:/Users/ntutuser-2256/Documents/110360231Jeffrey%20Chen/Antigravity/FYCD-HD-MANAGER/src/modules/database/components/cards/__tests__/CardDrawer.test.tsx) 驗證遮蔽狀態、抽屜開啟/關閉與欄位自動儲存。

---

## 五、Phase 3：`MasterViewOverride` 混合架構（已完成）

- [x] 建立 `MasterViewOverride` model：`@@unique([masterViewId, sourceTableId, sourceRowId])` + `deletedAt`（soft delete）+ `@@index([sourceTableId, sourceRowId])`（供反查清理）。
- [x] 在 `rowCascade.ts` 與 `DELETE /api/tables/[tableId]/rows` 掛上「來源列刪除 → 對應 Override 標記 `deletedAt`」的清理邏輯（`softDeleteMasterViewOverrides`）。
- [x] 讀取層批次合併：`mergeMasterViewOverrides` 支援 O(1) 批次合併，並於 `GET /api/workspaces/[id]/all-rows?masterViewId=...` 自動生效。
- [x] 寫入端點與併發測試：`PATCH /api/workspaces/[id]/master-views/[viewId]/rows` 提供冪等 `upsert`，單元測試與路由整合測試均通過。

---

## 六、已知技術債（已全數清零）

- [x] **`[P1 - 資料正確性]` `rowCascade.ts` 級聯重算 300 筆截斷上限**：已實作雙軌機制（Fast-path 前 50 筆同步回傳 + Async Chunked Engine 每批 100 筆背景迭代運算），徹底消除筆數上限並保證 100% 最終一致性，單元測試通過。

---

## 七、Phase 4：進階功能

- [x] **Phase 4.1 動態欄位排序與動態 Keyset Cursor（已完成）**：支援動態欄位投影與動態 Keyset Cursor 三元組 `(sort_val, tableId, id)`，支援 ASC / DESC 任意方向 O(1) 深度分頁比較，`MasterGridView` 支援表頭點擊排序與圖示指示，單元與 UI 整合測試 100% 通過。
- [x] **Phase 4.2 動態欄位篩選（已完成）**：支援 8 種運算子（`contains`、`not_contains`、`equals`、`not_equals`、`higher_than`、`lower_than`、`is_empty`、`is_not_empty`），SQL 條件走白名單防護 + Prisma 參數化 Prepared Statement 直接下推至各子表掃描階段（TiKV Coprocessor），`MasterGridView` 支援可展開篩選工具列與多條件設定，單元與 UI 測試 100% 通過。
- [x] **Phase 4.3 跨表聚合（已完成）**：支援 `sum`（加總 $\Sigma$）、`avg`（平均 $\bar{x}$）、`min`、`max`、`count`、`empty_count`、`percent`（填寫率）、`unique`（不重複值）等 8 種聚合指標，`MasterGridView` 底部整合 Sticky Summary Footer 與下拉切換選單，單元與 UI 測試 100% 通過。
- [x] **Phase 4.4 Sparse 模式（已完成）**：實作 `analyzeFieldFrequencies` 覆蓋率分析引擎，支援預設 15 欄位上限自動截斷保護，`MasterGridView` 頂部整合「欄位管理」Popover、稀疏率 Badge 標籤、自訂顯示開關與重置功能，單元與 UI 測試 100% 通過。
- [x] **Phase 4.5 快取層（已完成）**：實作 `masterViewCache.ts`，支援短 TTL（10 秒）查詢快取（Redis + In-Memory Fallback 雙模機制），並於子表刪除/寫入與總表覆寫時主動觸發 `invalidateMasterViewCache` 失效，單元與 API 整合測試 100% 通過。

---

## 八、Phase 5：使用者友善度與資料信任強化（已完成）

- [x] **Phase 5.1 欄位對齊可視化與來源追溯**：擴充 `UnifiedColumnInfo.sources` 陣列，表頭整合資訊 Popover 即時展開來源子表清單；當同名欄位型別不一致時亮起 `⚠️ 型別衝突` 警示；支援「取消合併（拆分為個別欄位）」與自訂映射。
- [x] **Phase 5.2 權限過濾透明度**：`/api/workspaces/[id]/all-rows` 統計並回傳 `permissionInfo`（總資料表數 vs 授權資料表數），前端頂部顯示遮蔽提示條，表尾跨表統計旁標註授權計算範圍圖示。
- [x] **Phase 5.3 覆寫層完整工作流**：實作 `revertMasterViewOverride` 與 `DELETE /api/workspaces/[id]/master-views/[viewId]/rows`，支援一鍵還原覆寫欄位回來源子表原始值。
- [x] **Phase 5.4 稀疏模式透明化與欄位釘選（Pinning）**：顯示稀疏保護提示條與「一鍵顯示全部」；支援將核心欄位釘選在表格左側（`position: sticky`），釘選欄位永久豁免於稀疏模式的自動隱藏。
- [x] **Phase 5.5 統計聚合層型別排除提示**：`computeColumnSummary` 計算非數值排除筆數 `excludedMismatchCount`，表尾加總/平均呈現 `⚠️(N 筆已排除)` 提示。
- [x] **Phase 5.6 基礎體驗打磨**：提供 UTF-8 CSV 匯出（含 BOM 防止中文亂碼）、搜尋範圍明確提示、三步驟引導式空狀態。

---

## 附錄一：Generated Column + Index 在 TiDB Serverless 上的驗證結果

已實測 `CREATE TABLE ... GENERATED ALWAYS AS (...) STORED` + `ADD INDEX`，`EXPLAIN` 確認 Optimizer 選擇 `IndexRangeScan` 而非全表掃描（`task: cop[tikv]`，索引下推至 TiKV Coprocessor 層），Phase 4 實作動態篩選/排序時可直接沿用此驗證結果，不需重新查證基礎可行性。

---

## 附錄二：這個專案建立起來的複核習慣（建議延續到 Phase 3、4、5）

八輪以上的複核下來，反覆出現的問題模式都是：**單獨看合理的決策，兜在一起才出事**（NUMBER 排序 vs SQL 不做 CAST）、**文字敘述聽起來對，攤開實際程式碼才發現漏了一步**（cursor 單位、workspace 授權檢查的實際位置）。因此後續每個關鍵決策，建議持續要求：
1. 附上實際程式碼，不是文字描述。
2. 附上實際執行結果（測試輸出、`EXPLAIN`、指令輸出），不是「應該沒問題」。
3. 安全/權限相關的驗證，斷言要驗證「查詢從一開始就沒發生」，而不是「資料被查出來後才過濾」。
4. 設計階段列出的矩陣/情境清單，實作完成時要能一一對應到實際測試案例。

