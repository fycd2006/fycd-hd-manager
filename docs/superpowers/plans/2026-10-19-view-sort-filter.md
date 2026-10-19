# 視圖補強（多重排序、條件群組、篩選運算子）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 多重排序／多層分組能保存；篩選支援一層條件群組、多值運算子與相對日期，UI 可設定。

**Architecture:** `TableView` 新增 `sortRules`／`groupByRules` Text 欄位，PATCH 驗證後保存並同步主欄位。篩選 JSON 擴充為 `FilterItem[]`（規則或一層群組），由新的純函式模組 `utils/filterEvaluation.ts` 計算，`page.tsx` 呼叫。`FilterMenu` 改用 `getFilterOperators` 單一清單，新增群組區塊、`MultiValueSelect` 與日期模式輸入。

**Tech Stack:** Next.js 16、React 19、Prisma 6（TiDB）、Zod、Jest（node／jsdom）、@testing-library/react。

**Spec:** `docs/superpowers/specs/2026-10-19-view-sort-filter-design.md`

## Global Constraints

- 不執行 `npm run build`、不執行 `prisma db push`；schema 改動後只跑 `npx prisma generate`。
- 每個 commit 前 hook 會跑 `npm run verify`；commit 前停掉 dev server。
- UI 文案繁體中文，新字串放 `src/lib/i18n/locales/zh-TW.json` 與 `en.json` 的 `filter` 區段。
- `evaluateCellCondition` 簽名與既有運算子行為不變（列顏色仍使用）。
- `GridView.tsx`、`page.tsx` 只做最小改動。
- 排序／分組規則：`fieldKey` 符合 `/^field_\d+$/`，`order` ∈ `asc|desc`，最多 10 條。
- 群組只允許一層。
- PR 目標分支：`feat/airtable-import`。

## Review Focus

1. 舊格式篩選（`FilterRule[]`、`{filterType, rules}`、雙重字串化）照樣能讀取與計算 → Task 2 測試舊格式。
2. 規則引用已刪除的欄位：新運算子略過該規則（視為成立），舊運算子維持現行行為 → Task 2 測試。
3. 多選值存成 JSON 字串（`'["A","B"]'`）或物件陣列時，has_* 仍能正確比對（走 `parseSelectItems`）→ Task 2 測試。
4. 日期儲存格為純日期 `2026-10-19` 與 ISO 時間 `2026-10-18T17:00:00Z`（台北已是 10/19）時，相對日期依欄位時區判斷 → Task 3 測試。
5. PATCH `sortRules: []` 會把 `sortField` 清成 `null`、`sortOrder` 設為 `asc`，不會留下舊的主排序 → Task 1 測試。

---

### Task 1: 排序／分組規則保存（schema＋API）

**Files:**
- Modify: `prisma/schema.prisma`（`model TableView`，`sortOrder` 下方）
- Modify: `src/app/api/tables/[tableId]/views/route.ts`
- Test: `src/app/api/tables/[tableId]/views/__tests__/route.test.ts`

**Interfaces:**
- Produces: `TableView.sortRules`、`TableView.groupByRules`（JSON 字串或 null）；PATCH 接受 `sortRules`／`groupByRules`：`SortRule[] | string | null`。

- [ ] **Step 1: 寫失敗測試**（在 `describe('PATCH ...')` 內新增）
  - `saves sortRules array as JSON and syncs primary sortField`：body `{ viewId: 1, sortRules: [{fieldKey:'field_2',order:'desc'},{fieldKey:'field_3',order:'asc'}] }` → `update` 的 `data` 含 `sortRules: '[{"fieldKey":"field_2","order":"desc"},{"fieldKey":"field_3","order":"asc"}]'`、`sortField: 'field_2'`、`sortOrder: 'desc'`。
  - `accepts sortRules as JSON string`：同上但 `sortRules` 以字串送出，結果相同（不可雙重字串化）。
  - `clears primary sort when sortRules is empty`：`sortRules: []` → `sortRules: '[]'`、`sortField: null`、`sortOrder: 'asc'`。
  - `explicit sortField wins over sync`：同時送 `sortRules`（第一條 field_2）與 `sortField: 'field_9'` → `sortField: 'field_9'`。
  - `saves groupByRules and syncs groupByField`：`groupByRules: [{fieldKey:'field_5',order:'asc'}]` → `groupByRules` JSON、`groupByField: 'field_5'`；空陣列 → `groupByField: null`。
  - `it.each` 400 案例：`fieldKey: 'name'`、`order: 'up'`、11 條規則、`sortRules: 'not json'` → status 400，`update` 未被呼叫。

