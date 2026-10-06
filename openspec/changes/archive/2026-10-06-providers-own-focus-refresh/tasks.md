## 1. One owner at the root

- [x] 1.1 Create `components/common/focus-refresh.tsx` — a `"use client"` component calling `useRefreshOnFocus()` and returning `null`, with a comment recording why it is in the layout and not in a provider
- [x] 1.2 Mount `<FocusRefresh />` in `app/app/layout.tsx` inside `SidebarProvider`, beside the existing `PermissionsProvider`
- [x] 1.3 Remove `useRefreshOnFocus()` and its import from all six providers: `my-tasks-provider.tsx`, `activity-provider.tsx`, `projects-provider.tsx`, `project-context-provider.tsx`, `invoice-provider.tsx`, `timeline-provider.tsx`
- [x] 1.4 Remove the now-obsolete explanatory comment from `components/projects/project-tasks-provider.tsx`, since no provider decides anything about focus refresh any more

## 2. Consumers stay silent

- [x] 2.1 `useRefreshOnFocus()` remains absent from `MyTasksView`, `ActivityTimeline`, `RemindersCard`, `InactiveClientsCard`, and `TasksCard`

## 3. Specs

- [x] 3.1 Rewrite the `optimistic-state` delta: the requirement now states that focus refresh is registered once by the route tree's root layout, that providers register nothing, and that consumers register nothing
- [x] 3.2 Confirm no other spec sentence implies a card or a provider owns the refresh; `A card SHALL NOT need to pass a callback to useRefreshOnFocus` still agrees

## 4. Verify

- [x] 4.1 `npx tsc --noEmit` exits 0
- [x] 4.2 Targeted `npx eslint` on every touched file shows only the pre-existing `hooks/use-mobile.ts:14` and `lib/actions/payments.test.ts:29`
- [x] 4.3 `npx vitest run` stays at 283 passing
- [x] 4.4 `grep -rn "useRefreshOnFocus()" components/ app/` returns exactly one call site, in `components/common/focus-refresh.tsx`
- [x] 4.5 `npx playwright test e2e/my-tasks.spec.ts e2e/focus-refresh.spec.ts` stays at 4 passing — both assert exactly one request per focus, which is what a single root listener guarantees
