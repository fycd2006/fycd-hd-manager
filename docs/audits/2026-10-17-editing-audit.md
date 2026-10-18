# 工作區編輯體驗健檢（2026-10-17）

狀態：**程式碼層健檢完成**。依使用者決定，這次沒有接資料庫，五個區塊都用讀程式碼和探測測試的方式檢查。標示「待實測」的項目是從程式碼推論出來的，還沒在畫面上重現過。

## 總結

共 47 項：A（資料錯誤）20 項、B（流程卡住）17 項、C（體驗）10 項。最需要優先處理的五件事：

1. **分組檢視下的範圍選取會跨到其他分組（S-C1）**：選取畫面上相鄰的兩列後按 Delete、貼上或自動填滿，可能清掉或覆寫中間其他分組、甚至收合起來看不到的資料列
2. **伺服器端驗證有大洞**：28 種型別裡有 20 種完全不驗證（F1）；各寫入路徑的驗證不一致（F2）；唯讀欄位（自動編號、建立者等）可以被改寫或被貼上覆蓋（F3、C3）
3. **欄位值會默默變形或消失**：`Infinity` 變成 null（F5）、預設值 0 被吃掉（F9）、日期依寫法差一天（F10）、單選／多選接受不存在的選項（F14、F15）
4. **刪除工作區或資料庫是永久刪除**，只有一個瀏覽器 `confirm()`（W1）；刪除使用者會連帶刪掉他所有的留言（W3）
5. **展開編輯每次修改進階欄位都會存兩次**（R1），而且多種型別只給一般文字框（R2）

嚴重度：
- **A 資料錯誤**：資料存錯、遺失或被竄改
- **B 流程卡住**：操作失敗或結果和預期不同
- **C 體驗**：可以用，但不順或令人困惑

探測方式：用一次性的 jest 測試，把各型別的 `FieldRegistry.get(type).validateValue()` 跑過一組邊界輸入（跑完已刪除，沒有進任何分支）。

---

## 1. 欄位型別正確性

### 1.1 結構性問題

| # | 嚴重度 | 問題 | 位置 |
|---|---|---|---|
| F1 | A | 前端提供 28 種欄位型別，伺服器端只註冊 8 種（text、number、date、single_select、multiple_select、boolean、rating、latest_comment）。其餘 20 種（long_text、url、email、phone_number、duration、password、uuid、autonumber、formula、count、rollup、lookup、collaborators、link_row、created_*／last_modified_*、edit_row_link、ai_prompt）會落到 `UnknownFieldType`，**什麼值都接受、照原樣存** | `fields/FieldRegistry.ts`、`fields/types/index.ts`、`modals/FieldTypeSelector.tsx` |
| F2 | A | 驗證分成兩層，而且各寫入路徑不一致：單筆 PATCH 會跑 `validateRowPatchPayload`（Zod，檢查 email／url／數字／日期）再跑 `FieldRegistry`；**批次新增、批次更新（貼上）、`createRow`（含公開表單）、搬移只跑 `FieldRegistry`**。所以同一個 email 欄位，單格輸入會擋下無效值，貼上就能存進去 | `services/rowValidation.ts`、`rows/route.ts`、`rows/batch/route.ts`、`services/createRow.ts`、`rows/move/route.ts` |
| F3 | A | 單筆 PATCH 只強制覆寫 `last_modified_by`／`last_modified_on`。**autonumber、created_by、created_on 可以被使用者直接改寫**（formula 會在之後重算，所以不受影響） | `rows/route.ts:185-213` |
| F4 | C | 型別名稱混用：`phone_number`／`phone`、`collaborators`／`collaborator` | `FieldTypeSelector.tsx:67` |

### 1.2 各型別的行為（探測結果）

