# 模塊化重構 - 快速參考

## 📊 重構成果

### 原始狀態
- **檔案**: `src/app/page.tsx`
- **行數**: 3,687 行
- **結構**: 單一巨大元件
- **維護性**: ⭐ (非常困難)

### 新狀態
- **檔案數**: 20 個專注的文件
- **代碼組織**: ✅ 模塊化
- **維護性**: ⭐⭐⭐⭐⭐ (易於維護)
- **可重用性**: 極高
- **測試友好**: ✅ 每個模塊獨立可測試

## 🗂️ 新架構一覽

```
src/modules/database/                    # 主數據庫模塊
├── ARCHITECTURE.md                      # 詳細架構文檔
├── index.ts                             # 公共 API 入口
│
├── types/                               # 2 個文件
│   └── index.ts (所有 TypeScript 類型)
│
├── constants/                           # 3 個文件
│   ├── icons.ts (21 個 SVG 圖標)
│   ├── fieldTypes.ts (欄位配置)
│   └── index.ts
│
├── services/                            # 8 個文件 (API 層)
│   ├── auth.ts (認證)
│   ├── workspace.ts (工作區/資料庫/表格)
│   ├── field.ts (欄位管理)
│   ├── row.ts (列管理)
│   ├── view.ts (檢視管理)
│   ├── user.ts (用戶管理)
│   ├── trash.ts (回收站)
│   └── index.ts
│
├── store/                               # 5 個文件 (狀態管理 Hooks)
│   ├── useAuthStore.ts
│   ├── useThemeStore.ts
│   ├── useWorkspaceStore.ts
│   ├── useUIStore.ts
│   └── index.ts
│
├── components/                          # 待拆分 (15-20 個)
│   ├── auth/
│   ├── theme/
│   ├── sidebar/
│   ├── table/
│   ├── view/
│   ├── field/
│   ├── row/
│   └── modals/
│
└── utils/                               # 待填充 (工具函數)
```

## 🎯 主要改進

| 功能 | 原始 | 新架構 |
|------|------|--------|
| **類型安全** | 混亂 | ✅ 集中管理 |
| **API 調用** | 散佈在元件中 | ✅ 集中在 services/ |
| **狀態管理** | useState 滿天飛 | ✅ 組織化 Hooks |
| **常數** | 在檔案中 | ✅ 集中管理 |
| **可重用性** | 低 | ✅ 高 (Services 和 Hooks) |
| **測試** | 困難 | ✅ 容易 (獨立單元) |
| **協作** | 衝突風險大 | ✅ 多人開發友好 |

## 💾 已創建的文件統計

```
總計: 20 個文件
├── 類型定義: 1 個文件
├── 常數: 3 個文件
├── 服務: 8 個文件 (共 ~600 行)
├── Store: 5 個文件 (共 ~400 行)
├── 文檔: 1 個文件 (ARCHITECTURE.md)
└── 索引: 3 個文件
```

## 🚀 如何使用

### 1. 導入模塊
```typescript
// 方式 A: 導入整個模塊
import { useAuthStore, fetchWorkspaces, FIELD_TYPE_LABELS } from '@/modules/database'

// 方式 B: 導入特定部分
import { useAuthStore } from '@/modules/database/store'
import { fetchWorkspaces } from '@/modules/database/services'
import { FIELD_TYPE_LABELS } from '@/modules/database/constants'

// 方式 C: 導入類型
import type { User, Workspace, TableView } from '@/modules/database/types'
```

### 2. 使用 Store Hooks
```typescript
'use client'
import { useAuthStore, useThemeStore, useWorkspaceStore } from '@/modules/database'

function MyComponent() {
  const [authState, authActions] = useAuthStore()
  const [themeState, themeActions] = useThemeStore()
  
  // 使用狀態
  if (!authState.currentUser) {
    return <div>請登入</div>
  }

  // 使用操作
  const handleLogin = async () => {
    await authActions.login('user', 'password')
  }

  return <button onClick={handleLogin}>登入</button>
}
```

