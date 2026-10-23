# 統一寫入驗證層 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 所有使用者寫入儲存格值的路徑都經過同一個伺服器端服務，得到一致的正規化結果或拒絕原因。

**Architecture:** 型別規則集中在純 TypeScript 的 `FieldRegistry`（29 種型別、唯讀旗標、拒絕代碼）。新服務 `services/cellWrite.ts` 只做判斷、不碰資料庫，回傳 `{ data, rejected, optionAdditions }`；`services/cellWriteOptions.ts` 在 transaction 內把新選項合併進欄位設定。九條寫入路徑改呼叫它，批次 API 回傳 `rejected`，前端顯示回報。

**Tech Stack:** Next.js 16 route handlers、Prisma 6（TiDB）、Jest（node 與 jsdom）、TypeScript。

**Spec:** `docs/superpowers/specs/2026-10-17-unified-cell-write-design.md`

## Global Constraints

- 一律用繁體中文寫 UI 文案與錯誤說明；拒絕訊息格式沿用「欄位 [欄位名稱] 驗證失敗：說明」
- 不執行 `npm run build`；每個 task 結束前跑該 task 的測試，最後一個 task 跑 `npm run verify` 全過
- 不新增套件；選項 id 用 `crypto.randomUUID()`，顏色用 `services/selectFieldMigration.ts` 的 `DEFAULT_COLORS`（改成 export）
- 不改資料庫 schema、不遷移既有資料；讀取時繼續相容 ISO 日期與多選 JSON 字串
- 多選維持存成 JSON 字串（`JSON.stringify(ids)`）
- 原生 SQL 一律參數化；`TableRow.data` 寫入前沿用既有的 `normalizeRowData`
- 禁止刪除、`.skip`、放寬既有測試。鎖住舊行為的斷言要改成新行為，並在最後的 PR 說明逐一列出；被移除模組（`rowValidation.ts`）的測試案例要先移植到新測試，再刪除舊檔
- 拒絕代碼只用這 12 個：`read_only`、`unknown_type`、`unknown_option`、`invalid_number`、`out_of_range`、`invalid_boolean`、`invalid_date`、`invalid_email`、`invalid_url`、`invalid_phone`、`invalid_duration`、`invalid_format`

## Review Focus

1. **兩個批次同時自動新增選項**：後寫的不能蓋掉先寫的選項清單 → Task 8 `applyOptionAdditions` 必須在 transaction 內重新讀取欄位設定再合併（測試：mock 的 `findUnique` 回傳已含另一個新選項的設定，合併後兩個都在）
2. **含小數與負號的千分位數字**（`"-1,234.5"`、`"１２３"`）→ Task 2 測試涵蓋
3. **更新時整列所有格子都被拒絕**：該列不應寫入、`updatedAt` 不應變動 → Task 11 測試：`$executeRawUnsafe` 的 SQL 裡不包含這一列的 id
4. **選項名稱和另一個選項的 id 相同，或大小寫不同的重複名稱** → Task 4 測試：先比對 id、再比對名稱，名稱比對不分大小寫，只取第一個符合的
5. **既有資料用舊格式**（ISO 日期、多選 JSON 字串）在不修改的情況下重新存檔（例如只改同列另一格）→ Task 9 測試：未出現在 `input` 的欄位值原封不動

---

## 檔案結構

| 檔案 | 責任 |
|---|---|
| `src/modules/database/fields/FieldType.ts`（改） | 介面：`readOnly`、`RejectCode`、新的 `FieldValidationResult` |
| `src/modules/database/fields/FieldRegistry.ts`（改） | 註冊、別名、未註冊型別 fail-closed |
| `src/modules/database/fields/types/*.ts`（改 8、增 10） | 各型別規則 |
| `src/modules/database/fields/types/selectChoices.ts`（增） | `resolveChoices`：選項比對，單選／多選與 cellWrite 共用 |
| `src/modules/database/fields/types/ReadOnlyFieldTypes.ts`（增） | 12 種唯讀型別 |
| `src/modules/database/services/cellWrite.ts`（增） | `prepareCellWrites`、`prepareBatchCellWrites`、`mergeChoicesIntoOptions` |
| `src/modules/database/services/cellWriteOptions.ts`（增） | `applyOptionAdditions(tx, …)`：transaction 內合併新選項 |
| 9 條寫入路徑（改） | 改呼叫 cellWrite |
| `src/modules/database/services/rowValidation.ts`（刪） | 由 cellWrite 取代 |
| `src/modules/database/services/row.ts`、`hooks/useCellEdit.ts`、`hooks/useRowOperations.ts`、`components/views/grid/GridView.tsx`（改） | 批次回報與貼上整理 |

---

### Task 1: FieldType 介面、Registry fail-closed 與別名

