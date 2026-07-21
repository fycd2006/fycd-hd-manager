/**
 * 遷移示例 - 如何在 page.tsx 中使用新的模塊化架構
 * 
 * 此文件展示如何逐步將現有的 page.tsx 遷移到新架構
 */

'use client'

import React, { useEffect, useState } from 'react'

// ============================================
// 新架構 Imports (逐步添加)
// ============================================

// 1. 狀態管理 Stores (替換本地 useState)
import { 
  useAuthStore, 
  useThemeStore, 
  useWorkspaceStore, 
  useUIStore 
} from './store'

// 2. API 服務層 (替換直接 fetch 調用)
import * as workspaceService from './services/workspace'
import * as fieldService from './services/field'
import * as rowService from './services/row'
import * as viewService from './services/view'
import * as userService from './services/user'
import * as trashService from './services/trash'

// 3. 工具函數 (替換內聯工具邏輯)
import { exportToCSV, parseCSVFile, csvRowToTableRow } from './utils/csv'

// 4. 類型定義 (替換本地接口定義)
import type { 
  User, 
  Workspace, 
  Database, 
  DynamicTable, 
  TableField, 
  TableRow, 
  CellValue, 
  ViewType, 
  SortOrder, 
  ViewConfigPatch, 
  TableView, 
  Toast, 
  ContextMenu, 
  FilterRule, 
  RowColorRule 
} from './types'

// ============================================
// 示例 1: 認證狀態管理遷移
// ============================================

export function AuthMigrationExample() {
  // ❌ 舊方式 (page.tsx 當前)
  // const [currentUser, setCurrentUser] = useState<User | null>(null)
  // const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  // const [authUsername, setAuthUsername] = useState('')
  // const [authEmail, setAuthEmail] = useState('')
  // const [authPassword, setAuthPassword] = useState('')
  // const [authLoading, setAuthLoading] = useState(true)

  // ✅ 新方式 (使用 useAuthStore)
  const [authState, authActions] = useAuthStore()

  const handleLogin = async () => {
    const result = await authActions.login(authState.authUsername, authState.authPassword)
    if (result.ok) {
      console.log('登入成功')
    } else {
      console.error(result.error)
    }
  }

  const handleRegister = async () => {
    const result = await authActions.register(
      authState.authUsername, 
      authState.authEmail, 
      authState.authPassword
    )
    if (result.ok) {
      authActions.setAuthMode('login')
    }
  }

  return (
    <div>
      <h1>認證示例</h1>
      <p>當前用戶: {authState.currentUser?.username || '未登入'}</p>
      <p>模式: {authState.authMode}</p>
      <button onClick={handleLogin}>登入</button>
      <button onClick={handleRegister}>註冊</button>
      <button onClick={authActions.logout}>登出</button>
    </div>
  )
}

// ============================================
// 示例 2: 主題狀態管理遷移
// ============================================

export function ThemeMigrationExample() {
  // ❌ 舊方式
  // const [theme, setTheme] = useState<'light' | 'dark'>('light')
  // const [showDarkReaderPanel, setShowDarkReaderPanel] = useState(false)
  // const [darkReaderSettings, setDarkReaderSettings] = useState({...})

  // ✅ 新方式 (使用 useThemeStore)
  const [themeState, themeActions] = useThemeStore()

  return (
    <div className={`theme-${themeState.theme}`}>
      <button onClick={themeActions.toggleTheme}>
        切換主題 ({themeState.theme})
      </button>
      <button onClick={() => themeActions.setShowDarkReaderPanel(true)}>
        打開 Dark Reader 設置
      </button>
    </div>
  )
}

// ============================================
// 示例 3: 工作區狀態管理遷移
// ============================================

