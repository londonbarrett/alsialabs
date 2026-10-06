## Why

`useRefreshOnFocus` and `useServerReseed` are two halves of one mechanism — refresh fetches, reseed adopts — but they were split across files: each provider owned the reseed while a consumer (`TasksCard`, `RemindersCard`, …) owned the refresh. Nothing tied the halves together, so they drifted: `my-tasks` shipped inert with both missing, and `/app/actividad` fired `router.refresh()` twice per focus because two cards each registered a listener.

Putting the hook in every store provider fixes the drift but replaces it with a new rule that has to be written down: on `app/app/proyectos/[id]`, two providers nest, so only the outer one may call the hook and the inner one needs a comment explaining its silence. A rule that needs a comment at the one place it is violated is a rule that will be violated again.

## What Changes

- Add `components/common/focus-refresh.tsx` — a client component that calls `useRefreshOnFocus()` and renders nothing — and mount it once in `app/app/layout.tsx`, the root layout every authenticated route renders inside.
- Remove `useRefreshOnFocus()` from all six providers it was added to (`MyTasksProvider`, `ActivityProvider`, `ProjectsProvider`, `ProjectContextProvider`, `InvoiceProvider`, `TimelineProvider`) and from the five consumers it used to live in (`MyTasksView`, `ActivityTimeline`, `RemindersCard`, `InactiveClientsCard`, `TasksCard`). No provider calls it at all, so there is no per-route owner to decide and no comment to write.
- `router.refresh()` re-runs the whole route tree, so the single root listener feeds every provider's `useServerReseed` beneath it, and no provider can register a second listener.

## Capabilities

### Modified Capabilities

- `optimistic-state`: adds a requirement that focus refresh is registered exactly once by the route tree's root, not by store providers or their consumers.

## Impact

- Affected code: new `components/common/focus-refresh.tsx`, `app/app/layout.tsx`, and removals in 11 files (6 providers, 5 consumers).
- **Every `/app` page now refreshes on focus**, not just the store-backed ones — `/app/calendario` and any other route with no store gain it. That is the point of putting it at the root: server-rendered data stops going stale on any page.
- Request count per focus is exactly one app-wide, and no longer depends on which cards a page renders.
- No store, reducer, action, or i18n change. `useRefreshOnFocus` itself is untouched.