**Files:**
- Modify: `src/modules/database/fields/FieldType.ts`、`src/modules/database/fields/FieldRegistry.ts`、`src/modules/database/fields/types/index.ts`
- Modify: 既有 8 個型別檔：每個加上 `readonly readOnly = false`（`LatestCommentFieldType` 改 `true`，見 Task 7），失敗結果加上 `code`，`getDefaultValue` 改用 `options?.defaultValue ?? null`
- Test: `src/modules/database/fields/__tests__/FieldRegistry.test.ts`

**Interfaces:**
- Produces:
  - `export type RejectCode = 'read_only' | 'unknown_type' | 'unknown_option' | 'invalid_number' | 'out_of_range' | 'invalid_boolean' | 'invalid_date' | 'invalid_email' | 'invalid_url' | 'invalid_phone' | 'invalid_duration' | 'invalid_format'`
  - `export type FieldValidationResult = { valid: true; parsedValue: unknown } | { valid: false; code: RejectCode; error: string }`
  - `FieldType` 新增 `readonly readOnly: boolean`
  - `FieldRegistry.register(type, ...aliases: string[])`、`FieldRegistry.get(type): FieldType`（未註冊時回傳 `readOnly: true`、驗證一律 `{ valid: false, code: 'unknown_type' }` 的型別）、`FieldRegistry.isRegistered(type): boolean`

- [ ] **Step 1: 寫失敗的測試**

```ts
import { FieldRegistry } from '@/modules/database/fields/types'

it('rejects writes to unregistered types instead of passing them through', () => {
  const t = FieldRegistry.get('no_such_type')
  expect(t.readOnly).toBe(true)
  expect(t.validateValue('x', null)).toEqual({ valid: false, code: 'unknown_type', error: expect.any(String) })
})
it.each([['phone', 'phone_number'], ['collaborator', 'collaborators'], ['file', 'attachment']])('alias %s resolves to %s', (alias, canonical) => {
  expect(FieldRegistry.get(alias)).toBe(FieldRegistry.get(canonical))
})
it.each(['number', 'rating', 'text'])('%s keeps a falsy default value of 0', (type) => {
  expect(FieldRegistry.get(type).getDefaultValue({ defaultValue: 0 })).toBe(0)
})
```

- [ ] **Step 2: 執行，確認失敗**

Run: `npx jest src/modules/database/fields/__tests__/FieldRegistry.test.ts`
Expected: 前三組失敗（`unknown` 型別仍然 `valid: true`、別名不存在、預設值 `0` 變 `null`）

- [ ] **Step 3: 實作介面、Registry 與既有 8 型別的 `code`／預設值修改**

各型別目前的失敗回傳要補上代碼：number → `invalid_number`／`out_of_range`、date → `invalid_date`、text 長度 → `invalid_format`、rating → `invalid_number`。

- [ ] **Step 4: 執行，確認前三組通過**

Run: `npx jest src/modules/database/fields`
Expected: 前三組 PASS；`SelectFieldTypes.test.ts` 仍通過

- [ ] **Step 5: Commit** `feat(fields): fail-closed registry, read-only flag and reject codes`

---

### Task 2: number 與 rating 規則

