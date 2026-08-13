# FYCD HD Manager (北科伙食團資料庫管理系統)

![FYCD HD Logo](public/logo.png)

FYCD HD Manager 是一款參考 Baserow 架構打造的高效能無程式碼（No-Code）資料庫與工作區管理平台。基於 **Next.js 16 (React 19)**、**Prisma ORM**、**TiDB (MySQL)** 與 **Redis / Pusher**，提供流暢的大資料量表格編輯、豐富的欄位型態、多維度視圖切換以及即時協作功能。

---

## 🚀 核心功能與特色

### 1. 動態資料表與豐富欄位型態 (Dynamic Tables & Rich Field Types)
- **多元欄位類型**：單行文字、長文字、數字、單選/多選、日期、布林值、Email、URL、電話號碼、附件、用戶關聯。
- **高級關聯欄位**：支援資料表關聯（Link to Table）、Lookup 查找欄位、Rollup 聚合欄位、Auto-number 自動編號。
- **強大公式引擎**：整合 `@formulajs/formulajs` 與 `hot-formula-parser`，支援跨欄位數學與字串計算（如 `SUM`, `CONCAT`, `IF`, `DATETIME_DIFF`）。
- **快取與索引優化**：自動維護 Generated Columns 與高頻檢索欄位索引。

### 2. 多維度視覺化視圖 (Multi-View Support)
- **網格視圖 (Grid View)**：支援虛擬化捲動（TanStack Virtual）、多格選取、拖曳填滿（Auto-fill）、無限復原/重做（Undo/Redo）與列高調整。
- **看板視圖 (Kanban View)**：依單選或分組欄位自動分類，支援卡片拖曳與欄位切換。
- **畫廊視圖 (Gallery View)**：視覺化卡片佈局，適合圖文內容展示。
- **日曆視圖 (Calendar View)**：依日期欄位直觀排程與動態展演。
- **時間軸視圖 (Timeline View)**：支援專案甘特圖與時序進度追蹤。
- **表單視圖 (Form View)**：對外問卷收集與動態欄位驗證。

### 3. 高級資料控制 (Data Control & Filtering)
- **多條件過濾器 (Filtering)**：支援多重 AND / OR 邏輯運算與多種比較子。
- **多層級排序 (Sorting)**：支援多欄位遞增/遞減混合排序。
- **自動分組 (Grouping)**：依指定欄位群組化呈現資料。
- **欄位顯示與寬度客製化**：彈性隱藏欄位與調整寬度。
- **條件式列顏色 (Row Coloring)**：依資料規則自動標示列顏色。

### 4. 即時協作與社群功能 (Real-Time & Collaboration)
- **即時廣播與同步**：整合 Pusher 與 Redis Pub/Sub，實現多人在線動態更新。
- **資料列討論 (Row Comments)**：支援單筆紀錄留言、對話與活動紀錄追蹤。
- **跨表搬移日誌 (Move Operation Logs)**：完整的跨表紀錄搬移與審核日誌。

### 5. 資料匯入匯出 (Import & Export)
- **Airtable 無縫轉移**：支援 Airtable API Key 匯入 Base 結構與完整資料。
- **CSV 檔案處理**：支援大資料量 CSV 匯入與客製化導出。

### 6. 工作區與權限管理 (Workspaces & Access Control)
- **多工作區與團隊**：支援創建多個 Workspace，並進行 Team 團隊細化歸類。
- **嚴格角色權限**：系統包含 Admin（管理員）、Member（一般成員）、Viewer（僅檢視者）。
- **安全認證與通知**：Argon2 密碼雜湊、兩階段驗證 (2FA) 支援、系統通知中心與邀請連結管理。

### 7. 雙語系與現代化 UI (Bilingual & Premium Design)
- **語系支援**：預設支援繁體中文 (`zh-TW`) 與英文 (`en`) 動態切換。
- **品牌視覺**：以綠橘為主色調的北科伙食團品牌設計與 SVG-first 動態載入動畫。

---

## 🛠️ 技術棧 (Tech Stack)

- **前端框架 (Frontend)**: Next.js 16.2 (App Router, Webpack), React 19.2
- **樣式與 UI (Styling)**: Tailwind CSS v4, Sass, Lucide Icons, DarkReader
- **資料庫與 ORM (Database)**: TiDB / MySQL, Prisma ORM 6.19
- **快取與訊息佇列 (Cache & Queue)**: Redis (ioredis)
- **即時廣播 (Realtime)**: Pusher Channels (`pusher`, `pusher-js`)
- **表格虛擬化與拖曳 (Virtualization & DnD)**: `@tanstack/react-virtual`, `@hello-pangea/dnd`
- **公式解析器 (Formula Parser)**: `@formulajs/formulajs`, `hot-formula-parser`
- **安全性與驗證 (Security)**: Argon2, Zod

---

## ⚙️ 環境變數設定 (Environment Variables)

> ⚠️ **安全提示**：本區塊為開發與部署使用的**範例值與佔位符**。請建立本地未版控的 `.env.local` 檔案並填入真實金鑰。

專案根目錄需設定 `.env.local` 檔案（可參考 `.env.example`）：

