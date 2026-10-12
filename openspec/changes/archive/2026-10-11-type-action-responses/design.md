## Context

See `proposal.md - Why`. Today inputs are validated by Zod schemas in `actions/schemas/<domain>.ts` while responses are untyped: `actions/projects.ts:93` derives `ProjectWithCategory` from `Awaited<ReturnType<typeof getProjects>>["data"]`, `actions/invoices.ts` and `actions/clients.tsx` hand-write mirror interfaces, components redeclare the same rows (`InvoiceWithClientName` in `components/sales/sales-invoice-table.tsx:18`), and store hooks cast parsed data (`stores/invoice/use-invoice-actions.ts:68`).

The stack is `next-safe-action` 8.6.1 (supports `.outputSchema(...)`, validated via StandardSchema) over Zod 4.4.3, Next 16.2.9. `lib/safe-action.ts` builds `actionClient` with a `handleServerError` that maps unexpected errors to `{ code: "FORBIDDEN" }` and logs `[safe-action]`.

## Goals / Non-Goals

**Goals:**
- One Zod schema per response shape, co-located with the matching input schema, exporting an inferred `<Thing>DTO` type as the single source (`XSchema` is the validator, `XDTO` the data shape).
- Every safe action declares `.outputSchema(...)`; `.data` is typed and runtime-validated.
- Every consumer reads `result.data` without casts, `Awaited<ReturnType<...>>`, or local mirrors.
- Redundant action types removed repo-wide.

**Non-Goals:**
- Migrating `actions/not-safe/*` to safe-action clients (tracked by the existing safe-actions migration). Not-safe actions get schema-inferred **return type annotations** only, no runtime output validation.
- Changing any action's returned data — schemas describe the current shapes exactly; no coercions or transforms that change values.
- Changing permission/auth/revalidation behavior.

## Decisions

### Co-locate output schemas and infer types
Response schemas live in the existing `actions/schemas/<domain>.ts`, named in PascalCase as `<Thing>Schema` with an exported `z.infer` type `<Thing>`, matching input-schema convention. Shared rows are defined once and composed with `.extend`/`.pick`/`.omit`.
- **Why over a `responses/` folder**: one domain module, imports already point at it, and inputs/outputs are read together.
- **Why over per-action files**: avoids a file explosion and keeps composition local.

### Use `.outputSchema()` for every safe action
Add `.outputSchema(schema)` after `.inputSchema(...)` in each safe-action chain. next-safe-action parses the handler's return, replaces `data` with `parsed.value`, and types `SafeActionResult["data"]` from the schema.
- **Why over manual `as` return annotations**: gives both compile-time typing and runtime validation from one declaration.
- **Why over `satisfies` type-only**: user chose runtime validation so drift in a Drizzle select is caught, not just typed.

### Model the exact serialized value; no transforms
Schemas mirror Drizzle's inferred TS types: `timestamp` columns are `z.date()`, `date`/`text` columns are `z.string()`, `numeric`/`decimal` are `z.string()`, `sql<number>` aggregates are `z.number()`, `sql<string>` sums are `z.string()`. No `.transform()` is used on outputs, so the parsed payload equals the returned payload and the client type is exact.
- **Why**: `.outputSchema` validates before Next serializes, so `z.date()` is correct; transforms would silently rewrite data.

### Output mismatches are logged, not surfaced
next-safe-action throws `ActionOutputDataValidationError` for a mismatch; it is not a server-validation error, so it reaches `handleServerError`. Keep `handleServerError` returning the existing generic `{ code: "FORBIDDEN" }`, adding a clear `[safe-action] output validation` log line so the bug is diagnosable without changing the client contract or translations.
- **Why over a dedicated `INTERNAL_ERROR` code**: user chose the smaller change; a mismatch is a developer bug and should not add a user-facing code path.
- **Alternative**: a distinct code with translation — rejected as unnecessary surface.

### Not-safe actions are typed by annotation only
Plain `"use server"` functions in `actions/not-safe/*` annotate their return type as the schema-inferred type (`Promise<ReminderRecordDTO[]>`), so consumers share the same single source, but the function is not runtime-validated. When a module later migrates to a safe-action client, it adopts `.outputSchema(...)` unchanged.
- **Why over wrapping now**: avoids invasive rewrites before the module is migrated, while still eliminating duplicate types.

### Delete redundant types; keep client-only ones
Remove `Awaited<ReturnType<...>>` derived types (`ProjectWithCategory`, `ProjectDetailDTO`, `MyTaskDTO`, `MyInvoicesResult`, `StoreOptionDTO`, `UserStore`, `InvoiceProductOption`) and hand-written mirrors (`ClientOptionDTO`, `UserWithRoleDTO`/`UserOptionDTO`, `ClientInvoice`/`InvoiceWithClient`/`MyInvoice`, `PermissionMatrixItemDTO`, `ClientTimelineEntryDTO`, `ReminderRecordDTO`, `ProjectOwnerDTO`/`ProjectCategoryOption`/`ProjectContextDTO`, `UpsertActivityResultDTO`, `lib/types.ts` response shapes, component-local duplicates). Keep `lib/types.ts` only for genuinely client-only types (`SettleResult`, submit contracts, UI metadata) and schema-inferred re-exports.
- **Why**: the schema is the single source; anything restating it is drift risk.

## Risks / Trade-offs

- **Schema must match the serialized value exactly, or reads break at runtime.** → Model from Drizzle inferred types; add one schema per action and run `tsc` + tests per domain batch before moving on.
- **`sql<number>` vs `sql<string>` aggregates are easy to get wrong** (counts are numbers, `sum`/`coalesce` are strings). → Verify each aggregate against the existing `Awaited<ReturnType<...>>` type it replaces; the compiler catches mismatches once consumers stop casting.
- **Large diff across ~108 actions and ~98 call sites.** → Land in per-domain batches (schema + actions + consumers + tests) so each batch is independently green and revertable; keep the infra change (`safe-action.ts`) in its own commit.
- **Output parsing adds per-call overhead.** → Negligible for these payload sizes; schemas are module-level constants (not rebuilt per call).
- **Two sources during migration** (schema-inferred and not-yet-removed mirror) could diverge mid-flight. → Remove each mirror in the same batch that introduces its schema.

## Migration Plan

Incremental, per domain; each batch ends with `npx tsc --noEmit`, targeted `npx eslint`, and `npx vitest run` green:
1. Infra: output-validation logging in `lib/safe-action.ts` + a test.
2. Foundation: shared output schemas for cross-cutting rows (invoice-with-client, task-with-comment-count, project summary/detail, store option, user, permission matrix, timeline/calendar).
3. Domains in batches: schemas → `.outputSchema` → consumers → delete mirrors → tests.
4. Final cleanup: shrink `lib/types.ts`, delete `lib/util/unwrap.ts` if fully unused, run full typecheck/lint/tests.

Rollback: each batch is a revertible commit; no database or data changes.

## Open Questions

None.
