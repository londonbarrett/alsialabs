# client-activity Specification

## Purpose

A client's activity timeline — activities, reminders, invoices, and payments — with optimistic edit/delete and inline dialogs.

## Requirements

### Requirement: Admin can view activity timeline

The system SHALL display a combined activity timeline on the client profile page, showing past activities, pending/completed reminders, invoices, and payments sorted by date descending. Entries with the same date SHALL be ordered deterministically (created-at descending, then id). Entries SHALL be built server-side via `getClientActivities` `actions/activities.ts` and `getClientReminders` `actions/reminders.ts` — both SHALL return `[]` for `user`-role sessions — and handed to `TimelineProvider` `components/clients/timeline-provider.tsx`, which owns a store created once per mount and publishes it through `TimelineStoreContext` `stores/timeline/timeline-store.ts`. The provider SHALL be mounted by the page (`app/app/clientes/[clientId]/page.tsx` and `app/app/perfil/page.tsx`), NOT by `ActivityTimeline`, so that `ActivityTimeline` `components/clients/activity-timeline.tsx` is a single component taking only `clientId` and contains no store-creation logic. Each entry SHALL render via a self-contained item (`ActivityItem`/`ReminderItem`/`InvoiceItem`/`PaymentItem`) that owns its permission checks and edit dialogs and runs any mutation through the route's action hook (`useTimelineActions`) rather than importing a server action. Each of those items belongs to this route alone and SHALL NOT carry a mode flag for other routes: the activity page has its own store-free rows, because it mounts `ActivityProvider` rather than `TimelineProvider`.

#### Scenario: Timeline shows on client profile when permitted

- **WHEN** a user with `client-activity:view` permission navigates to a client profile
- **THEN** they see an "Activity" section with a chronological timeline
- **AND** the timeline shows activities (past interactions), reminders (follow-ups), invoices, and payments

#### Scenario: Timeline ordering is stable across reloads

- **WHEN** multiple timeline entries share the same date
- **THEN** they SHALL be sorted deterministically by created-at descending then id
- **AND** the order SHALL NOT change between renders or reloads

#### Scenario: Timeline hidden without permission

- **WHEN** a user without `client-activity:view` permission navigates to a client profile
- **THEN** the Activity section is not shown
- **AND** `getClientActivities`/`getClientReminders` SHALL return `[]` for requests from `user`-role sessions

#### Scenario: Timeline entries are self-contained

- **WHEN** a timeline entry renders in its editable form
- **THEN** the item SHALL check its permissions via `useHasPermission` `components/common/permissions-provider.tsx`
- **AND** it SHALL run its mutation via `useOptimisticAction` `stores/use-optimistic-action.ts` on `useTimelineStore`, which SHALL throw if no `TimelineProvider` is mounted
- **AND** it SHALL render its own edit dialog (`LogActivityDialog`/`ReminderDialog`/`TimelineInvoiceDialog`/`PaymentDialog`)

#### Scenario: The activity page renders its own store-free rows

- **WHEN** the activity page's expanded client list renders an activity or a reminder
- **THEN** it SHALL use `ActivityPageEntry` `components/activity/activity-page-entry.tsx`, which dispatches on `entry.kind` to `ActivityEntryRow` `components/activity/activity-entry-row.tsx` or `ReminderEntryRow` `components/activity/reminder-entry-row.tsx`
- **AND** those rows SHALL show no action buttons and SHALL NOT open edit dialogs, because the row's own pencil button opens them
- **AND** they SHALL NOT touch `useTimelineStore`, because the activity page mounts no `TimelineProvider`; the timeline page's `ActivityItem`/`ReminderItem` are separate components rather than a mode flag on shared ones, since hooks cannot be called conditionally

#### Scenario: Build actions are self-contained buttons

- **WHEN** the timeline header renders
- **THEN** it shows `LogActivityButton` and `AddReminderButton` (gated on `client-activity:create`) and `CreateInvoiceButton` (gated on `sales:create`)
- **AND** each button SHALL open its own creation dialog (`LogActivityDialog`/`ReminderDialog`/`TimelineInvoiceDialog` `components/clients/timeline-invoice-dialog.tsx`)
- **AND** when the permission is missing the corresponding button SHALL NOT be shown

#### Scenario: Payment entries show invoice and amount

- **WHEN** a payment has been recorded against one of the client's invoices
- **THEN** the timeline shows a payment entry with the invoice number, formatted amount, payment date, and method (when present)

