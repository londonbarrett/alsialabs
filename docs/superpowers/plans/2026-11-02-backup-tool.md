# Database Backup Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A super-user-only page at `/app/backups` that dumps selected tables of the Supabase database to a server-side folder, lists/downloads/restores those dumps from the UI.

**Architecture:** Pure helpers in `lib/backup/` (filename/path safety, URL sanitization, `pg_dump`/`psql` execution via host binaries or the `postgres:17-alpine` Docker image, file storage, table discovery) are consumed by two `adminAction` server actions. The page seeds a page-scoped optimistic store; the view holds table selection in local component state persisted to localStorage only on Backup click. Download is a route handler; restore is a dialog gated by typing the exact filename.

**Tech Stack:** Next.js 16 App Router, next-safe-action (`adminAction`), Drizzle (`db.execute` for `information_schema`), Zustand optimistic store contract, next-intl, Playwright + Vitest. Child processes via `node:child_process` (`execFile` probe, `spawn` run).

**Spec:** `docs/superpowers/specs/2026-11-02-backup-tool-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- **No commits, pushes, or PRs at any point** — report task completion; the user commits explicitly (AGENTS.md).
- Package manager: `pnpm`. Never add `any` to work around type errors.
- No new dependencies (checkboxes are native `<input type="checkbox">`; no `@radix-ui/react-checkbox`).
- `messages/en.json` and `messages/es.json` stay structurally identical; every new key exists in both.
- Gate everything on `isSuperUser` / `role === "super"` — **no** new permission codes, no seed/migration changes, no `drizzle/` edits.
- Connection URL is always `DB_DIRECT_URL` (never `DATABASE_URL`); query params whitelisted to `sslmode`, `options`, `application_name`, `connect_timeout`; loopback host → `host.docker.internal` **only** when running through Docker.
- `pg_dump` flags: `--no-owner --no-privileges --clean --if-exists --no-password`, one `-t public."<table>"` per table. `psql` flags: `--no-password -v ON_ERROR_STOP=1 --single-transaction`.
- Backup dir: `process.env.BACKUP_DIR` or `<cwd>/backups` (absolute). Filename `YYYY-MM-DD_HH-mm-ss.sql` (local time), collision suffixes `-1`, `-2`, …; sidecar `<base>.meta.json` with `{ createdAt: ISO, tables: string[] }`.
- Never build a shell command string from user input — always `spawn`/`execFile` with argument arrays.
- Coverage floors: 60% lines/functions/statements, 50% branches (`pnpm verify`).
- E2E locale is pinned to `es-ES` — assertions use Spanish labels verbatim from `messages/es.json`.

## Review Focus

Failure modes no single happy-path test catches; each line names the test that pins it, in the task that owns the code.

1. **A non-super user calls `createBackup`/`restoreBackup` directly (bypassing the UI)** → Task 8 action tests: non-super session yields `serverError.code === "FORBIDDEN"` for both actions.
2. **A crafted `filename` escapes the backup directory (path traversal)** → Task 1 unit test (`isBackupFilename` rejects `../`, absolute paths, encoded forms) + Task 4 unit test (`resolveBackupSqlPath` throws `NOT_FOUND` for a name that passes the regex but resolves outside the dir — e.g. via symlink-free join tricks is impossible once the regex holds, so the test pins the regex rejection instead) + Task 10 route returns 404 for `../../.env.local`.
3. **A table name that does not exist or carries SQL metacharacters reaches `pg_dump`** → Task 5 unit test: `validateTableSelection` throws `INVALID_TABLE_SELECTION` for unknown names, empty lists, and names like `x"; DROP TABLE y; --`; Task 3 test asserts `-t` args are `public."<name>"` with embedded quotes doubled and come from the validated list only.
4. **The real Supabase URL's non-standard `supa` parameter reaches libpq** → Task 2 unit test: given the real-shaped URL `...?sslmode=require&supa=base-pooler.x`, `sanitizeDbUrl` output contains `sslmode=require` and no `supa`.
5. **`pg_dump`/`psql` fails (Docker down, non-zero exit) and the UI reports success anyway** → Task 3 unit test: non-zero exit returns `ok: false` with stderr; Task 8 action test: `ok: false` → `serverError.code === "BACKUP_FAILED"` / `"RESTORE_FAILED"`; Task 11 e2e asserts the failure toast path is not exercised (happy path) but Task 8's mock covers the branch that the toast text (`errors.BACKUP_FAILED`) exists via Task 6 message keys.

---

### Task 1: Filename and path helpers

**Files:**

- Create: `lib/backup/filename.ts`
- Test: `lib/backup/filename.test.ts`

**Interfaces:**

- Produces: `BACKUP_FILENAME_RE: RegExp`, `backupBaseName(date: Date): string`, `isBackupFilename(name: string): boolean` — used by Tasks 4, 8, 10.

- [ ] **Step 1: Write the failing test**