- [ ] **Step 2: 執行確認失敗**
  Run: `npx jest "src/app/api/tables/\[tableId\]/views"`　Expected: 新案例 FAIL。

- [ ] **Step 3: 實作**
  - schema 加 `sortRules String? @db.Text // JSON: SortRule[]` 與 `groupByRules String? @db.Text // JSON: GroupByRule[]`，跑 `npx prisma generate`。
  - route 定義 `ruleListSchema`：`z.array(z.object({ fieldKey: z.string().regex(/^field_\d+$/), order: z.enum(['asc','desc']) })).max(10)`；`sortRules`／`groupByRules` 用 `z.preprocess` 先把字串 `JSON.parse`（失敗時保留原字串，讓陣列驗證失敗 → 400），再 `ruleListSchema.nullable().optional()`。
  - handler：有給 `sortRules` 時存 `JSON.stringify`（null 存 null）；`sortField`／`sortOrder` 未在 body 出現時，由第一條規則同步（空陣列或 null → `null`／`'asc'`）。`groupByRules`／`groupByField` 同理。

- [ ] **Step 4: 執行確認通過**（同 Step 2 指令，全部 PASS，含既有案例）

- [ ] **Step 5: Commit** `feat(views): persist multi-level sort and group rules`

---

### Task 2: 篩選型別與非日期運算子計算

**Files:**
- Modify: `src/modules/database/types/index.ts`（Filters 區段）
- Create: `src/modules/database/utils/filterEvaluation.ts`
- Test: `src/modules/database/utils/__tests__/filterEvaluation.test.ts`

**Interfaces:**
- Produces（types）：
  ```ts
  export type FilterConjunction = 'AND' | 'OR'
  export type DateFilterMode = 'exact'|'today'|'tomorrow'|'yesterday'|'days_ago'|'days_from_now'
    |'past_week'|'past_month'|'past_year'|'next_week'|'next_month'|'next_year'|'past_n_days'|'next_n_days'
  // FilterOperator 增加：'is_any_of'|'is_none_of'|'has_any_of'|'has_all_of'|'has_none_of'|'is_exactly'
  //                     |'date_on_or_before'|'date_on_or_after'|'date_within'
  export interface FilterRule { fieldKey; operator; value: string; values?: string[]; dateMode?: DateFilterMode; dateAmount?: number }
  export interface FilterGroup { type: 'group'; filterType: FilterConjunction; rules: FilterRule[] }
  export type FilterItem = FilterRule | FilterGroup
  export interface FilterGroupConfig { filterType?: FilterConjunction; rules: FilterItem[] }
  ```
- Produces（filterEvaluation.ts）：
  - `isFilterGroup(item: FilterItem): item is FilterGroup`
  - `findFilterField(fields: TableField[], fieldKey: string): TableField | undefined`（比對 `field_<id>`、`id`、名稱，同 `page.tsx` 現行邏輯）
  - `evaluateFilterRule(value: unknown, field: TableField | undefined, rule: FilterRule, now: Date): boolean`
  - `evaluateFilters(row: TableRow, filterType: FilterConjunction, items: FilterItem[], fields: TableField[], now?: Date): boolean`
  - `readCellForFilter(row: TableRow, fieldKey: string): unknown`（同 `page.tsx` 的 `getCellValue`；若 `getCellValue` 可直接匯入就沿用，不另寫）

- [ ] **Step 1: 寫失敗測試**
  - 選取類 `it.each`（單選欄位 options 含 A/B/C）：`is_any_of ['a','b']` 對 `'A'` → true、對 `'C'` → false、對空 → false；`is_none_of ['a']` 對 `'B'` → true、對空 → true。
  - 多選 `it.each`，值用 `'["A","B"]'` 與 `['A','B']` 兩種形式：`has_any_of ['B','X']` true；`has_all_of ['A','B']` true、`['A','C']` false；`has_none_of ['C']` true；`is_exactly ['B','A']` true、`['A']` false。
  - 連結值 `[{id:3,value:'甲'},{id:5,value:'乙'}]`、協作者值 `[{id:7,username:'u'}]`：`has_any_of ['5']` true、`has_all_of ['3','9']` false、`has_none_of ['7']` 對協作者 → false。
  - 略過：`values: []` 的新運算子 → true；欄位不存在＋新運算子 → true；欄位不存在＋`contains` → 與 `evaluateCellCondition(val, undefined, 'contains', v)` 結果相同。
  - 群組：`AND [rule真, group(OR [假, 真])]` → true；`AND [rule真, group(AND [假, 真])]` → false；`OR [假, group(空)]` → 空群組略過後只剩假 → false；整體空 → true；全部略過 → true。
  - 舊格式：`evaluateFilters(row, 'AND', [{fieldKey:'field_1',operator:'contains',value:'ab'}], fields)` 與現行結果一致。

