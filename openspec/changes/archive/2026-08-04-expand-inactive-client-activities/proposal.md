## Why

Admins on the activity page currently must double-click an inactive client row only to be redirected to the client profile page to see the client's recent activity. This interrupts the flow of reviewing which inactive clients need follow-up. Surfacing the last few activities inline lets admins quickly gauge a client's recent activity without leaving the page.

## What Changes

- Replace the double-click navigation behavior on inactive client rows with an inline expandable row.
- Double-clicking a row toggles an expanded area that loads and shows the client's most recent 5 activities.
- Add an interactive chevron arrow that toggles the expanded area on single click.
- Show the app loading indicator while client activities are being fetched.
- Extract the row into a self-contained `ClientActivityRow` component that manages its own expansion and pagination.
- Move the period selector into the card content (right-aligned with a "Period" label) and show the result count on the left, matching the sales invoice table layout.
- Add a "Load more" button at the bottom of the expanded area that loads the next 5 activities (older records) when available.
- Hide the "Load more" button when there are no more activities to load.
- Add a paginated server action to fetch a client's activities by offset/limit.

## Capabilities

### New Capabilities
- `activity`: Extend the existing activity page behavior with expandable inactive-client activity rows.

### Modified Capabilities
- `activity`: The inactive clients table row interaction changes from navigating to the client profile to expanding inline activities, with paginated loading of the last 5 activities and a load-more control.

## Impact

- `components/activity/client-activity-row.tsx` — new self-contained expandable row (chevron toggle, activity fetching, load-more UI).
- `components/activity/inactive-clients-card.tsx` — toolbar layout (result count + labeled period selector), dialogs, and row wiring.
- `components/clients/activity-item.tsx` — hide the action menu in read-only mode.
- `lib/actions/activities.ts` — new paginated activity fetch (offset/limit, store-scoped).
- `messages/en.json` / `messages/es.json` — new translation keys (load more, no activities, period, result count, etc.).
- No database schema changes required.