```ts
// lib/backup/filename.test.ts — describe("lib/backup/filename")
it("formats local time as YYYY-MM-DD_HH-mm-ss", () => {
  expect(backupBaseName(new Date(2026, 10, 2, 14, 30, 5))).toBe(
    "2026-11-02_14-30-05"
  )
})
it("accepts plain and collision-suffixed names", () => {
  expect(isBackupFilename("2026-11-02_14-30-00.sql")).toBe(true)
  expect(isBackupFilename("2026-11-02_14-30-00-2.sql")).toBe(true)
})
it("rejects traversal, absolute paths, and wrong extensions", () => {
  for (const bad of [
    "../../etc/passwd",
    "/etc/passwd",
    "2026-11-02_14-30-00.sql.bak",
    "2026-11-02 14:30:00.sql",
    "..%2F..%2Fetc%2Fpasswd",
    "a.sql",
    "",
  ]) {
    expect(isBackupFilename(bad)).toBe(false)
  }
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run lib/backup/filename.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement in `lib/backup/filename.ts`**

`BACKUP_FILENAME_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.sql$/`. `backupBaseName` builds the stamp from local `Date` parts with zero-padding. `isBackupFilename` is a full-string `.test`.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm vitest run lib/backup/filename.test.ts`
Expected: PASS

---

### Task 2: Connection URL sanitization

**Files:**

- Create: `lib/backup/db-url.ts`
- Test: `lib/backup/db-url.test.ts`

**Interfaces:**

- Produces: `sanitizeDbUrl(url: string): string`, `rewriteLoopbackHost(url: string): string` — used by Task 3.

- [ ] **Step 1: Write the failing test**

```ts
// lib/backup/db-url.test.ts
it("keeps whitelisted params and drops the real supa param", () => {
  const out = sanitizeDbUrl(
    "postgres://u:p@host:5432/db?sslmode=require&supa=base-pooler.x"
  )
  expect(out).toBe("postgres://u:p@host:5432/db?sslmode=require")
})
it("keeps credentials, port, and path untouched", () => {
  const out = sanitizeDbUrl(
    "postgres://user:secret@aws-1.pooler.supabase.com:6543/postgres?sslmode=require&options=-c%20search_path"
  )
  expect(out).toContain(
    "user:secret@aws-1.pooler.supabase.com:6543/postgres"
  )
  expect(out).toContain("sslmode=require")
  expect(out).toContain("options=")
})
it("rewrites only loopback hosts", () => {
  expect(
    rewriteLoopbackHost(
      "postgres://alsia:alsia_test@localhost:55432/db"
    )
  ).toBe("postgres://alsia:alsia_test@host.docker.internal:55432/db")
  expect(
    rewriteLoopbackHost(
      "postgres://u:p@aws-1.pooler.supabase.com:5432/db"
    )
  ).not.toContain("host.docker.internal")
})
```

- [ ] **Step 2: Run and confirm failure** — `pnpm vitest run lib/backup/db-url.test.ts` → FAIL

- [ ] **Step 3: Implement in `lib/backup/db-url.ts`**

