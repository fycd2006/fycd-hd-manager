# 日期欄位補強（含時間、格式、時區）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `date`／`created_on`／`last_modified_on` 欄位支援 Airtable 的日期格式、含時間、12／24 小時制、時區與時區標籤，並修好前端完全無作用的三個日期篩選運算子。

**Architecture:** 新增前後端共用的純函式模組 `src/modules/database/utils/dateTime.ts`（只用內建 `Intl`），負責儲存值正規化、顯示格式化、編輯器換算與時區日界計算。驗證器、各顯示位置、編輯器、篩選、日曆、CSV 都改呼叫它。欄位設定 UI 新增 `DateFieldOptions.tsx`。

**Tech Stack:** TypeScript、React 19、Next.js 16、Jest（node／jsdom）、Testing Library。

**Spec:** `docs/superpowers/specs/2026-10-19-date-field-options-design.md`

## Global Constraints

- 不新增任何 npm 套件；時區換算只用 `Intl.DateTimeFormat`。
- 設定鍵：`date_format`（`local`|`friendly`|`us`|`european`|`iso`，預設 `iso`）、`date_include_time`（`date` 預設 false；`created_on`／`last_modified_on` 預設 true）、`date_time_format`（`'12'`|`'24'`，預設 `'24'`）、`date_time_zone`（`'client'` 或 IANA，預設 `'client'`；無效時區視為 `'client'`）、`date_show_time_zone`（預設 false）。
- 儲存：不含時間存 `YYYY-MM-DD`；含時間存 UTC ISO `YYYY-MM-DDTHH:mm:ss.sssZ`。改設定不改寫既有資料。
- 不含時間的驗證行為與現況完全相同，`DateFieldType.test.ts` 既有案例一律不改。
- 時間字串一律手組：24 小時 `14:30`、12 小時 `2:30 PM`（兩種語系相同）；時區標籤用 `Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })`，例如 `GMT+8`、`EDT`；不含時間時不顯示標籤。
- `local` 用 `Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone })`；`friendly` 用 `dateStyle: 'long'`。介面語系 `locale` 為 `'zh-TW' | 'en'`，取不到時用 `'zh-TW'`。
- UI 文案繁體中文，並在 `src/lib/i18n/locales/zh-TW.json`／`en.json` 都加鍵。
- `GridViewCell.tsx`、`GridView.tsx`、`MasterGridView.tsx` 只做最小改動，改完跑 `src/modules/database/components/views/grid/__tests__` 與 `views/master/__tests__`。
- 每個任務結束前 `npm run verify` 全過才 commit（hook 會自動跑）；同時有其他 session 跑 jest 時，元件測試可能隨機逾時，先單獨重跑該檔確認。

## Review Focus

- 台北清晨的時間（UTC 前一天）：`2026-10-17T23:59:00.000Z` 在 Asia/Taipei 是 10-18 07:59，篩選「10-18」要命中、日曆要排在 18 日 → Task 1、Task 4 測試。
- 夏令時間切換日：`America/New_York` 2026-11-01 是 25 小時，`dayRangeUtc` 要回 `['2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z']` → Task 1 測試。
- 從「不含時間」切到「含時間」後，舊 `YYYY-MM-DD` 值要正常顯示為當天 00:00，編輯器也要能帶出 → Task 2、Task 1 的 `toEditorValue` 測試。
- 無效的 `date_time_zone`（例如手改成 `Mars/Base`）不可讓整張表渲染拋錯 → Task 1 測試。
- 舊欄位 `options` 是 JSON 字串或 null（不是物件）時要能讀 → Task 1 `resolveDateOptions` 測試。

---

### Task 1: 共用模組核心（設定、時區、正規化、編輯器換算）

**Files:**
- Create: `src/modules/database/utils/dateTime.ts`
- Test: `src/modules/database/utils/__tests__/dateTime.test.ts`