### Requirement: Admin can log an activity

The system SHALL allow users with `client-activity:create` permission to log a new activity via a dialog form opened from `LogActivityButton` `components/clients/log-activity-button.tsx`.

#### Scenario: Successful activity creation

- **WHEN** an admin clicks "Log Activity" on the client profile page
- **THEN** a dialog form (`LogActivityDialog` `components/clients/log-activity-dialog.tsx`) appears with fields: type (call/email/meeting/note), subject, description, date (defaulting to today)
- **WHEN** the admin fills in valid data and submits
- **THEN** the activity appears in the timeline
- **AND** a success toast is shown
- **AND** the dialog closes

#### Scenario: Past date is accepted for an activity

- **WHEN** an admin enters an activity date before today, to log a call, email, or meeting that already happened
- **THEN** the form SHALL validate successfully
- **AND** the activity SHALL be persisted with that date

#### Scenario: Future date is rejected for an activity

- **WHEN** an admin enters an activity date after today
- **THEN** the form shows a validation error
- **AND** submission is blocked

#### Scenario: Missing required fields are rejected

- **WHEN** an admin submits without a subject or type
- **THEN** the form highlights the invalid fields with error messages
- **AND** submission is blocked

### Requirement: Admin can edit an activity

The system SHALL allow users with `client-activity:edit` permission to modify an existing activity.

#### Scenario: Successful activity edit

- **WHEN** an admin with `client-activity:edit` clicks Edit on an activity in the timeline
- **THEN** a pre-filled dialog form appears with the current values
- **WHEN** the admin modifies fields and submits
- **THEN** the timeline updates with the changes (optimistically via the timeline store)
- **AND** a success toast is shown

### Requirement: Admin can delete an activity

The system SHALL allow users with `client-activity:delete` permission to delete activities from the timeline after confirmation.

#### Scenario: Deletion with confirmation

- **WHEN** a user with `client-activity:delete` permission clicks Delete on an activity
- **THEN** a confirmation dialog appears asking to confirm
- **WHEN** the user confirms
- **THEN** the activity is removed from the timeline

#### Scenario: Delete hidden without permission

- **WHEN** a user without `client-activity:delete` permission opens the activity's action menu
- **THEN** no Delete option is shown

### Requirement: Admin can create a reminder

The system SHALL allow users with `client-activity:create` permission to create a follow-up reminder from `AddReminderButton` `components/clients/add-reminder-button.tsx`.

#### Scenario: Successful reminder creation

- **WHEN** an admin clicks "Add Reminder" on the client profile page
- **THEN** a dialog form (`ReminderDialog` `components/clients/reminder-dialog.tsx`) appears with fields: description and due date (defaulting to tomorrow)
- **WHEN** the admin fills in valid data and submits
- **THEN** the reminder appears in the timeline as pending
- **AND** a success toast is shown

#### Scenario: Past due date is rejected

- **WHEN** an admin enters a due date before today
- **THEN** the form shows a validation error
- **AND** submission is blocked

### Requirement: Admin can edit a reminder

The system SHALL allow users with `client-activity:edit` permission to modify an existing reminder.

#### Scenario: Successful reminder edit

- **WHEN** an admin with `client-activity:edit` clicks Edit on a reminder in the timeline
- **THEN** a pre-filled dialog form (`ReminderDialog`) appears
- **WHEN** the admin modifies fields and submits
- **THEN** the timeline updates with the changes (optimistically)

### Requirement: Admin can complete a reminder

The system SHALL allow users with `client-activity:edit` permission to mark a reminder as completed.

#### Scenario: Successful reminder completion

- **WHEN** an admin clicks the complete action on a pending reminder
- **THEN** the reminder is marked as completed in the timeline (optimistically, patches `{ completed: true }`)
- **AND** it remains visible with a visual distinction (e.g., strikethrough or muted style)

### Requirement: Admin can delete a reminder

The system SHALL allow users with `client-activity:delete` permission to delete a reminder with confirmation.

#### Scenario: Deletion with confirmation

- **WHEN** an admin with `client-activity:delete` clicks Delete on a reminder
- **THEN** a confirmation dialog appears
- **WHEN** they confirm
- **THEN** the reminder is removed from the timeline

### Requirement: Admin can edit a payment from the timeline

