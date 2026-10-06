## MODIFIED Requirements

### Requirement: Store providers follow one construction pattern

Every store provider SHALL build its store with a lazy `useState` initializer — `const [store] = useState(() => createXStore(seed))` — and SHALL publish it through the store's context. Providers SHALL NOT read `ref.current` during render: `react-hooks/refs` forbids it, so `useRef` + `if (storeRef.current == null)` SHALL NOT be used and no `eslint-disable` comment SHALL suppress that rule.

Every provider SHALL re-apply server data through `useServerReseed(store, serverData)`, because a lazy initializer runs once and client state survives `router.refresh()`, so a refresh would otherwise re-render the page with new props that nothing reads. The hook SHALL be typed against `ServerSeededStore<S, A, Seed>`, so it accepts only stores carrying `reseedFromServer` — it SHALL NOT accept a bare apply callback, which would let `useState`'s setter and other non-store state satisfy it. Identity is the correct signal because these props are built by the server component, so a new reference means the server re-ran, whereas client-only re-renders pass the same reference; no deep comparison is required. The store SHALL come from a `useState` initializer and the data from props, so both are stable and no ref is needed to keep a callback fresh. A provider SHALL NOT re-derive its reseed token during render — a token built inline changes identity every render and would reseed constantly — so it SHALL be memoised or the prop used directly. Reseeding SHALL happen in an effect, never during render, preserving the invariant that no render-phase write reaches the store its subscribers are reading.

The provider SHALL be mounted by the route's page, not by the component that consumes the store. Consequently a consuming component SHALL be a single component that calls `useXStore()` directly, rather than a wrapper that renders a provider around an inner content component. `TimelineProvider`, `ActivityProvider`, `InvoiceProvider`, `ProjectsProvider`, `ProjectTasksProvider`, and `MyTasksProvider` are each mounted by their page (`app/app/clientes/[clientId]/page.tsx`, `app/app/actividad/page.tsx`, `app/app/ventas/page.tsx`, `app/app/proyectos/page.tsx`, `app/app/proyectos/[id]/page.tsx`, and `app/app/mis-tareas/page.tsx` respectively).

#### Scenario: Provider is built once per mount

- **WHEN** a page re-renders with the same data
- **THEN** the store SHALL NOT be rebuilt or re-seeded

#### Scenario: A refreshed server prop reaches a mounted store

- **WHEN** a `router.refresh()` causes the server component to send a provider new seed props
- **THEN** the provider SHALL call `store.reseedFromServer` and the store SHALL adopt the new data

#### Scenario: The reseed hook is not satisfiable by non-store state

- **WHEN** a caller attempts to satisfy `useServerReseed` with a value lacking `reseedFromServer`, such as a `useState` setter
- **THEN** TypeScript SHALL reject the call, because the hook is typed against `ServerSeededStore<S, A, Seed>`

#### Scenario: My tasks reseeds on focus

- **GIVEN** `MyTasksView` has been mounted by `app/app/mis-tareas/page.tsx`
- **WHEN** the window regains focus
- **THEN** `useRefreshOnFocus` SHALL trigger `router.refresh()` and `MyTasksProvider` SHALL reseed the store from the fresh `getMyTasks({})` result

#### Scenario: An active filter survives a focus refresh

- **GIVEN** a status or project filter is applied to the my-tasks list
- **WHEN** a focus refresh reseeds the store with the full task set
- **THEN** the visible list SHALL remain narrowed by the same filter, because the projection is derived from the store rather than fetched per filter
