# Database backup tool — Design

## Why this exists

Before a risky migration against the Supabase database, there is no way to take a point-in-time copy of chosen tables from inside the app. The tool is an occasional, manual, super-user-only page: pick tables, hit Backup, get a `.sql` file on the server you can download, list later, and — if the migration goes wrong — restore from the UI.

The database is Supabase-hosted Postgres. `DATABASE_URL` points at the transaction pooler (port 6543), which does not support `pg_dump`/`psql` sessions; `DB_DIRECT_URL` (session pooler, port 5432) does and is what this tool uses. The host machine has no `pg_dump`/`psql` binaries, but the `postgres:17-alpine` Docker image (which ships both) is already in use for the test database.

**Runtime prerequisites (agreed: the app runs locally on this machine only, for now).** The feature assumes a long-lived machine with a persistent filesystem, a running Docker daemon (already required by the test suite), `DB_DIRECT_URL` present in the runtime environment (added to `.env.example`), and no platform timeout on server actions (true of local `next dev`/`next start`). If the app is ever moved to serverless or a host without Docker, this design must be revisited rather than ported as-is.

**Verified against the real Supabase server (2026-11-02):** `docker run postgres:17-alpine pg_dump --clean --if-exists -t public.role <DB_DIRECT_URL>` exits 0 and produces a valid dump (server 17.6, pg_dump 17.11); `psql ... --single-transaction -c "SELECT ..."` succeeds and `information_schema` reports 25 `public` base tables. One real issue found: your `DB_DIRECT_URL` carries a non-standard `supa=...` query parameter that libpq (`pg_dump`/`psql`) rejects — unlike postgres.js, which tolerates it. The tool therefore builds its connection URL by taking `DB_DIRECT_URL`'s scheme/host/port/path and allowing only known-safe query parameters (`sslmode`, `options`, `application_name`, `connect_timeout`); everything else is dropped before the command runs.

## Scope of this change

Everything ships in one phase:

- `/app/backups` page, super-user only, linked from the Admin sidebar section.
- Dynamic table discovery from `information_schema`, checkboxes with select-all, selection persisted to localStorage only when Backup is clicked.
- Backup creation via `pg_dump` into a server-side folder, filename = date and time.
- A list of existing backups with metadata (time, size, tables included).
- Download of any backup file through the app.
- Restore of any backup through the UI behind a typed-filename confirmation.

## Goals

- Only `role === "super"` can see the nav link, open the page, or call any backup action.
- Tables are discovered at runtime from the database — never a hardcoded list; new tables appear automatically.
- The last table selection survives reloads, persisted to localStorage only on Backup click (a canceled or abandoned selection does not stick).
- Dump files live in a folder on the server, named by creation date and time, and remain on disk between app restarts.
- Every row in the list shows real data: creation time, file size, and the tables the dump contains.
- A super user can restore a backup from the UI without shell access, with a confirmation that cannot be clicked through accidentally.

## Non-goals

- Scheduled or automatic backups.
- Backups of the Docker test database as a product feature (e2e may exercise the same code path against it, incidentally).
- Backup retention/cleanup policies, compression, or encryption.
- Deleting backups from the UI (files can be removed from disk).
- Point-in-time recovery, WAL archiving, or partial/row-level restores.
- Non-`public` schemas, views, or extension-owned objects.
- Any schema changes — this feature adds no tables and needs no migration.

## Anti-goals

- Shell-interpolated commands built from user input (table names, filenames) — always argument arrays via `execFile`/`spawn`.
- Trusting a filename or table name from the client without validating it against a whitelist/regex.
- Gating anything on a permission code (`backups:*`); this is role-gated only, so no seed or permission changes.
- Storing backup files in the database or in browser storage.

## Access and navigation

- Page gate, mirroring `app/app/usuarios/page.tsx`: `const session = await auth(); if (!session?.user || !isSuperUser(session)) forbidden()`.
- All mutations are next-safe-action actions built on the existing `adminAction` middleware (`lib/safe-action.ts:168`), which already gates on `isSuperUser` and rejects with `FORBIDDEN`.
- The download route handler calls `auth()` and rejects non-super users the same way.

### Sidebar entry

`config/sidebar-menu.ts` gains one item in `adminSections`:

```ts
{ label: "backups", icon: DatabaseBackup, url: "/app/backups", requiredRole: "super" }
```

`SidebarItem` gains an optional `requiredRole?: string`. `hasPermission` keeps working as-is; `adminSections(role, permissions)` additionally filters out items whose `requiredRole` is set and does not match the caller's role. `getSidebarMenu(_role, permissions)` stops ignoring its first parameter and passes it to `adminSections` (the other sections stay permission-driven only). This avoids introducing a `backups:*` permission, which would require seed/data changes on existing databases.

