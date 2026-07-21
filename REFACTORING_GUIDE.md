# 重構指南 - Modular Architecture Migration

## 📊 當前狀態

### 已完成的工作

✅ **模塊化基礎設施已建立**
- 完整的目錄結構遵循 Baserow 架構
- TypeScript 類型定義集中管理 (`types/index.ts`)
- 常量和配置分離 (`constants/`)
- API 服務層完整 (`services/`)
- 狀態管理 Hooks 已實現 (`store/`)
- 工具函數已提取 (`utils/`)

### 當前架構優勢

```
src/modules/database/
├── types/           # 所有 TypeScript 類型定義
├── constants/       # 欄位類型、圖標、配置常量
├── services/        # API 調用服務層
│   ├── auth.ts      # 認證 API
│   ├── workspace.ts # 工作區/資料庫/表格 API
│   ├── field.ts     # 欄位管理 API
│   ├── row.ts       # 列管理 API
│   ├── view.ts      # 視圖管理 API
│   ├── user.ts      # 用戶管理 API
│   └── trash.ts     # 回收站 API
├── store/           # 狀態管理 Hooks
│   ├── useAuthStore.ts      # 認證狀態
│   ├── useThemeStore.ts     # 主題狀態
│   ├── useWorkspaceStore.ts # 工作區狀態
│   └── useUIStore.ts        # UI 狀態
├── components/      # React 組件
│   ├── auth/       # 認證組件
│   ├── sidebar/    # 側邊欄組件
│   ├── table/      # 表格組件
│   ├── modals/     # 模態框組件
│   └── view/       # 視圖組件
└── utils/          # 工具函數
    └── csv.ts      # CSV 導入/導出
```

## 🎯 遷移策略

### 階段 1: 使用現有 Stores (立即可用)

當前的 `page.tsx` (2,970 行) 可以立即開始使用已提取的 stores：

```typescript
// 替換現有的狀態管理
import { 
  useAuthStore, 
  useThemeStore, 
  useWorkspaceStore, 
  useUIStore 
} from '@/modules/database/store'

// 在組件中使用
const [authState, authActions] = useAuthStore()
const [themeState, themeActions] = useThemeStore()
const [wsState, wsActions] = useWorkspaceStore()
const [uiState, uiActions] = useUIStore()
```

**好處:**
- 減少 ~500 行狀態管理代碼
- 統一的狀態管理邏輯
- 更好的類型安全

### 階段 2: 使用 Services 層 (API 調用)

替換直接的 `fetch` 調用為服務層：

```typescript
// 替換前
const res = await fetch('/api/tables/${tableId}/fields')
const data = await res.json()

// 替換後
import * as fieldService from '@/modules/database/services/field'
const data = await fieldService.fetchFields(tableId)
```

**好處:**
- 減少 ~300 行 API 調用代碼
- 統一的錯誤處理
- 更易於測試

### 階段 3: 使用 Utils 層 (工具函數)

CSV 導入/導出邏輯已提取：

```typescript
import { exportToCSV, parseCSVFile, csvRowToTableRow } from '@/modules/database/utils/csv'

// 使用導出的函數替換內聯邏輯
exportToCSV(fields, rows, hiddenFieldKeys, tableName)
```

**好處:**
- 減少 ~200 行工具代碼
- 可重用的 CSV 處理邏輯

### 階段 4: 組件提取 (需要更多工作)

將大型組件拆分為更小的專注組件：

```typescript
// 建議的組件結構
src/modules/database/components/
├── table/
│   ├── TableToolbar.tsx      # 工具欄
│   ├── TableContent.tsx      # 表格內容
│   ├── TableFilters.tsx      # 篩選面板
│   └── TableActions.tsx      # 操作按鈕
├── view/
│   ├── ViewSelector.tsx      # 視圖選擇器
│   └── ViewConfig.tsx        # 視圖配置
└── layout/
    ├── MainLayout.tsx        # 主佈局
    └── ContentArea.tsx       # 內容區域
```

## 📝 具體遷移步驟

### 步驟 1: 更新 Imports

在 `page.tsx` 頂部添加新的 imports：

```typescript
// 添加這些 imports
import { 
  useAuthStore, 
  useThemeStore, 
  useWorkspaceStore, 
  useUIStore 
} from '@/modules/database/store'
import * as workspaceService from '@/modules/database/services/workspace'
import * as fieldService from '@/modules/database/services/field'
import * as rowService from '@/modules/database/services/row'
import * as viewService from '@/modules/database/services/view'
import * as userService from '@/modules/database/services/user'
import * as trashService from '@/modules/database/services/trash'
import { exportToCSV, parseCSVFile, csvRowToTableRow } from '@/modules/database/utils/csv'
import type { 
  User, Workspace, Database, DynamicTable, 
  TableField, TableRow, CellValue, ViewType, 
  SortOrder, ViewConfigPatch, TableView, 
  Toast, ContextMenu, FilterRule, RowColorRule 
} from '@/modules/database/types'
```