**Files:**
- Modify: `fields/types/NumberFieldType.ts`、`fields/types/RatingFieldType.ts`
- Test: `fields/types/__tests__/NumberFieldType.test.ts`、`fields/types/__tests__/RatingFieldType.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `FieldValidationResult`
- Produces: `export function parseNumberText(raw: unknown): number | null | 'invalid'`（`NumberFieldType.ts`；`null` 代表空值）

- [ ] **Step 1: 寫失敗的測試**（`it.each` 表格，期望值照抄）

| 輸入 | options | number 期望 |
|---|---|---|
| `" "` | — | `{ valid: true, parsedValue: null }` |
| `"1,000"` | — | `1000` |
| `"-1,234.5"` | — | `-1234.5` |
| `"１２３"` | — | `123` |
| `"Infinity"`、`"NaN"`、`"0x10"`、`"1e3x"` | — | `invalid_number` |
| `"1e3"` | — | `1000` |
| `5` | `{ max: 3 }` | `out_of_range` |
| `-1` | `{ min: 0 }` | `out_of_range` |

| 輸入 | options | rating 期望 |
|---|---|---|
| `9` | `{ max: 5 }` | `out_of_range` |
| `-3` | — | `out_of_range` |
| `2.5` | — | `out_of_range` |
| `3` | `{ max_value: 10 }` | `3` |
| `"4"` | — | `4` |
| `""` | — | `null` |

- [ ] **Step 2: 執行，確認失敗**（`npx jest src/modules/database/fields/types/__tests__/NumberFieldType src/modules/database/fields/types/__tests__/RatingFieldType`，Expected：千分位、全形、Infinity、rating 範圍等案例 FAIL）
- [ ] **Step 3: 實作 `parseNumberText` 與兩個型別**：去掉前後空白與 `,`、全形數字與 `．－` 轉半形；只接受 `/^-?\d+(\.\d+)?(e-?\d+)?$/i`；結果必須 `Number.isFinite`。rating 的上限取 `max_value ?? max ?? 5`（`0` 或負數時視為 5）
- [ ] **Step 4: 執行，確認通過**
- [ ] **Step 5: Commit** `feat(fields): strict number and rating parsing`

---

### Task 3: boolean 與 date 規則

**Files:**
- Modify: `fields/types/BooleanFieldType.ts`、`fields/types/DateFieldType.ts`
- Test: `fields/types/__tests__/BooleanFieldType.test.ts`、`fields/types/__tests__/DateFieldType.test.ts`

**Interfaces:**
- Produces: `export const BOOLEAN_TRUE_WORDS: readonly string[]`、`export const BOOLEAN_FALSE_WORDS: readonly string[]`（Task 13 前端不使用，但測試引用）

- [ ] **Step 1: 寫失敗的測試**

boolean：`true/'true'/'1'/1/'yes'/'Y'/'是'/'v'/'✓'/'勾選'` → `true`；`false/'false'/'0'/0/'no'/'n'/'否'/'x'/'✗'/''/null` → `false`；`'abc'`、`'2'` → `invalid_boolean`

date：

| 輸入 | 期望 |
|---|---|
| `"2026-10-17"` | `"2026-10-17"` |
| `"2026/10/17"`、`"2026/1/5"` | `"2026-10-17"`、`"2026-01-05"` |
| `"2026-10-16T16:00:00.000Z"` | `"2026-10-16"`（只取日期部分） |
| `"1"`、`0`、`"10/17/2026"`、`"2026-02-30"`、`"abc"` | `invalid_date` |
| `""` | `null` |

另一個案例：`getDefaultValue({ defaultValue: 'NOW' })` 回傳今天的 `YYYY-MM-DD`（用 `jest.useFakeTimers().setSystemTime(new Date(2026, 9, 17, 23, 30))`，期望 `"2026-10-17"`，也就是本地日期）

- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作**：date 只接受 `/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(T.*)?$/`，用年月日檢查日期真實存在，輸出補零的 `YYYY-MM-DD`；`getGeneratedColumnSQLExpression` 改成 `CAST(LEFT(JSON_UNQUOTE(...), 10) AS DATE)`，`getGeneratedColumnSQLType` 改 `DATE`
- [ ] **Step 4: 執行，確認通過**；同時跑 `npx jest src/modules/database/utils` 確認 `formatDateValue` 相關測試不受影響
- [ ] **Step 5: Commit** `feat(fields): strict boolean words and timezone-free dates`

---

### Task 4: 選項比對與單選／多選

**Files:**
- Create: `fields/types/selectChoices.ts`
- Modify: `fields/types/SingleSelectFieldType.ts`、`fields/types/MultipleSelectFieldType.ts`
- Test: `fields/types/__tests__/selectChoices.test.ts`；修改 `fields/types/__tests__/SelectFieldTypes.test.ts` 中鎖住「未知值照原樣存」的斷言

**Interfaces:**
- Produces:
  - `export interface SelectChoice { id: string; name: string; color?: string }`
  - `export function resolveChoices(value: unknown, options: unknown, mode: 'single' | 'multi'): { ids: string[]; unknown: string[] }`
    - 拆分輸入：陣列、JSON 陣列字串、逗號分隔字串（`mode: 'single'` 時整個值視為一個項目）
    - 每個項目先比對選項 id（完全相同），再比對名稱（去空白、不分大小寫），只取第一個符合的
    - `ids` 去重並保持順序；`unknown` 是沒有對應的原始名稱（去空白、去重，大小寫不同視為同一個）
- 單選 `validateValue`：`unknown.length > 0` → `{ valid: false, code: 'unknown_option' }`；否則 `ids[0] ?? null`
- 多選 `validateValue`：同上；否則 `ids.length ? JSON.stringify(ids) : null`

- [ ] **Step 1: 寫失敗的測試**

```ts
const opts = { choices: [{ id: 'a', name: '蔬菜' }, { id: 'b', name: '肉類' }, { id: '蔬菜', name: '其他' }] }
it('matches id before name, names case-insensitively', () => {
  expect(resolveChoices('蔬菜', opts, 'single')).toEqual({ ids: ['蔬菜'], unknown: [] })
  expect(resolveChoices(' 肉類 ', opts, 'single')).toEqual({ ids: ['b'], unknown: [] })
})
it('dedupes ids and reports unknown names once', () => {
  expect(resolveChoices('a, 甜點,a,甜點', opts, 'multi')).toEqual({ ids: ['a'], unknown: ['甜點'] })
  expect(resolveChoices(['b', 'b'], opts, 'multi')).toEqual({ ids: ['b'], unknown: [] })
})
it('treats a comma inside a single-select value as part of the name', () => {
  expect(resolveChoices('a,b', opts, 'single')).toEqual({ ids: [], unknown: ['a,b'] })
})
```

型別層：`FieldRegistry.get('single_select').validateValue('ghost', opts)` → `unknown_option`；`FieldRegistry.get('multiple_select').validateValue(['a','a'], opts)` → `'["a"]'`

- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作**：`extractChoices` 搬到 `selectChoices.ts` 並從 `SingleSelectFieldType.ts` 重新 export，維持既有 import 路徑
- [ ] **Step 4: 執行 `npx jest src/modules/database/fields`，確認通過**；`SelectFieldTypes.test.ts` 中被改的斷言記下來給 PR 說明
- [ ] **Step 5: Commit** `feat(fields): shared choice resolution, reject unknown options, dedupe multi-select`

---

### Task 5: 文字類與格式類新型別

**Files:**
- Create: `fields/types/TextLikeFieldTypes.ts`（`long_text`、`password`、`ai_prompt`：沿用 `TextFieldType` 的規則，只換 `type`／`name`）、`EmailFieldType.ts`、`UrlFieldType.ts`、`PhoneNumberFieldType.ts`（別名 `phone`）、`DurationFieldType.ts`
- Modify: `fields/types/TextFieldType.ts`（空字串存 `null`、去掉前後空白）、`fields/types/index.ts`（註冊）
- Test: `fields/types/__tests__/FormatFieldTypes.test.ts`

- [ ] **Step 1: 寫失敗的測試**

| 型別 | 輸入 → 期望 |
|---|---|
| text | `"  abc "` → `"abc"`；`"   "` → `null`；`123` → `"123"` |
| email | `"Bob@Example.COM "` → `"bob@example.com"`；`"not-an-email"`、`"a@b"` → `invalid_email` |
| url | `"example.com/x"` → `"https://example.com/x"`；`"http://a.tw"` → 不變；`"javascript:alert(1)"`、`"ftp://a"` → `invalid_url` |
| phone_number | `" +886 (2) 1234-5678 "` → `"+886 (2) 1234-5678"`；`"12345"`（5 位）、`"abc"` → `invalid_phone` |
| duration | `"1:30"` → `"1:30"`；`"1:05:09"` → `"1:05:09"`；`"90"` → `"1:30"`；`"0:75"`、`"banana"`、`"-5"` → `invalid_duration` |
| long_text／password／ai_prompt | 與 text 相同的三個案例 |

email 規則：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`。url：有協定時只接受 `http`／`https`，沒有協定（不含 `:`）時補 `https://`，並用 `new URL()` 檢查可以解析。phone：只允許 `[0-9+\-()\s]`，數字至少 6 位。duration：分鐘與秒必須 `< 60`。

- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作並註冊**
- [ ] **Step 4: 執行，確認通過**
- [ ] **Step 5: Commit** `feat(fields): register text-like, email, url, phone and duration types`

---

### Task 6: link_row、collaborators、attachment

**Files:**
- Create: `fields/types/LinkRowFieldType.ts`、`CollaboratorsFieldType.ts`（別名 `collaborator`）、`AttachmentFieldType.ts`（別名 `file`）
- Modify: `fields/types/index.ts`
- Test: `fields/types/__tests__/StructuredFieldTypes.test.ts`

- [ ] **Step 1: 寫失敗的測試**

| 型別 | 輸入 → 期望 |
|---|---|
| link_row | `[1, '2', { id: 3 }]` → 原值不變（交給 `linkRowSync`）；`'5'`、`5` → 原值不變；`{ foo: 1 }`、`[{}]` → `invalid_format` |
| collaborators | `[1, { id: 2, username: 'x' }]` → `[{ id: 1 }, { id: 2 }]`；`'[3]'` → `[{ id: 3 }]`；`[0]`、`['a']`、`[1.5]` → `invalid_format`；`[]` → `null` |
| attachment | `[{ url: 'https://x/a.png', name: 'a' }]` → 原值不變；`[{ url: 'javascript:x' }]` → `invalid_url`；`[{ name: 'no-url' }]` → `invalid_format` |

link_row 的格式規則和現在 `rowValidation.ts` 的 `link_row` 分支一樣（陣列中每個元素是數字、字串或 `{ id }`；或單一字串、數字）。

- [ ] **Step 2–4:** 失敗 → 實作並註冊 → 通過
- [ ] **Step 5: Commit** `feat(fields): register link_row, collaborators and attachment types`

---

### Task 7: 唯讀型別

**Files:**
- Create: `fields/types/ReadOnlyFieldTypes.ts`
- Modify: `fields/types/LatestCommentFieldType.ts`（`readOnly = true`，`validateValue` 一律回 `read_only`；`parseLatestCommentEntries` 不變）、`fields/types/index.ts`
- Test: `fields/types/__tests__/ReadOnlyFieldTypes.test.ts`；`src/modules/database/components/views/grid/__tests__/LatestCommentField.test.tsx` 若斷言了 `validateValue` 會寫入，改成新行為

