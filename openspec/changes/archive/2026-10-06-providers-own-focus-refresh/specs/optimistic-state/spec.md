## ADDED Requirements

### Requirement: Focus refresh is registered once by the route tree's root

The application SHALL register focus-driven refresh in exactly one place: the `FocusRefresh` client component, which calls `useRefreshOnFocus()` and renders nothing, mounted once by `app/app/layout.tsx`. `router.refresh()` re-runs the whole route tree, so a single listener at the root supplies fresh seed props to every provider mounted beneath it — one listener is both necessary and sufficient.

Store providers SHALL NOT call `useRefreshOnFocus`, nor SHALL components that render store content. A per-provider owner would force a decision on any route that mounts more than one provider — on `app/app/proyectos/[id]`, `ProjectContextProvider` nests `ProjectTasksProvider` — and the loser of that decision needs a comment recording its silence, which is a rule the code only keeps because a comment says so. With no owner inside the tree, no second listener can be added by accident and the request count does not depend on which cards a page happens to render.

A route SHALL refresh on focus whether or not it mounts a store provider, because the layout wraps every authenticated route: server-rendered data on a page with no store goes stale for the same reason and is recovered the same way.

#### Scenario: A focus event issues exactly one refresh

- **GIVEN** `app/app/layout.tsx` has mounted `FocusRefresh`
- **WHEN** the window regains focus
- **THEN** exactly one `router.refresh()` SHALL be issued, and every mounted store provider SHALL reseed from its result

#### Scenario: A nested provider registers no listener

- **GIVEN** `app/app/proyectos/[id]` mounting `ProjectContextProvider` around `ProjectTasksProvider`
- **WHEN** the window regains focus
- **THEN** neither provider SHALL have registered a `visibilitychange` listener, and the route SHALL still refresh exactly once through `FocusRefresh`

#### Scenario: A consumer renders without requesting a refresh

- **WHEN** `MyTasksView`, `ActivityTimeline`, `RemindersCard`, `InactiveClientsCard`, or `TasksCard` renders
- **THEN** it SHALL NOT call `useRefreshOnFocus`, and its page SHALL still refresh on focus through the root layout

#### Scenario: A route with no store provider still refreshes

- **GIVEN** a route under `app/app/layout.tsx` that mounts no store provider
- **WHEN** the window regains focus
- **THEN** the page SHALL refetch through `FocusRefresh`, so its server-rendered data is not left stale
