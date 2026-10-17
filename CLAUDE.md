# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

FYCD HD Manager (北科伙食團資料庫管理系統): a Baserow/Airtable-style no-code database platform. Next.js 16 App Router + React 19, Prisma 6 on **TiDB v8.5.3-serverless** (MySQL-compatible, not plain MySQL; `relationMode = "prisma"`, so no DB-level foreign keys), Redis (optional, degrades gracefully), Pusher for realtime. UI copy and error messages are in Traditional Chinese.

## Commands

- `npm run dev`: dev server (forced `--webpack`)
- `npx tsc --noEmit`: type check (CI runs this)
- `npm run lint`: ESLint
- `npm test`: Jest. Tests must live in `src/**/__tests__/`; other locations are not picked up. Single test: `npx jest src/lib/__tests__/formula.test.ts` or `npx jest -t "test name"`
- `npx playwright test e2e/`: Playwright specs (no playwright config committed)
- `npm run build`: runs `prisma generate && prisma db push --accept-data-loss && next build`. **This pushes the schema to whatever `DATABASE_URL` points at and can drop data.** Don't run it against a shared DB just to check compilation; use `npx tsc --noEmit`. (`todo.md` says this was switched to `prisma migrate`, but `package.json` still uses `db push` and there is no `prisma/migrations/`. The README's `npm run migrate:dev` doesn't exist either.)

## 驗證規則

- 任何改動完成前必須跑 `npm run verify`（typecheck → lint → jest → `build:check`）並全部通過。失敗就自己修到通過；通過前不可說「完成」。
- 不可為了通過而刪除、跳過（`.skip`/`.only`）或弱化測試與斷言。
- `build:check` 只編譯、不碰資料庫；不要用 `npm run build` 代替。
- ESLint 舊錯誤凍結在 `eslint-suppressions.json`，新錯誤一律算失敗。修掉舊錯誤後跑 `npx eslint . --prune-suppressions` 更新它；不可用 `--suppress-*` 壓掉新錯誤。
- Hooks（`.claude/settings.json`）：編輯後自動對該檔 `eslint --fix` 並回報剩餘錯誤；`git commit` 前自動跑 `verify`，失敗會擋下。人手動 commit 由 `.githooks/pre-commit` 把關（每個 clone 執行一次 `git config core.hooksPath .githooks`）。

Required env (`.env.local`): `DATABASE_URL`, `SESSION_SECRET` (≥32 chars). Optional: `REDIS_URL`, `CRON_SECRET`, `PUSHER_*`. There is no `.env.example` despite the README.

## Architecture

**Dynamic data is stored as JSON, not DDL** (ADR `docs/architecture-decisions/001`). Every user table's rows sit in a single `TableRow` model whose `data` Json column is keyed `{ "field_<id>": value }`. Field definitions live in `TableField` (type-specific config in `options` Json). Consequences:
- There are no DB constraints on cell values, so validation and normalization happen in app code (`services/rowValidation.ts`, `utils/normalizeRowData`). Past bugs came from double-encoded JSON and orphaned field keys. Many `scripts/` (`auditOrphans`, `fixOrphanFieldKeys`, `verify*`) exist to audit and repair this.
- Filter/sort/search/pagination is pushed down to SQL in `services/rowQuery.ts`, which has a fast path and a slow path, plus keyset pagination using `id` as tie-breaker. TiDB `AUTO_INCREMENT` is not time-monotonic, so never treat `id` order as insertion order.

**Server side:**
- `src/proxy.ts` (the Next 16 replacement for middleware) is a coarse login gate on all `/api/*`. Public paths are allow-listed there (`/api/auth/*` subset, `/api/form/`, `/api/cron/`). A new public endpoint must be added to that list.
- API route handlers are wrapped in `withApiHandler` (`src/lib/api-handler.ts`), which handles param/body Zod validation, Redis rate limiting, RBAC via `authorizeAction` (`src/lib/authorize.ts`, roles in `src/lib/permissions.ts`), and unified error handling. Fine-grained permission checks belong in the handler's `auth` option, not inline.
- Business logic lives in `src/modules/database/services/`, not in route files. Key pieces: `rowCascade.ts` (formula/lookup/rollup recomputation: first 50 rows synchronously, the rest in background batches), `linkRowSync.ts` / `linkRowOperations.ts` (bidirectional link_row), `autonumberService.ts` (atomic allocation), `multiTableQuery.ts` + `masterViewOverride.ts` (cross-table "master view", ADR `002`).
- The formula engine is `src/lib/formula.ts` (formulajs / hot-formula-parser).

**Client side** (`src/modules/database/`): `context/TableContext.tsx` holds table state and `useTableContext()`. Behavior is split into hooks (`useRowOperations`, `useCellEdit`, `useViewConfig`, `useFieldOperations`, `useMoveOperations`, `useRealtimeSync`, `useTableCSV`). `components/views/DatabaseViewRouter.tsx` dispatches to Grid/Kanban/Gallery/Calendar/Timeline/Form. Field types register in `fields/FieldRegistry.ts`; unknown types fall back to a pass-through. Styles are SCSS under `src/styles/` (Baserow-derived), not Tailwind-first. See `src/modules/database/ARCHITECTURE.md` and `QUICK_START.md` for more.

**CI:** `.github/workflows/code-audit.yml` runs on PRs to `main`/`develop`: eslint, `tsc --noEmit`, stylelint, `npm audit`, and an AI review comment. Docs-only changes skip it.

# Karpathy-Inspired Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
