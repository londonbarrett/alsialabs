# Client activity timeline — Design

## Why this exists

The relationship with a client is told by its events: calls and meetings that already happened, follow-ups still due, invoices issued, and payments received. Rather than scatter those across separate modules, the client profile presents them as one chronological timeline. A rep opening a client sees at once what has been done and what is owed, and can act on any entry — logging, editing, completing, or deleting — without leaving the page.

The timeline is a mix of things with different lifecycles, so entries are self-contained components rather than a single polymorphic row. Each kind owns its permissions, its edit dialog, and its mutation, which keeps the rules about who can do what co-located with the thing being acted on. Mutations are optimistic, so the timeline updates the moment a user submits, and reverts cleanly if the server rejects the change.

## Goals

- Present activities, reminders, invoices, and payments in one date-ordered timeline.
- Order same-date entries deterministically so the order never shifts between renders.
- Keep each entry self-contained: its own permissions, dialog, and mutation.
- Let permitted users log, edit, complete, and delete activities and reminders.
- Let permitted users edit and delete payments from the timeline.
- Apply timeline mutations optimistically with the global loading bar.
- Validate and authorize all activity and reminder actions on the server.

## Design

### The combined timeline

The Activity section on a client profile is a chronological timeline of past activities, pending and completed reminders, invoices, and payments, sorted by date descending. Because several entries can share a date, ties are broken deterministically — created-at descending, then id — so the order is stable across renders and reloads.

The entries are assembled server-side: `getClientActivities` in `actions/activities.ts` and `getClientReminders` in `actions/reminders.ts` both return `[]` for `user`-role sessions, which is how the timeline stays hidden from roles that cannot see it. Neither the section nor the data is shown to a user without `client-activity:view`.

### Store ownership and provider mounting

The fetched entries are handed to `TimelineProvider` in `components/clients/timeline-provider.tsx`, which owns a store created once per mount and publishes it through `TimelineStoreContext` in `stores/timeline/timeline-store.ts`. The provider is mounted by the page — `app/app/clientes/[clientId]/page.tsx` and `app/app/perfil/page.tsx` — and not by `ActivityTimeline`. That split keeps `ActivityTimeline` in `components/clients/activity-timeline.tsx` a single component that takes only a `clientId` and holds no store-creation logic of its own.

Each entry renders through a self-contained item — `ActivityItem`, `ReminderItem`, `InvoiceItem`, or `PaymentItem` — which owns its own permission checks and edit dialogs and runs any mutation through the route's action hook `useTimelineActions` rather than importing a server action. An item checks permissions with `useHasPermission` from `components/common/permissions-provider.tsx`, runs mutations with `useOptimisticAction` from `stores/use-optimistic-action.ts` against `useTimelineStore`, and renders its own dialog (`LogActivityDialog`, `ReminderDialog`, `TimelineInvoiceDialog`, or `PaymentDialog`). `useTimelineStore` throws if no `TimelineProvider` is mounted, which is the guard that keeps timeline-only components off pages that lack the store.

### Self-contained entries versus the activity page's rows

The entries belong to this route alone and are not shared with the activity page through a mode flag. The activity page renders its own store-free rows: its expanded client list uses `ActivityPageEntry` in `components/activity/activity-page-entry.tsx`, which dispatches on `entry.kind` to either `ActivityEntryRow` in `components/activity/activity-entry-row.tsx` or `ReminderEntryRow` in `components/activity/reminder-entry-row.tsx`. Those rows show no action buttons and do not open edit dialogs — the row's own pencil button opens them — and they never touch `useTimelineStore`, because the activity page mounts `ActivityProvider` rather than `TimelineProvider`. The timeline's `ActivityItem` and `ReminderItem` are separate components rather than a mode on shared ones, since hooks cannot be called conditionally.

### Build buttons

The timeline header exposes the create actions as self-contained buttons: `LogActivityButton` in `components/clients/log-activity-button.tsx` and `AddReminderButton` in `components/clients/add-reminder-button.tsx`, both gated on `client-activity:create`, and `CreateInvoiceButton` gated on `sales:create`. Each button opens its own creation dialog — `LogActivityDialog`, `ReminderDialog`, or `TimelineInvoiceDialog` in `components/clients/timeline-invoice-dialog.tsx` — and a button whose permission is missing is simply not shown.

### Logging an activity

