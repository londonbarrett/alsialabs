## 1. Store

- [x] 1.1 Create `stores/my-tasks/my-tasks-reducer.ts` — state `{ tasks: MyTask[], commentsByTask: Record<string, TaskCommentWithAuthor[]> }`, seeded with `tasks` and an empty `commentsByTask`; actions for `updateTaskStatus`, `addNextTask`, `setComments`, `addComment`, `replaceTempComment`, `deleteComment`, `updateComment`, each adjusting `commentCount` in the same action as the comment mutation. No `setTasks`: whole-list replacement is `reseedFromServer`'s job and no other caller replaces the list.
- [x] 1.2 Create `stores/my-tasks/my-tasks-store.ts` — `createMyTasksStore(tasks)` from `createOptimisticStore`, `Object.assign`-ing `reseedFromServer(next: MyTask[])` that replaces `tasks` and preserves `commentsByTask`; export `MyTasksStoreContext` and `useMyTasksStore()` throwing `"useMyTasksStore must be used within a MyTasksProvider"`
- [x] 1.3 Create `stores/my-tasks/use-my-tasks-state.ts` — `useStore` selectors for `tasks` and `getComments(taskId)`, returning the stable `EMPTY_COMMENTS` fallback
- [x] 1.4 Create `stores/my-tasks/use-my-tasks-actions.ts` — the comment and status mutations, the `loadComments` fetch, and `updateTaskStatus` driven through `useOptimisticAction`, reading `projectId` as an explicit argument rather than from another store folder

## 2. Provider and page

- [x] 2.1 Create `components/my-tasks/my-tasks-provider.tsx` — lazy `useState(() => createMyTasksStore(tasks))`, publishing through `MyTasksStoreContext`, plus `useServerReseed(store, tasks)`
- [x] 2.2 Mount `MyTasksProvider` around `MyTasksView` in `app/app/mis-tareas/page.tsx`, seeded from `getMyTasks({})`. `MyTasksView` no longer takes `initialTasks`; only the provider receives server props, matching `tasks-card`.
- [x] 2.3 Confirm no `eslint-disable` and no render-phase read of `ref.current` in the provider

## 3. View

- [x] 3.1 Replace `useState(initialTasks)` in `MyTasksView` with `useProjectTasksState`-style reads from `useMyTasksState()`. The `initialTasks` prop is dropped: only the provider receives server props now, and `tasks-card` sets the precedent for a store-backed view.
- [x] 3.2 Derive the visible list with `useMemo` over `tasks` + `statusFilter` + `projectFilter`; delete `applyFilters` and its `startTransition` `getMyTasks` call. `isPending` is now `isLoading` from `useLoadingIndicator`, since no transition remains.
- [x] 3.3 Delete the manual `matchesStatus` / `matchesProject` branch in `handleStatusChange` and merge `nextTask` unconditionally through the `addNextTask` action, which copies the project fields off the completed row and gives the new occurrence `commentCount: 0`
- [x] 3.4 Move `handleCommentCountChange` into the store action; remove the `onCommentCountChange` prop from `MyTasksList`
- [x] 3.5 Restore `useRefreshOnFocus()` on `MyTasksView`. The reseed it drives lives in `MyTasksProvider` (`useServerReseed(store, tasks)`), not the view.

## 4. Comment panel

- [x] 4.1 Rewrite `components/my-tasks/my-task-comments-panel.tsx` as a store controller over `TaskCommentsSheet`, mirroring `ProjectTaskCommentsPanel`: `useState` only for the `loading` flag and the open-transition ref, no `useOptimistic` and no local `comments` state
- [x] 4.2 Drop `onCommentCountChange` from `MyTasksList` and from the panel's props
- [x] 4.3 Verify a rejected comment rolls `commentCount` back with it, and that an open panel does not refetch on reseed — covered by `stores/my-tasks/my-tasks-store.test.ts` ("rolls commentCount back with the comment when the action is discarded", "keeps comments that were already loaded")

## 5. Specs

- [x] 5.1 `openspec/specs/optimistic-state/spec.md` — add `MyTasksProvider` to the provider list mounted by its page (`app/app/mis-tareas/page.tsx`)
- [x] 5.2 `openspec/specs/project-management/spec.md` — replace the sentence saying my-tasks keeps local `useOptimistic` "until that domain gets a store" with the store-backed behaviour (both MODIFIED requirement bodies applied from the deltas; the matching stale comment in `project-task-comments-panel.tsx` was corrected too)
- [x] 5.3 Archive-time sync: all three delta requirement bodies are byte-identical to their permanent-tree counterparts, and the optimistic-state delta no longer duplicates the `No lint suppression in providers` scenario (which stays under `A reseed adopts server data without discarding pending work`), so archiving is a no-op for specs

## 6. Verification

- [x] 6.1 `npx tsc --noEmit` clean
- [x] 6.2 Targeted `npx eslint` on `stores/my-tasks/`, `components/my-tasks/`, `app/app/mis-tareas/`, `e2e/my-tasks.spec.ts` — exit 0, no problems. Repo-wide on `hooks/ stores/ components/ lib/ e2e/` still shows only pre-existing issues: `hooks/use-mobile.ts:14` (error), `lib/actions/payments.test.ts:29` and `e2e/auth.spec.ts:3` (warnings). A full `eslint .` adds 4 more in `.agents/skills/`, none of them mine.
- [x] 6.3 `npx vitest run` green — 283 tests / 20 files, including the 16 new ones in `stores/my-tasks/my-tasks-store.test.ts` covering comment-count atomicity and `reseedFromServer` preserving `commentsByTask`
- [x] 6.4 Audits: no `@/stores/*` folder imports a sibling, no store called as a function, provider mounted by the page (and not by `MyTasksView`), no `eslint-disable`
- [x] 6.5 Manual: changing a filter narrows the list without a network call; focusing the tab refreshes an unfiltered list; a filtered list stays filtered after a refresh — automated in `e2e/my-tasks.spec.ts` (3 passing tests: provider mounted, filter narrows to the chosen status with zero route requests and restores the original count without one, `visibilitychange` triggers a refresh request)
