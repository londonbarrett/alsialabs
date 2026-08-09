## MODIFIED Requirements

### Requirement: Task management

The system SHALL allow owners to manage tasks on their projects. Tasks are managed on the tasks subpage (`/dashboard/projects/[id]`, the default project subpage). Tasks SHALL carry an optional priority of `urgent` or `high`; tasks with no priority are allowed. Tasks SHALL carry an optional due date (a datetime). Owners set or edit the due date from the task dialog using a date field and an optional time field; the due date is rendered in the Due Date column of the task table. Tasks SHALL support a `cancelled` status that owners apply from the inline status dropdown; cancelled tasks are read-only for non-owners, do not show the overdue indicator, and are excluded from project task progress. Owners can reopen a cancelled task by selecting an active status. Collaborators can view tasks and change status to blocked or in_review only. The tasks section uses a Card component with a ListTodo icon in the header. Task operations (create, edit, delete, status change, priority change) use optimistic updates with useReducer for instant UI feedback, global loading indicator during server requests, and success toasts on completion.

#### Scenario: Create task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Add Task" in the tasks card header on the tasks subpage
- **THEN** a dialog opens with fields for name, description, cost, status, assignee, priority, and due date
- **AND** the assignee dropdown shows project owners and collaborators
- **AND** the priority dropdown defaults to no priority
- **AND** the due date field defaults to empty
- **WHEN** the user fills required fields and submits
- **THEN** the task appears immediately in the task table via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the task was created

#### Scenario: Collaborator can change task status to blocked or in_review

- **GIVEN** a user who is a collaborator of a project
- **WHEN** the user views the task table on the tasks subpage
- **THEN** the status dropdown (TaskStatusSelect component) is restricted to "blocked" and "in_review" options only

#### Scenario: Assignee can change task status

- **GIVEN** a user who is assigned to a task but is not an owner or collaborator of the project
- **WHEN** the user views the task in My Tasks
- **THEN** the status dropdown is available with collaborator-level restrictions (in_progress, blocked, in_review)
- **AND** the status cannot be changed to "done" or "cancelled"

#### Scenario: Collaborator cannot create or delete tasks

- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user views the task table on the tasks subpage
- **THEN** the "Add Task" button and task action menus are not visible

#### Scenario: Update task status inline

- **GIVEN** a user who is an owner of the project
- **WHEN** the user selects a different status from the inline status dropdown on a task row
- **THEN** the task status changes immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the status change

#### Scenario: Update task priority inline

- **GIVEN** a user who is an owner of the project
- **WHEN** the user selects a priority from the inline priority dropdown on a task row
- **THEN** the task priority changes immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the priority change

#### Scenario: Owner can set priority on a task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user creates or edits a task
- **THEN** the priority field accepts "urgent" or "high" or no priority
- **AND** the chosen priority is saved with the task

#### Scenario: Priority is optional

- **GIVEN** a user who is an owner of the project
- **WHEN** the user creates a task without selecting a priority
- **THEN** the task is created successfully with no priority

#### Scenario: Owner can set a due date on a task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user creates or edits a task and enters a date in the due date field, optionally with a time
- **THEN** the due date is saved with the task
- **AND** the due date appears in the Due Date column of the task table formatted with the task's date and time when set

#### Scenario: Due date is optional

- **GIVEN** a user who is an owner of the project
- **WHEN** the user creates a task without a due date
- **THEN** the task is created successfully with no due date
- **AND** the Due Date column shows an em dash for that task

#### Scenario: Overdue task shows indicator

- **GIVEN** a task that is not in the "done" or "cancelled" status and has a due date in the past
- **WHEN** the task is displayed in the task table
- **THEN** an "Overdue" badge is shown in the Due Date column
- **AND** the due date text is displayed in red
- **WHEN** the task's status is changed to "done" or "cancelled"
- **THEN** the overdue indicator is no longer shown

#### Scenario: Owner can cancel a task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user selects "Cancelled" from the inline status dropdown on a task row
- **THEN** the task status changes immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the status change

#### Scenario: Owner can reopen a cancelled task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user selects an active status from the inline status dropdown on a cancelled task
- **THEN** the task returns to the selected status
- **AND** the task appears in the task table again with its previous data intact

#### Scenario: Cancelled task is read-only for non-owners

- **GIVEN** a user who is a collaborator or assignee (not an owner) viewing a cancelled task
- **WHEN** the task row is displayed in the task table or My Tasks
- **THEN** the status is shown as a read-only badge
- **AND** no status dropdown is available

#### Scenario: Cancelled task does not show overdue indicator

- **GIVEN** a task in the "cancelled" status with a due date in the past
- **WHEN** the task is displayed in the task table
- **THEN** no "Overdue" badge is shown
- **AND** the due date text is not displayed in red

#### Scenario: Project progress excludes cancelled tasks