| # | 嚴重度 | 型別 | 輸入 → 實際結果 | 預期 |
|---|---|---|---|---|
| F5 | A | number | `"Infinity"` → 驗證通過，但存成 JSON 時變成 `null`，**資料默默消失** | 拒絕 |
| F6 | A | number | `" "`（空白）→ `0` | 視為空值 |
| F7 | B | number | `"1,000"` → 拒絕 | 從 Excel 貼上千分位數字很常見，應該接受 |
| F8 | C | number | `"0x10"` → `16`、`"1e3"` → `1000` | 多半不是使用者的本意 |
| F9 | A | number／rating／text | 預設值 `0` 會被 `options?.defaultValue \|\| null` 吃掉，變成 `null` | 保留 `0` |
| F10 | A | date | `"2026/10/17"` → `2026-10-16T16:00:00Z`（依伺服器時區解析後轉成 UTC）。`"2026-10-17"` 則是 UTC 午夜。**同一天兩種寫法存成不同日期**，在伺服器端排序、篩選、公式時可能差一天 | 只有日期的值存成不含時區的 `YYYY-MM-DD` |
| F11 | B | date | `"1"` → 2000-12-31、`0` → 1970-01-01 | 拒絕 |
| F12 | B | boolean | `"abc"`、`"否"` 都默默變成 `false`，任何無效值都不會報錯 | 無效值要拒絕；`否`／`no` 明確對應 false |
| F13 | B | rating | `9`（max 5）→ `5`、`-3` → `0`、`2.5` → `3`：**默默裁切或四捨五入** | 超出範圍要拒絕或提示 |
| F14 | A | single_select | 不在選項清單裡的值（如 `"ghost"`）**照原樣存入**，形成「幽靈選項」 | 拒絕，或依設定自動新增選項 |
| F15 | A | multiple_select | 同上：`"a,ghost"` → `["a","ghost"]`；重複值 `["a","a"]` 不會去重；存的是 JSON **字串**而不是陣列 | 拒絕未知值、去重 |
| F16 | A | latest_comment | 可以直接寫入任意陣列，包括偽造的留言者名稱 | 只能由系統寫入 |
| F17 | B | text | 沒有長度上限，但建索引時 generated column 是 `VARCHAR(255)`，超過 255 字的值在建索引或寫入時可能出錯（待實測） | 索引型別和實際長度一致 |
| F18 | C | attachment | `file.url` 直接放進 `<a href>`，沒有限制 scheme（網址欄位有自動補 `https://`，沒問題） | 只允許 http(s) |

### 1.3 維護面（影響後續改善的成本）

| # | 說明 |
|---|---|
| M1 | `GridViewCell.tsx` 2290 行、`GridView.tsx` 3117 行。儲存格編輯相關的修改都集中在這兩個大檔 |
| M2 | 一般表格（`GridViewCell`）和總表（`MasterGridCell`）各有一套儲存格渲染，同一型別的顯示和行為可能不一致 |

---

## 2. 欄位與資料表結構

| # | 嚴重度 | 問題 | 位置 |
|---|---|---|---|
| S1 | A | **改欄位型別完全不轉換既有值**：例如文字改成數字，原本的「abc」會原封不動留著，之後排序、篩選、公式都會出錯。只有改成單選／多選時會跑 `migrateSelectFieldsForTable` | `fields/[fieldId]/route.ts` PATCH |
| S2 | A | **公式的 `F<n>` 簡寫有歧義**：先找 id 為 n 的欄位，找不到才當作「第 n 欄」。用 `F2` 寫的公式，只要調整欄位順序結果就會默默改變；同一個 `F3`，在表裡剛好有 id 3 的欄位時，指的就是另一個欄位 | `lib/formula.ts` `preprocessShortAliases` |
| S3 | B | 只改 `options` 的權限是 `canEditData`：編輯者就能改公式內容、選項清單、lookup／rollup 設定，這些其實是結構變更 | `fields/[fieldId]/route.ts:23` |
| S4 | B | 刪除欄位時，`cleanupFieldDependencies` 會把參照它的 lookup／rollup 設定清成 null。之後**從回收站還原這個欄位，lookup／rollup 也不會恢復** | `services/rowCascade.ts:252`、`trash/route.ts` |
| S5 | B | `cleanupFieldDependencies` 每刪一個欄位，就掃描**全站**所有 lookup／rollup 欄位，沒有限定在同一個工作區 | `services/rowCascade.ts:253` |
| S6 | B | 從回收站還原欄位只需要 `canEditData`，等於編輯者可以做結構變更 | `trash/route.ts:55` |
| S7 | B | 「建立索引」只會在全站共用的 `TableRow` 表上 `ALTER TABLE ADD COLUMN`，但查詢層（`rowQuery.ts`）完全沒用到這些欄，**對查詢沒有效果**。TiDB 每張表的欄數有上限，這等於所有工作區共用一份額度。建立失敗時只有 `console.error`，使用者不會知道 | `services/schemaService.ts`、`fields/[fieldId]/route.ts` |
| S8 | C | 刪除 link_row 欄位時，沒有處理另一張表上配對的反向欄位（待實測） | `fields/[fieldId]/route.ts` DELETE |