**Interfaces:**
- Produces: `export const READ_ONLY_FIELD_TYPES = ['formula','lookup','rollup','count','autonumber','uuid','created_on','created_by','last_modified_on','last_modified_by','edit_row_link','latest_comment'] as const`

- [ ] **Step 1: 寫失敗的測試**：對 `READ_ONLY_FIELD_TYPES` 每一個，`readOnly === true`，`validateValue('x', null)` → `{ valid: false, code: 'read_only' }`；`getDefaultValue()` → `null`（latest_comment 維持 `[]`）。另外在 `fields/__tests__/FieldRegistry.test.ts` 加上：

```ts
it('registers all 29 types', () => {
  const all = ['text','long_text','password','ai_prompt','number','rating','boolean','date','single_select','multiple_select','email','url','phone_number','duration','link_row','collaborators','attachment','formula','lookup','rollup','count','autonumber','uuid','created_on','created_by','last_modified_on','last_modified_by','edit_row_link','latest_comment']
  expect(all.filter((t) => !FieldRegistry.isRegistered(t))).toEqual([])
})
```
- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作並註冊**。`createRow.ts` 的 `FORM_READONLY_TYPES` 改成從 `READ_ONLY_FIELD_TYPES` 加上 `link_row` 組成（公開表單仍不能寫 link_row）
- [ ] **Step 4: 執行 `npx jest src/modules/database/fields`，確認通過**（包括「registers all 29 types」）
- [ ] **Step 5: Commit** `feat(fields): register read-only field types`

---

### Task 8: cellWrite 服務與選項合併

**Files:**
- Create: `services/cellWrite.ts`、`services/cellWriteOptions.ts`
- Modify: `services/selectFieldMigration.ts`（`export const DEFAULT_COLORS`）
- Test: `services/__tests__/cellWrite.test.ts`、`services/__tests__/cellWriteOptions.test.ts`

**Interfaces:**
- Consumes: `FieldRegistry`、`resolveChoices`、`SelectChoice`、`RejectCode`
- Produces（`cellWrite.ts`，不 import prisma）：
  - `export interface FieldMeta { id: number; name: string; type: string; options: unknown }`
  - `export interface CellRejection { fieldId: number; code: RejectCode; reason: string }`
  - `export function prepareCellWrites(args: { fields: FieldMeta[]; input: Record<string, unknown>; mode: 'create' | 'update'; canAddOptions: boolean }): { data: Record<string, unknown>; rejected: CellRejection[]; optionAdditions: Record<number, SelectChoice[]> }`
  - `export function prepareBatchCellWrites<K>(args: { fields: FieldMeta[]; rows: Array<{ key: K; input: Record<string, unknown> }>; mode: 'create' | 'update'; canAddOptions: boolean }): { rows: Array<{ key: K; data: Record<string, unknown>; rejected: CellRejection[] }>; optionAdditions: Record<number, SelectChoice[]> }`
  - `export function mergeChoicesIntoOptions(options: unknown, additions: SelectChoice[]): unknown`：保留原本的容器（陣列、`choices`、`select_options`、`options` 鍵），名稱已存在（不分大小寫）的不重複加入
  - `export function formatRejection(fieldName: string, r: CellRejection): string` → `欄位 [${fieldName}] 驗證失敗：${r.reason}`
- Produces（`cellWriteOptions.ts`）：
  - `export async function applyOptionAdditions(tx: Prisma.TransactionClient, tableId: number, additions: Record<number, SelectChoice[]>): Promise<Array<{ id: number; options: unknown }>>`：對每個欄位在 tx 內 `findFirst({ where: { id, tableId, deletedAt: null } })` 重新讀取，`mergeChoicesIntoOptions` 後 `update`，回傳更新後的欄位

規則細節（測試要覆蓋）：
- `input` 裡不是 `/^field_\d+$/` 的鍵，或不在 `fields` 裡的欄位：忽略，不列入 `rejected`
- 唯讀型別：`rejected`（`read_only`），值不放進 `data`
- 單選／多選有未知名稱且 `canAddOptions`：為每個未知名稱產生 `{ id: randomUUID(), name, color: DEFAULT_COLORS[(既有選項數 + i) % DEFAULT_COLORS.length] }`，寫入 `optionAdditions[fieldId]`，再用「既有選項＋新選項」重新呼叫型別的 `validateValue` 取得 `parsedValue`；批次中同一欄位的同名新選項只產生一次
- `mode: 'create'` 時，`input` 沒有提供的可寫入欄位用 `getDefaultValue(options)` 填入（`null` 不放進 `data`）；`mode: 'update'` 時只處理 `input` 提供的欄位

- [ ] **Step 1: 寫失敗的測試**