- [ ] **Step 2: 執行確認失敗**　Run: `npx jest src/modules/database/utils/__tests__/filterEvaluation.test.ts`　Expected: FAIL（模組不存在）。

- [ ] **Step 3: 實作** 型別與上列函式。略過判斷集中在 `isRuleSkipped(rule, field)`；選取名稱用 `parseSelectItems` 後小寫比對；連結／協作者取 `String(item.id)`。日期運算子此任務先交給 `evaluateCellCondition`（Task 3 取代）。「全部略過」的群組／最外層回傳 true，`OR` 只在至少一條未略過時才要求 some。

- [ ] **Step 4: 執行確認通過**

- [ ] **Step 5: Commit** `feat(filter): add filter groups and multi-value operators`

---

### Task 3: 日期模式與相對日期

**Files:**
- Modify: `src/modules/database/utils/filterEvaluation.ts`
- Test: `src/modules/database/utils/__tests__/filterEvaluation.test.ts`

**Interfaces:**
- Consumes: `cellDayInZone(value: unknown, tz: string)`、`resolveTimeZone`、`resolveDateOptions`（`utils/dateTime.ts`）
- Produces: `addDays(day: string, n: number): string`、`addMonthsClamped(day: string, n: number): string`（YYYY-MM-DD，UTC 計算；月底夾到該月最後一天）、`resolveDateTarget(rule: FilterRule, today: string): string | null`、`resolveDateRange(rule: FilterRule, today: string): [string, string] | null`

- [ ] **Step 1: 寫失敗測試**（`now = new Date('2026-10-19T03:00:00Z')`）
  - `addMonthsClamped('2026-03-31', -1)` → `'2026-02-28'`；`('2024-03-31', -1)` → `'2024-02-29'`；`addDays('2026-12-31', 1)` → `'2027-01-01'`。
  - `it.each` 比較（欄位 tz `UTC`，today=2026-10-19）：`date_equal today` 對 `'2026-10-19'` true；`date_before yesterday` 對 `'2026-10-17'` true、`'2026-10-18'` false；`date_on_or_before days_ago 2` 對 `'2026-10-17'` true；`date_on_or_after days_from_now 3` 對 `'2026-10-22'` true、`'2026-10-21'` false；`date_after exact '2026-10-01'` 對 `'2026-10-02'` true；舊規則無 `dateMode`、`date_equal value '2026-10-19'` 仍 true。
  - `date_within`：`past_week` 對 `'2026-10-12'` true、`'2026-10-11'` false、`'2026-10-20'` false；`next_month` 對 `'2026-11-19'` true、`'2026-11-20'` false；`past_year` 對 `'2025-10-19'` true；`past_n_days 3` 對 `'2026-10-16'` true；`next_n_days 0` 只含今天。
  - 時區：`now = new Date('2026-10-18T17:00:00Z')`、值 `'2026-10-18T15:00:00Z'`。欄位 tz `Asia/Taipei`（today=10-19、值=10-18）→ `date_equal yesterday` true、`today` false；欄位 tz `UTC`（today=10-18、值=10-18）→ `date_equal today` true。
  - 略過：`days_ago` 無 `dateAmount` → true；`exact` 無 `value` → true；空儲存格 → false。

- [ ] **Step 2: 執行確認失敗**

- [ ] **Step 3: 實作** 今天 = `cellDayInZone(now.toISOString(), tz)`；日期運算子一律在 `evaluateFilterRule` 內處理，不再交給 `evaluateCellCondition`；`date_within` 區間依 spec 第 2 節（兩端皆含）。

- [ ] **Step 4: 執行確認通過**

- [ ] **Step 5: Commit** `feat(filter): relative date modes and date_within`

---

### Task 4: 運算子清單單一來源與 i18n

