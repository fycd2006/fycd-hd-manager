# FYCD HD Manager (北科伙食團資料庫管理系統)

![FYCD HD Logo](public/logo.png)

參考 Baserow 架構打造的高效能無程式碼 (No-Code) 資料庫與工作區管理平台。提供多維度視圖、即時協作、公式計算與大資料量表格處理能力。

---

## 🚀 核心功能

- **動態資料表與豐富欄位**：文字、數字、單/多選、日期、布林、Email、URL、電話、附件、使用者關聯、Link to Table、Lookup、Rollup、Auto-number、Formula 公式解析。
- **多維度視圖**：網格 (Grid)、看板 (Kanban)、畫廊 (Gallery)、日曆 (Calendar)、甘特時間軸 (Timeline)、公開表單 (Form)。
- **資料控制**：多條件過濾 (AND/OR)、多層級排序、分組 (Grouping)、列染色 (Row Coloring)。
- **即時協作與安全**：Pusher WebSocket 即時同步、資料列留言討論、RBAC 角色權限 (Admin, Member, Viewer)、Argon2 密碼雜湊。
- **資料匯入匯出**：Airtable Base 一鍵匯入、大資料量 CSV 匯入/匯出。

---

## 🛠️ 技術棧

- **Frontend**: Next.js 16 (App Router), React 19, Vanilla CSS (Modular Design System)
- **Database & ORM**: TiDB / MySQL, Prisma ORM 6
- **Cache & Realtime**: Redis (ioredis), Pusher Channels
- **Formula & Virtualization**: `@formulajs/formulajs`, `@tanstack/react-virtual`

---

## 💻 快速開始

### 1. 安裝與設定環境
```bash
npm install
cp .env.example .env.local
```

### 2. 資料庫 Migration
```bash
npx prisma generate
npx prisma migrate deploy
```

### 3. 啟動伺服器
```bash
npm run dev
```

瀏覽器開啟 [http://localhost:3000](http://localhost:3000)。

---

## ⚙️ 關鍵環境變數 (`.env.local`)

| 變數名稱 | 必填 | 說明 |
|---|:---:|---|
| `DATABASE_URL` | 是 | TiDB / MySQL 資料庫連線字串 (`mysql://...`) |
| `SESSION_SECRET` | 是 | 使用者 Session 加密金鑰 (至少 32 字元) |
| `REDIS_URL` | 否 | Redis 連線字串 (用於限流與快取，無則自動降級) |
| `CRON_SECRET` | 否 | 排程維護端點驗證 Token |
| `PUSHER_*` | 否 | Pusher 即時廣播服務金鑰與叢集設定 |

---

## 🔌 核心 API 路由速查

| 路由路徑 | 方法 | 說明 |
|---|---|---|
| `/api/workspaces` | `GET`, `POST`, `PATCH`, `DELETE` | 工作區與資料庫管理 |
| `/api/tables` | `POST` | 建立新資料表 |
| `/api/tables/[tableId]/views` | `GET`, `POST`, `PATCH`, `DELETE` | 視圖設定與規則 CRUD |
| `/api/tables/[tableId]/fields` | `GET`, `POST`, `PATCH`, `DELETE` | 欄位型態與結構管理 |
| `/api/tables/[tableId]/rows` | `GET`, `POST`, `PATCH`, `DELETE` | 資料列 CRUD 與批次操作 |
| `/api/auth/login`, `/api/auth/register` | `POST` | 認證與 Session 註冊 |

---

## 📜 常用開發指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 啟動本機開發伺服器 (Webpack 模式) |
| `npx tsc --noEmit` | 全專案 TypeScript 型別檢核 (0 Error 保證) |
| `npm run test` | 執行 Jest 單元與整合測試 (37 Suites / 292 Tests) |
| `npm run build` | 正式環境建置 (自動執行 Prisma Generate 與 Migration) |
| `npm run migrate:dev` | 開發環境：產生並套用新 Migration |

---

## 📚 延伸架構與開發指引

- **完整架構設計與資料流**：[`src/modules/database/ARCHITECTURE.md`](file:///src/modules/database/ARCHITECTURE.md)
- **開發者擴充指南與 Hooks 範例**：[`src/modules/database/QUICK_START.md`](file:///src/modules/database/QUICK_START.md)
