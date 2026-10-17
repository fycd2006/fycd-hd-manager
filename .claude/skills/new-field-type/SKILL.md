---
name: new-field-type
description: 新增或擴充資料表欄位型別（如 rating、date 這類）時的檢查清單：要接的所有位置與要補的測試。
argument-hint: <型別 key，如 percent>
---

新增欄位型別：$ARGUMENTS

欄位型別散在多處，漏接一處通常不會報錯，只會靜默失效。

1. **先找參考型別**：挑一個行為最接近的既有型別（例如數值類找 `rating`），用 `explorer` 子代理 grep `'<參考型別>'` 列出所有出現位置。這份清單就是要接的地方，以實際搜尋結果為準。
2. **必接的核心位置**（已確認存在）：
   - `src/modules/database/constants/fieldTypes.ts`：`AVAILABLE_FIELD_TYPES` 與顯示名稱
   - `src/modules/database/fields/types/<Name>FieldType.ts` 實作 `FieldType`，並在 `fields/types/index.ts` 用 `FieldRegistry.register` 註冊（沒註冊會靜默退回 pass-through）
   - `src/modules/database/services/rowValidation.ts`：驗證與型別轉換
   - `src/modules/database/services/rowQuery.ts`、`multiTableQuery.ts`：篩選／排序下推
3. **依參考型別的搜尋結果接其餘位置**：通常包含儲存格渲染（`components/views/grid/`、`views/master/`）、篩選／排序／分組選單（`components/toolbar/menu/`）、`FieldTypeSelector.tsx`、CSV（`utils/csv.ts`）、Airtable 匯入（`src/lib/airtable/`）。
4. **測試（先寫再實作）**：
   - `fields/types/__tests__/`：`validateValue` 合法／非法值、`formatValue`、`getDefaultValue`
   - `services/__tests__/`：`rowValidation` 與 `rowQuery` 對新型別的篩選、排序
5. **驗證**：`npm run verify` 全過；回報接了哪些位置、刻意沒接哪些及原因。
