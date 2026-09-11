## ADDED Requirements

### Requirement: Unified session action
The system SHALL provide a single `sessionAction` safe-action client that authenticates the session, optionally checks `metadata.permission` via `hasPermission`, and handles revalidation. `basicAction` SHALL be removed; all former `basicAction` usages (categories, products, etc.) SHALL migrate to `sessionAction`.

#### Scenario: Authenticated access required
- **GIVEN** no session
- **WHEN** any `sessionAction` is called
- **THEN** it returns `UNAUTHORIZED` via `returnActionError` without calling `hasPermission`

#### Scenario: Permission check when metadata present
- **GIVEN** an authenticated user without the required permission
- **WHEN** a `sessionAction` with `metadata.permission` is called
- **THEN** it returns `FORBIDDEN`
- **AND** `hasPermission` is called with `module:action`

#### Scenario: No permission metadata skips check
- **GIVEN** an authenticated user
- **WHEN** a `sessionAction` with empty `metadata` is called
- **THEN** `hasPermission` is not called and the action runs

### Requirement: Template revalidation
`sessionAction` SHALL support template paths in `metadata.revalidate` like `"/app/proyectos/:projectId"` and `"/app/proyectos/:id"` interpolated AFTER the action commits from `parsedInput`/`clientInput` and `data`.

#### Scenario: Dynamic revalidation from input
- **GIVEN** `sessionAction` with `revalidate: ["/app/proyectos", "/app/proyectos/:projectId"]`
- **WHEN** `updateProject` with `projectId=123` succeeds
- **THEN** `revalidatePath("/app/proyectos")` and `revalidatePath("/app/proyectos/123")` are called

#### Scenario: Dynamic revalidation from result
- **GIVEN** `sessionAction` with `revalidate: ["/app/proyectos", "/app/proyectos/:id"]`
- **WHEN** `createProject` returns `{id: "new-id"}` 
- **THEN** `revalidatePath("/app/proyectos/new-id")` is called

#### Scenario: Create does not revalidate detail
- **WHEN** `createProject` succeeds
- **THEN** only `"/app/proyectos"` is revalidated (no `"/app/proyectos/:id"`), as the detail page has not been cached

#### Scenario: Delete does not revalidate detail
- **WHEN** `deleteProject` with `projectId=123` succeeds
- **THEN** only `"/app/proyectos"` is revalidated, the deleted `"/app/proyectos/123"` is 404 and not revalidated

### Requirement: Derived actions
`storeAction`, `projectAction`, and `projectScopedAction` SHALL extend `sessionAction` (not `basicAction`), and `adminAction` SHALL remain `actionClient` with `isSuperUser` guard.

#### Scenario: Store action inherits auth
- **WHEN** `storeAction` is called
- **THEN** `sessionAction` auth runs first, then `getEffectiveStoreId` provides `ctx.storeId` and `ctx.session`

#### Scenario: Project scoped action
- **WHEN** `projectScopedAction` with `projectId` is called
- **THEN** `verifyProjectAccess` checks membership and injects `isProjectOwner`