**Interfaces:**
- Produces:
  - `type DateFormat = 'local' | 'friendly' | 'us' | 'european' | 'iso'`
  - `interface DateOptions { date_format: DateFormat; date_include_time: boolean; date_time_format: '12' | '24'; date_time_zone: string; date_show_time_zone: boolean }`
  - `resolveDateOptions(options: unknown, fieldType?: string): DateOptions` — 接受物件、JSON 字串、null。
  - `resolveTimeZone(options: DateOptions, viewerTz?: string): string`
  - `normalizeDateInput(value: unknown, options: unknown, viewerTz?: string): string | null` — 空值與無法解析都回 null（呼叫端以「原值非空且回 null」判斷為無效）。
  - `cellDayInZone(value: unknown, timeZone: string): string | null` — `YYYY-MM-DD` 值原樣回傳；UTC ISO 換成該時區的日期。
  - `dayRangeUtc(day: string, timeZone: string): [string, string]`
  - `toEditorValue(value: unknown, options: unknown, viewerTz?: string): string` — 不含時間回 `YYYY-MM-DD`，含時間回 `YYYY-MM-DDTHH:mm`（欄位時區的牆上時間）。
  - `fromEditorValue(input: string, options: unknown, viewerTz?: string): string | null`

- [ ] **Step 1: 寫失敗測試**

```ts
const TPE = { date_include_time: true, date_time_zone: 'Asia/Taipei' }
const NY = { date_include_time: true, date_time_zone: 'America/New_York' }

it('resolveDateOptions fills defaults and parses JSON strings', () => {
  expect(resolveDateOptions(null, 'date')).toEqual({ date_format: 'iso', date_include_time: false, date_time_format: '24', date_time_zone: 'client', date_show_time_zone: false })
  expect(resolveDateOptions(null, 'created_on').date_include_time).toBe(true)
  expect(resolveDateOptions('{"date_format":"us"}', 'date').date_format).toBe('us')
})
it('invalid time zone falls back to the viewer zone', () => {
  expect(resolveTimeZone(resolveDateOptions({ date_time_zone: 'Mars/Base' }), 'Asia/Taipei')).toBe('Asia/Taipei')
})
it.each([
  ['2026-10-18 14:30', TPE, '2026-10-18T06:30:00.000Z'],
  ['2026-10-18T14:30', TPE, '2026-10-18T06:30:00.000Z'],
  ['2026-10-18T14:30:00+08:00', NY, '2026-10-18T06:30:00.000Z'],
  ['2026-10-18', TPE, '2026-10-17T16:00:00.000Z'],
  ['2026-03-08 03:30', NY, '2026-03-08T07:30:00.000Z'],
  ['2026-11-01 01:30', NY, '2026-11-01T05:30:00.000Z'],
  ['2026-10-16T16:00:00.000Z', {}, '2026-10-16'],
  ['2026/1/5', {}, '2026-01-05'],
  ['', TPE, null],
  ['abc', TPE, null],
  ['2026-02-30 10:00', TPE, null],
])('normalizeDateInput(%j) -> %j', (input, opts, expected) => {
  expect(normalizeDateInput(input, opts)).toBe(expected)
})
it('client zone uses the viewer zone', () => {
  expect(normalizeDateInput('2026-10-18 14:30', { date_include_time: true }, 'Asia/Taipei')).toBe('2026-10-18T06:30:00.000Z')
})
it.each([
  ['2026-10-17T23:59:00.000Z', 'Asia/Taipei', '2026-10-18'],
  ['2026-10-17T15:59:00.000Z', 'Asia/Taipei', '2026-10-17'],
  ['2026-10-18', 'America/New_York', '2026-10-18'],
  ['garbage', 'Asia/Taipei', null],
])('cellDayInZone(%j, %s) -> %j', (v, tz, expected) => {
  expect(cellDayInZone(v, tz)).toBe(expected)
})
it('dayRangeUtc handles 25-hour DST day', () => {
  expect(dayRangeUtc('2026-11-01', 'America/New_York')).toEqual(['2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z'])
  expect(dayRangeUtc('2026-10-18', 'Asia/Taipei')).toEqual(['2026-10-17T16:00:00.000Z', '2026-10-18T16:00:00.000Z'])
})
it('editor round trip', () => {
  expect(toEditorValue('2026-10-18T06:30:00.000Z', TPE)).toBe('2026-10-18T14:30')
  expect(fromEditorValue('2026-10-18T14:30', TPE)).toBe('2026-10-18T06:30:00.000Z')
  expect(toEditorValue('2026-10-18', TPE)).toBe('2026-10-18T00:00')
  expect(toEditorValue('2026-10-18T06:30:00.000Z', { date_time_zone: 'Asia/Taipei' })).toBe('2026-10-18')
  expect(fromEditorValue('', TPE)).toBeNull()
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/utils/__tests__/dateTime.test.ts`
Expected: FAIL，`Cannot find module '../dateTime'`

