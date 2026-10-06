## Context

`MyTasksView` (`components/my-tasks/my-tasks-view.tsx`) holds `tasks` in `useState(initialTasks)` and writes to it three ways: `applyFilters` replaces the list from a filtered `getMyTasks` call, `handleStatusChange` optimistically patches a row and then optionally merges `nextTask`, and `handleCommentCountChange` adjusts a count from the comment panel two levels down in `MyTasksList`. The comment panel keeps its own second `useState` plus `useOptimistic` for `TaskCommentWithAuthor[]`.

The page therefore owns optimistic state that no other route reaches: `router.refresh()` re-runs `app/app/mis-tareas/page.tsx`, which passes a new `initialTasks` array, but nothing reads it after mount. Adding `useRefreshOnFocus` alone would fetch and discard.

Meanwhile `useServerReseed` had to be typed `(next) => void` precisely so `setTasks` could stand in for a store's reseed method. Every other consumer passes `store.reseedFromServer`, so the callback parameter exists only to accommodate this one page.

Constraints: the shared hook must become Zustand-specific; no server-action or schema change; no DB migration; project tasks and my tasks stay separate domains.

## Goals / Non-Goals

**Goals:**

- Give `my-tasks` the same store shape project tasks already has: factory `createMyTasksStore(seed)`, `XStoreContext`, `useMyTasksStore()` that throws without a provider, reactive reads through `useStore` and imperative reads through `getState`.
- Expose `reseedFromServer(tasks)` typed as `ServerSeededStore<S, A, Seed>`, so `useServerReseed(store, initialTasks)` works with no callback parameter.
- Make focus refresh correct *with filters applied*, not only on the default view.
- Fold comment state into the store so `commentCount` and `commentsByTask` cannot drift, and delete the `onCommentCountChange` callback chain.
- Bring `openspec/specs/optimistic-state` and `openspec/specs/project-management` back in line with the code.

**Non-Goals:**

- No change to `getMyTasks`'s signature or to `/app/calendario`.
- No pagination or virtualisation for the task list.
- No shared reducer between project tasks and my tasks.
- No URL-backed filters; that stays an open question below.

## Decisions

**1. Mirror project tasks' store shape rather than share it**

`MyTask` is not `TaskWithCommentCount`: it carries `projectColor`, `isOwner`, `projectOwnerName`, and is assembled by `getMyTasks`'s join, whereas `TaskWithCommentCount` is a `Task` row plus a count. Reusing one reducer would need a union or a mapping layer on every action, and the two domains are deliberately separate (the comments panels are separate components for the same reason). Duplicating ~200 lines of reducer keeps each store independently evolvable; the duplication is visible and traceable.

**2. Filtering moves client-side — this is what makes reseeding safe**

This is the load-bearing decision. `getMyTasks({})` with no inputs already returns *every* task assigned to the session user; the filter arguments are plain `WHERE` clauses and the page already ships the complete set on first render. So client-side filtering ships no additional data and removes a round trip.

If filtering stayed server-side, a focus reseed would replace a filtered projection with the unfiltered seed and the `Select` would report a filter the list no longer honoured. Deriving the visible list from `tasks` + the local filter selects means the store always holds the full set, so any fresh seed is always a valid base. `applyFilters` and its `startTransition` fetch are deleted.

`handleStatusChange` simplifies for the same reason: today it re-checks `statusFilter` and `projectFilter` by hand to decide whether `nextTask` belongs in the list, and inserts it with `commentCount: 0` hardcoded under a `as unknown as MyTask` cast. With the full set in the store it merges unconditionally and visibility follows from the projection. The merge keeps the *completed* task's count (only its status changed) and gives the new occurrence `commentCount: 0`, since it is brand new — the value was never wrong, only hard-wired and filter-gated.

**3. Filters stay local UI state, not store state**

`statusFilter` and `projectFilter` are not server-seeded and not optimistic — they are what `MyTaskCommentsPanel`'s draft text and `editingId` are, and those live in the component. Keeping them local keeps the store's contract narrow: server-backed data plus optimistic writes. It also means a reseed never has to reason about filter state.

**4. Comment count moves into the action, mirroring project tasks**

`MyTaskCommentsPanel` currently reports count deltas upward through `MyTasksList` via `onCommentCountChange`. Once comments live in `store.commentsByTask`, each comment mutation adjusts `count` in the *same* action, so a rejected comment rolls the count back with it — the same invariant project tasks already tested. The prop is deleted from `MyTasksList`.

**5. `reseedFromServer` preserves `commentsByTask`**

Consistent with every other store: the server sent `tasks`, not comments. Comments load when a panel opens, so a reseed that replaced the whole state would make an open panel refetch.

## Risks / Trade-offs

- **Client-side filtering ships the full list** → It already does; `initialTasks` is unfiltered today. The only new cost is that a filtered view no longer narrows the network response, which buys correctness on refresh. If the list ever grows to need server-side paging, filtering must move back and the seed then has to carry the active filters (see Open Questions).
- **Duplicated reducer drifts from project tasks'** → Accepted for domain independence. Both live under `stores/` with tests, so a shared bug surfaces twice.
- **`getMyTasks`'s filter inputs become unused by the UI** → Left in place; removing server inputs is a separate, additive-free change and the schema may serve future callers.
- **Optimistic status change can now diverge from a stale seed** → The seed is fresh on focus, and a pending action always replays over the new base, so this is the same guarantee every other store has.

## Migration Plan

1. Add `stores/my-tasks/` and its tests; keep the view working by copying `initialTasks` in.
2. Add `MyTasksProvider`, mount it from `app/app/mis-tareas/page.tsx`.
3. Point `MyTasksView` at the store; delete `applyFilters`' fetch and derive the visible list.
4. Move comment state into the store; delete `onCommentCountChange`.
5. Restore `useRefreshOnFocus()` on `MyTasksView`.
6. Verify `tsc`, targeted ESLint, `vitest`, plus the cross-store, callable-store and provider-mount audits.

Rollback: revert the view to `useState` and unmount the provider; the server action and page data fetch are unchanged throughout, so there is no persisted state to unwind.

## Open Questions

- Should filters move to URL search params? That would make `router.refresh()` refetch with the active filters server-side, restoring narrow network responses and adding shareable URLs — at the cost of query-param plumbing on every filter change.
- Once no caller filters `getMyTasks` server-side, should `statusFilter`/`projectIdFilter` be removed from its input schema?
