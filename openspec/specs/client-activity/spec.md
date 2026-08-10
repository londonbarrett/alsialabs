## ADDED Requirements

### Requirement: Admin can view activity timeline
The system SHALL display a combined activity timeline on the client profile page, showing past activities, pending/completed reminders, invoices, and payments sorted by date descending. Entries with the same date SHALL be ordered deterministically (created-at descending, then id).

#### Scenario: Timeline shows on client profile when permitted
- **WHEN** a user with `activities:view` permission navigates to a client profile
- **THEN** they see an "Activity" section with a chronological timeline
- **AND** the timeline shows activities (past interactions), reminders (follow-ups), invoices, and payments

#### Scenario: Timeline ordering is stable across reloads
- **WHEN** multiple timeline entries share the same date
- **THEN** they SHALL be sorted deterministically by created-at descending then id
- **AND** the order SHALL NOT change between renders or reloads

#### Scenario: Timeline hidden without permission
- **WHEN** a user without `activities:view` permission navigates to a client profile
- **THEN** the Activity section is not shown

#### Scenario: Payment entries show invoice and amount
- **WHEN** a payment has been recorded against one of the client's invoices
- **THEN** the timeline shows a payment entry with the invoice number, formatted amount, payment date, and method (when present)

### Requirement: Admin can log an activity
The system SHALL allow users with `activities:create` permission to log a new activity via a dialog form.

#### Scenario: Successful activity creation
- **WHEN** an admin clicks "Log Activity" on the client profile page
- **THEN** a dialog form appears with fields: type (call/email/meeting/note), subject, description, date (defaulting to today)
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
The system SHALL allow users with `activities:edit` permission to modify an existing activity.

#### Scenario: Successful activity edit
- **WHEN** an admin clicks Edit on an activity in the timeline
- **THEN** a pre-filled dialog form appears with the current values
- **WHEN** the admin modifies fields and submits
- **THEN** the timeline updates with the changes
- **AND** a success toast is shown

### Requirement: Super user can delete an activity
The system SHALL allow super users to delete activities from the timeline.

#### Scenario: Super deletes with confirmation
- **WHEN** a super user clicks Delete on an activity
- **THEN** a confirmation dialog appears asking to confirm
- **WHEN** the super user confirms
- **THEN** the activity is removed from the timeline

#### Scenario: Non-super cannot delete
- **WHEN** a non-super admin opens the activity's action menu
- **THEN** no Delete option is shown

### Requirement: Admin can create a reminder
The system SHALL allow users with `reminders:create` permission to create a follow-up reminder.

#### Scenario: Successful reminder creation
- **WHEN** an admin clicks "Add Reminder" on the client profile page
- **THEN** a dialog form appears with fields: description and due date (defaulting to tomorrow)
- **WHEN** the admin fills in valid data and submits
- **THEN** the reminder appears in the timeline as pending
- **AND** a success toast is shown

#### Scenario: Past due date is rejected
- **WHEN** an admin enters a due date before today
- **THEN** the form shows a validation error
- **AND** submission is blocked

### Requirement: Admin can edit a reminder
The system SHALL allow users with `reminders:edit` permission to modify an existing reminder.

#### Scenario: Successful reminder edit
- **WHEN** an admin clicks Edit on a reminder in the timeline
- **THEN** a pre-filled dialog form appears
- **WHEN** the admin modifies fields and submits
- **THEN** the timeline updates with the changes

### Requirement: Admin can complete a reminder
The system SHALL allow users with `reminders:complete` permission to mark a reminder as completed.

#### Scenario: Successful reminder completion
- **WHEN** an admin clicks the complete action on a pending reminder
- **THEN** the reminder is marked as completed in the timeline
- **AND** it remains visible with a visual distinction (e.g., strikethrough or muted style)

### Requirement: Admin can delete a reminder
The system SHALL allow users with `reminders:delete` permission to delete a reminder with confirmation.

#### Scenario: Deletion with confirmation
- **WHEN** an admin clicks Delete on a reminder
- **THEN** a confirmation dialog appears
- **WHEN** they confirm
- **THEN** the reminder is removed from the timeline

### Requirement: Admin can edit a payment from the timeline
The system SHALL allow users with `sales:record-payment` permission to edit a payment directly from the client activity timeline.

#### Scenario: Edit payment from timeline
- **WHEN** a user with `sales:record-payment` permission opens the action menu on a payment entry in the timeline
- **THEN** they see "Edit {amount}" and "Delete {amount}" items
- **WHEN** they click "Edit {amount}"
- **THEN** a pre-filled payment dialog appears
- **WHEN** they modify fields and submit
- **THEN** the payment is updated
- **AND** the timeline refreshes

#### Scenario: Payment actions hidden without permission
- **WHEN** a user without `sales:record-payment` permission views the timeline
- **THEN** payment entries show no edit or delete actions

### Requirement: Admin can delete a payment from the timeline
The system SHALL allow users with `sales:record-payment` permission to delete a payment from the timeline after confirmation.

#### Scenario: Delete payment from timeline
- **WHEN** a user with `sales:record-payment` permission clicks "Delete {amount}" on a payment entry in the timeline
- **THEN** a confirmation dialog appears
- **WHEN** they confirm
- **THEN** the payment is removed
- **AND** the timeline refreshes

### Requirement: Timeline mutations are optimistic
The system SHALL update the timeline optimistically when logging an activity, adding/editing a reminder, creating an invoice, or recording a payment, while showing the global loading bar during the server request.

#### Scenario: New entry appears immediately
- **WHEN** a user submits a new activity, reminder, invoice, or payment from the timeline
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