- [ ] **Step 3: 實作 `dateTime.ts`**

不含時間的分支直接沿用 `fields/types/DateFieldType.ts` 現有的 `DATE_PATTERN` 與日期合法性檢查（把那段邏輯搬進本模組，Task 3 再讓 `DateFieldType` 改呼叫本模組）。時區時差與牆上時間轉 UTC 用以下演算法（夏令跳時的不存在時間，例如 NY 2026-03-08 02:30，會得到 `06:30Z`，可接受）：

```ts
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(utcMs)).map(x => [x.type, x.value])
  )
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000
}
function wallToUtcMs(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): number {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s)
  const first = naive - zoneOffsetMs(naive, timeZone)
  return naive - zoneOffsetMs(first, timeZone)
}
```

時區有效性用 `try { new Intl.DateTimeFormat('en-US', { timeZone }) } catch` 判斷。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/utils/__tests__/dateTime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/utils/dateTime.ts src/modules/database/utils/__tests__/dateTime.test.ts
git commit -m "feat(date): add shared date-time utilities with time zone support"
```

### Task 2: 顯示格式化 `formatFieldDate`

**Files:**
- Modify: `src/modules/database/utils/dateTime.ts`
- Test: `src/modules/database/utils/__tests__/dateTime.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `resolveDateOptions`、`resolveTimeZone`、`zoneOffsetMs`。
- Produces: `formatFieldDate(value: unknown, options: unknown, ctx?: { locale?: 'zh-TW' | 'en'; viewerTz?: string; fieldType?: string }): string` — 空值回 `''`；無法解析回 `String(value)`。

- [ ] **Step 1: 寫失敗測試**

```ts
const V = '2026-10-18T06:30:00.000Z'
const base = { date_time_zone: 'Asia/Taipei' }
it.each([
  [{ ...base }, 'zh-TW', '2026-10-18'],
  [{ ...base, date_format: 'us' }, 'zh-TW', '10/18/2026'],
  [{ ...base, date_format: 'european' }, 'zh-TW', '18/10/2026'],
  [{ ...base, date_format: 'local' }, 'zh-TW', '2026/10/18'],
  [{ ...base, date_format: 'friendly' }, 'zh-TW', '2026年10月18日'],
  [{ ...base, date_format: 'friendly' }, 'en', 'October 18, 2026'],
  [{ ...base, date_include_time: true }, 'zh-TW', '2026-10-18 14:30'],
  [{ ...base, date_include_time: true, date_time_format: '12' }, 'zh-TW', '2026-10-18 2:30 PM'],
  [{ ...base, date_include_time: true, date_format: 'us', date_show_time_zone: true }, 'en', '10/18/2026 14:30 GMT+8'],
  [{ ...base, date_show_time_zone: true }, 'zh-TW', '2026-10-18'],
])('formatFieldDate %j %s', (opts, locale, expected) => {
  expect(formatFieldDate(V, opts, { locale: locale as 'zh-TW' | 'en' })).toBe(expected)
})
it('legacy date-only value shown as midnight when time is on', () => {
  expect(formatFieldDate('2026-10-18', { ...base, date_include_time: true })).toBe('2026-10-18 00:00')
})
it('date-only value is not shifted by zone', () => {
  expect(formatFieldDate('2026-10-18', { date_time_zone: 'America/New_York' })).toBe('2026-10-18')
})
it('created_on defaults to showing time', () => {
  expect(formatFieldDate(V, { date_time_zone: 'Asia/Taipei' }, { fieldType: 'created_on' })).toBe('2026-10-18 14:30')
})
it('empty and unparseable values', () => {
  expect(formatFieldDate(null, base)).toBe('')
  expect(formatFieldDate('n/a', base)).toBe('n/a')
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/utils/__tests__/dateTime.test.ts -t formatFieldDate`
Expected: FAIL，`formatFieldDate is not a function`