- **GIVEN** a project whose tasks include done, active, and cancelled tasks
- **WHEN** the project card shows task progress
- **THEN** progress is computed as done / (total − cancelled)
- **AND** cancelled tasks do not contribute to the completed count or the total

#### Scenario: Edit task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Edit" on a task's action menu
- **THEN** a dialog opens with the task's current values pre-filled, including priority and due date
- **WHEN** the user modifies fields and submits
- **THEN** the task updates immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the task was updated

#### Scenario: Delete task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Delete" on a task's action menu
- **THEN** a confirmation dialog appears
- **WHEN** the user confirms
- **THEN** the task is removed immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the task was deleted

#### Scenario: Task row shows comment count

- **GIVEN** a user viewing the task table
- **WHEN** tasks are displayed
- **THEN** each task row shows a comment count next to a MessageSquare icon
- **AND** the count is always visible, including 0
- **AND** the count is always a number (not a string)

#### Scenario: Double-click task row opens comments

- **GIVEN** a user viewing the task table
- **WHEN** the user double-clicks anywhere on a task row
- **THEN** the comments panel opens as a slide-over Sheet

### Requirement: Routine management

The system SHALL allow owners to manage recurring tasks (routines) on the routines subpage (`/dashboard/projects/[id]/routines`). A routine defines a name, description, cost, assignee, and a schedule; routines have no status and no priority. The schedule is captured in a two-step form (details, then scheduling) and supports two recurrences: `daily` (an "every N days" interval) and `weekly` (selected weekdays combined with an "every N weeks" interval). Each routine optionally stores a perform-at time (HH:MM) and an optional start/end date range that bounds the occurrences. Creating a routine immediately spawns its first task instance scheduled for the next occurrence (no earlier than the start date), and marking a routine-instance task as done or cancelled automatically spawns the next instance scheduled after the completed instance (status `todo`, no priority) unless an open instance already exists or the next occurrence falls after the end date. An instance is open when its status is not "done" and not "cancelled". Routine-instance tasks carry a due date (`due_date` column) and are identified by a `routineId`, shown with a "Routine" badge and their due date in the Due Date column of the Tasks and My Tasks tables. Common routines can be started from static templates (irrigation, fertilization, pest monitoring, weeding, harvest).

#### Scenario: View routines subpage

- **GIVEN** a user with `projects:view` permission
- **WHEN** the user navigates to `/dashboard/projects/[id]/routines`
- **THEN** a Routines card is shown listing each routine with name, assignee, recurrence badge, schedule summary (cadence, selected days, time, date range), and cost

#### Scenario: Create routine from template

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Add Routine" in the routines card header
- **THEN** a dialog opens with a two-step form (Details, then Scheduling)
- **WHEN** the user picks a template
- **THEN** the name, description, recurrence, interval, and selected days are pre-filled from the template
- **WHEN** the user completes both steps and submits
- **THEN** the routine is created and its first task instance appears in the task table with status "To Do"
- **AND** the first instance is scheduled for the next occurrence computed from the schedule

#### Scenario: Create custom routine

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Add Routine" and fills in custom values
- **THEN** a custom routine is created without a template

#### Scenario: Schedule a weekly routine with multiple weekdays

- **GIVEN** a user creating a routine
- **WHEN** the user selects "Weekly" recurrence
- **THEN** the user can toggle weekdays and set an "every N weeks" interval
- **WHEN** the user selects weekdays and submits
- **THEN** occurrences are computed on the selected weekdays with the configured cadence

#### Scenario: Daily routine repeats every N days

- **GIVEN** a user creating a routine
- **WHEN** the user selects "Daily" recurrence
- **THEN** no day selection is shown and an "every N days" interval input is available
- **AND** the routine occurs once every N days

#### Scenario: Schedule time is optional

- **GIVEN** a user on the scheduling step
- **WHEN** the user leaves the perform-at time empty and submits
- **THEN** the routine is created and its instances are not assigned a due date

#### Scenario: Bound the routine with start and end dates

- **GIVEN** a user creating a routine
- **WHEN** the user sets a start date
- **THEN** the first instance is not scheduled before the start date
- **WHEN** the user sets a start date earlier than today
- **THEN** a "start date cannot be in the past" error is shown and the routine is not created
- **WHEN** the user sets an end date
- **THEN** no new instance is spawned once the next occurrence would fall after the end date
- **WHEN** the user sets an end date that is not in the future
- **THEN** an "end date must be in the future" error is shown and the routine is not created
- **WHEN** the user sets an end date earlier than the start date
- **THEN** an "end date must be after start date" error is shown and the routine is not created

#### Scenario: Date bounds are relaxed when editing

- **GIVEN** an existing routine whose start date is in the past or whose end date has passed
- **WHEN** an owner edits and saves the routine without changing those dates
- **THEN** the routine is saved successfully
- **AND** only the end-date-after-start-date consistency check still applies

#### Scenario: Validate scheduling step

