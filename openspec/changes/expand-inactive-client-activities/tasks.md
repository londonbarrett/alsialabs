## 1. Server Action

- [x] 1.1 Add `getClientActivityPage(clientId, { offset, limit })` in `lib/actions/activities.ts` returning `{ activities, hasMore }`, ordered by `activityDate` desc (ties by `createdAt`/`id`), store-scoped, using `limit + 1` to detect another page.

## 2. Expandable Inactive Client Rows

- [x] 2.1 Create `components/activity/client-activity-row.tsx` as a self-contained row (main row + expanded panel) that manages its own expansion and pagination state.
- [x] 2.2 Toggle expansion on row double-click and via an interactive chevron `Button` (single click, `aria-expanded` + accessible label), fetching page 0 on first expand only (guarded by a `loaded` flag).
- [x] 2.3 Render the expanded content in a full-width `<TableRow>`/`<TableCell colSpan={5}>` panel showing the client's activities (reuse `ActivityItem` in read-only mode) with loading and empty states.
- [x] 2.4 Add a "Load more" button at the bottom that fetches the next page (append, not replace) and is hidden when `hasMore` is false or while loading.
- [x] 2.5 Show the app loading indicator (via `useLoadingIndicator`) during first-page and load-more fetches.
- [x] 2.6 Hide the `ActivityItem` action menu when neither edit nor delete is available.
- [x] 2.7 In `components/activity/inactive-clients-card.tsx`, replace inline handlers with named functions and wire the row callbacks.

## 3. Card Toolbar

- [x] 3.1 Move the period selector into the card content, right-aligned with a "Period" label, and show the result count left-aligned — matching the sales invoice table layout.

## 4. Translations

- [x] 4.1 Add `activity` translation keys (load more, no activities, loading activities, recent activity, toggle activities, result count, period) to `messages/en.json`.
- [x] 4.2 Add the same keys to `messages/es.json`.

## 5. Verification

- [x] 5.1 Run lint and typecheck; fix any issues.
