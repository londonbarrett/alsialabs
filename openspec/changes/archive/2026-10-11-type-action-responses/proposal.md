## Why

Server actions validate and type their **inputs** with Zod, but their **responses** are untyped: consumers infer shapes with `Awaited<ReturnType<typeof action>>["data"]`, hand-write interface mirrors, redeclare shapes at call sites, and cast `result.data as SomeType`. These types drift from the actions, duplicate each other across modules, and let a change in an action's return silently break consumers instead of failing at compile time.

## What Changes

- Add response (output) Zod schemas co-located in `actions/schemas/<domain>.ts` beside the input schemas, named in PascalCase as `<Thing>Schema` and exporting an inferred `<Thing>DTO` type, matching the existing input-schema convention.
- Attach `.outputSchema(...)` to every server action in `actions/` and `actions/not-safe/` so `result.data` is typed from the schema and validated at runtime.
- Type every action invocation from its output schema: remove `Awaited<ReturnType<...>>` derived types, hand-written mirror interfaces, and `as` casts on `result.data`.
- Remove redundant/derived types from `lib/types.ts`, action modules, stores, and components; keep only genuinely client-only types (e.g. `SettleResult`, form submit contracts) and types inferred from schemas.
- Add output-validation handling in `lib/safe-action.ts`: log the mismatch and keep the current generic error fallback (developer error, not user input).
- **BREAKING**: an action's `.data` is now the parsed output-schema value. `numeric`/`decimal` columns remain strings, `Date` columns remain `Date`, and void mutations that return `{ success: true }` get a trivial output schema.

## Capabilities

### New Capabilities
- `action-response-schemas`: the response-schema convention, the requirement that every action declares an output schema, that action invocations are typed from it, and that no duplicate action types remain.

### Modified Capabilities
- `safe-actions`: the action clients validate every action's return value against its declared output schema and surface mismatches as a logged server error.

## Impact

- **Schemas**: `actions/schemas/*` (add response schemas; possibly split shared shapes).
- **Actions**: `actions/**` (~108 actions across 22 modules), including `actions/not-safe/**`.
- **Types**: `lib/types.ts` (shrink to client-only), remove derived/hand-written action types across stores and components.
- **Consumers**: `stores/*/use-*-actions.ts`, `hooks/`, `lib/util/unwrap.ts`, ~98 component call sites; tests under `actions/__tests__` and `actions/*.test.ts`.
- **Infra**: `lib/safe-action.ts` (output-validation handling).
