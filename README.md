# FYCD HD Manager (北科伙食團資料庫管理系統)

![FYCD HD Logo](public/brand/icon-512.png)

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

- **Frontend**: Next.js 16 (App Router), React 19, Vanilla CSS (Modular Design System), Motion 動畫
- **Database & ORM**: TiDB / MySQL, Prisma ORM 6
- **Cache & Realtime**: Redis (ioredis), Pusher Channels
- **Formula & Virtualization**: `@formulajs/formulajs`, `@tanstack/react-virtual`
- **AI & Mail**: Google Gemini (`@google/genai`)、Resend 寄信、Argon2 密碼雜湊

---

## 🎨 品牌與 PWA 圖示

- 向量字標與圖示：`src/components/brand/FycdLogo.tsx`（`variant="full"` 字標、`variant="icon"` 圖示），主畫面、登入與載入畫面皆使用。
- 網站 favicon：`src/app/icon.svg`；Apple / PWA 圖示與啟動畫面：`public/brand/`（`icon-192`、`icon-512`、`maskable-512`、`apple-touch-icon`、各尺寸 `splash-*.png`）。
- 品牌色：Deep Olive `#39452B`、Vibrant Orange `#F58220`、Warm Ivory `#F5F0E6`。
- 重新產生 PNG 圖示與啟動畫面：`node scripts/generate-brand-icons.mjs`（需本機 Edge 或 Chrome，可用 `BROWSER_PATH` 指定路徑）。此腳本不在 `npm run verify` 內，手動執行。

---

## 💻 快速開始

### 1. 安裝與設定環境
```bash
npm install
cp .env.example .env.local
```

### 2. 建立資料庫結構
本專案沒有 `prisma/migrations`，結構由 `prisma db push` 依 `prisma/schema.prisma` 同步。只對**空的開發資料庫**執行：
```bash
npx prisma db push
```

> ⚠️ 不要對有資料的資料庫加 `--accept-data-loss`。`npm run build` 內含這個旗標，只在部署流程使用。

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
| `NEXT_PUBLIC_APP_URL` | 否 | 網站對外網址，預設 `http://localhost:3000` |
| `REDIS_URL` | 否 | Redis 連線字串 (用於限流與快取，無則自動降級) |
| `CRON_SECRET` | 否 | 排程維護端點驗證 Token（未設定時排程端點拒絕執行） |
| `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | 否 | Pusher 即時廣播（未設齊時不廣播） |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 否 | AI 資料表助理 |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | 否 | 寄送密碼重設信 |

完整範本與說明見 [`.env.example`](.env.example)。

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
| `npm run verify` | 提交前完整驗證：typecheck → lint 錯誤 → Jest → `build:check`（CI 也跑這個） |
| `npm run typecheck` | 全專案 TypeScript 型別檢核 |
| `npm run lint` | ESLint（舊錯誤凍結在 `eslint-suppressions.json`，新錯誤會失敗） |
| `npm test` | 執行 Jest 測試（單檔 `npx jest <路徑>`） |
| `npm run build:check` | 只編譯、不碰資料庫的建置檢查 |
| `npm run build` | 部署用建置：`prisma generate` → `prisma db push --accept-data-loss` → `next build`。**會改動 `DATABASE_URL` 指向的資料庫，本機不要執行** |

第一次 clone 後執行 `git config core.hooksPath .githooks`，commit 前會自動跑 `npm run verify`。

---

## 📚 延伸架構與開發指引

- **完整架構設計與資料流**：[`src/modules/database/ARCHITECTURE.md`](src/modules/database/ARCHITECTURE.md)
- **開發者擴充指南與 Hooks 範例**：[`src/modules/database/QUICK_START.md`](src/modules/database/QUICK_START.md)
