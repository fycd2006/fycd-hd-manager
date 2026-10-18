# 日期欄位補強：含時間、格式、時區

日期：2026-10-19
所屬：Airtable 完整匯入總覽的子專案 2（`2026-10-18-airtable-import-roadmap.md`）

## 目標

日期欄位提供與 Airtable 相同的設定，讓 Airtable 的 `date`／`dateTime`／`createdTime`／`lastModifiedTime` 欄位可直接對應，不遺失時間與格式。

## 範圍

- 適用型別：`date`、`created_on`、`last_modified_on`。
- 範圍外：公式中的日期函式（子專案 4）、Airtable 匯入的對應（子專案 5）、generated column 改型別。

## 欄位設定（`TableField.options`）

| 鍵 | 值 | 預設 |
|---|---|---|
| `date_format` | `local`、`friendly`、`us`、`european`、`iso` | `iso` |
| `date_include_time` | boolean | `date`：false；`created_on`／`last_modified_on`：true |
| `date_time_format` | `'12'`、`'24'` | `'24'` |
| `date_time_zone` | `'client'` 或 IANA 名稱（如 `Asia/Taipei`） | `'client'` |
| `date_show_time_zone` | boolean | false |

舊欄位沒有這些鍵，套用預設值後顯示結果與現況相同（`YYYY-MM-DD`）。

各格式範例（2026-10-18 14:30，時區 Asia/Taipei）：

| 格式 | 日期 | 含時間（24／12） |
|---|---|---|
| `iso` | 2026-10-18 | 2026-10-18 14:30／2026-10-18 2:30 PM |
| `us` | 10/18/2026 | 10/18/2026 14:30／10/18/2026 2:30 PM |
| `european` | 18/10/2026 | 18/10/2026 14:30／18/10/2026 2:30 PM |
| `local` | 依介面語言，`Intl.DateTimeFormat(locale, { dateStyle: 'short' })`，繁中為 2026/10/18 | 同左加時間 |
| `friendly` | 依介面語言，`dateStyle: 'long'`，繁中為 2026年10月18日，英文為 October 18, 2026 | 同左加時間 |

`date_show_time_zone` 為 true 時，在時間後加上時區縮寫（`Intl` 的 `timeZoneName: 'short'`，例如 GMT+8）；不含時間時不顯示。

## 儲存

- 不含時間：`YYYY-MM-DD`，不受時區影響（與現況相同）。
- 含時間：UTC ISO `YYYY-MM-DDTHH:mm:ss.sssZ`。
- 改設定不改寫既有資料：
  - 不含時間 → 含時間：舊的 `YYYY-MM-DD` 值視為欄位時區當天 00:00 顯示，下次編輯時才存成 UTC。
  - 含時間 → 不含時間：舊的 UTC 值以欄位時區換算成日期顯示，下次編輯時才存成 `YYYY-MM-DD`。

## 共用模組 `src/modules/database/utils/dateTime.ts`

前後端共用，只用內建 `Intl`，不新增套件。

- `resolveDateOptions(options, fieldType)`：補上預設值，回傳完整設定。
- `resolveTimeZone(options, viewerTz?)`：`client` 時回傳 `viewerTz`；沒有 `viewerTz` 時退回 `Intl.DateTimeFormat().resolvedOptions().timeZone`。
- `normalizeDateInput(value, options, viewerTz?)`：轉成儲存值，失敗回傳 null。
  - 含時間：帶時差或 `Z` 的 ISO 直接轉 UTC；不帶時差的 `YYYY-MM-DD HH:mm`、`YYYY-MM-DDTHH:mm(:ss)` 以欄位時區換算；只有日期時視為欄位時區 00:00。
  - 不含時間：與現有 `DateFieldType` 行為相同；若輸入是帶時差的 ISO，以欄位時區換算出日期。