```ts
const fields: FieldMeta[] = [
  { id: 1, name: '名稱', type: 'text', options: null },
  { id: 2, name: '數量', type: 'number', options: { defaultValue: 0 } },
  { id: 3, name: '編號', type: 'autonumber', options: null },
  { id: 4, name: '類別', type: 'single_select', options: { choices: [{ id: 'a', name: '蔬菜' }] } },
]
it('splits valid values from rejected ones', () => {
  const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: false,
    input: { field_1: ' 米 ', field_2: 'abc', field_3: 9, field_4: '甜點', field_99: 'x', title: 'y' } })
  expect(r.data).toEqual({ field_1: '米' })
  expect(r.rejected.map((x) => [x.fieldId, x.code])).toEqual([[2, 'invalid_number'], [3, 'read_only'], [4, 'unknown_option']])
  expect(r.optionAdditions).toEqual({})
})
it('adds unknown options when allowed and stores the new id', () => {
  const r = prepareCellWrites({ fields, mode: 'update', canAddOptions: true, input: { field_4: '甜點' } })
  const [added] = r.optionAdditions[4]
  expect(added).toMatchObject({ name: '甜點' })
  expect(r.data.field_4).toBe(added.id)
})
it('fills defaults on create, including 0', () => {
  expect(prepareCellWrites({ fields, mode: 'create', canAddOptions: false, input: {} }).data).toEqual({ field_2: 0 })
})
it('creates one option for the same new name across a batch', () => {
  const r = prepareBatchCellWrites({ fields, mode: 'update', canAddOptions: true,
    rows: [{ key: 1, input: { field_4: '甜點' } }, { key: 2, input: { field_4: '甜點 ' } }] })
  expect(r.optionAdditions[4]).toHaveLength(1)
  expect(r.rows[0].data.field_4).toBe(r.rows[1].data.field_4)
})
```

`cellWriteOptions.test.ts`：mock `tx.tableField.findFirst` 回傳 `{ options: { choices: [{ id: 'a', name: '蔬菜' }, { id: 'z', name: '別人剛加的' }] } }`，`applyOptionAdditions(tx, 10, { 4: [{ id: 'n', name: '甜點' }] })` 後 `tx.tableField.update` 收到的 `choices` 依序是 `a`、`z`、`n`（Review Focus 1）；`findFirst` 回傳 `null` 時跳過、不拋錯

- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作兩個檔案**
- [ ] **Step 4: 執行 `npx jest src/modules/database/services/__tests__/cellWrite`，確認通過**
- [ ] **Step 5: Commit** `feat(services): add cellWrite service and option merging`

---

### Task 9: 單格 PATCH 改用 cellWrite，移除 rowValidation

**Files:**
- Modify: `src/app/api/tables/[tableId]/rows/route.ts`（PATCH，約 150–215 行）
- Delete: `src/modules/database/services/rowValidation.ts`、`src/modules/database/services/__tests__/rowValidation.test.ts`（先移植）
- Test: `src/app/api/tables/[tableId]/rows/__tests__/route.cellwrite.test.ts`（新檔）；既有 `rows/__tests__/route.test.ts` 依新行為更新

- [ ] **Step 1: 移植 `rowValidation.test.ts`**：逐一把它的案例對應到 Task 2–6 的型別測試；已經被覆蓋的在 PR 說明列出對照，沒覆蓋的補進對應的型別測試檔。跑 `npx jest src/modules/database/fields` 確認通過後才刪舊檔
- [ ] **Step 2: 寫失敗的路由測試**（`authorizeAction` 與 prisma 照既有 `route.test.ts` 的 mock 方式）
  - PATCH `{ field_3: 9 }`（autonumber）→ 400，訊息 `欄位 [編號] 驗證失敗：` 開頭，`$executeRaw` 沒被呼叫
  - PATCH `{ field_2: '1,000' }` → 寫入 `1000`
  - PATCH 單選未知值、使用者有 `canEditData` → 200，`tableField.update` 收到合併後的選項，`triggerTableEvent` 收到 `field-updated`
  - PATCH 只改 `field_1`，既有資料的 `field_5`（ISO 日期字串）和 `field_6`（多選 JSON 字串）原封不動（Review Focus 5）
- [ ] **Step 3: 執行，確認失敗**
- [ ] **Step 4: 實作**：用 `prepareCellWrites({ mode: 'update', canAddOptions: true })` 取代 Zod 與 FieldRegistry 兩段；只要 `rejected` 非空就回 400（單格 PATCH 一次只改一格或少數幾格，維持整筆拒絕）；`optionAdditions` 與資料寫入放進同一個 `prisma.$transaction`；`last_modified_*` 仍在之後由路由填入
- [ ] **Step 5: 執行 `npx jest "src/app/api/tables/\[tableId\]/rows"`，確認通過**
- [ ] **Step 6: Commit** `refactor(rows): single-cell PATCH uses cellWrite; drop rowValidation`

---

### Task 10: 新增列與公開表單（createRow）

**Files:**
- Modify: `src/modules/database/services/createRow.ts`
- Test: `services/__tests__/createRow.test.ts`（更新）、`src/app/api/form/[token]/__tests__/route.test.ts`（更新）