The system SHALL allow users with `sales:edit` permission to edit a payment directly from the client activity timeline, and users with `sales:delete` permission to delete one. Payment entries are rendered by `PaymentItem` `components/clients/payment-item.tsx`, which contains no store logic and imports no store or server-action module: it calls `updatePayment`/`deletePayment` from `useTimelineActions` `stores/timeline/use-timeline-actions.ts` (requires `TimelineProvider`), the hook that owns the timeline store patch, the server mutation, and the toast, and renders `PaymentDialog` `components/sales/payment-dialog.tsx` — a presentational shell with a required `onSubmit` prop and no store logic.

#### Scenario: Edit payment from timeline

- **WHEN** a user with `sales:edit` permission opens the action menu on a payment entry in the timeline
- **THEN** they see "Edit {amount}" and "Delete {amount}" items
- **WHEN** they click "Edit {amount}"
- **THEN** a pre-filled `PaymentDialog` appears
- **WHEN** they modify fields and submit
- **THEN** the payment is updated optimistically via the timeline store, no refresh required

#### Scenario: Payment actions hidden without permission

- **WHEN** a user lacking both `sales:edit` and `sales:delete` permission views the timeline
- **THEN** payment entries show no edit or delete actions

### Requirement: Admin can delete a payment from the timeline

The system SHALL allow users with `sales:delete` permission to delete a payment from the timeline after confirmation.

#### Scenario: Delete payment from timeline

- **WHEN** a user with `sales:delete` permission clicks "Delete {amount}" on a payment entry in the timeline
- **THEN** a confirmation dialog appears
- **WHEN** they confirm
- **THEN** the payment is removed optimistically

### Requirement: Timeline mutations are optimistic

The system SHALL update the timeline optimistically when logging an activity, adding/editing/completing a reminder, or creating an invoice, while showing the global loading bar during the server request. Each mutation SHALL run through `useOptimisticAction` `stores/use-optimistic-action.ts` on the `useTimelineStore` `stores/timeline/timeline-store.ts` store, applying `TimelineEntryAction` (`add`, `patch`, `delete`) via `timelineReducer` `stores/timeline/timeline-reducer.ts`. The pending action SHALL be committed on success — optionally combined with a `commitAction` that swaps the temporary entry for the authoritative server row — or discarded on failure. `delete` SHALL match on id alone, and SHALL NOT carry a `kind` discriminator; `patch` SHALL retain `kind` because its payload is a typed discriminated union.

#### Scenario: New entry appears immediately

- **WHEN** a user submits a new activity, reminder, or invoice from the timeline
- **THEN** a temporary entry SHALL appear in the timeline immediately
- **AND** the global loading bar SHALL be visible during the server request
- **AND** on success the temporary entry SHALL be replaced with the persisted record
- **AND** on failure the temporary entry SHALL be removed and an error toast SHALL be shown

#### Scenario: Loading bar stays visible through transition

- **WHEN** a timeline mutation runs
- **THEN** the loading bar SHALL remain visible until the server action completes
- **AND** SHALL hide once the optimistic update resolves (success or error)

### Requirement: Server-side validation and authorization

The system SHALL validate and authorize all server actions for activities and reminders.

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated request is made to any activity or reminder server action
- **THEN** the action returns an unauthorized error
- **AND** no data is modified

#### Scenario: Malformed input is rejected

- **WHEN** the server receives malformed or malicious input
- **THEN** the server rejects the data with a validation error
- **AND** no data is modified

#### Scenario: Insufficient permissions are rejected

- **WHEN** a user without the required permission calls a server action
- **THEN** the action returns a forbidden error
- **AND** no data is modified

### Requirement: Date validation

Activity dates and reminder dates SHALL be validated in opposite directions, because they mean different things: an activity records something that already happened, while a reminder asks for a future follow-up. `activity_date` SHALL be today or earlier and SHALL reject future dates, on both client and server; `remind_at` SHALL be today or later and SHALL reject past dates, on both client and server. Neither field SHALL be validated as "today or in the future", which would wrongly forbid logging a past interaction.

#### Scenario: Past activity date is accepted on server

- **WHEN** the server receives an activity with a date before today
- **THEN** the activity SHALL be saved with that date

#### Scenario: Future activity date is rejected on server

- **WHEN** the server receives an activity with a date after today
- **THEN** the server returns a validation error
- **AND** no data is saved

#### Scenario: Past reminder date is rejected on server

- **WHEN** the server receives a reminder due before today
- **THEN** the server returns a validation error
- **AND** no data is saved
