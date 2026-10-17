# Safe actions — Design

## Why this exists

Almost every server action in the app needs the same three things before its body runs: prove there is a session, optionally prove the caller holds a permission, and, after it commits, tell Next.js which pages changed. That preamble was previously duplicated or split between clients, and a separate `basicAction` client existed for actions that only needed part of it. This capability collapses the authenticated path into one `sessionAction` client so that authentication, permission checks, and revalidation are defined once and cannot be forgotten per action.

Revalidation is the other half. Because many mutations affect both a list page and a detail page, paths need to be recomputed after the action succeeds, and the detail segment often comes from the input (`projectId`) or the freshly-created row (`id`) that only exists once the action returns. `sessionAction` supports template paths that are interpolated after commit, and it deliberately revalidates only what has actually been cached.

## Goals

- Provide a single `sessionAction` client that authenticates, checks an optional permission, and revalidates.
- Support template revalidation paths resolved after the action commits.
- Derive store, project, and project-scoped clients from `sessionAction`.
- Validate every action's returned data against its declared output schema.

## Design

### One authenticated session action

`sessionAction` is the single safe-action client for authenticated work. It authenticates the session first, then optionally checks `metadata.permission` through `hasPermission`, then handles revalidation. The old `basicAction` is gone, and every former usage — categories, products, and the rest — migrates to `sessionAction`.

If there is no session, the action returns `UNAUTHORIZED` through `returnActionError` and never reaches the permission check. When the caller is authenticated but lacks the permission named in `metadata.permission`, it returns `FORBIDDEN`, and `hasPermission` is invoked with the `module:action` code. When `metadata` carries no permission, the check is skipped entirely and the action runs — an authenticated user with empty metadata is allowed through without a call to `hasPermission`.

### Template revalidation resolved after commit

`metadata.revalidate` accepts template paths such as `"/app/proyectos/:projectId"` and `"/app/proyectos/:id"`. Interpolation happens after the action commits, drawing segments from `parsedInput`/`clientInput` and from the action's returned `data`. For a `sessionAction` configured with `revalidate: ["/app/proyectos", "/app/proyectos/:projectId"]`, an `updateProject` with `projectId=123` calls `revalidatePath("/app/proyectos")` and `revalidatePath("/app/proyectos/123")`; a `createProject` that returns `{id: "new-id"}` against `revalidate: ["/app/proyectos", "/app/proyectos/:id"]` calls `revalidatePath("/app/proyectos/new-id")`.

Revalidation is scoped to what was cached, not to a blanket set of paths. A `createProject` revalidates only `"/app/proyectos"`, because the detail page has not been cached yet. A `deleteProject` with `projectId=123` likewise revalidates only `"/app/proyectos"`: the deleted `"/app/proyectos/123"` is now a 404 and there is nothing there to revalidate.

### Derived action clients

`storeAction`, `projectAction`, and `projectScopedAction` all extend `sessionAction`, so they inherit its authentication, permission, and revalidation behavior. `storeAction` runs the session gate first, then `getEffectiveStoreId` supplies `ctx.storeId` and `ctx.session`. `projectScopedAction` with a `projectId` runs `verifyProjectAccess` to check membership and injects `isProjectOwner`. It is valid to use `projectScopedAction` without `metadata.permission`: project access is still verified, but `hasPermission` is not called, and the action enforces its own domain rules — ownership, for instance — in place of a global permission.

`adminAction` is the exception. It remains an `actionClient` with an `isSuperUser` guard rather than extending `sessionAction`, because its authorization is the super-user check rather than a session-scoped module permission.

### Output schema validation

The safe-action clients validate every action's returned data against its declared output schema before the result leaves the server. When the data conforms, `result.data` is the parsed value and the action succeeds as normal. A mismatch is treated as a developer error rather than input the user got wrong: it is logged server-side and surfaces through the existing generic server-error handling. It is not exposed as a user-facing validation error, and it does not throw to the client.

## Non-goals

- Defining or authoring the output schemas themselves. This capability consumes the schemas described in the action-response-schemas design.
- A shared authenticated path for `adminAction`. It stays on `actionClient` with its `isSuperUser` guard.
