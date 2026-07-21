# Database Module - 架構重構指南

## 📋 概述

原始的 `src/app/page.tsx` 檔案包含 **3,687 行代碼**，所有邏輯都混合在一個巨大的 React 元件中。
此重構將代碼拆分為模塊化架構，遵循 Baserow（企業級資料庫管理系統）的設計模式。

## 📁 新的目錄結構

```
src/modules/database/
├── index.ts                    # 主入口點
├── types/                      # TypeScript 類型定義
│   └── index.ts               # 所有公共類型
├── constants/                  # 常數和配置
│   ├── icons.ts               # SVG 圖標
│   ├── fieldTypes.ts          # 欄位類型配置
│   └── index.ts               # 常數索引
├── services/                   # API 服務層
│   ├── auth.ts                # 認證 API
│   ├── workspace.ts           # 工作區、資料庫、表格 API
│   ├── field.ts               # 欄位管理 API
│   ├── row.ts                 # 列管理 API
│   ├── view.ts                # 檢視管理 API
│   ├── user.ts                # 用戶管理 API
│   ├── trash.ts               # 回收站 API
│   └── index.ts               # 服務索引
├── store/                      # 狀態管理 (自定義 Hooks)
│   ├── useAuthStore.ts        # 認證狀態
│   ├── useThemeStore.ts       # 主題狀態
│   ├── useWorkspaceStore.ts   # 工作區狀態
│   ├── useUIStore.ts          # UI 狀態
│   └── index.ts               # 存儲索引
├── components/                 # React 元件 (按功能分類)
│   ├── auth/                  # 認證相關元件
│   ├── theme/                 # 主題相關元件
│   ├── sidebar/               # 側邊欄元件
│   ├── table/                 # 表格元件
│   ├── view/                  # 檢視元件
│   ├── field/                 # 欄位元件
│   ├── row/                   # 列元件
│   └── modals/                # 模態框元件
└── utils/                      # 工具函數
    └── index.ts               # 工具函數索引
```

## 🔧 核心文件說明

### Types (`types/index.ts`)
包含所有 TypeScript 類型定義：
- `User`, `Workspace`, `Database`, `DynamicTable`
- `TableField`, `TableRow`, `CellValue`
- `ViewType`, `TableView`, `FilterRule`, `RowColorRule`
- `Toast`, `ContextMenu`, `TrashItems`
- 主題、模態框和狀態相關類型

### Constants
#### `constants/icons.ts`
- 所有 SVG 圖標定義
- 可在任何地方導入使用

#### `constants/fieldTypes.ts`
- `FIELD_TYPE_ICONS`: 欄位類型到圖標的映射
- `FIELD_TYPE_LABELS`: 欄位類型標籤（中文）
- `AVAILABLE_FIELD_TYPES`: 可用欄位類型列表
- `ROLLUP_FUNCTIONS`: 聚合函數
- `FILTER_OPERATORS`: 篩選操作符
- `ROW_COLOR_OPTIONS`: 列顏色選項

### Services (API層)

#### `services/auth.ts`
```typescript
checkAuth()          // 檢查認證狀態
login(username, password)
register(username, email, password)
logout()
```

#### `services/workspace.ts`
```typescript
fetchWorkspaces()
createWorkspace(name)
createDatabase(workspaceId, name)
createTable(databaseId, name)
deleteWorkspaceOrDatabase(action, id)
rename(type, id, name)
```

#### `services/field.ts`
```typescript
fetchFields(tableId)
createField(tableId, field)
deleteField(tableId, fieldId)
renameField(tableId, fieldId, name)
reorderFields(tableId, fieldOrder)
```

#### `services/row.ts`
```typescript
fetchRows(tableId)
createRow(tableId, data)
updateCell(tableId, rowId, fieldKey, value)
deleteRow(tableId, rowId)
duplicateRow(tableId, rowData)
```

#### `services/view.ts`
```typescript
fetchViews(tableId)
createView(tableId, name, type)
updateViewConfig(tableId, viewId, changes)
deleteView(tableId, viewId)
```

#### `services/user.ts` & `services/trash.ts`
用戶管理和回收站相關 API

### Store (狀態管理 Hooks)

每個 Store 返回 `[State, Actions]` 元組：

#### `useAuthStore()`
```typescript
const [authState, authActions] = useAuthStore()

// 狀態
authState.currentUser
authState.authMode
authState.authLoading

// 操作
authActions.login(username, password)
authActions.register(username, email, password)
authActions.logout()
authActions.checkAuth()
```

#### `useThemeStore()`
```typescript
const [themeState, themeActions] = useThemeStore()

// 狀態
themeState.theme                    // 'dark' | 'light'
themeState.darkReaderSettings

// 操作
themeActions.toggleTheme()
themeActions.updateDarkReaderSettings({ brightness: 110 })
```