The sidebar label comes from `nav.backups` (the renderer looks up the last URL segment), so `messages/en.json` and `messages/es.json` both get `nav.backups` ("Backups" / "Respaldos").

## Storage layout

A folder on the server, default `<repo>/backups/`, overridable with an optional `BACKUP_DIR` env var. The folder is added to `.gitignore`. It must exist before use (the create action creates it with `mkdir recursive` if missing).

Each backup is a pair of files:

| file                            | contents                                                 |
| ------------------------------- | -------------------------------------------------------- |
| `2026-11-02_14-30-00.sql`       | the `pg_dump` output                                     |
| `2026-11-02_14-30-00.meta.json` | `{ "createdAt": ISO string, "tables": ["client", ...] }` |

Filename format: `YYYY-MM-DD_HH-mm-ss` in server local time, `.sql` extension — sortable lexicographically, and the sidecar gives the list its "tables included" column without parsing the dump. Size comes from `fs.stat`. A `.sql` file without a sidecar still appears in the list (tables shown as unknown) so orphaned files are visible rather than silently skipped.

## Backup creation

Action `createBackup(tableNames: string[])`, gated by `adminAction`:

1. Validate `tableNames` against the live `information_schema` list (`table_schema = 'public'`, `table_type = 'BASE TABLE'`); any unknown name rejects the whole request. Non-empty selection required.
2. Build `pg_dump` args: `--no-owner --no-privileges --clean --if-exists`, one `-t` per table, connection URL = `DB_DIRECT_URL` with `sslmode=require` preserved. When execution goes through Docker and the URL host is loopback (`localhost`/`127.0.0.1` — the e2e test DB), rewrite only the host component to `host.docker.internal` so the container can reach it; credentials, port, path, and query are never touched, and Supabase hosts are never rewritten.
3. Run it with `execFile` (never a shell string). Prefer a host `pg_dump` if found on `PATH`; otherwise run the same binary through `docker run --rm postgres:17-alpine pg_dump ...` (the image is already local; Docker must be running, which the project already assumes for its test DB).
4. Write stdout to `<BACKUP_DIR>/<timestamp>.sql`, write the sidecar with `createdAt` and the validated table list, return the resulting entry so the store can insert it.

`--clean --if-exists` is deliberate: a restore then rolls back schema changes made after the backup, which is the point of a pre-migration copy. Two known limitations (confirmed 2026-11-02): views that depend on selected tables are discovered at dump time (`listDependentViews`) and included so `DROP TABLE` isn't blocked; and a _partial_ selection can still fail at `DROP` when a table outside the dump foreign-keys into one inside it — the failure is loud and the `--single-transaction` rollback leaves the database untouched, and the default all-tables selection avoids the case entirely.

## List

Seeded server-side in the page component by reading `BACKUP_DIR` (sidecars + `stat`), then held in a page-scoped Zustand store per the optimistic-store contract (`stores/backups/`: reducer, store, state hook, actions hook, test, provider mounted by the page). `createBackup` commits the returned entry; a `getBackups` action re-reads the folder when a refetch is needed.

Columns: creation date/time, size, table count (with the table names available, e.g. in a popover or expandable row), and actions — Download, Restore.

## Download

Route handler `app/api/backups/download/[filename]/route.ts`:

- `auth()` + `isSuperUser`, else 401/403.
- `filename` must match `^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql$` — anything else 404. No path segments, no traversal; the file is joined against `BACKUP_DIR` and the resolved path must stay inside it.
- Stream the file with `Content-Disposition: attachment; filename="..."` and the SQL content type.

## Restore

Action `restoreBackup(filename)`, gated by `adminAction` (a next-safe-action action, same as create):

1. Same filename regex + path-containment check as download.
2. Run `psql` with `ON_ERROR_STOP=1` **and `--single-transaction`** against `DB_DIRECT_URL`, the file fed on stdin (Docker fallback as with `pg_dump`). One transaction means a mid-restore error rolls the whole restore back — nothing half-applied. This is safe for this schema: there are no `pgEnum` types (all statuses are text), so the dump contains no `ALTER TYPE ... ADD VALUE`, the one construct that misbehaves inside a transaction.
3. Return success/failure; on failure the psql stderr tail is logged server-side (`console.error`) and the client toasts the translated `RESTORE_FAILED` code — the safe-action `serverError: { code }` contract has no free-text channel, so detail lives in the server log, not the toast (resolved 2026-11-02).

UI: the Restore button opens a confirmation dialog that displays the filename and requires the user to **type the filename exactly** before the confirm button enables. Only then is the action called. Restoring writes to the live Supabase database; the typed-name gate is the accident protection (there is no undo — the current data is what the backup replaces).

