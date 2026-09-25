## ADDED Requirements

### Requirement: Admin can view activity timeline
The system SHALL display a combined activity timeline on the client profile page, showing past activities, pending/completed reminders, invoices, and payments sorted by date descending. Entries with the same date SHALL be ordered deterministically (created-at descending, then id). The timeline (`ActivityTimeline` `components/clients/activity-timeline.tsx`) SHALL hydrate entries into the global per-client `useTimelineStore` `stores/timeline-store.ts` from data fetched server-side via `getClientActivities` `lib/actions/activities.ts` and `getClientReminders` `lib/actions/reminders.ts` — both SHALL return `[]` for `user`-role sessions — and SHALL render each entry via a self-contained item (`ActivityItem`/`ReminderItem`/`InvoiceItem`/`PaymentItem`) that owns its permission checks, optimistic handlers, and edit dialogs.

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
- **WHEN** a timeline entry renders
- **THEN** the item SHALL check its permissions via `useHasPermission` `stores/permissions-store.ts`
- **AND** it SHALL run its mutation via `useOptimisticAction` on `useTimelineStore`
- **AND** it SHALL render its own edit dialog (`LogActivityDialog`/`ReminderDialog`/`TimelineInvoiceDialog`/`PaymentDialog`)

#### Scenario: Read-only preview hides actions
- **WHEN** `ActivityItem`/`ReminderItem` render with `readOnly`
- **THEN** they SHALL show no action buttons and SHALL NOT open edit dialogs (used for the read-only expanded-panel preview on the activity page)

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

#### Scenario: Past date is rejected
- **WHEN** an admin enters an activity date before today
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
The system SHALL allow users with `sales:edit` permission to edit a payment directly from the client activity timeline, and users with `sales:delete` permission to delete one. Payment entries are rendered by `PaymentItem` `components/clients/payment-item.tsx`, which owns the optimistic submit (timeline store patch + `updatePayment` `lib/actions/payments.ts`) and renders `PaymentDialog` `components/sales/payment-dialog.tsx` — a presentational shell with a required `onSubmit` prop and no store logic.

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
The system SHALL update the timeline optimistically when logging an activity, adding/editing/completing a reminder, or creating an invoice, while showing the global loading bar during the server request. Each mutation SHALL run through `useOptimisticAction`/`applyTimelineAction` `stores/timeline-store.ts`, with the pending entry removed or replaced when the server action settles.

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
The system SHALL validate that activity_date and remind_at are today or in the future, on both client and server.

#### Scenario: Future date is accepted
- **WHEN** an admin enters today's date or a future date
- **THEN** the form validates successfully

#### Scenario: Past date is rejected on server
- **WHEN** the server receives data with a past date
- **THEN** the server returns a validation error
- **AND** no data is saved