- [ ] **Step 3: 實作 `formatFieldDate`**（依 Global Constraints 的格式規則；`YYYY-MM-DD` 值取日期部分不做時區換算）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/utils/__tests__/dateTime.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/utils/dateTime.ts src/modules/database/utils/__tests__/dateTime.test.ts
git commit -m "feat(date): format dates per field options"
```

### Task 3: 驗證器 `DateFieldType`

**Files:**
- Modify: `src/modules/database/fields/types/DateFieldType.ts`
- Test: `src/modules/database/fields/types/__tests__/DateFieldType.test.ts`

**Interfaces:**
- Consumes: `normalizeDateInput`、`resolveDateOptions`。

- [ ] **Step 1: 在既有測試檔新增失敗測試（既有案例不改）**

```ts
const TPE = { date_include_time: true, date_time_zone: 'Asia/Taipei' }
it('stores UTC ISO when time is included', () => {
  expect(type.validateValue('2026-10-18 14:30', TPE)).toEqual({ valid: true, parsedValue: '2026-10-18T06:30:00.000Z' })
})
it('invalid date-time message mentions time', () => {
  expect(type.validateValue('abc', TPE)).toMatchObject({ valid: false, code: 'invalid_date', error: '必須是有效的日期時間（YYYY-MM-DD HH:mm）' })
})
it('NOW default is UTC ISO when time is included', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-18T06:30:00.000Z'))
  try {
    expect(type.getDefaultValue({ defaultValue: 'NOW', date_include_time: true })).toBe('2026-10-18T06:30:00.000Z')
  } finally {
    jest.useRealTimers()
  }
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/fields/types/__tests__/DateFieldType.test.ts`
Expected: 新增的 3 個 FAIL，既有案例 PASS

- [ ] **Step 3: 改 `validateValue` 呼叫 `normalizeDateInput`；`getDefaultValue` 依 `date_include_time` 回 `new Date().toISOString()`；在 `getGeneratedColumnSQLExpression` 上方加註「含時間欄位取到的是 UTC 日期，僅供索引，篩選不走此欄」**

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/fields/types/__tests__/DateFieldType.test.ts src/modules/database/services/__tests__/cellWrite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/fields/types/DateFieldType.ts src/modules/database/fields/types/__tests__/DateFieldType.test.ts
git commit -m "feat(date): validate date-time values with field time zone"
```

### Task 4: 日期篩選（前端與伺服器）

**Files:**
- Modify: `src/modules/database/components/views/grid/cells/utils.ts`（`evaluateCellCondition`，約 233 行起）
- Modify: `src/modules/database/services/rowQuery.ts:589-603`
- Test: `src/modules/database/components/views/grid/__tests__/dateFilter.test.ts`（新檔，node 環境）
- Test: `src/modules/database/services/__tests__/rowQuery.test.ts`

**Interfaces:**
- Consumes: `cellDayInZone`、`resolveDateOptions`、`resolveTimeZone`。

- [ ] **Step 1: 寫失敗測試**

```ts
// dateFilter.test.ts
const field = { type: 'date', options: { date_include_time: true, date_time_zone: 'Asia/Taipei' } }
it.each([
  ['2026-10-17T23:59:00.000Z', 'date_equal', '2026-10-18', true],
  ['2026-10-17T15:59:00.000Z', 'date_equal', '2026-10-18', false],
  ['2026-10-17T23:59:00.000Z', 'date_before', '2026-10-19', true],
  ['2026-10-17T23:59:00.000Z', 'date_after', '2026-10-18', false],
  ['2026-10-18', 'date_equal', '2026-10-18', true],
  ['', 'date_equal', '2026-10-18', false],
])('%s %s %s -> %s', (val, op, target, expected) => {
  expect(evaluateCellCondition(val, field, op, target)).toBe(expected)
})
```

在 `rowQuery.test.ts` 新增：欄位 `{ id: 3, type: 'date', options: JSON.stringify({ date_include_time: true, date_time_zone: 'Asia/Taipei' }) }`，兩列值分別為 `'2026-10-17T23:59:00.000Z'`、`'2026-10-17T15:59:00.000Z'`，`filterParam: 'field_3:date_equal:2026-10-18'`，斷言結果只剩第一列。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/components/views/grid/__tests__/dateFilter.test.ts src/modules/database/services/__tests__/rowQuery.test.ts`
Expected: 新增案例 FAIL

- [ ] **Step 3: 實作**：`evaluateCellCondition` 在最前面處理三個日期運算子：取 `cellDayInZone(val, resolveTimeZone(resolveDateOptions(field?.options, field?.type)))`，與 `targetValue.trim()` 做字串比較（`===`／`<`／`>`），任一側為空或 null 回 false。`rowQuery.ts` 三個 case 改用同一邏輯（以 `fieldByKey.get(fieldKey)` 取欄位）。

- [ ] **Step 4: 跑測試確認通過**（同 Step 2 指令）Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/components/views/grid/cells/utils.ts src/modules/database/services/rowQuery.ts src/modules/database/components/views/grid/__tests__/dateFilter.test.ts src/modules/database/services/__tests__/rowQuery.test.ts
git commit -m "fix(filter): evaluate date operators by day in the field time zone"
```

### Task 5: 各顯示位置改用 `formatFieldDate`

**Files:**
- Modify: `src/modules/database/components/views/grid/GridViewCell.tsx:155,1986,2105`
- Modify: `src/modules/database/components/views/master/MasterGridCell.tsx:544`
- Modify: `src/modules/database/components/views/grid/GridView.tsx:65-66`
- Modify: `src/modules/database/components/views/master/MasterGridView.tsx:861-862`
- Modify: `src/modules/database/components/cards/CardDrawer.tsx:557`
- Modify: `src/modules/database/components/views/DatabaseViewRouter.tsx:191`（同時涵蓋 `created_on`／`last_modified_on`）
- Test: `src/modules/database/components/views/grid/__tests__/DateCellDisplay.test.tsx`（新檔，jsdom，比照 `InlineOptionCreate.test.tsx` 的 render 方式）

**Interfaces:**
- Consumes: `formatFieldDate(value, field.options, { locale, fieldType: field.type })`；元件內 `locale` 取自 `useI18n()`，非 hook 的模組層函式不傳 locale。

- [ ] **Step 1: 寫失敗測試**：渲染 `GridViewCell`，欄位 `{ type: 'date', options: { date_include_time: true, date_time_format: '12', date_time_zone: 'Asia/Taipei' } }`、值 `'2026-10-18T06:30:00.000Z'`，斷言 `screen.getByText('2026-10-18 2:30 PM')`；另一案例 `created_on`、`options: { date_time_zone: 'Asia/Taipei' }`，斷言出現 `2026-10-18 14:30`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/components/views/grid/__tests__/DateCellDisplay.test.tsx`
Expected: FAIL（目前顯示 `2026-10-18`）

- [ ] **Step 3: 逐一替換上列位置的 `formatDateValue(val)`**（`GridViewCell.tsx:155` 的 `getInitialStringValue` 屬於編輯器，留給 Task 6）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/components/views`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/components
git commit -m "feat(date): display dates with field format, time and zone"
```

### Task 6: 編輯器支援含時間

**Files:**
- Modify: `src/modules/database/components/views/grid/GridViewCell.tsx:155,1509-1531`
- Modify: `src/modules/database/components/cards/CardDrawer.tsx:560-563`
- Modify: `src/modules/database/components/modals/RowEditModal.tsx:377-380`
- Modify: `src/modules/database/components/views/form/FormView.tsx`（日期輸入處）
- Test: `src/modules/database/components/views/grid/__tests__/DateCellDisplay.test.tsx`

**Interfaces:**
- Consumes: `toEditorValue`、`fromEditorValue`、`resolveDateOptions`。

- [ ] **Step 1: 寫失敗測試**：編輯模式的 `GridViewCell`（含時間、Asia/Taipei、值 `'2026-10-18T06:30:00.000Z'`）：input 的 `type` 為 `datetime-local`、`value` 為 `2026-10-18T14:30`；`fireEvent.change` 成 `2026-10-18T15:00` 時 `onUpdate` 尚未被呼叫，`fireEvent.blur` 後 `onUpdate` 以 `'2026-10-18T07:00:00.000Z'` 被呼叫一次。不含時間的欄位維持 `type="date"` 且 change 即送出（既有行為）。

- [ ] **Step 2: 跑測試確認失敗**（同 Task 5 指令）Expected: FAIL

- [ ] **Step 3: 實作**：含時間時 input `type="datetime-local"`、初值 `toEditorValue`、送出值 `fromEditorValue`，只在 blur／Enter 送出；不含時間維持原行為。CardDrawer、RowEditModal、FormView 同樣依 `date_include_time` 切換 input 類型與換算。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/components`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/components
git commit -m "feat(date): edit date-time values in the field time zone"
```

### Task 7: 欄位設定 UI `DateFieldOptions`

**Files:**
- Create: `src/modules/database/components/modals/field-options/DateFieldOptions.tsx`
- Modify: `src/modules/database/components/modals/FieldModal.tsx`（約 185、261、328 行，比照 `NumberFieldOptions` 的讀取、送出、渲染三處）
- Modify: `src/modules/database/components/field/CreateFieldPopover.tsx`（約 182、262、376 行，同上）
- Modify: `src/lib/i18n/locales/zh-TW.json`、`src/lib/i18n/locales/en.json`
- Test: `src/modules/database/components/modals/__tests__/DateFieldOptions.test.tsx`

**Interfaces:**
- Consumes: `DateOptions`、`resolveDateOptions`。
- Produces: `DateFieldOptions({ value, onChange, fieldType }: { value: DateOptions; onChange: (next: DateOptions) => void; fieldType: string })` — 受控元件；父元件以單一 `useState<DateOptions>` 保存，送出時把整個物件併入 `parsedOptions`。型別為 `date`、`created_on`、`last_modified_on` 時顯示。

- [ ] **Step 1: 寫失敗測試**：渲染 `DateFieldOptions`（`value = resolveDateOptions(null, 'date')`），斷言：未勾「含時間」時看不到時間格式、時區、時區標籤三個控制項；勾選後 `onChange` 收到 `date_include_time: true`；日期格式下拉有 5 個選項（label：本地、易讀、美式、歐式、ISO）；時區下拉第一項為「依瀏覽器時區」（值 `client`），並至少含 `Asia/Taipei`、`UTC`（清單取 `Intl.supportedValuesOf('timeZone')`，不支援時退回 `['UTC', 'Asia/Taipei']`）。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/components/modals/__tests__/DateFieldOptions.test.tsx`
Expected: FAIL，找不到模組

- [ ] **Step 3: 實作元件、接進兩個父元件、加 i18n 鍵（`modals.dateOptions`、`modals.dateFormat`、`modals.includeTime`、`modals.timeFormat`、`modals.timeZone`、`modals.timeZoneClient`、`modals.showTimeZone` 與五種格式名稱）**；樣式比照 `NumberFieldOptions.tsx`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx jest src/modules/database/components/modals`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/components/modals src/modules/database/components/field/CreateFieldPopover.tsx src/lib/i18n/locales
git commit -m "feat(date): add date field options UI"
```

### Task 8: 日曆與 CSV

**Files:**
- Modify: `src/modules/database/components/views/calendar/CalendarView.tsx:126`
- Modify: `src/modules/database/utils/csv.ts`（`exportToCSV` 約 54-72 行、`convertCSVValue`）
- Test: `src/modules/database/utils/__tests__/csv.test.ts`
- Test: `src/modules/database/components/views/calendar/__tests__/`（若無此目錄則新建 `CalendarDay.test.tsx`）

**Interfaces:**
- Consumes: `cellDayInZone`、`resolveTimeZone`、`resolveDateOptions`、`formatFieldDate`、`normalizeDateInput`。

- [ ] **Step 1: 寫失敗測試**
  - CSV 匯出：欄位 `{ type: 'date', options: { date_include_time: true, date_format: 'us', date_time_zone: 'Asia/Taipei' } }`、值 `'2026-10-18T06:30:00.000Z'`，匯出內容含 `"2026-10-18 14:30"`（攔截 `Blob` 建構讀內容，比照 `csv.test.ts` 既有作法）。
  - CSV 匯入：`csvRowToTableRow(['2026-10-18 14:30'], ['When'], [同上欄位，name: 'When', id: 3])` 回 `{ field_3: '2026-10-18T06:30:00.000Z' }`；無法解析的 `'abc'` 原樣回傳 `'abc'`。
  - 日曆：Asia/Taipei 含時間欄位、值 `'2026-10-17T23:59:00.000Z'` 的列出現在 10 月 18 日的格子。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx jest src/modules/database/utils/__tests__/csv.test.ts src/modules/database/components/views/calendar`
Expected: FAIL

- [ ] **Step 3: 實作**：日曆分組改用 `cellDayInZone(val, resolveTimeZone(resolveDateOptions(field.options, field.type)))`；CSV 匯出對 `date`／`created_on`／`last_modified_on` 用 `formatFieldDate(val, { ...options, date_format: 'iso', date_time_format: '24', date_show_time_zone: false })`；匯入在 `convertCSVValue` 對 `date` 呼叫 `normalizeDateInput(raw, field.options)`，null 時回原字串。

- [ ] **Step 4: 跑測試確認通過**（同 Step 2 指令）Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/database/components/views/calendar src/modules/database/utils
git commit -m "feat(date): time-zone aware calendar and round-trip CSV dates"
```

### Task 9: 收尾驗證與審查

**Files:**
- Modify: `.claude/rules/frontend.md`（錯誤紀錄：前端 `evaluateCellCondition` 缺日期運算子 → 新增篩選運算子時要同時在 `constants/fieldTypes.ts` 與 `evaluateCellCondition` 各加一處並補 `dateFilter.test.ts` 類測試）

- [ ] **Step 1: 跑 `npm run verify`**，Expected: typecheck、lint、jest、build:check 全過
- [ ] **Step 2: 交給 `reviewer` 子代理，比較基準 `main`**（本計畫改到 `services/rowQuery.ts`，以 model `opus` 呼叫）
- [ ] **Step 3: 處理審查意見後 commit**

```bash
git add .claude/rules/frontend.md
git commit -m "docs(rules): record missing date filter operators"
```