- **GIVEN** a user on the scheduling step
- **WHEN** the user selects a weekly recurrence without picking a day
- **THEN** a "select at least one day" error is shown and the routine is not created

#### Scenario: Edit routine

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Edit" on a routine's action menu
- **THEN** a dialog opens with the routine's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the routine is updated via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the update

#### Scenario: Delete routine

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Delete" on a routine's action menu
- **THEN** the routine is deleted
- **AND** existing task instances remain but are no longer linked to a routine

#### Scenario: Completing a routine task spawns the next instance

- **GIVEN** a routine task that is assigned and open
- **WHEN** an owner marks the task as done
- **THEN** a new task instance is created with the routine's name, description, cost, and assignee
- **AND** the new task has status "To Do" and no priority
- **AND** the new task's due date is set to the next occurrence after the completed instance's due date
- **AND** the new task is prepended to the task table
- **AND** a "next occurrence created" toast is shown

#### Scenario: Cancelling a routine task spawns the next occurrence

- **GIVEN** a routine task that is assigned and open
- **WHEN** an owner cancels the task
- **THEN** a new task instance is created with the routine's name, description, cost, and assignee
- **AND** the new task has status "To Do" and no priority
- **AND** the new task's due date is set to the next occurrence after the cancelled instance's due date
- **AND** the new task is prepended to the task table
- **AND** a "next occurrence created" toast is shown

#### Scenario: No duplicate open instances

- **GIVEN** a routine that already has an open task instance (an instance is not open when its status is "done" or "cancelled")
- **WHEN** the routine's next instance would be created
- **THEN** no additional instance is created

#### Scenario: Routine ends after its end date

- **GIVEN** a routine with an end date
- **WHEN** a routine-instance task is marked as done or cancelled and the next occurrence would fall after the end date
- **THEN** no new instance is created

#### Scenario: Routine tasks are marked in lists

- **GIVEN** a task created from a routine
- **WHEN** the task is displayed in the Tasks table or My Tasks
- **THEN** a "Routine" badge is shown next to the task name
- **AND** the task's due date and time are shown in the Due Date column

### Requirement: My Tasks page

The system SHALL provide a "My Tasks" page accessible from the sidebar that shows all tasks assigned to the current user across all projects they have access to. Status changes use optimistic updates with global loading indicator and success toasts. Each row shows a Due Date column; tasks that are not "done" or "cancelled" with a due date in the past show an "Overdue" badge. The status filter includes "cancelled". Cancelled tasks are read-only for non-owners.

#### Scenario: Navigate to My Tasks

- **GIVEN** a user logged into the dashboard
- **WHEN** the user clicks "My Tasks" in the sidebar
- **THEN** the user is navigated to `/dashboard/my-tasks`

#### Scenario: View assigned tasks

- **GIVEN** a user on the My Tasks page
- **WHEN** the page loads
- **THEN** a table is displayed with all tasks assigned to the current user
- **AND** each row shows task name, project name (formatted as "Project (Owner)" for owner context), status, cost, comment count, and a Due Date column with the task's due date and time when set
- **AND** tasks spawned by a routine show a "Routine" badge next to the task name

#### Scenario: Filter tasks by status

- **GIVEN** a user on the My Tasks page
- **WHEN** the user selects a status from the filter dropdown
- **THEN** only tasks with the selected status are shown
- **AND** "Cancelled" is an available filter option

#### Scenario: Filter tasks by project

- **GIVEN** a user on the My Tasks page
- **WHEN** the user selects a project from the filter dropdown
- **THEN** only tasks from the selected project are shown

#### Scenario: Change task status from My Tasks

- **GIVEN** a user on the My Tasks page viewing a task they are assigned to
- **WHEN** the user selects a different status from the inline status dropdown
- **THEN** the task status changes immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the status change
- **AND** assignees can update their own task status (not just owners and collaborators)

#### Scenario: Overdue task shows indicator in My Tasks

- **GIVEN** a task assigned to the user that is not in the "done" or "cancelled" status and has a due date in the past
- **WHEN** the task is displayed on the My Tasks page
- **THEN** an "Overdue" badge is shown in the Due Date column
- **AND** the due date text is displayed in red

#### Scenario: Cancelled task is read-only on My Tasks

- **GIVEN** a user on the My Tasks page viewing a cancelled task they are assigned to
- **WHEN** the task row is displayed
- **THEN** the status is shown as a read-only badge
- **AND** no status dropdown is available
- **AND** the task does not show the "Overdue" badge even if its due date is in the past

#### Scenario: Open comments from My Tasks

- **GIVEN** a user on the My Tasks page
- **WHEN** the user double-clicks a task row or clicks the comment count button
- **THEN** the comments panel opens as a slide-over Sheet

#### Scenario: Forbidden without projects view permission

- **GIVEN** a user without `projects:view` permission
- **WHEN** the user navigates to `/dashboard/my-tasks`
- **THEN** a 403 forbidden screen is displayed
- **AND** no server error is thrown
