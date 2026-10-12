## Purpose

Define the response (output) schema convention for server actions so every action's data payload is validated and typed from a single Zod schema, and no duplicate action types remain.

## ADDED Requirements

### Requirement: Response schemas co-located with input schemas

Every server action SHALL declare the shape of its returned data with a Zod output schema. Output schemas SHALL live in `actions/schemas/<domain>.ts`, beside the action's input schema, SHALL be named in PascalCase as `<Thing>Schema`, and SHALL export an inferred `<Thing>DTO` type using `z.infer`. When several actions return the same row shape, that shape SHALL be defined once and reused through schema composition (`.extend`, `.pick`, `.omit`) rather than redeclared.

#### Scenario: A response schema sits beside its input schema

- **WHEN** a domain module such as `actions/schemas/project.ts` is read
- **THEN** it exports both the input schemas (`CreateProjectSchema`, `UpdateProjectSchema`) and the output schemas for the data its actions return (`ProjectSummaryDTO`, `ProjectDetailDTO`), each with an inferred `<Thing>DTO` type

#### Scenario: A shared row shape is defined once

- **WHEN** two actions return the same invoice-with-client row
- **THEN** a single schema describes it and the actions extend or reference that schema instead of each declaring a second copy

#### Scenario: Client-only types stay hand-written

- **WHEN** a type describes a client-only concept such as `SettleResult` or a form submit contract
- **THEN** it MAY remain hand-written, because it does not restate an action's response

### Requirement: Every action declares an output schema

Every server action — query, mutation, and `actions/not-safe/**` alike — SHALL declare its return shape with an output schema. Safe actions SHALL attach `.outputSchema(...)` to their client chain, including actions that return `{ success: true }` for a void mutation. The declared schema SHALL match the exact serialized value the action returns, so `numeric`/`decimal` columns remain strings and `Date` columns remain `Date`.

#### Scenario: A query action declares its output

- **WHEN** `getProjects` returns a list of project rows
- **THEN** it declares an output schema for those rows and `result.data` is typed and validated from it

#### Scenario: A void mutation declares its output

- **WHEN** `deleteProject` returns `{ success: true as const }`
- **THEN** it declares an output schema for that envelope

#### Scenario: A not-safe action declares its output

- **WHEN** a plain `"use server"` function in `actions/not-safe/` returns data
- **THEN** it declares its return shape from the same co-located response schemas so its consumers stay typed

### Requirement: Invocations are typed from the output schema

Every action invocation SHALL obtain its result payload from the action's output-schema type. Code SHALL NOT derive payload types with `Awaited<ReturnType<typeof action>>["data"]`, SHALL NOT redeclare an interface that mirrors the returned shape, and SHALL NOT cast `result.data` with `as`. Removing or renaming a field in a response schema SHALL be a compile error at every call site.

#### Scenario: Removing a schema field breaks consumers at compile time

- **WHEN** a field is removed from a response schema
- **THEN** every consumer of that action's `.data` fails type-checking rather than silently using an undefined field

#### Scenario: No casts at the call site

- **WHEN** a store action hook reads a fetched row from `result.data`
- **THEN** it uses the inferred type directly, with no `as SomeType` assertion

### Requirement: No redundant action types

A type that only restates an action's response shape SHALL be deleted and replaced by the schema-inferred type. This includes derived types (`Awaited<ReturnType<...>>`) and hand-written interface mirrors in `lib/types.ts`, action modules, stores, and components.

#### Scenario: A mirror interface is deleted

- **WHEN** an interface such as a hand-written row shape duplicates what an action returns
- **THEN** it is removed and importers use the schema-inferred type instead

#### Scenario: Duplicated component-local types are consolidated

- **WHEN** two components each declare a local type for the same action payload
- **THEN** both are replaced by the single schema-inferred type