export function WorkspaceMigrationExample() {
  // ❌ 舊方式
  // const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  // const [activeTableId, setActiveTableId] = useState<number | null>(null)
  // const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Record<number, boolean>>({})
  // const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  // const [newWorkspaceName, setNewWorkspaceName] = useState('')

  // ✅ 新方式 (使用 useWorkspaceStore)
  const [wsState, wsActions] = useWorkspaceStore()

  useEffect(() => {
    wsActions.fetchWorkspaces()
  }, [wsActions])

  const handleCreateWorkspace = async () => {
    const result = await wsActions.createWorkspace('新工作區')
    if (result.ok) {
      console.log('工作區創建成功')
    }
  }

  const handleCreateDatabase = async (wsId: number) => {
    const result = await wsActions.createDatabase(wsId, '新資料庫')
    if (result.ok) {
      console.log('資料庫創建成功')
    }
  }

  const handleCreateTable = async (dbId: number) => {
    const result = await wsActions.createTable(dbId, '新資料表')
    if (result.ok) {
      console.log('資料表創建成功')
    }
  }

  return (
    <div>
      <h2>工作區列表</h2>
      {wsState.workspaces.map(ws => (
        <div key={ws.id}>
          <h3>{ws.name}</h3>
          {ws.databases.map(db => (
            <div key={db.id}>
              <h4>{db.name}</h4>
              {db.tables.map(table => (
                <button 
                  key={table.id}
                  onClick={() => wsActions.setActiveTableId(table.id)}
                >
                  {table.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
      
      <button onClick={handleCreateWorkspace}>創建工作區</button>
    </div>
  )
}

// ============================================
// 示例 4: API 服務層使用
// ============================================

export function ServiceLayerExample() {
  const [fields, setFields] = useState<TableField[]>([])
  const [rows, setRows] = useState<TableRow[]>([])
  const tableId = 1

  const loadTableData = async () => {
    // ❌ 舊方式 (直接 fetch)
    // const res = await fetch(`/api/tables/${tableId}/fields`)
    // const data = await res.json()
    // setFields(data)

    // ✅ 新方式 (使用服務層)
    const [fieldsData, rowsData] = await Promise.all([
      fieldService.fetchFields(tableId),
      rowService.fetchRows(tableId),
    ])
    setFields(fieldsData)
    setRows(rowsData)
  }

  const createField = async () => {
    // ❌ 舊方式
    // const res = await fetch(`/api/tables/${tableId}/fields`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ name: '新欄位', type: 'text' })
    // })

    // ✅ 新方式
    const result = await fieldService.createField(tableId, {
      name: '新欄位',
      type: 'text',
      options: null
    })
    
    if (result.ok) {
      console.log('欄位創建成功')
      await loadTableData()
    } else {
      console.error(result.error)
    }
  }

  const updateCell = async (rowId: number, fieldKey: string, value: CellValue) => {
    // ❌ 舊方式
    // const res = await fetch(`/api/tables/${tableId}/rows`, {
    //   method: 'PATCH',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ rowId, fieldKey, value })
    // })

    // ✅ 新方式
    const result = await rowService.updateCell(tableId, rowId, fieldKey, value)
    if (result.ok) {
      console.log('更新成功')
    } else {
      console.error(result.error)
    }
  }

  return (
    <div>
      <button onClick={loadTableData}>加載數據</button>
      <button onClick={createField}>創建欄位</button>
    </div>
  )
}

// ============================================
// 示例 5: CSV 工具使用
// ============================================

export function CSVUtilsExample() {
  const [fields] = useState<TableField[]>([
    { id: 1, tableId: 1, name: '姓名', type: 'text', order: 0, options: null },
    { id: 2, tableId: 1, name: '年齡', type: 'number', order: 1, options: null }
  ])
  const [rows] = useState<TableRow[]>([
    { id: 1, tableId: 1, data: { field_1: '張三', field_2: 25 }, order: 0, createdAt: '' }
  ])

  const handleExport = () => {
    // ❌ 舊方式 (內聯 CSV 邏輯)
    // const headers = fields.map(f => f.name).join(',')
    // const csvRows = rows.map(row => ...)
    // const blob = new Blob([csvContent], { type: 'text/csv' })
    // ...

    // ✅ 新方式 (使用工具函數)
    exportToCSV(fields, rows, [], 'export')
  }

  const handleImport = async (file: File) => {
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result as string
      if (!text) return

      try {
        // ❌ 舊方式 (內聯解析)
        // const lines = text.split('\n')
        // const headers = parseLine(lines[0])
        // ...

        // ✅ 新方式 (使用工具函數)
        const { headers, rows: csvRows } = parseCSVFile(text)
        
        // 轉換 CSV 行為表格行
        const tableRows = csvRows.map(csvRow => 
          csvRowToTableRow(csvRow, fields)
        )
        
        console.log('導入成功:', tableRows)
      } catch (error) {
        console.error('導入失敗:', error)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <button onClick={handleExport}>導出 CSV</button>
      <input 
        type="file" 
        accept=".csv"
        onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
      />
    </div>
  )
}

// ============================================
// 示例 6: 完整的組件遷移模板
// ============================================

export function MigratedComponentTemplate() {
  // 1. 使用所有 Stores
  const [authState, authActions] = useAuthStore()
  const [themeState, themeActions] = useThemeStore()
  const [wsState, wsActions] = useWorkspaceStore()
  const [uiState, uiActions] = useUIStore()

  // 2. 保留本地 UI 狀態 (尚未提取的)
  const [localState, setLocalState] = useState('')

  // 3. 初始化
  useEffect(() => {
    authActions.checkAuth()
    if (authState.currentUser) {
      wsActions.fetchWorkspaces()
    }
  }, [authState.currentUser, authActions, wsActions])

  // 4. 使用服務層進行 API 調用
  const handleSomeAction = async () => {
    const result = await fieldService.createField(wsState.activeTableId!, {
      name: '新欄位',
      type: 'text',
      options: null
    })
    
    if (result.ok) {
      uiActions.addToast('操作成功', 'success')
    } else {
      uiActions.addToast(result.error || '操作失敗', 'error')
    }
  }

  // 5. 使用工具函數
  const handleCSVExport = () => {
    exportToCSV([], [], [], 'export')
  }

  return (
    <div className={`theme-${themeState.theme}`}>
      {/* 組件內容 */}
      {authState.currentUser ? (
        <div>
          <h1>歡迎, {authState.currentUser.username}</h1>
          <button onClick={handleSomeAction}>執行操作</button>
          <button onClick={handleCSVExport}>導出 CSV</button>
          <button onClick={themeActions.toggleTheme}>切換主題</button>
        </div>
      ) : (
        <div>請先登入</div>
      )}
    </div>
  )
}

// ============================================
// 遷移檢查清單
// ============================================

export const MIGRATION_CHECKLIST = {
  // ✅ 已完成
  infrastructure: '模塊化基礎設施已建立',
  types: '類型定義已集中到 types/index.ts',
  constants: '常量已提取到 constants/',
  services: 'API 服務層已實現',
  stores: '狀態管理 Hooks 已實現',
  utils: '工具函數已提取到 utils/',
  
  // 🔄 進行中
  pageMigration: 'page.tsx 遷移進行中',
  
  // ⏳ 待完成
  componentExtraction: '大型組件需要進一步拆分',
  testing: '需要添加單元測試',
  documentation: '需要更新組件文檔'
}

// ============================================
// 遷移步驟總結
// ============================================

export const MIGRATION_STEPS = [
  {
    phase: 1,
    title: '添加 Imports',
    description: '在 page.tsx 頂部添加新的 imports',
    code: `import { useAuthStore, useThemeStore, useWorkspaceStore, useUIStore } from '@/modules/database/store'`
  },
  {
    phase: 2,
    title: '替換認證狀態',
    description: '刪除本地認證狀態，使用 useAuthStore',
    code: `const [authState, authActions] = useAuthStore()`
  },
  {
    phase: 3,
    title: '替換主題狀態',
    description: '刪除本地主題狀態，使用 useThemeStore',
    code: `const [themeState, themeActions] = useThemeStore()`
  },
  {
    phase: 4,
    title: '替換工作區狀態',
    description: '刪除本地工作區狀態，使用 useWorkspaceStore',
    code: `const [wsState, wsActions] = useWorkspaceStore()`
  },
  {
    phase: 5,
    title: '替換 API 調用',
    description: '將 fetch 調用替換為服務層函數',
    code: `await fieldService.fetchFields(tableId)`
  },
  {
    phase: 6,
    title: '替換工具函數',
    description: '將內聯工具邏輯替換為 utils 函數',
    code: `exportToCSV(fields, rows, hiddenFieldKeys, tableName)`
  },
  {
    phase: 7,
    title: '測試驗證',
    description: '測試所有功能確保正常運作',
    code: `npm run dev && npm run test`
  }
]