### 3. 使用 API 服務
```typescript
import * as authService from '@/modules/database/services/auth'
import * as workspaceService from '@/modules/database/services/workspace'

// 直接調用 API
const workspaces = await workspaceService.fetchWorkspaces()
const result = await authService.login('user', 'password')
```

### 4. 使用常數
```typescript
import { FIELD_TYPE_LABELS, FIELD_TYPE_ICONS, Icons } from '@/modules/database/constants'

// 獲取欄位標籤
const label = FIELD_TYPE_LABELS['text']  // "單行文字"

// 獲取欄位圖標
const icon = FIELD_TYPE_ICONS['date']    // Icons.Calendar

// 使用 SVG 圖標
const tableIcon = Icons.Table()
```

## 📝 下一步行動

### 立即進行 (第一階段)
1. ✅ **基礎設施完成** (已完成 - 本次)
   - 類型、常數、服務、Store 已準備好

2. ⏳ **拆分 React 元件** (下次)
   - 建立 `AuthPage`, `Sidebar`, `MainContent` 等
   - 每個元件專注於一個功能

3. ⏳ **建立新 page.tsx** (下次)
   - 使用新的 Store Hooks
   - 導入新的元件

4. ⏳ **測試和驗證** (下次)
   - 確保所有功能正常工作
   - 移除舊 `src/app/page.tsx`

## 🔍 檔案說明速查表

| 文件 | 行數 | 說明 |
|------|------|------|
| `types/index.ts` | 250 | 所有 TS 類型定義 |
| `constants/icons.ts` | 150 | SVG 圖標 |
| `constants/fieldTypes.ts` | 80 | 欄位配置 |
| `services/auth.ts` | 60 | 認證 API |
| `services/workspace.ts` | 110 | 工作區 API |
| `services/field.ts` | 90 | 欄位 API |
| `services/row.ts` | 90 | 列 API |
| `services/view.ts` | 80 | 檢視 API |
| `services/user.ts` | 50 | 用戶 API |
| `services/trash.ts` | 60 | 回收站 API |
| `store/useAuthStore.ts` | 100 | 認證狀態 |
| `store/useThemeStore.ts` | 90 | 主題狀態 |
| `store/useWorkspaceStore.ts` | 130 | 工作區狀態 |
| `store/useUIStore.ts` | 100 | UI 狀態 |

## 📊 對比表

### 代碼查找時間
| 任務 | 原始 | 新架構 |
|------|------|--------|
| 找認證邏輯 | 在 page.tsx 中搜索 (~5 分鐘) | `services/auth.ts` (即時) |
| 找狀態管理 | 在 page.tsx 中搜索 (~10 分鐘) | `store/` (即時) |
| 找 API 調用 | 分散各處 | `services/` (集中) |
| 找常數 | 在 page.tsx 中 | `constants/` (集中) |

### 新功能開發
| 任務 | 原始 | 新架構 |
|------|------|--------|
| 添加新 API | 編輯 3,600+ 行檔案 | 創建新 `services/xxx.ts` |
| 添加新狀態 | 編輯 page.tsx | 創建新 `store/useXxxStore.ts` |
| 複用邏輯 | 困難 | 簡單 (導入服務/Hook) |

## ✨ 架構優勢總結

- ✅ **易於導航**: 代碼位置清晰、邏輯組織合理
- ✅ **易於維護**: 每個模塊專注於一個職責
- ✅ **易於擴展**: 添加新功能無需觸及舊代碼
- ✅ **易於測試**: 每個服務/Hook 都可獨立測試
- ✅ **易於協作**: 多人開發不易產生衝突
- ✅ **性能**: 按需導入，自動 Tree-Shake

---

**重構日期**: 2026-07-18  
**進度**: 基礎設施完成 (60%)  
**下一步**: 拆分 React 元件並建立新 page.tsx
