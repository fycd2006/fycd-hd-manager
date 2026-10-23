# 視圖補強：多重排序、條件群組、篩選運算子

日期：2026-10-19
所屬：Airtable 完整匯入總覽（`2026-10-18-airtable-import-roadmap.md`）子專案 3
基底分支：`feat/airtable-import`（含已修好的日期篩選運算子）

## 目標

讓 Airtable 視圖的多重排序、多層分組、條件群組與常用篩選運算子都能對應到內部視圖並保存；使用者在 UI 也能設定這些條件。匯入轉換器本身屬於子專案 5，不在本次範圍。

## 現況（2026-10-19 盤點）

- 多重排序與多層分組：前端 `SortMenu`／`GroupMenu` 可設定多條，`page.tsx` 也會依序套用；但 `api/tables/[tableId]/views/route.ts` 的 Zod schema 只收 `sortField`／`sortOrder`／`groupByField`，`sortRules`／`groupByRules` 被丟棄，`TableView` 也沒有欄位。重新整理後只剩第一條。
- 篩選：`filters` 存 `{ filterType, rules }`，單層、全部共用一個 AND/OR；沒有條件群組。只在前端執行（`page.tsx` 呼叫 `evaluateCellCondition`）。
- `FilterMenu` 運算子清單寫死在元件內，沒使用 `constants/fieldTypes.ts` 的 `FILTER_OPERATORS`（無人使用）；日期欄位選不到 `date_equal`／`date_before`／`date_after`。
- Airtable 有、內部沒有：單選 is any of／is none of；多選、連結、協作者 has any of／has all of／has none of／is exactly；日期 on or before／on or after／is within、相對日期（today、N days ago 等）。

## 範圍外

- 附件的 filename／file type 篩選（附件與圖片一律不支援）。
- 兩層以上的巢狀條件群組（子專案 5 匯入時攤平並在報告提示）。
- 後端 `rowQuery` 的單一 `filter` 參數（與視圖篩選無關，不改）。
- 列顏色規則（`rowColors`）的運算子。

## 1. 資料模型

### Schema（已取得使用者同意）

`TableView` 新增兩個可為空欄位：

```prisma
sortRules    String?  @db.Text  // JSON: SortRule[]
groupByRules String?  @db.Text  // JSON: GroupByRule[]
```

只新增欄位，不改既有欄位。`sortField`／`sortOrder`／`groupByField` 保留，存檔時同步成第一條規則，舊程式碼與 `rowQuery` 不受影響。本機只跑 `prisma generate`，不執行 `db push`。

### 篩選 JSON（存在既有 `filters` 欄位，向下相容）

```ts
type FilterConjunction = 'AND' | 'OR'

interface FilterRule {
  fieldKey: string
  operator: FilterOperator
  value: string
  values?: string[]          // 多值運算子
  dateMode?: DateFilterMode  // 日期運算子；缺少時視為 'exact'
  dateAmount?: number        // days_ago／days_from_now／past_n_days／next_n_days
}

interface FilterGroup {
  type: 'group'
  filterType: FilterConjunction
  rules: FilterRule[]        // 只允許一層，群組內不可再有群組
}

type FilterItem = FilterRule | FilterGroup

interface FilterGroupConfig {
  filterType?: FilterConjunction
  rules: FilterItem[]
}
```

舊資料（`FilterRule[]` 或 `{ filterType, rules: FilterRule[] }`）不需遷移即可讀取。

### 新增運算子

| 欄位類別 | 運算子 |
|---|---|
| 單選 | `is_any_of`、`is_none_of` |
| 多選、連結、協作者 | `has_any_of`、`has_all_of`、`has_none_of`、`is_exactly` |
| 日期 | `date_on_or_before`、`date_on_or_after`、`date_within` |

`DateFilterMode`：
- 用於 `date_equal`／`date_before`／`date_after`／`date_on_or_before`／`date_on_or_after`：`exact`（用 `value` 的 YYYY-MM-DD）、`today`、`tomorrow`、`yesterday`、`days_ago`、`days_from_now`。
- 用於 `date_within`：`past_week`、`past_month`、`past_year`、`next_week`、`next_month`、`next_year`、`past_n_days`、`next_n_days`。

## 2. 篩選計算

新增純函式模組 `src/modules/database/utils/filterEvaluation.ts`：

- `evaluateFilters(row, config, fields, now = new Date()): boolean`：處理最外層 AND/OR 與一層群組。`page.tsx` 的內嵌篩選迴圈改呼叫它。
- `evaluateFilterRule(value, field, rule, now): boolean`：新運算子在此處理；舊運算子交給 `evaluateCellCondition`（簽名不變，列顏色仍在用）。
- 欄位對應沿用現有邏輯（`field_<id>`、`id`、名稱）。

規則：
- 空群組、未填值的新運算子規則（`values` 為空、`exact` 模式沒有 `value`、需要 N 的模式沒有 `dateAmount`）略過，視為成立。舊運算子行為不變。
- 群組內若全部規則都被略過，群組視為成立；最外層同理。
- 單選／多選：以選項名稱比對，不分大小寫（同現有 `equals`）。
  - `is_any_of`：值在 `values` 中；`is_none_of`：值不在 `values` 中（空值視為不在）。
  - `has_any_of`／`has_all_of`／`has_none_of`：交集非空／`values` 全含／交集為空。
  - `is_exactly`：選取集合與 `values` 集合相同。
