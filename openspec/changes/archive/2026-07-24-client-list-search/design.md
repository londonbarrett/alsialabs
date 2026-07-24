## Context

The clients page (`/dashboard/clients`) renders a server component that fetches all clients from the database and passes them to a `ClientListView` client component. The component currently displays a table with no filtering or search capability. The `Input` component is already installed and available.

## Goals / Non-Goals

**Goals:**
- Add a search input that filters the client table in real-time
- Match against name, phone, email, location, and comments fields
- Case-insensitive matching
- Show appropriate empty state when no results match

**Non-Goals:**
- Server-side search (all data is already loaded)
- Pagination (out of scope)
- Advanced filters (by date, status, etc.)
- URL-based search state (no need to persist search across navigation)

## Decisions

### Client-side filtering with `useState`

**Decision**: Use a `useState` hook for the search query and compute filtered clients via `useMemo`.

**Rationale**: All clients are already loaded in memory. Client-side filtering provides instant feedback with no network latency. `useMemo` prevents re-filtering on every render.

**Alternative considered**: Server-side search via `searchClients()` — rejected because the full list is already loaded and would add unnecessary complexity (debounce, loading states, AbortController).

### Search input placement

**Decision**: Place the search input in the header area, between the title and the action buttons, as a full-width or compact input.

**Rationale**: Follows common table search patterns. Keeps actions visible while searching.

### Case-insensitive matching

**Decision**: Convert both the query and field values to lowercase before comparison.

**Rationale**: Users expect search to be case-insensitive. Simple `toLowerCase()` + `includes()` is sufficient.

## Risks / Trade-offs

- **Large client lists**: If clients grow to tens of thousands, client-side filtering may cause UI jank. Mitigation: the current list is small; if it grows, migrate to server-side search.
- **No URL persistence**: Search state is lost on navigation. This is acceptable for the current use case.
