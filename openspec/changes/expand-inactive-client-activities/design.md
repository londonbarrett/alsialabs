## Context

The activity page's inactive clients card (`components/activity/inactive-clients-card.tsx`) renders a table of inactive clients. Currently double-clicking a row navigates to the client profile page (`/dashboard/clients/[clientId]`), where a full timeline lives. There is no inline way to see a client's recent activity without leaving the page.

Activity records live in `client_activity` (`clientActivitiesTable`) and are store-scoped. The existing `getClientActivities` action in `lib/actions/activities.ts` fetches all activities for a client with no pagination and requires `client-activity:view`.

## Goals / Non-Goals

**Goals:**
- Allow double-clicking an inactive client row to expand it inline and show the client's most recent 5 activities.
- Provide an interactive chevron that toggles expansion on single click.
- Show the app loading indicator while activities are being fetched.
- Provide a "Load more" button that fetches the next 5 (older) activities, hidden when none remain.
- Display the inactive client result count and a labeled period selector in the card content, matching the sales invoice table layout.
- Keep all existing row actions (edit client, log activity, add reminder, client name link) working.

**Non-Goals:**
- Showing reminders, invoices, or payments in the expanded panel (activities only).
- Adding pagination to the client profile timeline.
- Changing the data model.

## Decisions

### 1. Paginated server action returning `{ activities, hasMore }`
Add `getClientActivityPage(clientId, { offset, limit })` in `lib/actions/activities.ts`. It orders by `activityDate` descending (ties broken by `createdAt`/`id` for stability), applies `limit + 1` to detect whether another page exists, and returns `{ activities, hasMore }`. Store-scoping reuses the same `store_id` guard used elsewhere.

Rationale: offset/limit is the simplest fit for "next 5 records" and matches the existing query style. Fetching `limit + 1` avoids a separate count query.
Alternative considered: cursor-based pagination — more robust against inserts during paging, but overkill here since the panel is short-lived.

### 2. Self-contained `ClientActivityRow` component
Extract the row (main `<TableRow>` plus the expanded `<TableRow>` panel) into `components/activity/client-activity-row.tsx`. Each row manages its own expansion and pagination state locally, so the card stays a thin list renderer.

Row state:
- `expanded: boolean`
- `loaded: boolean` (whether the first page has been fetched, avoids refetching on re-expand)
- `activities: ClientActivity[]`
- `hasMore: boolean`
- `isLoading: boolean`
- `isLoadingMore: boolean`

Interaction:
- Double-clicking the row toggles expansion.
- The chevron arrow is a `Button` (`aria-expanded` + accessible label) that toggles on single click; it stops propagation so it never triggers a row-level double-click side effect.
- The first page (5 activities) is fetched on first expand only; "Load more" appends the next 5.

### 3. App loading indicator during activity fetches
Each row calls `useLoadingIndicator().start()` before fetching and `stop()` in `finally`. Because the indicator uses a counter, concurrent fetches keep the bar visible until all complete.

### 4. Reuse ActivityItem for the expanded activity list
Render each activity using the existing `ActivityItem` component in read-only mode (`canEdit`/`canDelete` false). `ActivityItem` hides its action menu when neither edit nor delete is available. Translations for activity types already exist under `activities.types`.

### 5. Card toolbar matching the sales invoice table
`CardContent` wraps the table in `flex flex-col gap-4`. A toolbar row (`flex flex-wrap items-end justify-end gap-3`) holds:
- A result count `<p>` with `mr-auto self-center text-sm text-muted-foreground` and `aria-live="polite"`, using `activity.resultCount` (ICU pluralization).
- A right-aligned `grid gap-1.5` group with a `Label` (`activity.period`) and the period `Select` (`id`/`htmlFor` wired together).

### 6. Translations
Add keys under `activity` in both `messages/en.json` and `messages/es.json`:
- `loadMoreActivities` ("Load more" / "Cargar más")
- `noActivities` ("No activities" / "Sin actividades")
- `loadingActivities` ("Loading activities…" / "Cargando actividades…")
- `recentActivity` (header for the expanded panel)
- `toggleActivities` (chevron aria-label, with client name)
- `resultCount` (pluralized result count)
- `period` (period selector label)

## Risks / Trade-offs

- [Double-click while already loading could refetch] → Guarded by the `loaded` flag: the first page is fetched only once per row.
- [Offset pagination can skip/duplicate if new activity is created mid-paging] → Acceptable for a short-lived inline panel; ordering is stable by date desc + createdAt.
- [Wide expanded row pushes table layout] → Use `colSpan` matching the current column count so the row spans cleanly.
- [Each expanded row fetches independently] → On-demand, short-lived panels; the loading-indicator counter keeps the global bar consistent.
