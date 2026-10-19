# Activity page — Design

## Why this exists

Sales staff need one place to notice which clients have gone quiet and to keep the follow-up work — reminders and logged activities — moving. The page combines three views of the same relationship data: a table of clients who haven't bought within a chosen window, a reminders card for what's due next, and per-client timelines that expand inline so nobody has to leave the page to see what happened recently with a client.

The hard constraint is that the same UI elements are rendered under two different routes. The client detail page shows reminders and activities through the timeline store; the activity page shows them through its own store. Dialogs and rows are shared between the two, so they must be store-agnostic, and each route's call site picks the action hook that matches the store live on that route.

Everything mutable is optimistic. Completing a reminder, logging an activity, or fixing a client's phone number applies instantly and reverts if the server rejects it, because the page's job is quick capture during follow-up work, not waiting for round-trips.

## Goals

- Surface clients who haven't purchased within a configurable period, including clients who have never purchased.
- Keep reminders and each client's recent activities actionable from a single page.
- Share dialogs and rows with the client detail route without coupling either route to the other's store.
- Apply every mutation optimistically with automatic revert and consistent toasts.

## Design

### Page access

The activity page at `/app/actividad` is gated on the `activity:view` permission: a user holding it sees the page render normally, and anyone else gets a 403 Forbidden response. The same permission gates the underlying data — the paginated timeline fetch returns an empty result set to callers without `client-activity:view`.

### Inactive clients table

The core of the page is a table of clients whose last invoice falls outside a configurable window. A period dropdown offers exactly four options — 30 days, 60 days, 90 days, and "No purchases" — and changing it re-filters the table immediately, no submit step. "No purchases" is a first-class option: it selects clients with zero invoices, not clients with old invoices.

The table shows Client Name, Phone, Location, and Last Invoice Date, ordered by last invoice date ascending so the coldest clients — including never-purchased clients — come first. Above the table, a result count aligned to the left reflects the size of the current result set, and a "Period" selector sits right-aligned within the card content, matching the layout of the sales invoice table. Each row also shows the total number of activities registered for that client. When every client has bought within the selected window, the table replaces itself with an "All clients are active" message.

Each row carries an edit button (pencil icon) that opens `ClientDialog` pre-filled with that client's data. Saving updates the row optimistically with the new values, closes the dialog, and lets the server action run in the background.

### The reminders card

`RemindersCard` (`components/activity/reminders-card.tsx`) lists all reminders, active and completed. It takes no props and reads exclusively through `useActivityState()` (`stores/activity/use-activity-state.ts`), the store's single state hook — never `useActivityStore` directly. The store itself is scoped to the whole page by `ActivityProvider` (`components/activity/activity-provider.tsx`), which is mounted by `app/app/actividad/page.tsx` and seeded from `getReminders` (`actions/reminders.ts`), returning all reminders as `ReminderRecordDTO[]` already sorted completed-last. The store is built once per page visit; the card contains no store-creation logic.

Ordering inside the card is deliberate: active reminders with expired dates come first, then non-expired active reminders by nearest date, and completed reminders sit after everything else with done styling — muted row, check icon, struck-through description. Each reminder shows client name, description, and date; an overdue reminder (date before today) is highlighted with a destructive bell icon and date. Clicking the client name navigates to that client's detail page. Double-clicking anywhere on a row opens the edit reminder dialog pre-filled with that reminder's data. When there are no reminders at all, the card shows a "no reminders" message.

Completing a reminder is optimistic: `activityReducer` (`stores/activity/activity-reducer.ts`) `completeReminder` patches `{ completed: true }`, the reminder stays in the list but drops below the active reminders with done styling, its check button disappears, and a success toast confirms it.

### Store-agnostic dialogs, route-matched hooks

`ReminderDialog` (`components/clients/reminder-dialog.tsx`) and `LogActivityDialog` (`components/clients/log-activity-dialog.tsx`) contain no store logic and import no store module. Each is rendered under two different providers, so it cannot know which store to write to; instead each accepts a required `onSubmit(data, editingId?)` prop and leaves the mutation, the optimistic write, and the toast to the caller. `ReminderDialog` accepts either reminder shape as `reminder` — `ClientReminder` from the client timeline or `ReminderRecordDTO` from the activity list — because it serves both routes. As a consequence, the activity page's dialogs never require a `TimelineProvider` to be present.