**Files:**
- Modify: `src/modules/database/constants/fieldTypes.ts`（取代 `FILTER_OPERATORS`）、`src/modules/database/constants/index.ts`（改匯出）
- Modify: `src/lib/i18n/locales/zh-TW.json`、`src/lib/i18n/locales/en.json`
- Create: `src/modules/database/constants/__tests__/filterOperators.test.ts`

**Interfaces:**
- Produces: `getFilterOperators(fieldType: string | undefined): { value: FilterOperator; labelKey: string }[]`；`MULTI_VALUE_OPERATORS: FilterOperator[]`；`DATE_OPERATORS: FilterOperator[]`；`DATE_COMPARE_MODES: DateFilterMode[]`（exact…days_from_now）；`DATE_WITHIN_MODES: DateFilterMode[]`；`NO_VALUE_OPERATORS = ['empty','not_empty']`。

- [ ] **Step 1: 寫失敗測試** `it.each` 每個型別回傳的 `value` 陣列，完全等於 spec 第 3 節表格（依表格順序）；`created_on`、`last_modified_on` 同 `date`；`rating` 同數字；未知型別同文字。另測每個 `labelKey` 在 `zh-TW.json` 與 `en.json` 都存在。

- [ ] **Step 2: 執行確認失敗**

- [ ] **Step 3: 實作** 刪除 `FILTER_OPERATORS`（無其他使用者），加入上列匯出。新 i18n key（`filter.` 底下）：`isAnyOf` 是其中之一、`isNoneOf` 不是其中任何一個、`hasAnyOf` 包含任一、`hasAllOf` 包含全部、`hasNoneOf` 不包含任何、`isExactly` 完全相同、`higherThan` 大於、`higherThanOrEqual` 大於等於、`lowerThan` 小於、`lowerThanOrEqual` 小於等於、`dateIs` 是、`dateBefore` 早於、`dateAfter` 晚於、`dateOnOrBefore` 在當天或之前、`dateOnOrAfter` 在當天或之後、`dateWithin` 在範圍內；日期模式 `modeExact` 指定日期、`modeToday` 今天、`modeTomorrow` 明天、`modeYesterday` 昨天、`modeDaysAgo` 幾天前、`modeDaysFromNow` 幾天後、`modePastWeek` 過去一週、`modePastMonth` 過去一個月、`modePastYear` 過去一年、`modeNextWeek` 未來一週、`modeNextMonth` 未來一個月、`modeNextYear` 未來一年、`modePastNDays` 過去幾天、`modeNextNDays` 未來幾天；群組 `addGroup` 新增條件群組、`deleteGroup` 刪除群組、`selectValues` 選擇值、`days` 天。`en.json` 用對應英文。

- [ ] **Step 4: 執行確認通過**

- [ ] **Step 5: Commit** `feat(filter): single source of filter operators per field type`

---

### Task 5: 接上 page.tsx 與 FilterItem 型別

**Files:**
- Modify: `src/app/page.tsx`（Advanced filters 區塊，約 545–560 行）
- Modify: `FilterRule[]` → `FilterItem[]`：`context/TableContext.tsx`、`hooks/useViewConfig.ts`、`components/views/DatabaseViewRouter.tsx`、`components/views/TableWorkspaceView.tsx`、`components/toolbar/ViewToolbar.tsx`、`components/table/GridView.tsx`、`components/modals/GlobalModalsContainer.tsx`、`components/toolbar/menu/FilterMenu.tsx`（props 型別）

**Interfaces:**
- Consumes: `evaluateFilters`（Task 2）
- Produces: 上下游 `filterRules: FilterItem[]`、`setFilterRules: (items: FilterItem[]) => void`

- [ ] **Step 1: 改 page.tsx** 以 `result = result.filter(row => evaluateFilters(row, filterType, filterRules, fields))` 取代 if/else 兩段迴圈，`now` 用預設值。
- [ ] **Step 2: 改型別** 只改型別註記；`GlobalModalsContainer` 第 398 行改用 `FilterItem[]`。
- [ ] **Step 3: 驗證** Run: `npm run typecheck` 與 `npx jest src/modules/database`　Expected: 無錯誤、全 PASS。
- [ ] **Step 4: Commit** `refactor(filter): evaluate view filters through filterEvaluation`

---

### Task 6: FilterMenu 群組、多值與日期輸入