- 連結（`{id, value}`）與協作者（`{id, username}`）：以 `id` 字串比對，規則同上。
- 日期：
  - 今天 = `cellDayInZone(now, resolveTimeZone(resolveDateOptions(field.options, field.type)))`，以 YYYY-MM-DD 字串做純日期加減（UTC 計算避免日光節約誤差）。
  - `exact`／`today`／`tomorrow`／`yesterday`／`days_ago`／`days_from_now` 先換算成目標日期，再比 `=`／`<`／`>`／`<=`／`>=`。
  - `date_within` 區間（兩端皆含）：`past_week` [今天−7, 今天]、`past_month` [今天−1 個日曆月, 今天]、`past_year` [今天−1 年, 今天]、`next_*` 對稱、`past_n_days` [今天−N, 今天]、`next_n_days` [今天, 今天+N]。月份不足時取該月最後一天（如 3/31 往回一個月為 2/28 或 2/29）。
  - 儲存格沒有日期時，所有日期比較運算子回傳 false。
- 未知運算子回傳 false（同現況）。

## 3. UI

### 運算子清單統一來源

`constants/fieldTypes.ts` 新增 `getFilterOperators(fieldType): { value, labelKey }[]`，取代 `FilterMenu` 內寫死的清單與未使用的 `FILTER_OPERATORS`。

| 型別 | 運算子 |
|---|---|
| 文字（預設） | contains、not_contains、equals、not_equals、empty、not_empty |
| 數字（number、rating、autonumber、percent、currency） | equals、not_equals、higher_than、higher_than_or_equal、lower_than、lower_than_or_equal、empty、not_empty |
| 單選 | equals、not_equals、is_any_of、is_none_of、empty、not_empty |
| 多選 | has_any_of、has_all_of、has_none_of、is_exactly、empty、not_empty |
| 連結、協作者 | contains、has_any_of、has_all_of、has_none_of、empty、not_empty |
| 日期（date、created_on、last_modified_on） | date_equal、date_before、date_after、date_on_or_before、date_on_or_after、date_within、empty、not_empty |
| boolean | equals |

標籤用 i18n key，補進 `src/lib/i18n/locales/zh-TW.json` 與 `en.json`。

### 條件群組（`FilterMenu`）

- 底部「新增條件」旁加「新增條件群組」。
- 群組以外框區塊呈現：自己的「且／或」、條件列、「新增條件」、右上角刪除群組；群組內沒有「新增條件群組」。
- 最外層「且／或」維持現有切換方式。
- 型別：`filterRules` 狀態由 `FilterRule[]` 改為 `FilterItem[]`（`TableContext`、`useViewConfig`、`ViewToolbar`、`TableWorkspaceView` 等跟著調整型別）。

### 值的輸入

- 多值運算子：新增 `MultiValueSelect`（下拉勾選清單，已選項目以標籤顯示）。
  - 選項來源：單選／多選用欄位選項；連結與協作者用目前資料列中出現過的 `{id, 名稱}` 去重。`FilterMenu` 新增 `rows` prop，由上層傳入。
- 日期運算子：先選模式（今天／明天／昨天／N 天前／N 天後／指定日期；「在範圍內」則為過去／未來一週、一個月、一年、N 天），依模式顯示日期框或數字框。
- 切換欄位時，若目前運算子不在新型別清單內，改為新型別第一個運算子，並清空 `value`／`values`／`dateMode`／`dateAmount`。

### 排序／分組保存

前端已送出 `sortRules`／`groupByRules`，`useViewConfig` 讀取時已優先使用它們；只需後端接收與保存，前端型別 `TableView` 已有這兩個欄位。

## 4. 錯誤處理

- 視圖 PATCH 的 Zod schema 新增：
  - `sortRules`、`groupByRules`：`{ fieldKey: /^field_\d+$/, order: 'asc'|'desc' }[]`，最多 10 條，可為 `null`；也接受 JSON 字串（前端現有序列化方式）並在解析後驗證。不符回 400。
  - 存檔時轉 JSON 字串；`sortField`／`sortOrder`／`groupByField` 若請求未另外提供，同步為第一條規則（空陣列時設為 `null`／`asc`／`null`）。
- `filters` 維持 `z.any()`，不改驗證方式。
- 讀取端：JSON 損壞退回「無篩選」；未知運算子回傳 false。

## 5. 測試

- `utils/__tests__/filterEvaluation.test.ts`：每個新運算子一組 `it.each`；日期用固定 `now` 並含跨時區案例（例如 UTC 與 Asia/Taipei 跨日）、月底邊界；群組測 AND/OR 組合、空群組、略過規則；舊格式設定仍可計算。
- views 路由測試：`sortRules`／`groupByRules` 保存、同步主欄位、400 案例。
- `getFilterOperators` 測試：每個型別回傳的清單。
- `FilterMenu` 最多一個元件測試：新增群組後渲染出群組區塊。不做 E2E。

## 完成條件

`npm run verify` 全部通過，開 PR 到 `feat/airtable-import`。
