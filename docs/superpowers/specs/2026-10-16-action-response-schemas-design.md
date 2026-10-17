# Action response schemas — Design

## Why this exists

Server actions are the seam between the database and the UI, and in the past the shape of what they returned was described in more than one place: a hand-written interface in `lib/types.ts`, a derived `Awaited<ReturnType<typeof action>>["data"]` at a call site, or a component-local type that happened to mirror the same row. Each copy could drift from what the action actually sent, and a field that was removed or renamed on the server would keep type-checking at consumers that read an out-of-date mirror. This capability makes a single Zod output schema the one source of truth for each action's return shape, so the payload type is inferred rather than restated.

Co-locating response schemas with the existing input schemas keeps a domain's whole contract in one file, and naming them consistently (`ProjectSummaryDTO`, `ProjectDetailDTO`) makes the return type of an action obvious at a glance. The convention is enforced through typing rather than a lint rule: because payloads come from the schema, deleting a field becomes a compile error everywhere it was used.

## Goals

- Declare every action's returned data with a Zod output schema, co-located with its input schema.
- Type every action invocation from that schema, so a removed or renamed field breaks the build.
- Delete types that only restate an action's response shape.

## Design

### Response schemas live beside input schemas

Output schemas sit in the same domain module as the action's inputs, at `actions/schemas/<domain>.ts`. `actions/schemas/project.ts`, for example, exports both its input schemas (`CreateProjectSchema`, `UpdateProjectSchema`) and the output schemas for the data its actions return, such as `ProjectSummaryDTO` and `ProjectDetailDTO`. Output schemas are named in PascalCase as `<Thing>Schema`, and each exports an inferred `<Thing>DTO` type through `z.infer`. When two actions return the same row — say an invoice joined with its client — that shape is defined once and reused through schema composition (`.extend`, `.pick`, `.omit`) rather than each action declaring its own copy.

Not every type needs to be an output schema. A type that describes a client-only concept, such as `SettleResult` or a form submit contract, does not restate an action's response and may stay hand-written.

### Every action declares its output

Queries, mutations, and the plain `"use server"` functions in `actions/not-safe/**` all declare their return shape with an output schema. A safe action attaches `.outputSchema(...)` to its client chain, and that includes void mutations, which declare an output even when they return only `{ success: true }`. A query such as `getProjects` declares a schema for its list of project rows so that `result.data` is typed and validated from it, and a not-safe action that returns data declares its return shape from the same co-located response schemas so its consumers stay typed.

The declared schema has to match the exact serialized value the action returns. `numeric` and `decimal` columns stay strings across the boundary, and `Date` columns stay `Date`, so the schema describes the value as it actually crosses the server/client split rather than the underlying column type.

### Invocations are typed from the output schema

Every action invocation gets its result payload from the action's output-schema type. Code does not derive payload types with `Awaited<ReturnType<typeof action>>["data"]`, does not redeclare an interface that mirrors a returned shape, and does not cast `result.data` with `as`. The benefit is the failure mode: removing or renaming a field in a response schema becomes a compile error at every call site, so a consumer can never silently read an undefined field. A store action hook that reads a fetched row from `result.data` uses the inferred type directly, with no assertion.

### No redundant action types

Any type that exists only to restate an action's response shape is deleted and replaced by the schema-inferred type. That covers derived types like `Awaited<ReturnType<...>>` and hand-written interface mirrors wherever they appear — in `lib/types.ts`, action modules, stores, and components. If two components each declare a local type for the same action payload, both are replaced by the single inferred type.

## Non-goals

- Describing client-only concepts such as `SettleResult` or form submit contracts. Those do not restate an action response and remain hand-written.
- Runtime behavior on the server. This capability governs the shape and typing of responses; validating them against the schema is the job of the safe-action clients.
