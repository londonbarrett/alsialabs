## MODIFIED Requirements

### Requirement: Task management

The system SHALL allow owners to manage tasks on their projects. Tasks are managed on the tasks subpage (`/dashboard/projects/[id]`, the default project subpage). Tasks SHALL carry an optional priority of `urgent` or `high`; tasks with no priority are allowed. Tasks SHALL carry an optional due date (a datetime). Owners set or edit the due date from the task dialog using a date field and an optional time field; the due date is rendered in the Due Date column of the task table. Collaborators can view tasks and change status to blocked or in_review only. The tasks section uses a Card component with a ListTodo icon in the header. Task operations (create, edit, delete, status change, priority change) use optimistic updates with useReducer for instant UI feedback, global loading indicator during server requests, and success toasts on completion.

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
- **AND** the status cannot be changed to "done" if already done

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

- **GIVEN** a task that is not in the "done" status and has a due date in the past
- **WHEN** the task is displayed in the task table
- **THEN** an "Overdue" badge is shown in the Due Date column
- **AND** the due date text is displayed in red
- **WHEN** the task's status is changed to "done"
- **THEN** the overdue indicator is no longer shown

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

The system SHALL allow owners to manage recurring tasks (routines) on the routines subpage (`/dashboard/projects/[id]/routines`). A routine defines a name, description, cost, assignee, and a schedule; routines have no status and no priority. The schedule is captured in a two-step form (details, then scheduling) and supports two recurrences: `daily` (an "every N days" interval) and `weekly` (selected weekdays combined with an "every N weeks" interval). Each routine optionally stores a perform-at time (HH:MM) and an optional start/end date range that bounds the occurrences. Creating a routine immediately spawns its first task instance scheduled for the next occurrence (no earlier than the start date), and marking a routine-instance task as done automatically spawns the next instance scheduled after the completed instance (status `todo`, no priority) unless an open instance already exists or the next occurrence falls after the end date. Routine-instance tasks carry a due date (`due_date` column) and are identified by a `routineId`, shown with a "Routine" badge and their due date in the Due Date column of the Tasks and My Tasks tables. Common routines can be started from static templates (irrigation, fertilization, pest monitoring, weeding, harvest).

#### Scenario: Schedule time is optional

- **GIVEN** a user on the scheduling step
- **WHEN** the user leaves the perform-at time empty and submits
- **THEN** the routine is created and its instances are not assigned a due date

#### Scenario: Completing a routine task spawns the next instance

- **GIVEN** a routine task that is assigned and open
- **WHEN** an owner marks the task as done
- **THEN** a new task instance is created with the routine's name, description, cost, and assignee
- **AND** the new task has status "To Do" and no priority
- **AND** the new task's due date is set to the next occurrence after the completed instance's due date
- **AND** the new task is prepended to the task table
- **AND** a "next occurrence created" toast is shown

#### Scenario: Routine tasks are marked in lists

- **GIVEN** a task created from a routine
- **WHEN** the task is displayed in the Tasks table or My Tasks
- **THEN** a "Routine" badge is shown next to the task name
- **AND** the task's due date and time are shown in the Due Date column

### Requirement: My Tasks page

The system SHALL provide a "My Tasks" page accessible from the sidebar that shows all tasks assigned to the current user across all projects they have access to. Status changes use optimistic updates with global loading indicator and success toasts. Each row shows a Due Date column; tasks that are not "done" with a due date in the past show an "Overdue" badge.

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

- **GIVEN** a task assigned to the user that is not in the "done" status and has a due date in the past
- **WHEN** the task is displayed on the My Tasks page
- **THEN** an "Overdue" badge is shown in the Due Date column
- **AND** the due date text is displayed in red

#### Scenario: Open comments from My Tasks

- **GIVEN** a user on the My Tasks page
- **WHEN** the user double-clicks a task row or clicks the comment count button
- **THEN** the comments panel opens as a slide-over Sheet

#### Scenario: Forbidden without projects view permission

- **GIVEN** a user without `projects:view` permission
- **WHEN** the user navigates to `/dashboard/my-tasks`
- **THEN** a 403 forbidden screen is displayed
- **AND** no server error is thrown