- `formatFieldDate(value, options, { locale, viewerTz, fieldType })`：顯示字串；無法解析時原樣回傳字串。
- `toEditorValue(value, options, viewerTz?)`：轉成 `<input type="date">` 或 `<input type="datetime-local">` 的值（欄位時區的牆上時間）。
- `fromEditorValue(input, options, viewerTz?)`：反向換算成儲存值。
- `dayRangeUtc(day, timeZone)`：`YYYY-MM-DD` 在該時區對應的 `[startUtc, endUtc)`。
- `cellDayInZone(value, timeZone)`：儲存值落在該時區的哪一天（`YYYY-MM-DD`）。

時差計算：以 `Intl.DateTimeFormat(…, { timeZone, hourCycle: 'h23', year…second })` 的 `formatToParts` 算出該瞬間在目標時區的牆上時間，與 UTC 相減得到時差；牆上時間轉 UTC 時迭代兩次以處理夏令時間切換。

`utils/date.ts` 的 `formatDateValue` 保留不動，給沒有欄位設定的呼叫端使用。

## 要改的位置

- 驗證：`fields/types/DateFieldType.ts` 的 `validateValue` 改呼叫 `normalizeDateInput`；`getDefaultValue` 的 `NOW` 依 `date_include_time` 回傳日期或 UTC ISO。
- 顯示（`formatDateValue(val)` → `formatFieldDate(val, field.options, …)`）：`GridViewCell.tsx`、`MasterGridCell.tsx`、`GridView.tsx`、`MasterGridView.tsx`、`CardDrawer.tsx`、`RowEditModal.tsx`、`DatabaseViewRouter.tsx`、`FormView.tsx`，以及 `created_on`／`last_modified_on` 的顯示處。
- 編輯器：上述位置的日期輸入，含時間時用 `datetime-local`，值經 `toEditorValue`／`fromEditorValue`。
- 欄位設定 UI：新增 `components/modals/field-options/DateFieldOptions.tsx`，接進 `FieldModal.tsx` 與 `CreateFieldPopover.tsx`（型別為 `date`、`created_on`、`last_modified_on` 時顯示）；文案加進 `zh-TW.json`／`en.json`。
- 篩選：
  - 伺服器（`services/rowQuery.ts` 慢路徑）的 `date_equal`／`date_before`／`date_after` 改用 `cellDayInZone` 比較「天」。
  - 時區：欄位設定為固定時區時用該時區；`client` 時使用 filter 參數附帶的檢視者時區，前端送出篩選時附上 `Intl` 的時區（新增選填 query `tz`，僅接受 `Intl` 能解析的 IANA 名稱，否則忽略並退回伺服器時區）。
  - 前端若有自行比對日期的篩選，改用同一組函式。
- 日曆視圖：`CalendarView.tsx` 以 `cellDayInZone` 決定一筆資料落在哪一天。
- CSV：匯出使用 `formatFieldDate`；匯入以 `normalizeDateInput` 解析。
- generated column：維持 `DATE`／`LEFT(…, 10)`。含時間欄位的索引欄會是 UTC 日期，但篩選不走此欄；在 `getGeneratedColumnSQLExpression` 加註說明。

## 錯誤處理

- 無法解析的輸入：驗證回傳 `invalid_date`，錯誤訊息依是否含時間顯示「YYYY-MM-DD」或「YYYY-MM-DD HH:mm」。
- 無效的 `date_time_zone`（`Intl` 拋錯）：視為 `client`。
- 顯示時遇到無法解析的值：原樣顯示字串，不拋錯。

## 測試

- `utils/__tests__/dateTime.test.ts`：五種格式 × 12／24 小時制 × 顯示時區標籤；`Asia/Taipei` 跨日邊界（UTC 2026-10-17T23:59Z = 台北 10-18 07:59）；`America/New_York` 夏令時間切換日（2026-03-08、2026-11-01）；`dayRangeUtc`；編輯器往返換算；無效時區退回。
- `fields/types/__tests__/`：`DateFieldType` 含時間／不含時間的正規化、非法值、`NOW` 預設值。
- `services/__tests__/rowQuery.test.ts`：`date_equal` 依欄位時區與 `tz` 參數判斷跨日邊界。
- 元件測試：`GridViewCell` 依設定顯示含時間格式；`DateFieldOptions` 切換設定送出正確的 `options`。
