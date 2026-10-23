# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

German-language "Einlasskontrolle" (entry/attendance tracking) web app for a swim club. QR-code handscanner or manual entry logs member visits; includes member management, CSV import/export, statistics, an optional AI stats chat, and user administration. Runs as a single all-in-one Docker image (PostgreSQL + Backend + Frontend in one container) so it can be started on any Windows PC with Docker Desktop. See `README.md` for the full feature/API list and `Installation.md` for deployment.

## Commands

Backend (`backend/`):
- `npm run dev` — `tsx watch src/index.ts`
- `npm run build` — `tsc` (typecheck + compile to `dist/`; this is the only form of "lint" in this repo — there is no ESLint config and no test suite)
- `npm start` — `node dist/index.js` (runs compiled output)

Frontend (`frontend/`):
- `npm run dev` — Vite dev server (port 5173, proxies `/api` to `localhost:3001`)
- `npm run build` — `tsc && vite build`
- `npm run preview` — preview the production build

`mcp-backup-import/` (separate top-level package, **not** part of the Docker image — see Architecture):
- `npm run dev` — `tsx watch src/index.ts`
- `npm run build` — `tsc`
- `npm start` — `node dist/index.js`
- Requires `APP_BASE_URL`, `BACKUP_API_KEY`, `CENTRAL_DATABASE_URL` env vars (see `mcp-backup-import/README.md`); normally launched by a Claude client (stdio transport), not run manually.

Docker (all-in-one, the primary way this app is run/tested):
- `docker build -t einlasskontrolle:latest -f Dockerfile .` — build the all-in-one image (build context is the repo root, not `backend/`/`frontend/` individually)
- `docker compose -f docker-compose.standalone.yml up -d --build` — build and run locally
- `powershell -ExecutionPolicy Bypass -File ./build-portable.ps1` — build, `docker save` to a `.tar`, and assemble a self-contained `release/` folder (image + compose file + `.env.example` + `start.bat`) for copying to another Windows PC with no source code needed there
- There are no automated tests. Verification is manual: build the image, run it, hit endpoints/UI by hand (see the "Verifikation" sections in `docs/plans/*.md` for the pattern used when adding a feature).

## Architecture

**One container, three roles.** `Dockerfile` multi-stage-builds the frontend (Vite → static files) and backend (`tsc` → `dist/`) separately, then copies both into a single Alpine runtime image alongside PostgreSQL 16. `entrypoint.sh` is PID 1 (via `tini`): it initializes the Postgres data directory on first run, starts `postgres` as the `postgres` user via `su-exec`, waits for readiness, then starts the Node backend — both as background jobs it supervises, trapping `SIGTERM`/`SIGINT` to shut postgres down cleanly before exiting. The backend serves the built frontend as static files itself (`express.static` + SPA fallback in `backend/src/index.ts`) — there is no separate nginx/frontend container in this image. Other `docker-compose.*.yml` variants (multi-container with nginx, QNAP, dev with hot reload) exist for different deployment targets but the all-in-one image is the one actively developed against.

**No ORM at runtime.** The backend uses the `postgres` (postgres.js) tagged-template SQL client directly (`backend/src/lib/db.ts`) — services write raw SQL. A `backend/prisma/` schema and migration folder exist but are **legacy/unused**; the real schema and migrations live in `backend/src/lib/migrate.ts` as a hand-rolled, idempotent migration runner (an ordered array of `{ name, sql }` entries tracked in a `_migrations` table, applied once at startup). When changing the schema, add a new entry there — do not touch the Prisma files.