Users with `client-activity:create` log a new activity from `LogActivityButton`, which opens `LogActivityDialog` in `components/clients/log-activity-dialog.tsx`. The dialog collects type (call, email, meeting, or note), subject, description, and a date defaulting to today. On a valid submit the activity appears in the timeline, a success toast is shown, and the dialog closes. Because an activity records something that already happened, a date before today is accepted and persisted, while a date after today fails validation and blocks submission. Submitting without a subject or type highlights the missing fields and blocks submission.

### Editing and deleting activities

Users with `client-activity:edit` can modify an existing activity: clicking Edit opens a pre-filled dialog, and submitting updates the timeline optimistically through the timeline store and shows a success toast. Users with `client-activity:delete` can delete an activity after a confirmation dialog, and the activity is removed from the timeline on confirm. A user without `client-activity:delete` sees no Delete option in the activity's action menu.

### Reminders

Users with `client-activity:create` create a follow-up reminder from `AddReminderButton`, which opens `ReminderDialog` in `components/clients/reminder-dialog.tsx` with a description and a due date defaulting to tomorrow. A valid submit adds the reminder to the timeline as pending and shows a success toast; a due date before today fails validation and blocks submission.

Users with `client-activity:edit` can edit a reminder through the same pre-filled `ReminderDialog`, with the timeline updating optimistically on submit, and can mark a pending reminder complete — which optimistically patches `{ completed: true }` and leaves the reminder visible with a visual distinction such as a strikethrough or muted style. Users with `client-activity:delete` can delete a reminder after a confirmation dialog, removing it from the timeline on confirm.

### Payments

Payment entries render through `PaymentItem` in `components/clients/payment-item.tsx`, which contains no store logic and imports no store or server-action module. Instead it calls `updatePayment` and `deletePayment` from `useTimelineActions` in `stores/timeline/use-timeline-actions.ts` — the hook that requires `TimelineProvider` and owns the timeline store patch, the server mutation, and the toast — and renders `PaymentDialog` in `components/sales/payment-dialog.tsx`, a presentational shell with a required `onSubmit` prop and no store logic.

A user with `sales:edit` sees "Edit {amount}" and a user with `sales:delete` sees "Delete {amount}" in a payment entry's action menu. Choosing edit opens a pre-filled `PaymentDialog`, and submitting updates the payment optimistically through the timeline store with no refresh required. Choosing delete opens a confirmation dialog, and confirming removes the payment optimistically. A user lacking both `sales:edit` and `sales:delete` sees no edit or delete actions on payment entries.

### Optimistic mutations

Logging an activity, adding, editing, or completing a reminder, or creating an invoice updates the timeline optimistically while the global loading bar shows during the server request. Every mutation runs through `useOptimisticAction` in `stores/use-optimistic-action.ts` against the `useTimelineStore` store in `stores/timeline/timeline-store.ts`, applying a `TimelineEntryAction` — `add`, `patch`, or `delete` — through `timelineReducer` in `stores/timeline/timeline-reducer.ts`. A new entry appears immediately as a temporary row; the pending action is committed on success, optionally combined with a `commitAction` that swaps the temporary entry for the authoritative server row, and discarded on failure, which removes the temporary entry and shows an error toast. The loading bar stays visible until the server action completes and hides once the optimistic update resolves, whether that ends in success or error.

The action shapes are deliberate: `delete` matches on id alone and carries no `kind` discriminator, while `patch` retains `kind` because its payload is a typed discriminated union.

### Validation and authorization

All activity and reminder server actions validate and authorize their input. An unauthenticated request returns an unauthorized error with no data modified. Malformed or malicious input is rejected with a validation error and no data modified. A caller lacking the required permission receives a forbidden error and again modifies nothing.

### Date validation runs in opposite directions

Activity dates and reminder dates are validated in opposite directions because they mean different things: an activity records something that already happened, while a reminder asks for a future follow-up. `activity_date` must be today or earlier and rejects future dates, on both client and server. `remind_at` must be today or later and rejects past dates, on both client and server. Neither field is validated as "today or in the future", which would wrongly forbid logging a past interaction; the server correspondingly saves an activity dated before today and returns a validation error for one dated after today, and returns a validation error for a reminder due before today.

## Non-goals

- A shared, mode-flagged entry component across the timeline and the activity page. The two render different components because their hooks differ.
- Touching the timeline store from the activity page, which mounts `ActivityProvider` and renders store-free rows.
- Validating activity dates as future-only or allowing past reminder due dates; the two fields validate in opposite directions by design.
</content>