#### `useWorkspaceStore()`
```typescript
const [wsState, wsActions] = useWorkspaceStore()

// 狀態
wsState.workspaces
wsState.activeTableId
wsState.collapsedWorkspaces

// 操作
wsActions.fetchWorkspaces()
wsActions.createWorkspace(name)
wsActions.createDatabase(wsId, name)
wsActions.createTable(dbId, name)
```

#### `useUIStore()`
```typescript
const [uiState, uiActions] = useUIStore()

// 狀態
uiState.toasts
uiState.showRenameModal
uiState.sidebarCollapsed

// 操作
uiActions.addToast(message, type)
uiActions.toggleSidebarCollapsed()
```

## 💡 使用示例

### 新的 page.tsx 結構

```typescript
'use client'

import React, { useEffect } from 'react'
import {
  useAuthStore,
  useThemeStore,
  useWorkspaceStore,
  useUIStore,
} from '@/modules/database'

export default function Home() {
  // 使用模塊化存儲
  const [authState, authActions] = useAuthStore()
  const [themeState, themeActions] = useThemeStore()
  const [wsState, wsActions] = useWorkspaceStore()
  const [uiState, uiActions] = useUIStore()

  // 初始化認證
  useEffect(() => {
    authActions.checkAuth()
  }, [])

  // 加載工作區
  useEffect(() => {
    if (authState.currentUser) {
      wsActions.fetchWorkspaces()
    }
  }, [authState.currentUser])

  // 未認證時顯示登入界面
  if (!authState.currentUser) {
    return <AuthPage authState={authState} authActions={authActions} />
  }

  // 認證後顯示主界面
  return (
    <div className={`app-container theme-${themeState.theme}`}>
      <Sidebar wsState={wsState} wsActions={wsActions} />
      <MainContent
        wsState={wsState}
        uiState={uiState}
        uiActions={uiActions}
        themeState={themeState}
      />
    </div>
  )
}
```

## 🎯 下一步

### 立即需要拆分的元件：
1. **AuthPage** (`components/auth/AuthPage.tsx`)
   - 登入表單
   - 註冊表單

2. **Sidebar** (`components/sidebar/Sidebar.tsx`)
   - 工作區導航
   - 資料庫和表格列表
   - 折疊/展開邏輯

3. **MainContent** (`components/MainContent.tsx`)
   - 表格視圖選擇器
   - 工具欄

4. **GridView** / **KanbanView** 等 (`components/view/`)
   - 各種檢視實現

5. **Modals** (`components/modals/`)
   - 新建工作區/資料庫/表格模態框
   - 重新命名模態框
   - 回收站模態框

## 📊 架構優勢

| 方面 | 原始架構 | 新架構 |
|------|--------|--------|
| **檔案大小** | 3,687 行單一檔案 | 多個專注的小檔案 |
| **可維護性** | 困難 - 所有東西混合 | 容易 - 關注點分離 |
| **可重用性** | 低 - 無法提取邏輯 | 高 - Services 和 Hooks 可重用 |
| **測試** | 困難 - 複雜的元件 | 容易 - 獨立的單元 |
| **擴展性** | 差 - 新功能難以整合 | 好 - 輕鬆添加新功能 |
| **協作** | 難 - 多人易產生衝突 | 容易 - 各自負責不同模塊 |

## 🔍 遷移清單

- [x] 創建目錄結構
- [x] 提取所有 TypeScript 類型 → `types/index.ts`
- [x] 提取常數 → `constants/`
- [x] 建立 API Services → `services/`
- [x] 建立 Store Hooks → `store/`
- [ ] 拆分 React 元件 → `components/`
- [ ] 建立新的 `page.tsx`
- [ ] 遷移和測試所有功能
- [ ] 刪除舊的單一檔案 `src/app/page.tsx`

## 🚀 快速開始

### 導入和使用

```typescript
// 導入單個項目
import { useAuthStore, useThemeStore } from '@/modules/database/store'
import { fetchWorkspaces, login } from '@/modules/database/services'
import { FIELD_TYPE_LABELS, Icons } from '@/modules/database/constants'
import type { User, Workspace } from '@/modules/database/types'

// 或者導入所有
import { useAuthStore, fetchWorkspaces, FIELD_TYPE_LABELS, User } from '@/modules/database'
```

## 📝 註釋和文檔

每個檔案都包含清晰的 JSDoc 註釋，說明：
- 模塊的目的
- 函數的用途和參數
- 返回類型和可能的錯誤

---

**創建日期**: 2026-07-18  
**遵循架構**: Baserow (企業級資料庫管理系統)  
**重構狀態**: 進行中 (基礎設施完成)