Each call site selects the handler matching the store live on its route. On the client detail page, `AddReminderButton` (`components/clients/add-reminder-button.tsx`), `ReminderItem` (`components/clients/reminder-item.tsx`), `LogActivityButton` (`components/clients/log-activity-button.tsx`), and `ActivityItem` use `useTimelineActions` (`stores/timeline/use-timeline-actions.ts`). On the activity page, `RemindersCard` and `ClientActivityRow` (`components/activity/client-activity-row.tsx`) use `useActivityActions` (`stores/activity/use-activity-actions.ts`), with rows supplied by `ActivityPageEntry` (`components/activity/activity-page-entry.tsx`), which reads no store.

Each hook owns every write to its own store and the toasts for those writes — no component builds its own `run()` call or calls `toast` directly. `useActivityActions` returns `loadActivities`/`createReminder`/`updateReminder`/`createActivity`/`updateActivity`/`completeReminder`/`deleteReminder`; `useTimelineActions` returns `createInvoice`/`updateInvoice`/`createReminder`/`updateReminder`/`createActivity`/`updateActivity`/`completeReminder`/`deleteReminder`/`deleteActivity`/`updatePayment`/`deletePayment`. Because the hooks own the toasts, messages stay uniform across routes: a create from the activity page and a create from the timeline read the same success message, and likewise for updates.

Optimistic flow follows the standard pattern on both routes. A reminder created from the activity page shows a temp row in the card before the server responds; on success `replaceTemp` swaps in the saved row so later complete/delete actions target the real id, and on failure the temp row is discarded. A reminder created from the client page appears as a temp entry in the timeline and on success is patched with the row returned by `upsertReminder` (`actions/reminders.ts`).

Because one store holds both the card's reminder list and the expanded rows' activity lists, a reminder created from an expanded row is written to both in a single action. A logged activity lands only in that row's activity list, since the card lists reminders and not activities.

### Expanding a client's recent activities

Double-clicking an inactive client row (or clicking its chevron, which rotates to indicate state) expands the row inline to show that client's merged timeline: activities and non-completed reminders together, newest first, five entries at a time. A second double-click collapses it. While the first page loads, the global app loading indicator appears at the top of the viewport and the list shows its own loading indicator; a client with nothing logged shows a "no activities" message and no "Load more" button. "Load more" appends the next five older entries and hides itself once the list is exhausted.

Expansion never fights the row's other actions: edit, log activity, and add reminder all keep working and do not collapse the expanded list. Logging an activity for an expanded client prepends the new entry optimistically without re-fetching the list — on success the optimistic entry is replaced with the persisted activity, on failure it is removed, and the client's activity count updates immediately. A reminder added the same way is prepended immediately and removed on failure.

### Per-client lists live in the activity-page store

The expanded timelines are held in `activity-store.ts` as `activities: Record<clientId, ClientActivityList>`, each list carrying `entries`, `hasMore`, and `loaded`. Row components hold none of this in React state, precisely so that a reminder written from an expanded row can reach both the card's list and that row's list as a single store write.

`ClientActivityRow` reads its list via `getClientActivities(clientId)` from `useActivityState()`, which returns a shared `EMPTY_ACTIVITIES` constant for clients never expanded — the same reference on every call, because a freshly built object each time would loop `useSyncExternalStore`. Rows render only the keys they actually use, so an expanded row re-renders without disturbing its siblings.

`loadActivities(clientId)` fetches the first page and stores it with `loaded: true`, and the loading state is not published before the fetch resolves, so a row cannot flash an empty list. Once loaded, collapsing and re-expanding shows the cached entries without another fetch. `loadActivities(clientId, nextCursor)` appends the new entries after the existing ones rather than replacing them and updates `hasMore` from the response.

### Paginated timeline fetch

The inline lists are served by a paginated server action that returns a client's merged timeline — activities and non-completed reminders — ordered newest first, with same-date entries ordered deterministically (created-at desc, then id) so pagination is stable. Each page carries a `hasMore` flag indicating whether older entries exist. A caller without `client-activity:view` gets an empty result set rather than an error.

## Non-goals

- A shared global store for reminders and activities. Each route owns its store; dialogs stay store-agnostic instead.
- Server-rendered activity lists. The timelines are fetched per client on expansion, paginated five at a time.
- Filtering the activity page by anything other than the four fixed period options.
- Persisting expanded-row state across page visits. The store is rebuilt per visit and lists are fetched on demand.