```env
# 資料庫連線 (TiDB / MySQL)
DATABASE_URL="mysql://user:password@localhost:3306/fycd_hd_manager"

# Session 金鑰 (至少 32 個字元)
SESSION_SECRET="your-super-secret-key-at-least-32-chars-long"

# Redis 快取 (可選 - 若無則自動降級)
REDIS_URL="redis://localhost:6379"

# Cron Job 驗證金鑰
CRON_SECRET="your-cron-secret-token"

# Pusher 即時同步設定 (可選)
PUSHER_APP_ID="your-pusher-app-id"
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
NEXT_PUBLIC_PUSHER_CLUSTER="ap1"

# 應用程式名稱與網址
NEXT_PUBLIC_APP_NAME="FYCD HD Manager"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

---

## 💻 本地開發與啟動 (Local Development)

### 1. 安裝依賴套件
```bash
npm install
```

### 2. 設定資料庫與生成 Prisma Client
```bash
# 生成 Prisma Client 並套用資料庫 Migration
npx prisma generate
npx prisma migrate deploy
```

> 開發中修改 `prisma/schema.prisma` 後，請用 `npm run migrate:dev` 產生新的 migration 檔並提交版控；**不要**使用 `prisma db push`。

### 3. 啟動開發伺服器
```bash
npm run dev
```

開啟瀏覽器造訪 [http://localhost:3000](http://localhost:3000)。

---

## 📜 常用腳本 (Scripts)

| 腳本 | 命令 | 說明 |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | 以 Webpack 模式啟動 Next.js 開發伺服器 |
| `build` | `npm run build` | 自動執行 Prisma Client 生成、套用資料庫 Migration 與 Next.js 正式環境構建 |
| `start` | `npm run start` | 啟動 Next.js 正式環境伺服器 |
| `lint` | `npm run lint` | 執行 ESLint 程式碼檢查 |
| `test` | `npm run test` | 執行 Jest 單元測試 |
| `migrate:dev` | `npm run migrate:dev` | 開發環境：依 Schema 變更產生並套用新 Migration |
| `migrate:deploy` | `npm run migrate:deploy` | 正式環境：套用已版控的 Migration（不修改 Schema） |
| `migrate:status` | `npm run migrate:status` | 檢查 Migration 套用狀態 |

---

## 🔌 核心 API 路由總覽 (Key API Routes)

| 分類 | API 路由 | 方法 | 說明 |
| :--- | :--- | :--- | :--- |
| **資料表** | `/api/tables` | `GET`, `POST` | 取得資料表列表 / 建立新資料表 |
| **資料列** | `/api/tables/[tableId]/rows` | `GET`, `POST`, `PATCH`, `DELETE` | 取得、新增、批次修改與刪除資料列 |
| **欄位設定** | `/api/tables/[tableId]/fields` | `POST`, `PATCH`, `DELETE` | 新增、修改型態與刪除欄位 |
| **Airtable 匯入** | `/api/database/import/airtable` | `POST` | 匯入 Airtable Base 結構與資料 |
| **身份驗證** | `/api/auth/login`, `/api/auth/register` | `POST` | 登入、註冊與 Session 驗證 |
| **通知中心** | `/api/notifications` | `GET`, `PATCH` | 讀取與標示通知訊息 |

---

## 📁 專案架構概覽 (Project Structure)

```text
FYCD-HD-MANAGER/
├── prisma/
│   └── schema.prisma         # Prisma 資料庫 Schema 定義
├── src/
│   ├── app/                  # Next.js App Router (頁面與 API Routes)
│   ├── components/           # 全域共用 UI 元件 (動畫、Navbar、Modal 等)
│   ├── hooks/                # 全域 React Hooks (useUndoRedo, useLocale 等)
│   ├── lib/                  # 核心函式庫 (Prisma client, Redis, Pusher, Formula)
│   ├── modules/
│   │   └── database/         # 資料庫核心模組
│   │       ├── components/   # 網格、看板、畫廊、日曆、表單等視圖與選單
│   │       ├── constants/    # 欄位型態、運算子與預設設定
│   │       ├── fields/       # 各種欄位類型的渲染與編輯器
│   │       ├── hooks/        # 視圖狀態、過濾與排序邏輯 Hook
│   │       ├── services/     # 資料庫 API 通訊與處理邏輯
│   │       └── store/        # 狀態管理
│   ├── styles/               # 全域 CSS 與 Tailwind 設定
│   └── types/                # TypeScript 型態定義
└── public/                   # 靜態資源檔 (Logo, Icons)
```

---

## 🚀 部署說明 (Deployment on Vercel)

1. 將專案連線至 **Vercel**。
2. 設定 `DATABASE_URL` 變數指向 TiDB / MySQL。
3. 設定 `REDIS_URL` 與 `PUSHER_*` 設定檔以啟用快取與即時同步。
4. 部署時將自動執行 `npm run build`（內含 `prisma generate` 與 `prisma migrate deploy`，僅套用已版控的 Migration，不會對資料庫做破壞性變更）。
5. **首次部署注意**：若正式資料庫在導入 migrate 前已存在資料表，請先對該資料庫執行一次 baseline 標記，否則 `migrate deploy` 會嘗試重建既有資料表：
   ```bash
   DATABASE_URL="<正式庫連線字串>" npx prisma migrate resolve --applied 20260813000000_init
   ```

---

## 📄 授權與維護 (License & Notes)

- 本專案由 **FYCD HD 北科伙食團** 團隊維護與開發。
- 如需擴充物件存儲（如圖片/附件上傳），請於 `.env.local` 設置對應之 S3 / Cloudinary 配置。