## 3. 儲存格編輯

| # | 嚴重度 | 問題 | 位置 |
|---|---|---|---|
| C1 | A | **分組檢視下的範圍選取用原始索引取最小值到最大值**。方向鍵用的是畫面順序（`visualGroupedRows`），但選取範圍、Delete 清除、貼上、自動填滿、選取統計都是 `rows[minRow..maxRow]`。在畫面上選取相鄰兩列（例如原始索引 1 和 7），就會影響 1 到 7 之間其他分組、甚至收合起來看不到的資料列（待實測確認畫面行為，程式邏輯已確認） | `GridView.tsx:789`（selectionBounds）、`:970`（清除）、`:1062`（貼上）、`:1171`（自動填滿） |
| C2 | A | 分組檢視下，Enter／Tab 在 `rows` 的最後一列就自動新增資料列，不一定是畫面上的最後一列；Tab 換列用的是原始索引 +1 | `GridView.tsx:1468` |
| C3 | A | 貼上和自動填滿**沒有略過唯讀或計算型欄位**（自動編號、建立者、建立時間、lookup、rollup、count），批次 API 也沒擋，會直接覆寫 | `GridView.tsx:1048`、`rows/batch/route.ts` |
| C4 | A | 核取方塊貼上任何不認得的文字都變成 **true**（`Boolean(trimmed)`），伺服器端同樣情況則是 false（F12），兩邊相反 | `GridView.tsx:1057` |
| C5 | B | 自動填滿跨多欄時，把**第一欄的值**填進所有欄，不管型別；也不會像試算表那樣遞增數列 | `GridView.tsx:1180-1194` |
| C6 | B | 復原只涵蓋儲存格值的修改。貼上時自動新增的列、刪除列、欄位操作都不能復原；復原堆疊只在記憶體裡，重新整理就清空 | `hooks/useUndoRedo.ts`、`hooks/useCellEdit.ts` |
| C7 | C | `useTableOperations` 裡另一套復原堆疊（`SET_UNDOABLE`）從來沒有被寫入，是死程式碼，容易讓人誤會 | `hooks/useTableOperations.ts:133` |
| C8 | C | 沒有 `onBatchUpdateCells` 時，貼上會退回每 2 列送一次請求、間隔 20ms，大量貼上很慢 | `GridView.tsx:1136` |

## 4. 資料列展開編輯與留言

