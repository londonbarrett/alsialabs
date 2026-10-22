# Invoice ↔ project binding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let my-invoices users bind/rebind/clear a project on their invoices from a row action dialog (optimistic), and show bound invoices as read-only rows whose `paidAmount` counts as spend in the project's expenses section.

**Architecture:** One new next-safe-action (`bindInvoiceToProject`) guarded by ownership; a new whole-state optimistic store for my-invoices (the route currently has none); a read-only `getProjectInvoices` action feeding an `invoices` slice added to the existing expenses store; one metadata-only change dropping `getProjects`'s `projects:view` gate so ownership is the picker's authorization.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM/PostgreSQL, next-safe-action, next-intl, zustand vanilla stores via `createOptimisticStore`, Tailwind v4 + shadcn/ui, vitest + vitest-drizzle-mock.

**Spec:** `docs/superpowers/specs/2026-10-20-invoice-project-binding-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Package manager **pnpm**; commands: `pnpm typecheck`, `pnpm eslint <paths>`, `pnpm test:run` (or `pnpm vitest run <file>`), full gate `pnpm verify`.
- **Never commit without explicit user permission (AGENTS.md).** At execution start, ask the user once whether per-task commits are permitted; if declined, skip every Commit step and leave changes uncommitted.
- No new dependencies. No `any`. No hand-edited `drizzle/` output.
- `messages/en.json` and `messages/es.json` stay structurally identical; every new key added to both. Reuse `common.*` before inventing keys.
- Store rules (AGENTS.md): pure reducer, `createOptimisticStore` (no `zustand` `create`), one no-arg state hook per file, mutations only via `useOptimisticAction`/`run` + `useSettle`, no sibling-store imports, provider = lazy `useState` + `useServerReseed`.
- Buttons that sit inside the my-invoices row must `e.stopPropagation()` — the whole `<TableRow>` is a click target that toggles expansion.
- Add no `permission` metadata to ownership-gated my-invoices actions; keep existing permission metadata everywhere else untouched (except Task 3's single removal).

## Review Focus

1. **Ownership gates on bind** — a foreign invoice or a project the caller doesn't own must yield `FORBIDDEN` and write nothing. Pinned in Task 2 tests ("belongs to another client", "does not own the project").
2. **Clearing a binding** — `projectId: null` must persist as SQL NULL, return `projectId: null`, and clear `projectName` optimistically. Pinned in Task 2 test "clears the binding…" and Task 4 reducer test "clears projectId and projectName".
3. **Spend semantics** — project spend must sum `paidAmount` (not `grandTotal`), all statuses. Pinned in Task 10 test (asserts captured invoice SQL contains `paid_amount` and `expenses` fold = 50+40+30) and Task 7 test (cancelled row returned).
4. **Failed bind reverts** — a rejected server call must discard the optimistic row, not leave it bound. Pinned in Task 4 store test "discard reverts a pending bindProject".
5. **Permission-less picker** — `getProjects` must no longer consult `hasPermission` (the whole point of decision B; the user role lacks `projects:view`). Pinned in Task 3 test "does not check the projects:view permission".
6. _(manual — no component-test harness exists in the repo; adding one needs a dependency, out of scope)_ bind button must not toggle row expansion; `/app/mis-facturas` header must stream while the list loads; budget bar/over-budget flag must move when binding. Checked in Task 11's manual pass.

## File Structure

| File                                                                                                                                                        | Responsibility                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `actions/schemas/invoice.ts` (modify)                                                                                                                       | `projectName` on `MyInvoiceSchema`; `BindInvoiceToProjectSchema`/`BindInvoiceResultSchema`; `ProjectInvoiceSchema` |
| `actions/invoices.ts` (modify)                                                                                                                              | `bindInvoiceToProject`, `getProjectInvoices`; `projectName` joins in `getMyInvoices`/`getMyInvoiceDetails`         |
| `actions/projects.ts` (modify)                                                                                                                              | `getProjects` permission metadata removal; `invoicePaidAggs` in `getProjectsWithDetails`                           |
| `stores/my-invoices/*` (create ×5)                                                                                                                          | reducer / store / state hook / actions hook / test                                                                 |
| `components/my-invoices/my-invoices-provider.tsx` (create)                                                                                                  | lazy store + reseed from `MyInvoicesResultDTO` seed                                                                |
| `components/my-invoices/bind-project-dialog.tsx` (create)                                                                                                   | bind/rebind/clear picker dialog                                                                                    |
| `app/app/mis-facturas/page.tsx` (modify)                                                                                                                    | async seed child inside `Page`'s Suspense (streaming preserved)                                                    |
| `components/my-invoices/my-invoices-{view,list,row}.tsx`, `my-invoice-details.tsx` (modify)                                                                 | store-backed view; Project + Actions columns; bind button; details entry                                           |
| `stores/expenses/*` (modify)                                                                                                                                | state becomes `{ expenses, invoices }`; test updated                                                               |
| `components/projects/expenses/{expenses-provider,project-expenses,expenses-table}.tsx` (modify)                                                             | seed pair; invoice rows; totals                                                                                    |
| `app/app/proyectos/[id]/gastos/page.tsx` (modify)                                                                                                           | fetch `getProjectInvoices`                                                                                         |
| `messages/{en,es}.json` (modify)                                                                                                                            | `myInvoices.*` bind keys; `common.invoice`                                                                         |
| `actions/invoices.test.ts`, `actions/__tests__/{projects}.test.ts`, `stores/my-invoices/my-invoices-store.test.ts`, `stores/expenses/expense-store.test.ts` | tests                                                                                                              |

---

### Task 1: `projectName` on the my-invoice DTO

**Files:**

- Modify: `actions/schemas/invoice.ts:101-103` (`MyInvoiceSchema`)
- Modify: `actions/invoices.ts:170-194` (`getMyInvoices` select) and `:275-304` (`getMyInvoiceDetails` select)
- Test: `actions/invoices.test.ts`

**Interfaces:**

- Consumes: existing `MyInvoiceSchema`/`MyInvoiceDTO`.
- Produces: `MyInvoiceSchema` gains `projectName: z.string().nullable()`; both `getMyInvoices` and `getMyInvoiceDetails` return it (left-joined from `projectsTable.name`, `null` when unbound). Later tasks rely on `invoice.projectName`.

- [ ] **Step 1: Write the failing tests**

In `actions/invoices.test.ts`, extend the existing fixtures for `getMyInvoices` and `getMyInvoiceDetails` with `projectName: "Website Redesign"` on the invoice row, and add:

```ts
it("includes projectName from the joined project", async () => {
  // clients → [{ id: CLIENT_ID }]; invoicesTable → fixture (above)
  const result = await getMyInvoices()
  expect(result.data?.invoices[0]?.projectName).toBe("Website Redesign")
})
```

(an analogous assertion on `result.data?.invoice.projectName` inside the `getMyInvoiceDetails` describe). Fixtures missing `projectName` will also start failing output-schema validation — that is expected until Step 3.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run actions/invoices.test.ts`
Expected: FAIL — `projectName` unknown/undefined (or output validation `INTERNAL_SERVER_ERROR` on stale fixtures).

- [ ] **Step 3: Implement**

In `actions/schemas/invoice.ts`: add `projectName: z.string().nullable(),` to `MyInvoiceSchema` (only — do **not** touch `InvoiceRecordSchema`, whose consumers return rows without a join).

In `actions/invoices.ts`: add `projectsTable` to the `@/lib/drizzle/schema` import; append to both selects `projectName: projectsTable.name,` and `.leftJoin(projectsTable, eq(invoicesTable.projectId, projectsTable.id))`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run actions/invoices.test.ts`
Expected: PASS (update every `MyInvoiceSchema`-shaped fixture in the file with `projectName: null` where the test doesn't assert a name).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck` → clean. Commit `feat(invoices): expose projectName on my-invoice DTOs` (only if the user granted commit permission).

---

### Task 2: `bindInvoiceToProject` server action

**Files:**

- Modify: `actions/schemas/invoice.ts` (after `MyInvoiceDetailsSchema`)
- Modify: `actions/invoices.ts` (after `getMyInvoiceDetails`, ~line 326)
- Test: `actions/invoices.test.ts`

**Interfaces:**

- Consumes: Task 1's DTO; the client-ids ownership block from `getMyInvoices` (`actions/invoices.ts:148-158`); `returnActionError`, `sessionAction`.
- Produces:
  - `BindInvoiceToProjectSchema = z.object({ invoiceId: z.uuid(), projectId: z.uuid().nullable() })`
  - `BindInvoiceResultSchema = z.object({ id: z.string(), projectId: z.string().nullable() })` (+ `BindInvoiceToProjectDTO`/`BindInvoiceResultDTO` types)
  - `export const bindInvoiceToProject = sessionAction` with `.metadata({ revalidate: ["/app/mis-facturas"] })`, **no permission metadata**, input/output schemas above. Returns `{ id, projectId }`.
  - Consumed by Task 4's actions hook.

- [ ] **Step 1: Write the failing tests**

Add to `actions/invoices.test.ts`:

- Top of file: `isSuperUser: vi.fn()` inside the existing `vi.mock("@/lib/auth", …)` factory; `const mockIsSuperUser = vi.mocked(isSuperUser)`; set `mockIsSuperUser.mockReturnValue(false)` in the shared `beforeEach`.
- Constants: `const PROJECT_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"` (must be a UUID — input schema validates `z.uuid()`).

```ts
describe("bindInvoiceToProject", () => {
  it("binds an owned invoice to an owned project", async () => {
    // clientsTable → [{ id: CLIENT_ID }]
    // invoicesTable → invoice fixture with clientId: CLIENT_ID
    // projectOwnersTable → [{ projectId: PROJECT_ID }]
    // onUpdate(invoicesTable) → [{ id: INVOICE_ID, projectId: PROJECT_ID }]
    const result = await bindInvoiceToProject({
      invoiceId: INVOICE_ID,
      projectId: PROJECT_ID,
    })
    expect(result.data).toEqual({
      id: INVOICE_ID,
      projectId: PROJECT_ID,
    })
  })

  it("clears the binding when projectId is null", async () => {
    // clientsTable → [{ id: CLIENT_ID }]; invoicesTable → fixture;
    // onUpdate(invoicesTable) → [{ id: INVOICE_ID, projectId: null }]
    // (no projectOwnersTable query happens)
    const result = await bindInvoiceToProject({
      invoiceId: INVOICE_ID,
      projectId: null,
    })
    expect(result.data?.projectId).toBeNull()
  })

  it("returns NOT_FOUND for an unknown invoice", async () => {
    // clientsTable → [{ id: CLIENT_ID }]; invoicesTable → []
    expect(result.serverError).toEqual({ code: "NOT_FOUND" })
  })

  it("returns FORBIDDEN when the invoice belongs to another client", async () => {
    // clientsTable → [{ id: CLIENT_ID }]; invoicesTable → fixture with clientId: <other uuid>
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("returns FORBIDDEN when the user does not own the project", async () => {
    // clientsTable → [{ id: CLIENT_ID }]; invoicesTable → fixture (owned);
    // projectOwnersTable → []
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})
```

(Invoice fixture: reuse the file's existing `getMyInvoices` row shape; `onUpdate` mock as in other mutation tests.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run actions/invoices.test.ts`
Expected: FAIL — `bindInvoiceToProject is not a function`.

- [ ] **Step 3: Implement the action**

In `actions/schemas/invoice.ts`: add `BindInvoiceToProjectSchema`, `BindInvoiceResultSchema` and their DTO types as specified in Interfaces.

In `actions/invoices.ts`:

- Imports: the two new schemas; `projectOwnersTable` from `@/lib/drizzle/schema`; `isSuperUser` from `@/lib/auth`.
- Action body (order matters — it drives the test mocks):
  1. Resolve caller's client ids exactly as `getMyInvoices` does (`clientsTable.userId`/`email`, `or`/`eq`); empty → `returnActionError("FORBIDDEN")`.
  2. `select({ clientId })` from `invoicesTable` where `id = invoiceId` limit 1; none → `returnActionError("NOT_FOUND")`; `clientId` not in the ids → `returnActionError("FORBIDDEN")`.
  3. If `projectId !== null` and `!isSuperUser(ctx.session)`: `select({ projectId })` from `projectOwnersTable` where `projectId` + `userId = ctx.session.user.id` limit 1; none → `returnActionError("FORBIDDEN")`.
  4. `update(invoicesTable).set({ projectId }).where(eq(invoicesTable.id, invoiceId)).returning({ id, projectId })`; return row or `NOT_FOUND`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run actions/invoices.test.ts`
Expected: all PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`. Commit `feat(invoices): add bindInvoiceToProject action` (with permission).

---

### Task 3: `getProjects` drops the `projects:view` gate

**Files:**

- Modify: `actions/projects.ts:38-39`
- Test: `actions/__tests__/projects.test.ts`

**Interfaces:**

- Consumes: existing `getProjects` (zero app callers today — verified in recon).
- Produces: `getProjects` with `.metadata({})`; same ownership-filtered body. Consumed by Task 6's dialog.

- [ ] **Step 1: Write the failing test**

Add to `actions/__tests__/projects.test.ts` (the file already mocks `@/lib/auth` with `auth`, `hasPermission`, `isSuperUser`):

```ts
describe("getProjects", () => {
  it("returns projects without checking the projects:view permission", async () => {
    mockIsSuperUser.mockReturnValue(false)
    const row: ProjectDetailDTO = {
      /* full shape — TypeScript will list the fields */
    }
    state.mock.onSelect(schema.projectsTable).respond([row])
    const result = await getProjects()
    expect(result.data).toHaveLength(1)
    expect(mockHasPermission).not.toHaveBeenCalled()
  })
})
```

Add the `ProjectDetailDTO` and `getProjects` imports (and `mockHasPermission` if the file doesn't alias it yet).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run actions/__tests__/projects.test.ts`
Expected: FAIL — `mockHasPermission` was called with `projects`/`view`.

