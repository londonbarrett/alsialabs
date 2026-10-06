## Why

`my-tasks` is the one page holding optimistic state in `useState` instead of a page-scoped store, which the `optimistic-state` capability already requires ("Client-side optimistic state SHALL be held in a Zustand store created per route visit"). `handleStatusChange` performs a genuine optimistic write — it mutates `tasks` before the server confirms — so the state it writes is squarely in scope for the store pattern.

That gap is not merely academic:

- **Focus refresh cannot reach it.** `MyTasksView` seeds `useState(initialTasks)` once, and client state survives `router.refresh()`, so the `useRefreshOnFocus` it needs to show fresh tasks has nothing to deliver to. A refresh would re-render the page and discard the new props.
- **It corrupted a shared hook.** To reseed `my-tasks` alongside the real stores, `useServerReseed` had to be loosened from a typed Zustand call to a bare `(next) => void` callback, which let `useState`'s setter pass for a store's reseed method. That was a workaround, not a design: the hook read as a Zustand facility while accepting anything callable.
- **A focus reseed would break active filters.** The view filters by calling `getMyTasks({ statusFilter, projectIdFilter })`, so its list is a filtered projection while `initialTasks` is not. Replacing one with the other on refresh would leave the filter control saying "done" while the list showed everything.

## What Changes

- Add `stores/my-tasks/` — `my-tasks-reducer.ts`, `my-tasks-store.ts`, `use-my-tasks-state.ts`, `use-my-tasks-actions.ts`, `my-tasks-store.test.ts` — following the established factory/context/hook split.
- State is `{ tasks: MyTask[], commentsByTask: Record<string, TaskCommentWithAuthor[]> }`, mirroring project tasks. The store exposes `reseedFromServer(tasks)`, which adopts the server's list while preserving `commentsByTask`.
- Add `components/my-tasks/my-tasks-provider.tsx`, mounted by `app/app/mis-tareas/page.tsx`, seeded from `getMyTasks({})`.
- Move the comment panel onto the store: `MyTaskCommentsPanel` reads `commentsByTask` and its mutations adjust `commentCount` in the same action, so `MyTasksList` no longer needs an `onCommentCountChange` callback threaded up through two components.
- **Switch filtering from server-side to client-side.** `getMyTasks({})` already returns the full unfiltered set on load, and the action's filters are plain `WHERE` clauses, so nothing additional is shipped. The visible list is derived from `tasks` + the filter selects; `applyFilters` and its `getMyTasks` round trip are removed. This is what makes reseeding safe: the store always holds the full set, so a fresh seed can never contradict an active filter.
- Restore `useRefreshOnFocus()` on `MyTasksView`, now backed by a store that actually reseeds.
- Simplify `handleStatusChange`: it currently decides whether to insert `nextTask` by re-checking both filters against `tasks` (and hardcodes `commentCount: 0` on the inserted row). With a client-side projection, the full set is simply merged and the filter derives visibility.

## Capabilities

### Modified Capabilities

- `optimistic-state`: adds `MyTasksProvider` to the providers the route mounts; records that every page carrying optimistic state now goes through the provider/read-method contract.
- `project-management`: replaces the temporary description of `my-tasks` comment state (local `useOptimistic` "until that domain gets a store") with the store-backed behaviour.

## Impact

- Affected code: new `stores/my-tasks/*`, new `components/my-tasks/my-tasks-provider.tsx`, `components/my-tasks/my-tasks-view.tsx`, `components/my-tasks/my-tasks-list.tsx`, `components/my-tasks/my-task-comments-panel.tsx`, `app/app/mis-tareas/page.tsx`.
- `useServerReseed` regains its strict `ServerSeededStore<S, A, Seed>` signature with no bare-callback escape hatch.
- `onCommentCountChange` is deleted from `MyTasksList`'s props.
- `getMyTasks` keeps its optional `statusFilter`/`projectIdFilter` inputs — only the `my-tasks` view stops using them. No DB migration, no server-action signature change, no i18n changes.
- No behavioural change to `/app/calendario`, which also calls `getMyTasks({})` but does not filter.