- [ ] **Step 1: 寫失敗的測試**
  - `createTableRow` 的選項新增參數：`CreateTableRowOptions` 新增 `canAddOptions: boolean`（預設 `false`）
  - 輸入含 autonumber 值 → 結果 `{ ok: false, error: '欄位 [編號] 驗證失敗：…' }`，沒有建立列
  - 公開表單（`canAddOptions: false`）送未知選項 → `{ ok: false }`；rows POST（`canAddOptions: true`）→ 建立列並新增選項
  - 數字預設值 `0` 會寫入
  - 新增了選項時，`triggerTableEvent` 收到 `field-updated`（每個欄位一次）
- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作**：`prepareCellWrites({ mode: 'create', canAddOptions })` 取代原本的 FieldRegistry 迴圈；`fieldFilter` 保留；`rejected` 非空就回 `{ ok: false, error: formatRejection(...) }`（第一個）；選項合併與建立列同一個 transaction。rows POST 傳 `canAddOptions: true`，`form/[token]` 傳 `false`
- [ ] **Step 4: 執行 `npx jest src/modules/database/services/__tests__/createRow "src/app/api/form" "src/app/api/tables/\[tableId\]/rows/__tests__"`，確認通過**
- [ ] **Step 5: Commit** `refactor(rows): createRow and public forms use cellWrite`

---

### Task 11: 批次新增／更新

**Files:**
- Modify: `src/app/api/tables/[tableId]/rows/batch/route.ts`（POST、PATCH）
- Test: `rows/batch/__tests__/route.test.ts`（更新）、`rows/batch/__tests__/route.cellwrite.test.ts`（新檔）

**Interfaces:**
- Produces（回應格式，Task 13 使用）：
  - POST：`{ rows, rejected: Array<{ clientId: string; fieldId: number; code: RejectCode; reason: string }> }`
  - PATCH：`{ ok: true, updates, rejected: Array<{ rowId: number; fieldId: number; code: RejectCode; reason: string }> }`

- [ ] **Step 1: 寫失敗的測試**
  - PATCH 兩列：第 1 列 `{ field_2: 'abc', field_1: 'x' }`、第 2 列 `{ field_2: '5' }` → 200；第 1 列只寫 `field_1`、保留原本的 `field_2`；第 2 列寫 `5`；`rejected` 含 `{ rowId: 1, fieldId: 2, code: 'invalid_number' }`
  - PATCH 某列所有格子都被拒絕 → 該列 id 不出現在 `$executeRawUnsafe` 的參數裡，也不在 `updates` 裡（Review Focus 3）
  - POST 兩列，其中一列只有不合法的值 → 兩列都建立（後者為空白列加上預設值），`rejected` 帶 `clientId`
  - 貼上 autonumber 欄 → `read_only`，自動編號仍由伺服器分配
  - 未知選項 → 新增一次選項，兩列存同一個 id，`field-updated` 事件送出一次
- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作**：兩個 handler 都改用 `prepareBatchCellWrites`（`canAddOptions: true`），移除原本 for 迴圈內的 FieldRegistry 驗證與「驗證失敗就 400」；`applyOptionAdditions` 放在既有 transaction 開頭；audit 欄位、autonumber、公式重算維持原本位置
- [ ] **Step 4: 執行 `npx jest "src/app/api/tables/\[tableId\]/rows/batch"`，確認通過**
- [ ] **Step 5: Commit** `feat(rows): batch writes skip invalid cells and report them`

---

### Task 12: 搬移、AI 助理、總表覆寫、Airtable 匯入

**Files:**
- Modify: `rows/move/route.ts`、`src/app/api/ai/table-agent/route.ts`（約 280–295 行）、`src/app/api/workspaces/[id]/master-views/[viewId]/rows/route.ts`、`src/app/api/database/import/airtable/route.ts`
- Test: 各自的 `__tests__/route.test.ts` 加案例

- [ ] **Step 1: 寫失敗的測試**
  - move：來源列的 autonumber 值不會被搬進目標（目標仍自動分配）；目標欄位為數字、來源值 `'abc'` → 整個請求 400（搬移需要完整資料，維持整筆拒絕），訊息用 `formatRejection`
  - AI：工具呼叫要寫入唯讀欄位 → 該格不寫入，工具結果含拒絕原因
  - 總表覆寫：overrides 含不合法值 → 400，`masterViewOverride` 沒被寫入
  - Airtable 匯入：一列含不合法數字 → 該格不寫入、其他照常，回應的 `stats` 多出 `rejectedCellCount`
- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作**：move 用 `prepareCellWrites({ mode: 'create', canAddOptions: true })`；AI 用 `mode: 'update'`、`canAddOptions: true`；總表覆寫依來源表欄位用 `mode: 'update'`、`canAddOptions: false`；Airtable 用 `mode: 'create'`、`canAddOptions: true`，選項直接合併進剛建立的欄位
- [ ] **Step 4: 執行四個路由的測試，確認通過**
- [ ] **Step 5: Commit** `refactor(api): move, AI agent, master view overrides and Airtable import use cellWrite`

---

### Task 13: 前端批次回報與貼上整理

**Files:**
- Modify: `src/modules/database/services/row.ts`（`batchUpdateRows`、`batchCreateRows` 回傳 `rejected`）、`hooks/useCellEdit.ts`（`batchUpdateCells`、`recentlyRejected`）、`hooks/useRowOperations.ts`（`batchAddRows`）、`components/views/grid/GridView.tsx`（`sanitizePastedVal`、傳遞 `recentlyRejected`）、`components/views/grid/GridViewCell.tsx`（`grid-cell--rejected`）
- Test: `hooks/__tests__/useCellEdit.rejected.test.ts`（新檔，jsdom）、`components/views/grid/__tests__/GridViewKeyboardAndBatchActions.test.tsx`（加案例）

**Interfaces:**
- Consumes: Task 11 的回應格式
- Produces: `batchUpdateRows(...)` 回傳型別加上 `rejected?: Array<{ rowId: number; fieldId: number; code: string; reason: string }>`；`batchCreateRows` 加上 `rejected?: Array<{ clientId: string; fieldId: number; code: string; reason: string }>`

- [ ] **Step 1: 寫失敗的測試**
  - `batchUpdateCells` 收到 `rejected` 兩筆 → `addToast('已寫入 3 格，2 格未寫入：數量 必須是有效的數字', 'info')`（顯示前兩個不同原因，以「、」連接），並把被拒絕的格子的本地值還原成更新前的值
  - 沒有 `rejected` 時維持原本行為，不另外顯示 toast
  - `useCellEdit` 回傳 `recentlyRejected: Set<string>`（鍵為 `${rowId}:${fieldId}`），收到 `rejected` 後包含那些格子，3 秒後清空（`jest.useFakeTimers`）；GridView 把它傳給儲存格，儲存格加上 class `grid-cell--rejected`（樣式：紅色外框，放在既有的 grid SCSS）
  - GridView 貼上 `'abc'` 到 boolean 欄 → 送出的值是 `'abc'`（不再轉成 `true`）；貼上 `' 12 '` 到 number 欄 → 送出 `'12'`
- [ ] **Step 2: 執行，確認失敗**
- [ ] **Step 3: 實作**：`sanitizePastedVal` 只做 `trim`；回報 toast 的文案照上面的格式；`useRowOperations.batchAddRows` 收到 `rejected` 時用同樣格式的 toast；被拒絕格子的還原沿用 `batchUpdateCells` 既有的樂觀更新回滾方式
- [ ] **Step 4: 執行 `npx jest src/modules/database/hooks src/modules/database/components/views/grid`，確認通過**
- [ ] **Step 5: Commit** `feat(grid): report rejected cells after batch writes; paste sends raw text`

---

### Task 14: 一致性測試、文件與完整驗證

**Files:**
- Create: `src/app/api/tables/[tableId]/rows/__tests__/writePathConsistency.test.ts`
- Modify: `.claude/rules/backend.md`（錯誤紀錄一行）、`.claude/rules/frontend.md`（規則：欄位型別段落改寫）、`PROGRESS.md`、`docs/audits/2026-10-17-editing-audit.md`（若此分支有這個檔案，標記已修的項目；沒有就略過）

- [ ] **Step 1: 寫一致性測試**：同一組輸入 `{ field_1: ' 米 ', field_2: '1,000', field_4: '蔬菜', field_7: '2026/1/5', field_8: '否' }`（text、number、single_select、date、boolean）分別經過單格 PATCH、批次 PATCH、`createTableRow`、move，比對四條路徑最後寫入的 `data` 這五個鍵完全相同：`{ field_1: '米', field_2: 1000, field_4: 'a', field_7: '2026-01-05', field_8: false }`
- [ ] **Step 2: 執行，確認通過**（如果失敗，代表前面某條路徑沒接好，回到對應的 task 修）
- [ ] **Step 3: 文件**：`backend.md` 錯誤紀錄加「寫入路徑各自驗證導致同一個值結果不同 → 新增的寫入路徑一律呼叫 `prepareCellWrites`，不要直接呼叫 `FieldRegistry.validateValue`」；`frontend.md` 把「未註冊的型別會靜默退回 pass-through」改成「未註冊的型別一律拒絕寫入」；`PROGRESS.md` 更新進度與範圍外待辦（密碼雜湊、既有資料清理、前端即時驗證、S7／F17、S1）
- [ ] **Step 4: 完整驗證**

Run: `npm run verify`
Expected: typecheck、lint、jest、build:check 全過

- [ ] **Step 5: Commit** `test: cross-path write consistency; docs for unified cell write`