- [ ] **Step 3: Implement**

Change `actions/projects.ts:39` from `.metadata({ permission: { module: "projects", action: "view" } })` to `.metadata({})`. Body untouched (the `exists` filter on `projectOwnersTable` for non-super users already enforces ownership).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run actions/__tests__/projects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit `feat(projects): gate getProjects by ownership, not projects:view` (with permission).

---

### Task 4: my-invoices optimistic store

**Files:**

- Create: `stores/my-invoices/my-invoices-reducer.ts`
- Create: `stores/my-invoices/my-invoices-store.ts`
- Create: `stores/my-invoices/use-my-invoices-state.ts`
- Create: `stores/my-invoices/use-my-invoices-actions.ts`
- Test: `stores/my-invoices/my-invoices-store.test.ts`
- Create: `components/my-invoices/my-invoices-provider.tsx`

**Interfaces:**

- Consumes: `MyInvoicesResultDTO` (state = the seed itself), `bindInvoiceToProject` + `BindInvoiceResultDTO` (Task 2), `createOptimisticStore`, `useOptimisticAction`, `useSettle`.
- Produces (relied on by Tasks 5–6):
  - State: `MyInvoicesState = MyInvoicesResultDTO`; action `{ type: "bindProject"; invoiceId: string; projectId: string | null; projectName: string | null }`.
  - `createMyInvoicesStore(seed: MyInvoicesResultDTO)` — **no `serverSlice`** (whole state is the server's; reseed replaces it).
  - `useMyInvoicesState(): { clientId: string | null; invoices: MyInvoiceDTO[] }` — the file's only export.
  - `useMyInvoicesActions(): { bindToProject(invoiceId: string, projectId: string | null, projectName: string | null): Promise<void> }`.
  - `<MyInvoicesProvider seed={MyInvoicesResultDTO}>{children}</MyInvoicesProvider>` exporting nothing else.

- [ ] **Step 1: Write the failing test**

`stores/my-invoices/my-invoices-store.test.ts` (mirror `stores/expenses/expense-store.test.ts` structure):

```ts
// fixtures: makeInvoice(id, overrides) → MyInvoiceDTO (include projectName: null)
describe("myInvoicesReducer", () => {
  it("bindProject patches projectId and projectName", () => /* row updated, others untouched */)
  it("clears projectId and projectName when projectId is null", () => /* both null after */)
  it("returns the same state for an unknown invoiceId", () => {
    expect(myInvoicesReducer(state, { type: "bindProject", invoiceId: "nope", projectId: "p", projectName: "P" })).toBe(state)
  })
})
describe("createMyInvoicesStore", () => {
  it("seeds committed and optimistic from the seed", () => /* committed === seed, pending [] */)
  it("discard reverts a pending bindProject", () => {
    // pend(bindProject → "Project X"); discard(id);
    // expect committed/optimistic row still projectId: null
  })
  it("reseedFromServer replaces the whole state", () => /* new seed in committed+optimistic */)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run stores/my-invoices`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the package**

Follow `stores/my-tasks/` file-for-file:

- `my-invoices-reducer.ts` — `MyInvoicesState = MyInvoicesResultDTO`; discriminated-union `MyInvoicesAction` with the single `bindProject` case: find the invoice (missing → return `state` unchanged), else `{ ...state, invoices: state.invoices.map(…) }` patching `projectId` **and** `projectName`. No `reset`.
- `my-invoices-store.ts` — `createOptimisticStore({ initialState: seed, reducer: myInvoicesReducer })` (omit `serverSlice`); `MyInvoicesStoreContext`; `useMyInvoicesStore()` throwing `"useMyInvoicesStore must be used within a MyInvoicesProvider"`.
- `use-my-invoices-state.ts` — single export; `useStore(store, s => s.optimistic)` → `{ clientId, invoices }`.
- `use-my-invoices-actions.ts` — `useAction(bindInvoiceToProjectAction)` + `run` + `settle`; `commitAction: (r) => r.data ? { type: "bindProject", invoiceId: r.data.id, projectId: r.data.projectId, projectName } : undefined` (name comes from the caller's dialog selection — the store never imports another store). `settle(result, t("myInvoices.bindSuccess"))` (key added in Task 6 — add it to both message files here so the hook typechecks: `myInvoices.bindSuccess` = `"Invoice project updated"` / `"Proyecto de la factura actualizado"`). Returns `void`.
- `my-invoices-provider.tsx` — `const [store] = useState(() => createMyInvoicesStore(seed))` + `useServerReseed(store, seed)` + context. Prop: `seed: MyInvoicesResultDTO`, `children`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run stores/my-invoices`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`. Commit `feat(my-invoices): add optimistic store for project binding` (with permission).

---

### Task 5: my-invoices route reads the store (Project column)

**Files:**

- Modify: `app/app/mis-facturas/page.tsx`
- Modify: `components/my-invoices/my-invoices-view.tsx`
- Modify: `components/my-invoices/my-invoices-list.tsx`
- Modify: `components/my-invoices/my-invoices-row.tsx` (Project cell + `colSpan` 5→6)
- Modify: `components/my-invoices/my-invoice-details.tsx`

**Interfaces:**

- Consumes: Task 1 (`invoice.projectName`), Task 4 (provider/state hook).
- Produces: view with no props; list gains the Project column; row `colSpan` = 6. Task 6 adds the Actions column (7th) and the button.

- [ ] **Step 1: Rewire the page with streaming preserved**

`app/app/mis-facturas/page.tsx`: keep `auth`/redirect, `getTranslations`, `<Page header={…} fallback={…}>`. Delete `invoicesPromise`. Add a local async server component:

```tsx
async function MyInvoicesContent() {
  const seed = unwrapResponse(await getMyInvoices())
  return (
    <MyInvoicesProvider seed={seed}>
      <MyInvoicesView />
    </MyInvoicesProvider>
  )
}
```

Render `<MyInvoicesContent />` as `Page`'s child (Page wraps children in `Suspense`, so the header streams — do **not** `await getMyInvoices()` in the page body). Import `MyInvoicesProvider` and `unwrapResponse`.

- [ ] **Step 2: Rewire the view**

`my-invoices-view.tsx`: drop the `invoicesPromise` prop and `use()`; `const { clientId, invoices } = useMyInvoicesState()`. Keep the two empty-state cards (`!clientId` → `myInvoices.noClient…`, `invoices.length === 0` → `invoice.noInvoicesYet…`); render `<MyInvoicesList invoices={invoices} />`.

- [ ] **Step 3: Project column + details entry**

- `my-invoices-list.tsx`: after the Status `TableHead`, add `<TableHead>{t("common.project")}</TableHead>`.
- `my-invoices-row.tsx`: after the Status cell add `<TableCell className="text-xs">{invoice.projectName ?? "—"}</TableCell>` (add `text-muted-foreground` when null); `colSpan={5}` → `colSpan={6}`.
- `my-invoice-details.tsx`: add a grid entry — label `t("common.project")`, value `invoice.projectName ?? "—"`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm eslint app/app/mis-facturas components/my-invoices && pnpm vitest run actions/invoices.test.ts`
Expected: clean; manual spot-check `pnpm dev` → `/app/mis-facturas` renders the header instantly and the list after.

- [ ] **Step 5: Commit**

Commit `feat(my-invoices): back the route with the optimistic store + project column` (with permission).

---

### Task 6: Bind dialog + row action

**Files:**

- Create: `components/my-invoices/bind-project-dialog.tsx`
- Modify: `components/my-invoices/my-invoices-row.tsx` (Actions column, button, dialog mount; `colSpan` 6→7)
- Modify: `components/my-invoices/my-invoices-list.tsx` (Actions `TableHead`)
- Modify: `messages/en.json` + `messages/es.json` (`myInvoices.*`)

**Interfaces:**

- Consumes: Task 3 (`getProjects`), Task 4 (`useMyInvoicesActions().bindToProject`), `Dialog` from `components/common/dialog.tsx` (`{ title, description?, open, onOpenChange, children, className? }`), `ProjectDetailDTO`.
- Produces: `<BindProjectDialog invoice={MyInvoiceDTO} open={boolean} onOpenChange={(open: boolean) => void} />`; row owns `bindOpen` local state. Dialog never imports server mutations directly except through the actions hook, and never calls `toast`/`run`.

- [ ] **Step 1: Add translations (both locales)**

In `myInvoices` (en / es):

| key               | en                                          | es                                                        |
| ----------------- | ------------------------------------------- | --------------------------------------------------------- |
| `bindToProject`   | `Bind to Project`                           | `Vincular a proyecto`                                     |
| `bindTitle`       | `Bind to project`                           | `Vincular a proyecto`                                     |
| `bindDescription` | `Choose a project to link this invoice to.` | `Elige el proyecto al que quieres vincular esta factura.` |
| `noProject`       | `No project`                                | `Sin proyecto`                                            |
| `bind`            | `Bind`                                      | `Vincular`                                                |
| `clear`           | `Clear`                                     | `Quitar`                                                  |
| `noOwnedProjects` | `You don't own any projects yet.`           | `Aún no tienes proyectos propios.`                        |

(`bindSuccess` was added in Task 4.)

- [ ] **Step 2: Implement the dialog**

`bind-project-dialog.tsx` ("use client"):

- Props as in Interfaces. Local state: `projects: ProjectDetailDTO[]`, `loading: boolean`, `selected: string | null`.
- `useEffect` on `open`: when open, reset `selected` to `invoice.projectId`, set loading, call `getProjects()` with a cancellation flag (copy the fetch-with-cancel pattern from `my-invoices-row.tsx:75-105`); store `r.data ?? []`. Handle `r.serverError` by showing `myInvoices.noOwnedProjects` (its only realistic cause for this audience).
- Content: `myInvoices.noOwnedProjects` when the list is empty; otherwise a vertical list of selectable rows — first row `t("myInvoices.noProject")` with `selected === null`, then one row per project (`project.name`, `selected === project.id`), styled as buttons with `aria-pressed` and a selected ring/background (no new primitives — there is no radio-group component in `components/ui`).
- Footer: `Button variant="outline"` cancel (`t("common.cancel"))`) + confirm `Button`: label = `selected === null ? t("myInvoices.clear") : t("myInvoices.bind")`; `disabled={selected === invoice.projectId}`.
- Confirm handler: `onOpenChange(false)` first, then `void bindToProject(invoice.id, selected, selected === null ? null : projects.find(p => p.id === selected)?.name ?? null)` via `useMyInvoicesActions()`.

- [ ] **Step 3: Wire the row**

`my-invoices-row.tsx`:

- `const [bindOpen, setBindOpen] = useState(false)`.
- Add `TableHead` `t("common.actions")` in `my-invoices-list.tsx` (last) and a trailing `<TableCell>` in the row containing:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={(e) => {
    e.stopPropagation()
    setBindOpen(true)
  }}
>
  {t("myInvoices.bindToProject")}
</Button>
```

- Render `<BindProjectDialog invoice={invoice} open={bindOpen} onOpenChange={setBindOpen} />` inside the row's `Fragment`.
- `colSpan={6}` → `colSpan={7}`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm eslint components/my-invoices`
Expected: clean. Manual (`pnpm dev`): button does **not** expand the row; dialog lists owned projects (+ "No project"); bind/clear updates the Project column and details immediately; failure (e.g. stop the API) reverts with an error toast.

- [ ] **Step 5: Commit**

Commit `feat(my-invoices): bind-to-project row action and dialog` (with permission).

---

### Task 7: `getProjectInvoices` query

**Files:**

- Modify: `actions/schemas/invoice.ts` — `ProjectInvoiceSchema = z.object({ id: z.string(), invoiceNumber: z.string(), status: InvoiceStatusSchema, paidAmount: z.string(), issueDate: z.string() })` + `ProjectInvoiceDTO`
- Modify: `actions/invoices.ts` — new export after `bindInvoiceToProject`
- Test: `actions/invoices.test.ts`

**Interfaces:**

- Consumes: `projectScopedAction` (factory: `projectScopedAction(z.object({ projectId: z.uuid() }))` — see `actions/expenses.ts:46`), `InvoiceStatusSchema`.
- Produces: `export const getProjectInvoices = projectScopedAction(…).metadata({ permission: { module: "expenses", action: "view" } }).outputSchema(z.array(ProjectInvoiceSchema))` — selects `id, invoiceNumber, status, paidAmount, issueDate` where `projectId = input`, **no status filter**, `orderBy(invoicesTable.issueDate)`. Consumed by Tasks 8/10.

- [ ] **Step 1: Write the failing tests**

In `actions/invoices.test.ts` add the project-access mock (copy from `actions/__tests__/expenses.test.ts:8-10,42,53`): `vi.mock("@/actions/not-safe/project-access", () => ({ verifyProjectAccess: vi.fn() }))`, `mockVerifyProjectAccess`, and in `beforeEach` (after `vi.clearAllMocks()`): `mockVerifyProjectAccess.mockResolvedValue({ hasAccess: true, isOwner: true })`.

```ts
describe("getProjectInvoices", () => {
  it("returns bound invoices for an accessible project, including cancelled", async () => {
    const rows = [
      {
        id: INVOICE_ID,
        invoiceNumber: INVOICE_NUMBER,
        status: "cancelled",
        paidAmount: "0",
        issueDate: "2024-01-15",
      },
      {
        id: "…uuid…",
        invoiceNumber: "ALSIA-2",
        status: "paid",
        paidAmount: "220.00",
        issueDate: "2024-02-01",
      },
    ]
    state.mock.onSelect(schema.invoicesTable).respond(rows)
    const result = await getProjectInvoices({ projectId: PROJECT_ID })
    expect(result.data).toEqual(rows)
  })
  it("returns FORBIDDEN when project access is denied", async () => {
    mockVerifyProjectAccess.mockResolvedValue({
      hasAccess: false,
      isOwner: false,
    })
    const result = await getProjectInvoices({ projectId: PROJECT_ID })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run actions/invoices.test.ts` → FAIL (action missing).

- [ ] **Step 3: Implement**

As specified in Interfaces, placed after `bindInvoiceToProject`. Import `projectScopedAction` from `@/lib/safe-action` and the new schema/type.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run actions/invoices.test.ts` → PASS.

- [ ] **Step 5: Commit**

Commit `feat(invoices): add getProjectInvoices project-scoped query` (with permission).

---

### Task 8: expenses store gains the `invoices` slice

**Files:**

- Modify: `stores/expenses/expense-reducer.ts`
- Modify: `stores/expenses/expense-store.ts`
- Modify: `stores/expenses/use-expenses-state.ts`
- Modify: `components/projects/expenses/expenses-provider.tsx`
- Modify: `app/app/proyectos/[id]/gastos/page.tsx`
- Test: `stores/expenses/expense-store.test.ts`
- (Verify `stores/expenses/use-expenses-actions.ts` needs no change — it only dispatches; typecheck proves it.)

**Interfaces:**

- Consumes: `ProjectInvoiceDTO` (Task 7).
- Produces: `ExpenseStoreState = { expenses: ExpenseWithCategoryDTO[]; invoices: ProjectInvoiceDTO[] }` (export from `expense-reducer.ts`); `createExpensesStore(seed: ExpenseStoreState)` — still **no `serverSlice`** (both keys are server lists; whole state reseeds); `useExpensesState()` → `{ expenses, invoices, pending }`; `<ExpensesProvider expenses={…} invoices={…}>{children}</ExpensesProvider>`. Consumed by Task 9.

- [ ] **Step 1: Update the failing tests first**

`stores/expenses/expense-store.test.ts`: wrap every fixture state as `{ expenses: [...], invoices: [] }`; reducer cases operate on `state.expenses` (`expenseReducer({ expenses: [a], invoices: [] }, { type: "add", expense: b })` → `.expenses` equals `[b, a]`, `.invoices` unchanged); store tests pass the object seed; `reseedFromServer({ expenses: [b], invoices: [inv] })` replaces both. Add one case asserting an expense action leaves `invoices` untouched.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run stores/expenses` → FAIL (shape mismatch).

- [ ] **Step 3: Implement**

- `expense-reducer.ts`: add `ExpenseStoreState`; reducer signature takes/returns it; every case spreads state and maps `state.expenses`.
- `expense-store.ts`: `createExpensesStore(seed: ExpenseStoreState)`, `initialState: seed`; update the comment (both keys are server lists).
- `use-expenses-state.ts`: select `s.optimistic.expenses` and `s.optimistic.invoices` alongside `s.pending`; return `{ expenses, invoices, pending }`.
- `expenses-provider.tsx`: props `{ expenses, invoices, children }`; **must memoize the seed** — `const seed = useMemo(() => ({ expenses, invoices }), [expenses, invoices])`, then `useState(() => createExpensesStore(seed))` + `useServerReseed(store, seed)`. An inline object literal would give a fresh identity every render and reseed (wiping optimistic state) continuously.
- `gastos/page.tsx`: add `getProjectInvoices({ projectId: id })` to the `Promise.all`; pass `invoices={unwrapResponse(invoicesResult)}` to `ExpensesProvider`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run stores/expenses && pnpm typecheck && pnpm eslint stores/expenses components/projects/expenses app/app/proyectos` → clean.

- [ ] **Step 5: Commit**

Commit `feat(expenses): seed bound invoices into the expenses store` (with permission).

---

### Task 9: invoice rows in the expenses table + totals

**Files:**

- Modify: `components/projects/expenses/project-expenses.tsx`
- Modify: `components/projects/expenses/expenses-table.tsx`
- Modify: `messages/en.json` + `messages/es.json` (`common.invoice` = `Invoice` / `Factura`)

**Interfaces:**

- Consumes: Task 8 (`invoices` from `useExpensesState()`), `ProjectInvoiceDTO`.
- Produces: merged rows include `{ type: "invoice", invoice, date: invoice.issueDate }`; totals = expenses + task costs + `paidAmount` sum.

- [ ] **Step 1: Add the `common.invoice` key to both locales**

- [ ] **Step 2: Implement totals + merge in `project-expenses.tsx`**

- `const { expenses, invoices } = useExpensesState()`.
- `const invoicePaidTotal = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0)`.
- `const total = expenseTotal + taskCostTotal + invoicePaidTotal`; `const hasItems = expenses.length > 0 || taskCosts.length > 0 || invoices.length > 0`.
- Extend the `rows` array:

```ts
...invoices.map((invoice) => ({
  key: invoice.id,
  type: "invoice" as const,
  invoice,
  date: invoice.issueDate,
})),
```

(before the `.sort` — same pattern as the existing two).

- [ ] **Step 3: Implement the invoice variant in `expenses-table.tsx`**

- Extend `CombinedExpenseRow` with `| { key: string; type: "invoice"; invoice: ProjectInvoiceDTO; date: string }`.
- **Narrowing gotcha:** every existing `row.type === "task" ? row.task.x : row.expense.y` becomes a three-way chain (`task` / `expense` / `invoice`) or is guarded by `row.type !== "invoice" &&` — otherwise TS errors on `row.task`/`row.expense` for the invoice variant.
- Description cell: `row.invoice.invoiceNumber`.
- Type cell: invoice → `<Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{t("common.invoice")}</Badge>`.
- Amount cell: `<Money value={row.invoice.paidAmount} />`.
- Actions cell (only rendered when `canEdit || canDelete`): render nothing for invoice rows — `{row.type === "invoice" ? null : <ActionMenu … />}` (keep `entityName`/`onDelete` under a `row.type !== "invoice"` guard so TS narrows).

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm eslint components/projects/expenses` → clean. Manual: bind an invoice with `paidAmount 0` → row appears, budget bar/total unchanged; paid invoice → bar and card totals grow by the paid amount; cancelled invoice with paid > 0 still counts.

- [ ] **Step 5: Commit**

Commit `feat(projects): show bound invoices as spend in expenses` (with permission).

---

### Task 10: card aggregates include invoice paid amounts

**Files:**

- Modify: `actions/projects.ts:169-248` (the `Promise.all`) and `:310-313` (the fold) — inside `getProjectsWithDetails`
- Test: `actions/__tests__/projects.test.ts`

**Interfaces:**

- Consumes: `invoicesTable.paidAmount` (already imported in `actions/projects.ts`? verify — add to the schema import if not).
- Produces: project card `expenses` = expenses + task costs + invoice paid sums.

- [ ] **Step 1: Write the failing test**

New describe in `actions/__tests__/projects.test.ts`. The mock supports per-query responses via `respondWith((sql, params) => …)` (branch on SQL text) and records SQL — use both, because `tasksTable` is hit three times by this action (taskAggs → `count(`, taskCostAggs → `cost`, inProgress → else) and the invoice query must be proven to sum `paid_amount`:

```ts
describe("getProjectsWithDetails", () => {
  it("counts invoice paidAmount toward project spend", async () => {
    mockIsSuperUser.mockReturnValue(false)
    const PROJECT = {
      /* full ProjectDetailDTO fields for the base select */
    }
    state.mock.onSelect(schema.projectsTable).respond([PROJECT])
    state.mock
      .onSelect(schema.tasksTable)
      .respondWith((sql) =>
        sql.includes("count(")
          ? [{ projectId: PROJECT.id, total: 2, completed: 1 }]
          : sql.includes("cost")
            ? [{ projectId: PROJECT.id, total: "40" }]
            : []
      )
    state.mock
      .onSelect(schema.expensesTable)
      .respond([{ projectId: PROJECT.id, total: "50" }])
    let invoiceSql = ""
    state.mock.onSelect(schema.invoicesTable).respondWith((sql) => {
      invoiceSql = sql
      return [{ projectId: PROJECT.id, total: "30" }]
    })
    state.mock.onSelect(schema.projectOwnersTable).respond([])
    state.mock.onSelect(schema.projectCollaboratorsTable).respond([])

    const result = await getProjectsWithDetails()

    expect(result.data?.[0]?.expenses).toBe(120) // 50 expenses + 40 tasks + 30 invoices
    expect(invoiceSql).toContain("paid_amount")
    expect(invoiceSql).not.toContain("grand_total")
  })
})
```

If `respondWith`'s SQL branch conditions don't match the generated SQL on first run, inspect the failing output and adjust the branch strings (the mock prints the normalized SQL and the registered mocks). Likewise, if the mock reports "No mock registered" for `usersTable` (the in-progress/owner queries left-join it), add `state.mock.onSelect(schema.usersTable).respond([])`. `getProjectsWithDetails` and `ProjectDetailDTO` imports needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run actions/__tests__/projects.test.ts` → FAIL (`expenses` is 90, and/or no invoice SQL recorded — the query doesn't exist yet).

- [ ] **Step 3: Implement the aggregate**

In `getProjectsWithDetails`'s `Promise.all`, insert **after `taskCostAggs`, before `inProgressTasks`**:

```ts
db.select({
  projectId: invoicesTable.projectId,
  total: sql<string>`coalesce(sum(${invoicesTable.paidAmount}), '0')`,
})
.from(invoicesTable)
.where(inArray(invoicesTable.projectId, projectIds))
.groupBy(invoicesTable.projectId),
```

Destructure it as `invoicePaidAggs` in the same position; build `invoicePaidMap` like `expenseMap`; fold at the return: `const expenses = (expenseMap.get(p.id) ?? 0) + (taskCostMap.get(p.id) ?? 0) + (invoicePaidMap.get(p.id) ?? 0)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run actions/__tests__/projects.test.ts` → PASS.

- [ ] **Step 5: Commit**

Commit `feat(projects): include invoice paid amounts in card spend` (with permission).

---

### Task 11: Full verification + manual pass

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `pnpm verify`
Expected: typecheck + `eslint --max-warnings=0` + vitest coverage all pass (floors: 60% lines/functions/statements, 50% branches). Fix any fallout before proceeding.

- [ ] **Step 2: Manual end-to-end pass** (`pnpm dev`)

1. `/app/mis-facturas`: header paints before the list (streaming); each row shows the new Project column and the "Bind to Project" button; clicking the button does **not** toggle row expansion.
2. Dialog: lists only projects you own (and "No project"); preselects the current binding; confirm with unchanged selection is disabled; bind → row + expanded details update instantly with a success toast; rebind and clear work the same way.
3. Kill the server mid-bind (or use devtools to fail the request) → error toast and the row reverts.
4. `/app/proyectos/[id]/gastos`: the bound invoice appears as an "Invoice" badge row sorted by issue date (cancelled included); budget bar, footer total, and the projects list card budget all include the invoice's **paid** amount only.
5. Unbind → row disappears and totals drop back.
6. A role without `projects:view` (e.g. retailer) can still open the dialog and list owned projects.

- [ ] **Step 3: Report**

Summarize results to the user. **Do not commit anything that remains uncommitted without explicit permission.**