## UI

`/app/backups` server component: gate → seed `tables` (from `information_schema`), seed `backups` (from the folder) → render the client view inside the store provider.

The view has two sections:

1. **Create backup** — checkbox list of tables with a select/unselect-all toggle, a Backup button showing a pending state while `pg_dump` runs. Selection initializes from localStorage if present (and the stored names still exist in the current table list; stale names are dropped), otherwise all tables checked. The Backup button is what writes the selection back to localStorage.
2. **Backups** — the table described above, empty state when the folder is empty.

Form/dialog state (checkbox selection, confirmation dialog) stays local to the view; the backups list lives in the store. No new dependencies are needed beyond what the repo already has (`sonner` for toasts, existing dialog/table primitives).

## i18n

`messages/en.json` and `messages/es.json` stay structurally identical:

- `nav.backups` — "Backups" / "Respaldos".
- A new `backups.*` namespace for the page: title, create section, select all, backup button, pending label, empty state, list columns, download/restore actions, confirmation dialog text, error/success toasts.

No existing keys are renamed or moved.

## Testing

Unit (vitest, beside the code):

- Filename validation: accepts a well-formed name; rejects `../../etc/passwd`, absolute paths, encoded traversal, wrong extensions, extra segments.
- Path containment: resolved path outside `BACKUP_DIR` is rejected.
- Table validation: unknown/statement-injection-shaped names rejected against the whitelist; empty list rejected.
- `pg_dump`/`psql` argument construction (child process mocked): correct flags, one `-t` per table, URL untouched by shell.
- Connection URL sanitization: `supa` (and any non-whitelisted param) stripped, `sslmode` preserved, credentials/host/port intact.
- Sidecar parsing: missing/corrupt `.meta.json` degrades gracefully (file still listed, tables unknown).
- Sidebar: `requiredRole: "super"` item appears only for role `"super"`, hidden for `admin`/`retailer`/`user` and for missing role; other admin items unchanged.

E2E (Playwright, through the pages, against the test DB):

- A non-super user (`admin`) does not see the Backups nav item and gets forbidden at `/app/backups`.
- A super user sees the nav item, opens the page, sees the table list with everything checked.
- Uncheck some tables, hit Backup → pending state → the new row appears at the top of the list with the right table names; reload the page → selection restored from localStorage.
- Download returns a file whose content starts with a PostgreSQL dump header.
- Restore: dialog stays disabled until the exact filename is typed; confirming runs and reports success (restore targets the same test DB the dump came from).

`pnpm verify` and `pnpm test:e2e` green before the change is reported complete.

## Calls made here, for the reader to check

1. Nav visibility uses a new `requiredRole` field on sidebar items rather than a `backups:*` permission — no seed/migration changes; `getSidebarMenu`'s already-present but unused role parameter does the work.
2. Dumps run through Docker `postgres:17-alpine` when the host lacks `pg_dump` (the current state of this machine); host binaries are preferred when present.
3. Connection is always `DB_DIRECT_URL` (session pooler) — never `DATABASE_URL` (transaction pooler breaks `pg_dump`/`psql`).
4. Filenames are `YYYY-MM-DD_HH-mm-ss.sql` local time plus a `.meta.json` sidecar carrying the table list; the sidecar is the source of the list's "tables" column.
5. `--clean --if-exists` on dump so restore rolls back post-backup schema changes.
6. Restore requires typing the filename in a confirmation dialog; there is no undo.
7. No delete UI, no scheduling, no compression — files are managed on disk.
8. Selection persists to localStorage only on Backup click; initialization filters out names no longer in the database.
9. `psql` runs with `ON_ERROR_STOP=1` **and `--single-transaction`** so a failed restore rolls back entirely rather than half-applying (safe here: no enum types in the schema).
10. Under Docker with a loopback DB URL (e2e), only the host component is rewritten to `host.docker.internal`; Supabase URLs and all other URL parts are untouched.
11. The `pg_dump`/`psql` connection URL is rebuilt from `DB_DIRECT_URL` with a query-parameter whitelist (`sslmode`, `options`, `application_name`, `connect_timeout`) — the live URL's non-standard `supa` parameter is stripped, since libpq rejects it while postgres.js accepts it. Verified end-to-end against Supabase on 2026-11-02.

## What is left to the builder

- Component decomposition of the page (checkbox list, list table, confirm dialog) and exact shadcn primitives used.
- Exact `pg_dump -t` pattern quoting for unusual table names (names are validated against `information_schema` first).
- How the Docker fallback detects host `pg_dump` (`which`/`execFile` probe) and the error surfaced when Docker is not running.
- Toast/error copy details beyond the `backups.*` key structure above.
- Whether the e2e restore step is folded into the create/list spec or its own spec file.