| # | 嚴重度 | 問題 | 位置 |
|---|---|---|---|
| R1 | A | **進階欄位每次修改都存兩次**：onChange 先以 `immediateSave` 存一次，`commitFieldChangeLog` 拿沒有記錄過的 focus 值比較，又存一次。單選、多選、關聯、附件、最新留言都會發兩次 PATCH、產生兩筆復原紀錄 | `RowEditModal.tsx:332-335`、`:94` |
| R2 | B | 很多型別只給一般文字框：核取方塊、評分、email、電話、時長、ai_prompt、edit_row_link；**密碼欄位用明文顯示** | `RowEditModal.tsx:376` |
| R3 | A | `collaborators` 不在進階欄位清單裡（清單寫的是 `collaborator`），所以協作者欄位變成可以任意打字的文字框，寫入的字串會破壞資料格式 | `RowEditModal.tsx:308` |
| R4 | B | `row` 一變動就整份重設 `formData`：別人即時更新同一列時，**你正在輸入、還沒 blur 的內容會被蓋掉**（待實測） | `RowEditModal.tsx:59-70` |
| R5 | B | 長文字和一般欄位只在 blur 時存檔。按 Esc 關閉（`ModalOverlay` 預設 `closeOnEscape`）時，輸入框被移除不一定會觸發 blur，**打到一半的內容可能不會存**（待實測） | `RowEditModal.tsx:345`、`components/ui/ModalOverlay.tsx` |
| R6 | C | `readOnly` 沒有套用到長文字的 textarea，檢視者可以打字，存檔時才被伺服器擋下 | `RowEditModal.tsx:340` |
| R7 | C | 欄位旁的「Field info」按鈕沒有作用 | `RowEditModal.tsx:317` |
| R8 | B | 活動紀錄可以被任何能編輯的人修改，包括別人的操作紀錄，稽核軌跡不可靠 | `RowCommentsPanel.tsx:108` |
| R9 | C | 留言不能編輯或刪除（API 只有 GET／POST）；錯誤訊息用瀏覽器的 `alert()` | `rows/comments/route.ts`、`RowCommentsPanel.tsx:102` |

## 5. 工作區管理

| # | 嚴重度 | 問題 | 位置 |
|---|---|---|---|
| W1 | A | **刪除工作區或資料庫是永久刪除**：Prisma 的 cascade 會連帶刪掉所有資料表、欄位、資料列、視圖、留言，不進回收站。前端只有一個瀏覽器 `confirm()`，沒說明無法復原，也不用輸入名稱確認。資料庫只需要 builder 權限（`canManageStructure`）就能刪 | `api/workspaces/route.ts:405-426`、`app/page.tsx:1118` |
| W2 | B | 「必須保留至少一個工作區」計算的是全站工作區數量，不是使用者自己的 | `api/workspaces/route.ts:409` |
| W3 | A | 刪除使用者會透過 cascade 刪掉他所有的留言（`RowComment.user onDelete: Cascade`），別人的資料列上的討論紀錄也會消失 | `prisma/schema.prisma:192` |
| W4 | C | 改名只檢查非空白，沒有長度上限 | `api/workspaces/route.ts:350` |

另外，第 1 部分的 F1–F18 和成員權限相關問題（已在 PR #7 修正），這裡不重複。

---

## 建議的子專案與順序

| 順序 | 子專案 | 涵蓋 | 為什麼排這裡 |
|---|---|---|---|
| 1 | **分組選取修正**（bugfix） | C1、C2 | 會默默改到看不見的資料，修法集中在 `GridView` 的索引換算，範圍小 |
| 2 | **統一寫入驗證層** | F1–F3、F5–F16、C3、C4 | 根因相同：沒有一個所有寫入路徑共用的驗證服務。做完後貼上、表單、批次、單格的行為一致，也能一次補上缺的型別 |
| 3 | **刪除保護** | W1、W3、S4、S6 | 永久刪除無法挽回；改成軟刪除或要求輸入名稱確認，並保留被刪使用者的留言 |
| 4 | **展開編輯修正** | R1–R6 | 重複存檔和型別編輯器是體驗問題裡影響最大的 |
| 5 | **結構變更安全** | S1–S3、S5、S7 | 改型別的值轉換（附預覽）、公式參照改成只用 `field_<id>`、索引功能的去留，需要先設計 |
| 6 | **UX 打磨** | C5–C8、R7–R9、W2、W4、F4、F18 | 不影響資料正確性，可以穿插進行 |

每個子專案會各自走「設計 → 規格 → 實作計畫 → TDD」。第 1 項範圍小，可以直接用 `/bugfix`。