**Auth is custom JWT, not session-based.** `backend/src/middleware/requireAuth.ts` verifies a Bearer token and attaches `userId`/`userRole`/`isAdmin` to the request; `requireAdmin` wraps `requireAuth` and also checks the role, so routes needing admin-only access mount with just `requireAdmin` (see `/api/v1/users` and `/api/v1/reports` in `backend/src/index.ts`) — no need to stack both middlewares. `/api/v1/backup` is the one exception: it mounts with `requireAdminOrBackupApiKey`, which accepts a valid admin JWT *or* a static `X-Backup-Api-Key` header (checked via timing-safe compare in `requireBackupApiKey.ts`) — the key path exists for the external `mcp-backup-import` client, which has no browser session; without `BACKUP_API_KEY` set, that path is simply always rejected and behavior is identical to plain `requireAdmin`. On the frontend, `/logs` and `/stats` are reachable by any authenticated user but contain admin-only *sections* gated by `useAuth().isAdmin` inside the page itself (there's no route-level `AdminRoute` wrapper for those pages, unlike `/users`) — check how a page is actually gated before assuming route-level protection exists.

**Entry date handling has a known trap.** The `entries` table has both `entry_time` (exact timestamp) and `entry_date` (the calendar day, set correctly at write time from the client's browser date, see `backend/src/lib/dateParams.ts`). `statsService.getStatsByDay()` buckets by `entry_time.toISOString().split('T')[0]` — i.e. **UTC** calendar day, not the app's `Europe/Berlin` timezone — so entries made shortly after local midnight can land on the wrong day in that function's output. Newer code (e.g. the Finanzamt report) deliberately groups by the `entry_date` column instead and does not reuse `getStatsByDay` for anything date-sensitive. Prefer `entry_date` for new day-bucketed queries; `Europe/Berlin` is set process-wide via `backend/src/lib/timezone.ts` (imported first in `index.ts`).

**Entry-time source of truth is the browser, not the server clock.** Scan/manual-entry timestamps and dates come from the client (`clientNow`/`entryDate` params, parsed in `dateParams.ts`); the server clock is only a fallback, because Docker Desktop stops the container clock during Windows sleep (see the comment in `backend/src/routes/system.routes.ts` and the drift-warning UI in `ServerClock.tsx`).

**Member creation is implicit, not CRUD-first.** Members aren't created through a form first and then scanned — scanning, manual entry, and CSV import all do their own find-or-create against the `members` table (matching by `member_number` or by exact name), each independently re-implementing the same "does this member already exist" check (`scan.service.ts`, `members.service.ts: findOrCreateMember`, `import.service.ts`). There's no shared helper between them by design (small, direct per-flow logic is preferred here over a shared abstraction) — when touching dedupe behavior, check all three call sites.

**CSV conventions are established and should be matched exactly for any new export:** `;`-delimited, `\r\n` line endings, UTF-8 **with a BOM** prefix (so Excel opens umlauts correctly — see `entries.controller.ts`'s `'﻿' + csv` and the `csvField()` escaping helper in `entries.service.ts`), and authenticated file downloads go through the frontend as an axios blob request (not a plain `<a href>`, which wouldn't carry the Bearer token) — see `entriesApi.exportMembers` in `frontend/src/api/entries.ts` for the pattern.

**File-export features share a write/serve pattern.** `reports.service.ts` (Finanzamt `.xlsx` reports — monthly/yearly, filenames `Finanzamt_Monat_<yyyy-MM>.xlsx` / `Finanzamt_Jahr_<yyyy>.xlsx`) and `backup.service.ts` (JSON data export for offsite backup) both: write into a dedicated, env-configurable folder (`REPORTS_DIR`/`BACKUP_DIR`, default `./reports`/`./backups`, bind-mounted in the all-in-one compose files), write atomically via a `.tmp-<name>` file + `fs.renameSync`, and guard downloads with a `path.basename(filename) !== filename` traversal check before serving via `res.download()`. Reuse this pattern — don't invent a new one — for the next per-file export feature.

**Backup export feeds an external MCP server, not the Docker image.** `POST/GET /api/v1/backup` generates/lists/downloads a JSON export of `members`, `entries`, `import_logs`, `import_member_links`, `price_items` only — **never** `users`/`registration_requests` (they hold `password_hash`, which must never leave the install) or `_migrations`. The consumer is `mcp-backup-import/`, a **separate top-level package** (own `package.json`/`tsconfig.json`, ESM with `module`/`moduleResolution: Node16` — unlike the backend's CommonJS — stdio-transport MCP server via `@modelcontextprotocol/sdk`) that is never built into the Docker image; it runs on the operator's own machine, started on demand by a Claude client, authenticates to the backend via the `X-Backup-Api-Key` header described above, and upserts the export into an independent "central" Postgres database (`CENTRAL_DATABASE_URL`), guarded by a `schemaVersion` check so a mismatched/future export format is rejected rather than silently mis-imported. See `docs/plans/2026-10-backup-export-mcp.md` for the full reasoning.

**Dependency-light by convention.** New features add dependencies sparingly (e.g. `@anthropic-ai/sdk` for the optional stats-chat feature, `exceljs` for the Finanzamt reports — both deliberate, explicitly-requested exceptions; there's still no cron library, scheduled/periodic jobs use a plain `setInterval` with a startup catch-up check instead of adding `node-cron`). Keeping the Docker image small is an explicit goal; avoid adding heavy libraries (e.g. a PDF renderer) without a concrete need. `mcp-backup-import/`'s own dependencies (`@modelcontextprotocol/sdk`, a second `postgres` client) don't count against this, since that package is never part of the image.

**Plans for non-trivial features are written to `docs/plans/<yyyy-MM>-<name>.md`** (see `docs/README.md` for the index) before implementation — each documents Context/decisions, the file-by-file approach, critical files, and a manual verification checklist. Check there first for the reasoning behind a recent non-trivial change before re-deriving it from the diff.
