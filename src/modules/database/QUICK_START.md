# Database 模組快速上手 (QUICK START)

## ⚡ 常用開發指令

```bash
npm run dev              # 啟動開發伺服器
npx tsc --noEmit         # 全專案 TypeScript 型別檢核 (0 Error 保證)
npx jest --maxWorkers=2  # 執行全量單元與整合測試 (37 Suites / 292 Tests)
```

---

## 🧩 1. 讀取與操作資料表 (`useTableContext`)

在工作區或彈窗元件中，直接調用 `useTableContext()`：

```tsx
'use client'
import { useTableContext } from '@/modules/database/context/TableContext'

export function CustomTableWidget() {
  const {
    activeTableId,
    fields,
    displayRows,
    addRow,
    deleteRow,
    updateCell,
    saveViewConfig,
  } = useTableContext()

  return (
    <div>
      <p>資料表: {activeTableId} | 欄位數: {fields.length} | 顯示列數: {displayRows.length}</p>
      <button onClick={() => addRow()}>新增一列</button>
    </div>
  )
}
```

---

## 🛠️ 2. 開發新後端 API 端點 (`withApiHandler`)

使用 `withApiHandler` 自動處理 Next.js 15+ 參數解析、Zod 驗證、Redis 限流與 RBAC 權限：

```typescript
// src/app/api/tables/[tableId]/example/route.ts
import { withApiHandler } from '@/lib/api-handler'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const payloadSchema = z.object({
  title: z.string().min(1, '標題為必填'),
})

export const POST = withApiHandler<{ tableId: string }, z.infer<typeof payloadSchema>>(
  async ({ params, body }) => {
    const tableId = parseInt(params.tableId)
    const result = await prisma.tableRow.create({
      data: { tableId, data: { field_title: body!.title } },
    })
    return { ok: true, id: result.id }
  },
  {
    auth: { action: 'canEditData' },               // 要求資料編輯權限
    rateLimit: { limit: 60, windowSeconds: 60 },   // 每分鐘限流 60 次
    bodySchema: payloadSchema,                     // Zod 強型別校驗
  }
)
```

---

## 🗂️ 3. 核心 Hooks 索引

| Hook | 職責 | 匯入路徑 |
|---|---|---|
| `useRowOperations` | 資料列 CRUD、批次建立、拖曳排序 | `@/modules/database/hooks/useRowOperations` |
| `useCellEdit` | 儲存格雙擊編輯、防抖更新、並行取消 | `@/modules/database/hooks/useCellEdit` |
| `useViewConfig` | 視圖設定、篩選/排序/分組條件存取 | `@/modules/database/hooks/useViewConfig` |
| `useFieldOperations` | 欄位建立、重命名、刪除、雙向關聯 | `@/modules/database/hooks/useFieldOperations` |
| `useMoveOperations` | 跨資料表剪貼與搬移 | `@/modules/database/hooks/useMoveOperations` |
| `useRealtimeSync` | Pusher WebSocket 多人即時同步 | `@/modules/database/hooks/useRealtimeSync` |
| `useTableCSV` | 表格 CSV 檔案匯出與批次解析匯入 | `@/modules/database/hooks/useTableCSV` |

---

## 🚀 4. 常見擴充指引

### A. 擴充新欄位型態 (Field Type)
1. **型別定義**：在 `src/modules/database/types/index.ts` 中的 `FieldType` 聯集新增新型態名稱。
2. **常數註冊**：在 `src/modules/database/constants/fieldTypes.ts` 設定中文標籤與 Lucide 圖示。
3. **渲染器實作**：在 `src/modules/database/fields/` 新增渲染與編輯元件，並註冊至 `GridViewCell.tsx`。

### B. 註冊新視圖 (New View)
1. **建立視圖元件**：於 `src/modules/database/components/views/` 建立視圖本體（如 `MatrixView.tsx`），內部直接調用 `useTableContext()`。
2. **派送路由分流**：在 `src/modules/database/components/views/DatabaseViewRouter.tsx` 加入對應的分支渲染。
3. **視圖選單整合**：在 `src/modules/database/constants/fieldTypes.ts` 的 `AVAILABLE_VIEWS` 補上選單名稱與圖示。