**Files:**
- Create: `src/modules/database/components/toolbar/menu/MultiValueSelect.tsx`
- Modify: `src/modules/database/components/toolbar/menu/FilterMenu.tsx`
- Modify: `src/modules/database/components/toolbar/ViewToolbar.tsx`（傳 `rows` 給 `FilterMenu`；`ViewToolbar` 新增 `rows?: TableRow[]` prop）、`src/modules/database/components/views/TableWorkspaceView.tsx`（把 `rows` 傳給 `ViewToolbar`）
- Test: `src/modules/database/components/toolbar/menu/__tests__/FilterMenu.test.tsx`（`/** @jest-environment jsdom */`）

**Interfaces:**
- Consumes: `getFilterOperators`、`MULTI_VALUE_OPERATORS`、`DATE_*`（Task 4）、`isFilterGroup`（Task 2）
- Produces: `MultiValueSelect({ value: string[]; options: {value: string; label: string}[]; onChange: (v: string[]) => void; placeholder?: string })`；`FilterMenu` 新 prop `rows?: TableRow[]`

- [ ] **Step 1: 寫失敗測試**
  - `adds a condition group`：渲染 `FilterMenu`（一條規則），點「新增條件群組」→ `setFilterRules` 收到最後一項為 `{ type:'group', filterType:'AND', rules:[{...第一個欄位的預設規則}] }`。
  - `group has no add-group button`：傳入含群組的 `filterRules` → 畫面上「新增條件群組」只出現 1 個（最外層）。
  - `shows multi-value picker for has_any_of`：多選欄位＋`has_any_of` 規則 → 渲染出 `MultiValueSelect`（以 placeholder「選擇值」查找）。
  - `resets operator when switching field type`：文字欄位 `contains` 規則改選多選欄位 → 新規則 `operator: 'has_any_of'`、`value: ''`、`values` 為 undefined。
- [ ] **Step 2: 執行確認失敗**　Run: `npx jest src/modules/database/components/toolbar/menu`
- [ ] **Step 3: 實作**
  - 把單列規則抽成元件內函式 `renderRule(rule, onChange, onDelete)`，最外層與群組共用；群組區塊外框＋自己的且／或 `CustomSelect`＋「新增條件」＋刪除群組。
  - 運算子選項改為 `getFilterOperators(field?.type).map(o => ({ value: o.value, label: t(o.labelKey) }))`。
  - 值輸入：`NO_VALUE_OPERATORS` 不顯示；`MULTI_VALUE_OPERATORS` 用 `MultiValueSelect`（選項：選取類取欄位選項；`link_row`／`collaborator` 從 `rows` 該欄位值收集 `{id, value|username}` 去重，`value` 用 `String(id)`）；日期運算子先顯示模式 `CustomSelect`（`date_within` 用 `DATE_WITHIN_MODES`，其他用 `DATE_COMPARE_MODES`），`exact` 顯示 `<input type="date">`，`days_ago`／`days_from_now`／`past_n_days`／`next_n_days` 顯示數字框寫入 `dateAmount`；其餘沿用現有輸入。
  - 切換欄位：運算子不在新清單時取新清單第一個，並清空 `value`／`values`／`dateMode`／`dateAmount`。
  - 選日期運算子時預設 `dateMode`：`date_within` → `past_week`，其他 → `exact`。
- [ ] **Step 4: 執行確認通過**
- [ ] **Step 5: 手動檢查**：`preview_start` 開 dev server，建一條多選 has_any_of 規則、一個 OR 群組與一條「過去一週」，確認表格結果正確且重新整理後保留；排序加兩條、重新整理後兩條仍在（需本機資料庫已有新欄位；若沒有，回報使用者，不自行 `db push`）。結束後 `preview_stop`。
- [ ] **Step 6: Commit** `feat(filter): condition groups, multi-value and date mode inputs`

---

### Task 7: 收尾

- [ ] **Step 1:** `npm run verify`　Expected: typecheck、lint、jest、build:check 全過。
- [ ] **Step 2:** 交 `reviewer` 子代理審查（比較基準 `origin/feat/airtable-import`），處理意見。
- [ ] **Step 3:** 更新 `PROGRESS.md`（子專案 3 完成、待部署時 schema 會新增兩欄）。
- [ ] **Step 4:** push 並開 PR 到 `feat/airtable-import`，PR 說明註明 schema 新增 `TableView.sortRules`／`groupByRules`。