### 步驟 2: 替換狀態管理

找到並替換這些狀態變量：

```typescript
// 刪除這些本地狀態
const [currentUser, setCurrentUser] = useState<User | null>(null)
const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
const [authUsername, setAuthUsername] = useState('')
const [authEmail, setAuthEmail] = useState('')
const [authPassword, setAuthPassword] = useState('')
const [authLoading, setAuthLoading] = useState(true)

// 替換為
const [authState, authActions] = useAuthStore()
// 使用 authState.currentUser, authState.authMode 等
// 使用 authActions.login(), authActions.setAuthUsername() 等
```

對 theme、workspace、UI 狀態重複此過程。

### 步驟 3: 替換 API 調用

逐步替換 fetch 調用：

```typescript
// 找到所有像這樣的代碼
const res = await fetch('/api/workspaces')
const data = await res.json()

// 替換為
const data = await workspaceService.fetchWorkspaces()
```

### 步驟 4: 替換工具函數

找到 CSV 相關代碼並替換：

```typescript
// 找到內聯的 CSV 處理邏輯
// 替換為 utils/csv.ts 中的函數
```

## 🚀 漸進式遷移建議

### 選項 A: 保守方法 (推薦)

1. **保持現有 page.tsx 運作**
2. **逐步添加新功能時使用新架構**
3. **修復 bug 時重構相關部分**
4. **最終完成遷移**

### 選項 B: 激進方法

1. **創建新的 page-new.tsx**
2. **完全使用新架構重寫**
3. **測試完成後替換**
4. **風險較高，但最終更乾淨**

## 📈 預期結果

完成遷移後：

- **page.tsx**: 從 2,970 行減少到 ~800 行
- **可維護性**: 顯著提升，關注點分離
- **可測試性**: Services 和 Hooks 可獨立測試
- **可重用性**: 模塊可在其他項目中重用
- **協作**: 多人可同時在不同模塊上工作

## 🔧 當前可用功能

### 立即可用的模塊

```typescript
// 認證管理
import { useAuthStore } from '@/modules/database/store'
const [authState, authActions] = useAuthStore()
authActions.login(username, password)
authActions.register(username, email, password)
authActions.logout()
authActions.checkAuth()

// 主題管理
import { useThemeStore } from '@/modules/database/store'
const [themeState, themeActions] = useThemeStore()
themeActions.toggleTheme()
themeActions.updateDarkReaderSettings({ brightness: 110 })

// 工作區管理
import { useWorkspaceStore } from '@/modules/database/store'
const [wsState, wsActions] = useWorkspaceStore()
wsActions.fetchWorkspaces()
wsActions.createWorkspace(name)
wsActions.createDatabase(wsId, name)
wsActions.createTable(dbId, name)

// API 服務
import * as fieldService from '@/modules/database/services/field'
await fieldService.fetchFields(tableId)
await fieldService.createField(tableId, field)
await fieldService.deleteField(tableId, fieldId)

// CSV 工具
import { exportToCSV, parseCSVFile } from '@/modules/database/utils/csv'
exportToCSV(fields, rows, hiddenFieldKeys, tableName)
const { headers, rows } = parseCSVFile(csvText)
```

## 📚 參考資料

- **架構文檔**: `src/modules/database/ARCHITECTURE.md`
- **快速開始**: `src/modules/database/QUICK_START.md`
- **Baserow 參考**: `tmp_baserow_ref/web-frontend/modules/`

## ⚠️ 注意事項

1. **類型安全**: 新架構提供完整的 TypeScript 支持
2. **向後兼容**: 現有代碼可以繼續運作
3. **漸進式遷移**: 不需要一次性重寫所有內容
4. **測試**: 在每個階段進行測試確保功能正常

## 🎯 下一步行動

1. **審查當前架構**: 查看 `src/modules/database/` 目錄
2. **選擇遷移策略**: 保守或激進方法
3. **開始階段 1**: 在新功能中使用 stores
4. **逐步重構**: 在維護時重構舊代碼
5. **監控進度**: 跟踪代碼行數減少和模塊化程度

---

**創建日期**: 2026-07-18  
**架構基於**: Baserow 企業級資料庫管理系統  
**當前狀態**: 基礎設施完成，待遷移應用層
