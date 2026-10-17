# 統一寫入驗證層 設計規格

- 日期：2026-10-17
- 來源：`docs/audits/2026-10-17-editing-audit.md` 的子專案 2（健檢 F1–F3、F5–F16、C3、C4）
- 狀態：設計已確認，待實作計畫

## 1. 目標

同一個值不論從哪條路徑寫入（單格編輯、貼上、自動填滿、CSV、公開表單、搬移、AI 助理、總表覆寫、Airtable 匯入），都得到**同一個結果**：存成相同格式，或用相同理由拒絕。使用者不能改寫唯讀欄位。

成功條件：
- 健檢的 F1–F3、F5–F16、C3、C4 各自有測試，而且全部通過
- 29 種欄位型別（前端可選的 28 種，加上舊資料用的 attachment）在伺服器端都有明確規則；未註冊的型別一律拒絕
- 上述 9 條寫入路徑都只透過 `prepareCellWrites` 判斷儲存格值

## 2. 已確認的決定

| 主題 | 決定 |
|---|---|
| 做法 | 伺服器端單一入口（做法 A）。`FieldRegistry` 保持純 TypeScript、不依賴 Prisma，之後可以延伸成前後端共用 |
| 批次中有不合法的格子 | 合法的照常寫入；不合法的跳過並回報原因。**更新時保留原值，新增列時留空** |
| 單選／多選的未知值 | 有 `canEditData` 且不是公開表單時，自動新增選項；否則拒絕 |
| 日期 | 日期欄位沒有時間設定，一律存成 `YYYY-MM-DD`，不做時區轉換 |
| 多選的儲存格式 | 維持 JSON 字串，不改格式（讀取端太多，改格式風險高、好處小） |
| 密碼欄位 | 這次只當文字驗證，雜湊儲存另開子專案 |
| 既有的錯誤資料 | 不在這次範圍。讀取時繼續相容舊格式（ISO 日期、多選 JSON 字串） |

## 3. 架構

### 3.1 `FieldRegistry`（`src/modules/database/fields/`）

- `FieldType` 介面新增 `readonly readOnly: boolean`
- `validateValue(value, options)` 回傳：
  - `{ valid: true, parsedValue }`
  - `{ valid: false, code, error }`：`code` 是固定代碼（見 3.3），`error` 是中文說明
- 補齊 29 種型別（可寫入 17 種、唯讀 12 種），都要註冊：
  - **可寫入**：text、long_text、password、ai_prompt、number、rating、boolean、date、single_select、multiple_select、email、url、phone_number、duration、link_row、collaborators、attachment
  - **唯讀**：formula、lookup、rollup、count、autonumber、uuid、created_on、created_by、last_modified_on、last_modified_by、edit_row_link、latest_comment
- `FieldRegistry.get()` 遇到未註冊的型別，回傳一個 `readOnly: true`、驗證一律失敗（`code: 'unknown_type'`）的型別，不再照原樣接受
- 型別別名：`phone` → `phone_number`、`collaborator` → `collaborators`、`file` → `attachment`。註冊時兩個名稱都對應到同一個實作
- `getDefaultValue` 改用 `options?.defaultValue ?? null`，讓 `0` 和 `false` 可以當預設值

### 3.2 `services/cellWrite.ts`（新檔，唯一的寫入入口）

```ts
export interface PrepareCellWritesInput {
  fields: FieldMeta[]                 // id、name、type、options
  input: Record<string, unknown>      // { field_<id>: 原始值 }
  mode: 'create' | 'update'
  canAddOptions: boolean              // 有 canEditData 且不是公開表單
}

export interface PrepareCellWritesResult {
  data: Record<string, unknown>                 // 正規化後、可以寫入的值
  rejected: Array<{ fieldId: number; code: RejectCode; reason: string }>
  optionAdditions: Record<number, SelectChoice[]> // 要合併進欄位設定的新選項
}

export function prepareCellWrites(args: PrepareCellWritesInput): PrepareCellWritesResult
```

- 不讀寫資料庫，只做判斷
- `input` 裡不是 `field_<數字>` 的鍵、或不屬於這張表的欄位，直接忽略，不列入 `rejected`
- 唯讀欄位一律列入 `rejected`（`code: 'read_only'`）
- 單選／多選的未知值：`canAddOptions` 為 true 時產生新選項（id 用現有的選項 id 產生方式、顏色依序輪替），寫入新選項的 id；同一次呼叫裡相同名稱的新選項只產生一個。`canAddOptions` 為 false 時列入 `rejected`（`code: 'unknown_option'`）
- 建立者、建立時間、最後修改者／時間、自動編號等系統值，由呼叫端在 `prepareCellWrites` 之後填入，不經過這個函式
- 批次版本 `prepareBatchCellWrites(rows, ...)` 對多列呼叫，並把各列的 `optionAdditions` 合併去重

### 3.3 拒絕代碼

`read_only`、`unknown_type`、`unknown_option`、`invalid_number`、`out_of_range`、`invalid_boolean`、`invalid_date`、`invalid_email`、`invalid_url`、`invalid_phone`、`invalid_duration`、`invalid_format`

### 3.4 各寫入路徑