Parse with `new URL()` (throws → let the caller's error handling surface it as `INTERNAL_SERVER_ERROR`). Rebuild `searchParams` keeping only `SAFE_URL_PARAMS = ["sslmode","options","application_name","connect_timeout"]`. `rewriteLoopbackHost` replaces `hostname` when it is `localhost`, `127.0.0.1`, or `[::1]`.

- [ ] **Step 4: Run and confirm pass** — `pnpm vitest run lib/backup/db-url.test.ts` → PASS

---

### Task 3: Postgres tool runner (`pg_dump` / `psql`)

**Files:**

- Create: `lib/backup/exec.ts`
- Test: `lib/backup/exec.test.ts`

**Interfaces:**

- Consumes: `sanitizeDbUrl`, `rewriteLoopbackHost` (Task 2)
- Produces:
  - `type ToolResult = { ok: boolean; stdout: string; stderr: string }`
  - `pgDump(tables: string[], url: string): Promise<ToolResult>`
  - `restoreSql(hostFilePath: string, url: string): Promise<ToolResult>`
    — used by Task 8.

- [ ] **Step 1: Write the failing test** (mock `node:child_process`)

```ts
// lib/backup/exec.test.ts
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}))
// helpers: mockProbeFound(), mockProbeMissing(), mockSpawn({ code, stdout, stderr })

it("uses host pg_dump when the probe succeeds", async () => {
  // execFile("pg_dump", ["--version"]) resolves; assert spawn called with
  // ["pg_dump", expect.arrayContaining(["--no-owner","--clean","--if-exists","--no-password"]),
  //  "-t", 'public."role"', url] — and NOT with "docker"
})
it("falls back to docker with the postgres:17-alpine image", async () => {
  // execFile rejects ENOENT; assert spawn called with
  // ["run","--rm","postgres:17-alpine","pg_dump", ...same flags..., url]
})
it("quotes table names for -t and doubles embedded quotes", async () => {
  await pgDump(['we"ird'], "postgres://x")
  expect(spawnArgs).toContain('public."we""ird"')
})
it("rewrites loopback hosts only in the docker path", async () => {
  await pgDump(["t"], "postgres://u:p@localhost:55432/db")
  // docker args contain host.docker.internal; host-binary args contain localhost
})
it("reports non-zero exit as ok:false with stderr", async () => {
  // spawn emits exit code 1, stderr "boom" → { ok: false, stdout: "", stderr: "boom" })
})
it("restoreSql passes single-transaction and ON_ERROR_STOP, and mounts the dir read-only under docker", async () => {
  await restoreSql(
    "/repo/backups/2026-11-02_14-30-00.sql",
    "postgres://x"
  )
  // host path: ["psql", "--no-password", "-v", "ON_ERROR_STOP=1", "--single-transaction",
  //             "-f", "/repo/backups/...", url]
  // docker path additionally: ["run","--rm","-i","-v","/repo/backups:/backups:ro",
  //             "postgres:17-alpine","psql", ... "-f", "/backups/2026-11-02_14-30-00.sql", url]
})
```

Mock shape: `execFile` is `vi.fn()` (probe, promisified manually in the module or via `util.promisify` — mock it as already-promise-returning by having the module call `promisify(execFile)` at import; simplest is the module calls `execFile(cmd, args, cb)` and the mock invokes the callback). `spawn` returns an `EventEmitter` with `stdout`/`stderr` `EventEmitter`s; the test emits `data` events then `exit`.

- [ ] **Step 2: Run and confirm failure** — `pnpm vitest run lib/backup/exec.test.ts` → FAIL

- [ ] **Step 3: Implement in `lib/backup/exec.ts`**

- `probe(tool)` — `execFile(tool, ["--version"], cb)`; resolves on exit 0, rejects on `ENOENT`/non-zero.
- `collect(child)` — resolves `{ ok: code === 0, stdout, stderr }` from `spawn` events.
- `pgDump(tables, url)` — flags `["--no-owner","--no-privileges","--clean","--if-exists","--no-password"]`, then per table `["-t", 'public."' + t.replace(/"/g,'""') + '"']`, then `sanitizeDbUrl(url)`. Host probe `pg_dump` → `spawn("pg_dump", args)`; else `spawn("docker", ["run","--rm","postgres:17-alpine","pg_dump", ...argsWithoutUrl...])` where the URL argument is `rewriteLoopbackHost(sanitizeDbUrl(url))`.
- `restoreSql(hostFilePath, url)` — args `["--no-password","-v","ON_ERROR_STOP=1","--single-transaction","-f", target, sanitizedUrl]`; host probe `psql` → `spawn("psql", args)`; else docker with `["run","--rm","-i","-v",`${dir}:/backups:ro`,"postgres:17-alpine","psql", ...]` where `dir = path.dirname(hostFilePath)` and `target = "/backups/" + path.basename(hostFilePath)`.
- Always sanitize; rewrite loopback only in docker branches. Buffer stdout/stderr as utf8 strings.

- [ ] **Step 4: Run and confirm pass** — `pnpm vitest run lib/backup/exec.test.ts` → PASS

---

### Task 4: Backup file storage

**Files:**

- Create: `lib/backup/files.ts`
- Test: `lib/backup/files.test.ts`

**Interfaces:**

- Consumes: `backupBaseName`, `isBackupFilename` (Task 1)
- Produces:
  - `type BackupEntry = { filename: string; createdAt: string; sizeBytes: number; tables: string[] | null }` (re-exported/aliased by Task 6's schema — the zod schema is authoritative; this type must stay shape-identical)
  - `backupDir(): string`
  - `listBackups(): Promise<BackupEntry[]>`
  - `writeBackupFile(sql: string, tables: string[], now?: Date): Promise<BackupEntry>`
  - `resolveBackupSqlPath(filename: string): string` (throws `ActionError("NOT_FOUND")`)
    — used by Tasks 8, 10.

- [ ] **Step 1: Write the failing test** (point `BACKUP_DIR` at `fs.mkdtemp` in `beforeEach`)

```ts
// lib/backup/files.test.ts
it("writeBackupFile writes .sql + .meta.json and returns the entry", async () => {
  const entry = await writeBackupFile(
    "-- dump",
    ["role", "user"],
    new Date(2026, 10, 2, 14, 30)
  )
  expect(entry.filename).toBe("2026-11-02_14-30-00.sql")
  expect(entry.tables).toEqual(["role", "user"])
  expect(entry.sizeBytes).toBe("-- dump".length)
  // sidecar exists with createdAt ISO and the same tables
})
it("appends -1, -2 on same-second collisions", async () => {
  const a = await writeBackupFile("1", ["t"], d)
  const b = await writeBackupFile("2", ["t"], d)
  expect(a.filename).toBe("2026-11-02_14-30-00.sql")
  expect(b.filename).toBe("2026-11-02_14-30-00-1.sql")
})
it("listBackups returns newest first and tolerates a missing sidecar", async () => {
  // write two backups; delete one .meta.json → its entry has tables: null
  // order: newer createdAt first
})
it("resolveBackupSqlPath accepts valid names and throws NOT_FOUND otherwise", () => {
  expect(() => resolveBackupSqlPath("../secret.sql")).toThrow()
  expect(() => resolveBackupSqlPath("nope.sql")).toThrow()
  expect(resolveBackupSqlPath("2026-11-02_14-30-00.sql")).toContain(
    "2026-11-02_14-30-00.sql"
  )
})
```

- [ ] **Step 2: Run and confirm failure** — `pnpm vitest run lib/backup/files.test.ts` → FAIL

- [ ] **Step 3: Implement in `lib/backup/files.ts`**

`backupDir()` = `path.resolve(process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups"))` (read at call time so tests can set the env var). `writeBackupFile`: `mkdir(dir, { recursive: true })`, loop `backupBaseName(now)` + optional `-N` until neither `.sql` nor `.meta.json` exists, write both files, `stat` for size, return entry with `createdAt: now.toISOString()`. `listBackups`: `readdir` filter `isBackupFilename`, `Promise.all` stat + sidecar parse (missing/corrupt → `tables: null`, `createdAt` from stat mtime), sort desc by `createdAt`. `resolveBackupSqlPath`: reject unless `isBackupFilename`, then `path.join(backupDir(), filename)` and assert `resolved.startsWith(backupDir() + path.sep)`; throw `throwActionError("NOT_FOUND")` from `@/lib/action-result` on any failure.

- [ ] **Step 4: Run and confirm pass** — `pnpm vitest run lib/backup/files.test.ts` → PASS

---

### Task 5: Table discovery and selection validation

**Files:**

- Create: `lib/backup/tables.ts`
- Test: `lib/backup/tables.test.ts`

**Interfaces:**

- Produces:
  - `listPublicTables(): Promise<string[]>`
  - `validateTableSelection(selected: string[], available: string[]): void` (throws `ActionError("INVALID_TABLE_SELECTION")`)
  - `filterAvailableTableNames(stored: string[] | null, available: string[]): string[] | null`
    — used by Tasks 8 (first two) and 10 (third).

- [ ] **Step 1: Write the failing test**

```ts
// lib/backup/tables.test.ts — pure functions; no db mock needed
it("rejects empty selection", () => {
  expect(() => validateTableSelection([], ["a"])).toThrow()
})
it("rejects unknown and metacharacter names", () => {
  const available = ["role", "user"]
  expect(() => validateTableSelection(["nope"], available)).toThrow()
  expect(() =>
    validateTableSelection(['x"; DROP TABLE y; --'], available)
  ).toThrow()
  expect(() =>
    validateTableSelection(["role", "nope"], available)
  ).toThrow() // whole request fails
})
it("accepts a subset of available names", () => {
  expect(() =>
    validateTableSelection(["role"], ["role", "user"])
  ).not.toThrow()
})
it("filterAvailableTableNames drops stale names and returns null when nothing valid remains", () => {
  expect(
    filterAvailableTableNames(["role", "ghost"], ["role", "user"])
  ).toEqual(["role"])
  expect(
    filterAvailableTableNames(["ghost"], ["role", "user"])
  ).toBeNull()
  expect(filterAvailableTableNames(null, ["role"])).toBeNull()
})
```

- [ ] **Step 2: Run and confirm failure** — `pnpm vitest run lib/backup/tables.test.ts` → FAIL

- [ ] **Step 3: Implement in `lib/backup/tables.ts`**

`listPublicTables`: `db.execute(sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name\`)`from`@/lib/drizzle/client`+`drizzle-orm`; map rows' `table_name`(cast the row type as`{ table_name: string }`). `validateTableSelection`: non-empty, every name in `available`. `filterAvailableTableNames`: pure intersection as specified.

- [ ] **Step 4: Run and confirm pass** — `pnpm vitest run lib/backup/tables.test.ts` → PASS

---

### Task 6: Error codes, Zod schemas, translations

**Files:**

- Modify: `actions/error-codes.ts` (add to the `ActionError` const)
- Create: `actions/schemas/backup.ts`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**

- Produces:
  - Error codes: `BACKUP_FAILED`, `RESTORE_FAILED`, `INVALID_TABLE_SELECTION`
  - `BackupEntrySchema` → `type BackupEntry = z.infer<typeof BackupEntrySchema>` = `{ filename: string; createdAt: string; sizeBytes: number; tables: string[] | null }` (must match Task 4's type)
  - `CreateBackupSchema` = `{ tables: z.string().min(1).array().min(1) }`
  - `RestoreBackupSchema` = `{ filename: z.string().min(1) }`
    — used by Tasks 8, 9, 10.

- [ ] **Step 1: Add the three codes** to `actions/error-codes.ts` under a `// Backups` comment, mirroring existing sections.

- [ ] **Step 2: Create `actions/schemas/backup.ts`** with the three schemas above and exported `BackupEntry` type (`"use server"` not needed — schemas are plain modules like `actions/schemas/user.ts`).

- [ ] **Step 3: Add translation keys** — identical structure in both files:

| key                              | en                                     | es                                             |
| -------------------------------- | -------------------------------------- | ---------------------------------------------- |
| `nav.backups`                    | `Backups`                              | `Respaldos`                                    |
| `backups.title`                  | `Backups`                              | `Respaldos`                                    |
| `backups.selectAll`              | `Select all`                           | `Seleccionar todo`                             |
| `backups.create`                 | `Create backup`                        | `Crear respaldo`                               |
| `backups.creating`               | `Creating backup…`                     | `Creando respaldo…`                            |
| `backups.empty`                  | `No backups yet`                       | `Aún no hay respaldos`                         |
| `backups.date`                   | `Date`                                 | `Fecha`                                        |
| `backups.size`                   | `Size`                                 | `Tamaño`                                       |
| `backups.tables`                 | `Tables`                               | `Tablas`                                       |
| `backups.tablesCount`            | `{count} tables`                       | `{count} tablas`                               |
| `backups.tablesUnknown`          | `Unknown`                              | `Desconocidas`                                 |
| `backups.download`               | `Download`                             | `Descargar`                                    |
| `backups.restore`                | `Restore`                              | `Restaurar`                                    |
| `backups.restoreTitle`           | `Restore backup`                       | `Restaurar respaldo`                           |
| `backups.restorePrompt`          | `Type the file name to confirm`        | `Escribe el nombre del archivo para confirmar` |
| `backups.created`                | `Backup created`                       | `Respaldo creado`                              |
| `backups.restored`               | `Backup restored`                      | `Respaldo restaurado`                          |
| `errors.BACKUP_FAILED`           | `The backup could not be created`      | `No se pudo crear el respaldo`                 |
| `errors.RESTORE_FAILED`          | `The backup could not be restored`     | `No se pudo restaurar el respaldo`             |
| `errors.INVALID_TABLE_SELECTION` | `Some selected tables no longer exist` | `Algunas tablas seleccionadas ya no existen`   |

- [ ] **Step 4: Verify both files parse and match**

Run: `python3 -c "import json; a=json.load(open('messages/en.json')); b=json.load(open('messages/es.json')); assert a.keys()==b.keys(); print('ok')" && pnpm typecheck`
Expected: `ok` and no type errors

---

### Task 7: Sidebar entry gated by role

**Files:**

- Modify: `config/sidebar-menu.ts`
- Test: `config/sidebar-menu.test.ts`

**Interfaces:**

- Produces: `SidebarItem.requiredRole?: string`; `getSidebarMenu(role, permissions)` now passes `role` into `adminSections` — consumed by the existing `components/common/app-sidebar.tsx` (no change needed there; it already passes `role`).

- [ ] **Step 1: Write the failing test**

```ts
// config/sidebar-menu.test.ts
import { getSidebarMenu } from "./sidebar-menu"

const ALL_PERMS = [
  "users:manage",
  "permissions:manage",
  "categories:view",
]
const findBackups = (role: string | null) =>
  getSidebarMenu(role, ALL_PERMS)
    .flatMap((s) => s.items)
    .find((i) => i.url === "/app/backups")

it("shows the backups item only for the super role", () => {
  expect(findBackups("super")).toBeDefined()
  expect(findBackups("admin")).toBeUndefined()
  expect(findBackups("retailer")).toBeUndefined()
  expect(findBackups("user")).toBeUndefined()
  expect(findBackups(null)).toBeUndefined()
})
it("leaves the other admin items permission-driven", () => {
  const urls = getSidebarMenu("admin", ["users:manage"])
    .flatMap((s) => s.items)
    .map((i) => i.url)
  expect(urls).toContain("/app/usuarios")
  expect(urls).not.toContain("/app/backups")
})
```

- [ ] **Step 2: Run and confirm failure** — `pnpm vitest run config/sidebar-menu.test.ts` → FAIL (item not gated yet — assert the first test fails because `findBackups("admin")` is defined)

- [ ] **Step 3: Implement**

- Add `requiredRole?: string` to `SidebarItem`.
- `adminSections(role?: string | null, permissions?: string[])`: filter = `(item.requiredRole === undefined || item.requiredRole === role) && hasPermission(item, permissions)`.
- Add the item `{ label: "backups", icon: DatabaseBackup, url: "/app/backups", requiredRole: "super" }` (import `DatabaseBackup` from `lucide-react`) as the last admin item.
- `getSidebarMenu(role, permissions)` — rename `_role` to `role`, pass it to `adminSections`.

- [ ] **Step 4: Run and confirm pass** — `pnpm vitest run config/sidebar-menu.test.ts` → PASS

---

### Task 8: Server actions

**Files:**

- Create: `actions/backups.ts`
- Test: `actions/__tests__/backups.test.ts`

**Interfaces:**

- Consumes: Tasks 2–6 exports; `adminAction` from `@/lib/safe-action`; `throwActionError` from `@/lib/action-result`
- Produces:
  - `createBackup` — built on `adminAction` (the existing next-safe-action super-user middleware at `lib/safe-action.ts:168`), input `CreateBackupSchema`, output `BackupEntrySchema`
  - `restoreBackup` — built on `adminAction`, input `RestoreBackupSchema`, output `z.object({ filename: z.string() })`
    — consumed by Task 9's actions hook.

- [ ] **Step 1: Write the failing action tests** (mock pattern from `actions/__tests__/users.test.ts`)

```ts
// actions/__tests__/backups.test.ts
vi.mock("@/lib/auth", () => ({ auth: vi.fn(), isSuperUser: vi.fn() }))
vi.mock("@/lib/backup/tables", () => ({ listPublicTables: vi.fn(), validateTableSelection: vi.fn() }))
vi.mock("@/lib/backup/files", () => ({ writeBackupFile: vi.fn(), resolveBackupSqlPath: vi.fn() }))
vi.mock("@/lib/backup/exec", () => ({ pgDump: vi.fn(), restoreSql: vi.fn() }))
// import after mocks; state via vi.hoisted if needed

describe("createBackup", () => {
  it("returns FORBIDDEN for a non-super session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u-1", role: "admin" }, expires: "" })
    mockIsSuperUser.mockReturnValue(false)
    const res = await createBackup({ tables: ["role"] })
    expect(res.serverError).toEqual({ code: "FORBIDDEN" })
  })
  it("rejects a selection that fails validation", async () => {
    // isSuperUser true; validateTableSelection throws ActionError("INVALID_TABLE_SELECTION")
    // → res.serverError.code === "INVALID_TABLE_SELECTION"; pgDump NOT called
  })
  it("returns BACKUP_FAILED when pg_dump fails, logging stderr", async () => {
    mockPgDump.mockResolvedValue({ ok: false, stdout: "", stderr: "docker down" })
    const res = await createBackup({ tables: ["role"] })
    expect(res.serverError).toEqual({ code: "BACKUP_FAILED" })
    expect(writeBackupFile).not.toHaveBeenCalled()
  })
  it("writes the dump and returns the entry on success", async () => {
    mockPgDump.mockResolvedValue({ ok: true, stdout: "-- dump", stderr: "" })
    mockWrite.mockResolvedValue({ filename: "2026-11-02_14-30-00.sql", createdAt: "...", sizeBytes: 7, tables: ["role"] })
    const res = await createBackup({ tables: ["role"] })
    expect(res.data?.filename).toBe("2026-11-02_14-30-00.sql")
  })
})
describe("restoreBackup", () => {
  it("returns FORBIDDEN for a non-super session", ...)
  it("returns NOT_FOUND for an invalid filename", ...) // resolveBackupSqlPath throws
  it("returns RESTORE_FAILED when psql fails", ...)    // restoreSql → ok:false
  it("returns { filename } on success", ...)
})
```

- [ ] **Step 2: Run and confirm failure** — `pnpm vitest run actions/__tests__/backups.test.ts` → FAIL

- [ ] **Step 3: Implement `actions/backups.ts`**

`"use server"`. Both actions: `adminAction.metadata({}).inputSchema(...).outputSchema(...).action(async ({ parsedInput }) => ...)`.
`createBackup`: guard `process.env.DB_DIRECT_URL` (missing → `throwActionError("INTERNAL_SERVER_ERROR")`); `const available = await listPublicTables()`; `validateTableSelection(parsedInput.tables, available)`; `const dump = await pgDump(parsedInput.tables, dbDirectUrl)`; `if (!dump.ok) { console.error("[backup] pg_dump failed:", dump.stderr); throwActionError("BACKUP_FAILED") }`; `return writeBackupFile(dump.stdout, parsedInput.tables)`.
`restoreBackup`: `const file = resolveBackupSqlPath(parsedInput.filename)`; `const result = await restoreSql(file, dbDirectUrl)`; `if (!result.ok) { console.error("[backup] psql failed:", result.stderr); throwActionError("RESTORE_FAILED") }`; `return { filename: parsedInput.filename }`.

- [ ] **Step 4: Run and confirm pass** — `pnpm vitest run actions/__tests__/backups.test.ts` → PASS

---

### Task 9: Optimistic store

**Files:**

- Create: `stores/backups/backup-reducer.ts`
- Create: `stores/backups/backup-store.ts`
- Create: `stores/backups/use-backups-state.ts`
- Create: `stores/backups/use-backups-actions.ts`
- Create: `stores/backups/backup-store.test.ts`
- Create: `components/backups/backups-provider.tsx`

**Interfaces:**

- Consumes: `BackupEntry` type (Task 6), `createBackup`/`restoreBackup` actions (Task 8), `createOptimisticStore`, `useOptimisticAction`, `useSettle`, `useServerReseed`
- Produces: `BackupsStoreContext`, `useBackupsStore()`, `useBackupsState()` → `{ backups, pending }`, `useBackupsActions()` → `{ createBackup(tables: string[]): Promise<void>, restoreBackup(filename: string): Promise<void> }`, `BackupsProvider({ backups, children })` — consumed by Tasks 10.

- [ ] **Step 1: Write the failing store test**

```ts
// stores/backups/backup-store.test.ts
// mirror stores/expenses/expense-store.test.ts structure
it("add prepends the backup", ...)
it("replaceTemp swaps the temp row for the server entry", ...)
it("restore leaves the list unchanged", ...)
it("createBackupsStore reseedFromServer replaces the whole state", () => {
  const store = createBackupsStore({ backups: [a] })
  store.getState().reseedFromServer({ backups: [b] })
  expect(store.getState().optimistic.backups).toEqual([b])
})
it("useBackupsStore outside its provider throws a provider-named error", ...) // same pattern as existing store tests
```

- [ ] **Step 2: Run and confirm failure** — `pnpm vitest run stores/backups/backup-store.test.ts` → FAIL

- [ ] **Step 3: Implement the reducer, store, state hook, actions hook, provider**

- `backup-reducer.ts`: `BackupStoreState = { backups: BackupEntry[] }`; `BackupAction = { type: "add"; backup } | { type: "replaceTemp"; tempId; backup } | { type: "restore" }`. `restore` returns state unchanged (it exists only so `useOptimisticAction.run` can pend the in-flight restore and drive the loading bar; `commit` triggers `router.refresh()`).
- `backup-store.ts`: `createBackupsStore(seed)` → `createOptimisticStore({ initialState: seed, reducer })` (no `serverSlice` — the state IS the server's list), context, `useBackupsStore()` throwing `"useBackupsStore must be used within a BackupsProvider"`. Relative imports inside the folder, absolute from outside.
- `use-backups-state.ts`: single export `useBackupsState()` selecting `s.optimistic.backups` and `s.pending`; returns `{ backups, pending }`.
- `use-backups-actions.ts`:
  - `createBackup(tables)`: temp entry `{ filename: \`temp-${Date.now()}.sql\`, createdAt: new Date().toISOString(), sizeBytes: 0, tables }`; `run({ type: "add", backup: temp }, () => executeCreate({ tables }), { commitAction: (r) => r.data ? { type: "replaceTemp", tempId: temp.filename, backup: r.data } : undefined })`; `settle(result, t("backups.created"))`.
  - `restoreBackup(filename)`: `run({ type: "restore" }, () => executeRestore({ filename }))`; `settle(result, t("backups.restored"))`.
  - Both use `useAction` from `next-safe-action/hooks` with `executeAsync`.
- `backups-provider.tsx`: exactly the `ExpensesProvider` shape — `useMemo` seed, `useState(() => createBackupsStore(seed))`, `useServerReseed(store, seed)`, `<BackupsStoreContext value={store}>`.

- [ ] **Step 4: Run and confirm pass** — `pnpm vitest run stores/backups/backup-store.test.ts` → PASS

---

### Task 10: Page, view components, download route

**Files:**

- Create: `app/app/backups/page.tsx`
- Create: `components/backups/backups-view.tsx`
- Create: `components/backups/table-selection.tsx`
- Create: `components/backups/backups-list.tsx`
- Create: `components/backups/restore-dialog.tsx`
- Create: `app/api/backups/download/[filename]/route.ts`
- Modify: `.env.example` (add `DB_DIRECT_URL=` after `DATABASE_SSL=`)
- Modify: `.gitignore` (add `backups/`)

**Interfaces:**

- Consumes: everything from Tasks 1–9
- Produces: the working route and UI that Task 11 drives.

- [ ] **Step 1: Build the download route**

`GET(_request, { params }: { params: Promise<{ filename: string }> })`: `auth()` + `isSuperUser` → else `403`; `resolveBackupSqlPath(filename)` in try/catch → `404` on throw; stream with `Readable.toWeb(createReadStream(path))` as the body, headers `Content-Type: application/sql`, `Content-Disposition: attachment; filename="<name>"`. No shell, no `execFile` here.

- [ ] **Step 2: Build the page**

`app/app/backups/page.tsx` (async server component): `auth()`; `if (!session?.user || !isSuperUser(session)) forbidden()`; `const tables = await listPublicTables()`; `const backups = await listBackups()`; render `<BackupsProvider backups={backups}><BackupsView tables={tables} /></BackupsProvider>`.

- [ ] **Step 3: Build the view components**

- `backups-view.tsx` (`"use client"`): `useBackupsState()`, `useBackupsActions()`; `const [selected, setSelected] = useState<string[]>(tables)`; one `useEffect` on mount applying `filterAvailableTableNames(parseStored(), tables)` where `parseStored()` reads `localStorage.getItem("alsia.backup.tables")` inside try/catch and `JSON.parse`s to `string[] | null` (guard `typeof window`). `handleCreate` = `localStorage.setItem("alsia.backup.tables", JSON.stringify(selected))` then `await createBackup(selected)`. Renders heading `t("backups.title")`, `<TableSelection>`, a Backup `<Button>` labeled `t("backups.create")` / `t("backups.creating")` while `pending.length > 0` or the local submitting flag, and `<BackupsList>`.
- `table-selection.tsx`: props `{ tables: string[]; selected: string[]; onChange(next: string[]): void }`. A "select all" `<input type="checkbox">` (checked = all selected; `indeterminate` set through a ref when some), label `t("backups.selectAll")`, plus one native checkbox per table name. Use Tailwind semantic tokens only; no new UI primitive.
- `backups-list.tsx`: reads `useBackupsState().backups`. Empty → `t("backups.empty")`. Otherwise a `Table` with columns `backups.date` (`new Date(createdAt).toLocaleString()`), `backups.size` (local `formatBytes` helper: B/KB/MB with one decimal), `backups.tables` (sidecar present → `t("backups.tablesCount", { count })` with `title={tables.join(", ")}`; null → `t("backups.tablesUnknown")`), and actions: download `<a href={"/api/backups/download/" + filename}>` labeled `t("backups.download")`, restore button opening local state `restoreTarget: string | null`.
- `restore-dialog.tsx`: props `{ filename: string; open: boolean; onOpenChange(open: boolean): void; onConfirm(): void }`. Local `typed` state, reset when `open` flips true. Confirm `<Button>` disabled until `typed === filename`. Cancel = `t("common.cancel")`, confirm = `t("backups.restore")`, title = `t("backups.restoreTitle")`, prompt = `t("backups.restorePrompt")`. `onConfirm` calls `restoreBackup(filename)` then closes.
- One component per file; event handlers with two or more lines memoized with `useCallback`.

- [ ] **Step 4: Config touch-ups**

Add `DB_DIRECT_URL=` to `.env.example`; add `backups/` to `.gitignore`.

- [ ] **Step 5: Typecheck and lint the new files**

Run: `pnpm typecheck && pnpm eslint app/app/backups components/backups lib/backup actions/backups.ts actions/schemas/backup.ts stores/backups config/sidebar-menu.ts "app/api/backups"`
Expected: clean

---

### Task 11: E2E spec

**Files:**

- Create: `e2e/backups.spec.ts`

**Interfaces:**

- Consumes: `signInAs` / `test` from `./fixtures`; Spanish labels from Task 6.

- [ ] **Step 1: Write the spec**

```ts
// e2e/backups.spec.ts — labels are es-ES
import { test, expect } from "./fixtures"
import fs from "node:fs"
import path from "node:path"

test("admin users cannot see or open the backups section", async ({
  page,
  signInAs,
}) => {
  await signInAs("admin")
  await page.goto("/app")
  await expect(
    page.getByRole("link", { name: "Respaldos" })
  ).toHaveCount(0)
  await page.goto("/app/backups")
  await expect(
    page.getByText("No tienes acceso a esta página.")
  ).toBeVisible()
})

test("super user creates, downloads, and restores a backup", async ({
  page,
  signInAs,
}) => {
  await signInAs("super")
  await page.goto("/app")
  await expect(
    page.getByRole("link", { name: "Respaldos" })
  ).toBeVisible()
  await page.goto("/app/backups")
  await expect(
    page.getByRole("heading", { name: "Respaldos" })
  ).toBeVisible()
  // table list: everything checked; untick one via its label checkbox
  const selectAll = page.getByLabel("Seleccionar todo")
  await expect(selectAll).toBeChecked()
  // persistence: selection is only written on click — after unchecking one table
  // and reloading WITHOUT clicking Backup, everything must be checked again
  await page.reload()
  await expect(selectAll).toBeChecked()
  // now create
  await page.getByRole("button", { name: "Crear respaldo" }).click()
  const firstRow = page
    .getByRole("row")
    .filter({ hasText: /\.sql/ })
    .first()
  await expect(firstRow).toBeVisible({ timeout: 60_000 })
  const filename = (await firstRow.textContent())!.match(
    /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-\d+)?\.sql/
  )![0]
  // sidecar-aware column shows a table count, not "Desconocidas"
  await expect(firstRow).not.toContainText("Desconocidas")
  // selection persisted by the Backup click survives reload
  await page.reload()
  // (the previously checked state was written; assert the un-ticked box stayed un-ticked)
  await expect(
    page.getByLabel("role", { exact: true })
  ).not.toBeChecked() // adjust label to the unticked table
  // download
  const downloadPromise = page.waitForEvent("download")
  await firstRow.getByRole("link", { name: "Descargar" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(filename)
  // restore: dialog blocked until the exact filename is typed
  await firstRow.getByRole("button", { name: "Restaurar" }).click()
  const dialog = page.getByRole("dialog")
  const confirm = dialog.getByRole("button", {
    name: "Restaurar",
    exact: true,
  })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole("textbox").fill("wrong-name.sql")
  await expect(confirm).toBeDisabled()
  await dialog.getByRole("textbox").fill(filename)
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByText("Respaldo restaurado")).toBeVisible({
    timeout: 60_000,
  })
  // cleanup: remove the files this test created from ./backups
  const dir = path.join(process.cwd(), "backups")
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(filename.replace(/\.sql$/, "")))
      fs.rmSync(path.join(dir, f))
  }
})
```

Adjust the per-table checkbox label to whatever accessible name the native input + label wiring produces (the label must wrap or `htmlFor`-link the input so `getByLabel` works — wire it that way in `table-selection.tsx`). Give the whole test `test.setTimeout(120_000)` if the create/restore steps exceed the 45s default.

- [ ] **Step 2: Run just this spec**

Run: `pnpm test:e2e -- e2e/backups.spec.ts` (or `pnpm exec playwright test e2e/backups.spec.ts` with the project's webServer config)
Expected: PASS. Docker must be running; this exercises the real loopback→`host.docker.internal` rewrite against the test DB.

- [ ] **Step 3: Fix wiring issues only** (labels, roles, timeouts) — do not weaken assertions.

---

### Task 12: Full verification

- [ ] **Step 1:** Run `pnpm verify`
      Expected: typecheck, `eslint --max-warnings=0`, and vitest with coverage all green (≥60/60/60/50).
- [ ] **Step 2:** Run `pnpm test:e2e`
      Expected: full Playwright suite green (Docker running).
- [ ] **Step 3:** Report completion with a summary of files changed. **Do not commit** — wait for the user's explicit go-ahead, then stage only the intended files and let the pre-commit hook (`pnpm verify` + `pnpm test:e2e`) run.