| 路徑 | 改法 |
|---|---|
| 單格 PATCH（`rows/route.ts`） | 改呼叫 `prepareCellWrites`；只改一格且被拒絕時回 400，訊息沿用「欄位 [X] 驗證失敗：…」。移除 `validateRowPatchPayload` 與 `services/rowValidation.ts` |
| 新增列 POST、公開表單（`services/createRow.ts`） | 改呼叫 `prepareCellWrites`；公開表單 `canAddOptions = false`。表單有欄位被拒絕時回 400（表單需要提交者修正） |
| 批次新增／更新（`rows/batch`） | 改呼叫 `prepareBatchCellWrites`；回應加上 `rejected: [{ rowId?, clientId?, fieldId, code, reason }]`，HTTP 狀態維持 200。新增時整列都被拒絕也照樣建立空白列（保留使用者貼上的列數） |
| 搬移（`rows/move`） | 依目標表欄位呼叫 `prepareCellWrites`（`mode: 'create'`） |
| AI 助理（`ai/table-agent`） | 改呼叫 `prepareCellWrites`，被拒絕的格子回報給 AI 的結果 |
| 總表覆寫（`master-views/.../rows`） | overrides 依來源表欄位呼叫 `prepareCellWrites`；有被拒絕的就回 400 |
| Airtable 匯入 | 每列呼叫 `prepareCellWrites`（`canAddOptions = true`），匯入結果的統計加上「未寫入格數」 |

`optionAdditions` 與資料列寫入放在**同一個 transaction**：先合併欄位設定，再寫資料。新增選項後送出 `field-updated` 即時事件。

## 4. 各型別規則

| 型別 | 接受 | 存成 | 拒絕代碼（舉例） | 健檢 |
|---|---|---|---|---|
| text／long_text／password／ai_prompt | 任何值轉成文字，去掉前後空白 | 字串；空字串存 `null` | — | — |
| number | 數字；文字去掉千分位逗號、空白，全形數字轉半形 | 有限數字 | `Infinity`、`NaN`、`0x10` → `invalid_number`；超出 min／max → `out_of_range`；只有空白 → 視為空值 | F5–F8 |
| rating | 0 到 max（`max_value`／`max`，預設 5）的整數 | 整數 | 超出範圍、小數 → `out_of_range`（不再默默裁切或四捨五入） | F13 |
| boolean | `true`／`false`、`1`／`0`、`yes`／`no`、`y`／`n`、`是`／`否`、`v`／`x`、`✓`／`✗`、`勾選`；空值 → `false` | `true`／`false` | 其他文字 → `invalid_boolean` | F12、C4 |
| date | `YYYY-MM-DD`、`YYYY/M/D`、ISO 字串（只取日期部分，不做時區轉換） | `YYYY-MM-DD` | 純數字、無法辨識、不存在的日期（2/30）→ `invalid_date` | F10、F11 |
| single_select | 選項 id 或名稱（去掉空白、不分大小寫） | 選項 id | 未知值 → 自動新增或 `unknown_option` | F14 |
| multiple_select | 陣列、JSON 陣列字串、逗號分隔字串 | 選項 id 陣列，**去重**後存成 JSON 字串 | 同上 | F15 |
| email | email 格式 | 小寫字串 | `invalid_email` | F2 |
| url | `http://`／`https://` 開頭；沒有協定時補上 `https://` | 字串 | 其他協定 → `invalid_url` | F2 |
| phone_number | 數字、空白、`+ - ( )`，至少 6 位數字 | 去掉前後空白的字串 | `invalid_phone` | F2 |
| duration | `h:mm`、`h:mm:ss`、純數字（視為分鐘） | `h:mm` 或 `h:mm:ss` | `invalid_duration` | F1 |
| link_row | 交給既有的 `linkRowSync`，這裡只檢查格式（id、`{ id }` 陣列） | 不變 | `invalid_format` | — |
| collaborators | id 陣列或 `{ id }` 物件陣列 | `[{ id }]` | 非正整數 id → `invalid_format` | R3 |
| attachment | 物件陣列，`url` 必須是 `http(s)` | 不變 | `invalid_url` | F18 |
| 唯讀 12 種 | — | — | `read_only` | F3、F16、C3 |
| 未註冊 | — | — | `unknown_type` | F1 |

空值（`null`、`undefined`、空字串）在可寫入型別一律視為「清空」，存成 `null`（boolean 存 `false`）。

## 5. 前端配合（最小範圍）

- 批次回應有 `rejected` 時，toast 顯示「已寫入 N 格，M 格未寫入」，點開可以看依代碼分組的原因；未寫入的格子短暫顯示紅框
- `GridView` 的 `sanitizePastedVal` 只做 `trim`，不再自行判斷 number／boolean，判斷交給伺服器（修 C4）
- 自動新增的選項透過既有的 `field-updated` 事件更新欄位設定，不另外做確認視窗

## 6. 測試

- `fields/types/__tests__/`：每種型別一個測試檔，涵蓋第 4 節表格每一列，包括健檢探測過的邊界值（`" "`、`"1,000"`、`"Infinity"`、`"0x10"`、`"2026/10/17"`、`"1"`、`"abc"` 等）
- `services/__tests__/cellWrite.test.ts`：唯讀、未知型別、未知選項（有權限／沒權限）、同名新選項去重、預設值 `0`、忽略不屬於這張表的鍵
- 路由：
  - 每條路徑至少一個「被拒絕的格子不會寫入、其他格子照常寫入」的測試
  - 一個一致性測試：同一組輸入經過單格 PATCH、批次、表單、搬移，存下的值相同
- 前端：批次回報 toast；貼上不再自行把文字轉成 boolean
- 既有測試中鎖住舊行為的斷言（例如 rating 裁切、boolean 默默變 false、多選不去重）改成新行為，並在 PR 說明逐一列出

## 7. 範圍外（記入待辦）

- 密碼欄位雜湊儲存、只寫不讀
- 清理資料庫中既有的錯誤資料
- 前端即時驗證（做法 B）
- 文字長度上限與索引功能的去留（健檢 S7、F17）
- 改欄位型別時的既有值轉換（健檢 S1，屬於子專案 5）
