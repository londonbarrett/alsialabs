## MODIFIED Requirements

### Requirement: Project subpage navigation

The project detail area SHALL be split into four subpages under `/dashboard/projects/[id]`: tasks (default), details, people, and expenses. Accessing any subpage SHALL require the `projects:view` permission. All subpages SHALL share a persistent header (back button, project name, location, status badge) and a tab navigation that highlights the active subpage.

- `/dashboard/projects/[id]` — tasks (default)
- `/dashboard/projects/[id]/details`
- `/dashboard/projects/[id]/people`
- `/dashboard/projects/[id]/expenses`

#### Scenario: Tasks is the default subpage

- **GIVEN** a user with `projects:view` permission
- **WHEN** the user opens a project from the projects list
- **THEN** the user is navigated to `/dashboard/projects/[id]`
- **AND** the tasks table is shown
- **AND** the "Tasks" tab is highlighted

#### Scenario: Navigate between project subpages

- **GIVEN** a user with `projects:view` permission on a project subpage
- **WHEN** the user clicks a tab in the project navigation
- **THEN** the user is navigated to the corresponding subpage
- **AND** the active tab is highlighted
- **AND** the header (back button, project name, location, status badge) remains visible

#### Scenario: Forbidden without projects view permission

- **GIVEN** a user without `projects:view` permission
- **WHEN** the user navigates to any project subpage
- **THEN** a 403 forbidden screen is displayed

#### Scenario: Unknown project shows not found

- **GIVEN** a project that does not exist
- **WHEN** the user navigates to any project subpage
- **THEN** a 404 not found screen is displayed

### Requirement: Project CRUD

The system SHALL allow owners to create, view, edit, and delete projects. The primary owner and super users SHALL have full control. Owners can manage collaborators and tasks. Collaborators can view projects and comment on tasks.

#### Scenario: Create project

- **GIVEN** a user with `projects:create` permission
- **WHEN** the user clicks "New Project" on the projects list page
- **THEN** a dialog opens with a form containing name, category, start/end dates, location, and budget fields
- **WHEN** the user fills in the required fields (name, category, dates, location, budget) and submits
- **THEN** a new project is created with the user as primary owner
- **AND** the user is added to the project_owners table

#### Scenario: View project list

- **GIVEN** a user with `projects:view` permission
- **WHEN** the user navigates to `/dashboard/projects`
- **THEN** projects are displayed as a card grid with name, category, status badge, dates, budget bar, task progress, and primary owner shown with a crown icon
- **AND** the header shows "Portfolio" label, "Projects" title, and a subtitle description

#### Scenario: Project card links to detail

- **GIVEN** a user viewing the projects list
- **WHEN** the user clicks on a project card's title
- **THEN** the user is navigated to `/dashboard/projects/[id]`
- **AND** the tasks subpage is shown by default

#### Scenario: View project details subpage

- **GIVEN** a user who is an owner of the project
- **WHEN** the user navigates to `/dashboard/projects/[id]/details`
- **THEN** the details subpage shows the project info in a Card
- **AND** primary owner is shown in the details card
- **AND** edit and delete buttons appear in the details card footer

#### Scenario: Edit project

- **GIVEN** a user who is an owner of the project or a super user
- **WHEN** the user clicks the secondary "Edit" button in the project details footer
- **THEN** a dialog opens with the project's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the project is updated and the page refreshes

#### Scenario: Delete project

- **GIVEN** a user who is the primary owner of the project or a super user
- **WHEN** the user clicks the destructive "Delete" button in the project details footer
- **THEN** a styled confirmation dialog appears with the project name
- **WHEN** the user confirms
- **THEN** the project is deleted and the user is redirected to the projects list

#### Scenario: Update project status inline

- **GIVEN** a user who is an owner of the project or a super user
- **WHEN** the user selects a different status from the inline status dropdown on the details subpage
- **THEN** the project status changes immediately without a page reload

#### Scenario: Collaborator cannot view project

- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user navigates to a project subpage
- **THEN** the project is not visible (only owners can access project details)

### Requirement: Project ownership model

Projects SHALL support multiple owners and collaborators. The primary owner has full control. Owners can manage collaborators and tasks. Collaborators can view and comment on tasks.

#### Scenario: Primary owner manages co-owners

- **GIVEN** a user who is the primary owner of a project
- **WHEN** the user views the people subpage
- **THEN** a "Co-owners" section is visible with a combobox to search for users to add
- **AND** a remove button appears next to each non-primary owner

#### Scenario: Non-primary owner cannot manage owners

- **GIVEN** a user who is an owner (but not primary) of a project
- **WHEN** the user views the people subpage
- **THEN** the add/remove co-owner controls are not visible

#### Scenario: Primary owner can transfer ownership

- **GIVEN** a user who is the primary owner of a project
- **WHEN** the user selects another owner as primary owner
- **THEN** the ownership is transferred and the page refreshes

#### Scenario: Owner manages collaborators

- **GIVEN** a user who is an owner of a project
- **WHEN** the user views the people subpage
- **THEN** a "Collaborators" section is visible with a combobox to search for users to add
- **AND** a remove button appears next to each collaborator

#### Scenario: Collaborator cannot manage collaborators

- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user views the people subpage
- **THEN** the add/remove collaborator controls are not visible

### Requirement: User search and invite

The system SHALL provide a combobox input for searching existing users and inviting new ones. The input shows search results as users type and includes an invite button.

#### Scenario: Search for existing user

- **GIVEN** an owner managing co-owners or collaborators
- **WHEN** the user types in the combobox search field
- **THEN** matching users appear in a dropdown list
- **AND** users already associated with the project are excluded from results

#### Scenario: Invite new user

- **GIVEN** an owner managing co-owners or collaborators
- **WHEN** the user selects "Invite" option in the combobox
- **THEN** the invite action is triggered without a loading spinner

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

#### Scenario: No duplicate open instances

- **GIVEN** a routine that already has an open (non-done) task instance
- **WHEN** the routine's next instance would be created
- **THEN** no additional instance is created

#### Scenario: Routine ends after its end date

- **GIVEN** a routine with an end date
- **WHEN** a routine-instance task is marked as done and the next occurrence would fall after the end date
- **THEN** no new instance is created

#### Scenario: Routine tasks are marked in lists

- **GIVEN** a task created from a routine
- **WHEN** the task is displayed in the Tasks table or My Tasks
- **THEN** a "Routine" badge is shown next to the task name
- **AND** the task's due date and time are shown in the Due Date column

### Requirement: Expense management

The system SHALL allow owners to manage expenses on the expenses subpage (`/dashboard/projects/[id]/expenses`). The subpage shows a budget progress card (total spend = expense amounts + task costs compared against the project budget, with an over-budget indicator) and a table listing expense rows and task cost rows ordered by date (expense `expense_date` and task creation date). Owners can create, edit, and delete expenses, and can edit or delete task cost rows from the same table. Actions are granted via the `expenses:create`, `expenses:edit`, and `expenses:delete` permissions or project ownership rights.

#### Scenario: View expenses subpage

- **GIVEN** a user with `projects:view` permission
- **WHEN** the user navigates to `/dashboard/projects/[id]/expenses`
- **THEN** a Card is shown with a budget progress bar when the project has a budget
- **AND** a table lists expense rows and task cost rows ordered by date ascending
- **AND** each expense row shows description, a category badge translated via `categoryNames.*`, amount, and date
- **AND** each task cost row shows a "Task" badge and the task creation date
- **AND** expense dates and task creation dates are displayed in the same `YYYY-MM-DD` format
- **AND** a total of expenses and task costs is shown

#### Scenario: Budget progress

- **GIVEN** a project with a budget
- **WHEN** the expenses subpage is displayed
- **THEN** the total spend (expense amounts + task costs) is compared to the budget
- **AND** the progress bar shows the percentage of budget used
- **AND** when the total exceeds the budget, an over-budget indicator is shown in red

#### Scenario: Create expense

- **GIVEN** a user with `expenses:create` permission or project edit rights
- **WHEN** the user clicks "Add Expense" in the expenses card header
- **THEN** a dialog opens with fields for description, category, amount, and date
- **WHEN** the user fills the required fields and submits
- **THEN** the expense is created and the page refreshes

#### Scenario: Edit expense

- **GIVEN** a user with `expenses:edit` permission or project edit rights
- **WHEN** the user clicks "Edit" on an expense row's action menu
- **THEN** a dialog opens with the expense's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the expense is updated and the page refreshes

#### Scenario: Delete expense

- **GIVEN** a user with `expenses:delete` permission or delete rights on the project
- **WHEN** the user clicks "Delete" on an expense row's action menu
- **THEN** the expense is deleted
- **AND** a success toast confirms the deletion

#### Scenario: Edit or delete task cost from expenses subpage

- **GIVEN** a user with expense management rights
- **WHEN** the user clicks "Edit" or "Delete" on a task row's action menu on the expenses subpage
- **THEN** the task dialog opens pre-filled, or the task is deleted

### Requirement: Task comments

The system SHALL allow project members (owners and collaborators) and task assignees to have conversations on tasks. Comments are displayed in a slide-over Sheet panel. Only the comment author or project owners can delete comments. Only the comment author can edit their own comments. Comment operations (add, edit, delete) use optimistic updates with the global loading indicator during server requests and success toasts on completion.

#### Scenario: Assignee who is not a project member can comment

- **GIVEN** a user who is assigned to a task but is not an owner or collaborator of the project
- **WHEN** the user opens the comments panel for that task from My Tasks
- **THEN** the comments are loaded and shown
- **AND** the user can add comments
- **AND** the user can edit their own comments
- **AND** the user can delete their own comments

#### Scenario: Open comments panel via button

- **GIVEN** a user viewing the task table
- **WHEN** the user clicks the comment count button on a task row
- **THEN** the comments panel opens as a slide-over Sheet

#### Scenario: Open comments panel via double-click

- **GIVEN** a user viewing the task table
- **WHEN** the user double-clicks anywhere on a task row
- **THEN** the comments panel opens as a slide-over Sheet

#### Scenario: Comments panel header layout

- **GIVEN** a user with the comments panel open
- **WHEN** the panel header is displayed
- **THEN** the task name is shown as the title
- **AND** the task description is shown below as muted text

#### Scenario: View comments

- **GIVEN** a user with the comments panel open
- **WHEN** the panel loads
- **THEN** existing comments are displayed in chronological order
- **AND** each comment shows the author's avatar, name, relative timestamp, and content
- **AND** if the comment has been edited, "(edited)" is shown after the timestamp

#### Scenario: Add a comment

- **GIVEN** a user with the comments panel open
- **WHEN** the user types a comment and clicks Send (or presses Enter)
- **THEN** the comment appears immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the comment was added
- **AND** the comment count on the task row increments

#### Scenario: Edit own comment in place

- **GIVEN** a user viewing a comment they authored
- **WHEN** the user hovers over the comment
- **THEN** a pencil (edit) icon appears
- **WHEN** the user clicks the edit icon
- **THEN** the comment content becomes an editable textarea
- **AND** Save and Cancel buttons appear below the textarea
- **WHEN** the user modifies the content and clicks Save (or presses Enter)
- **THEN** the comment is updated immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the comment was updated
- **AND** "(edited)" appears in the timestamp
- **WHEN** the user clicks Cancel (or presses Escape)
- **THEN** the edit is discarded and the original content is shown

#### Scenario: Cannot edit other users' comments

- **GIVEN** a user viewing a comment authored by another user
- **WHEN** the user hovers over the comment
- **THEN** the edit icon is not shown

#### Scenario: Delete own comment (author)

- **GIVEN** a user viewing a comment they authored
- **WHEN** the user hovers over the comment
- **THEN** a trash (delete) icon appears
- **WHEN** the user clicks the delete icon
- **THEN** the comment is removed immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the comment was deleted
- **AND** the comment count on the task row decrements

#### Scenario: Owner deletes any comment

- **GIVEN** a user who is an owner of the project
- **WHEN** the user hovers over any comment
- **THEN** a trash (delete) icon appears
- **WHEN** the user clicks the delete icon
- **THEN** the comment is deleted

#### Scenario: Collaborator cannot delete others' comments

- **GIVEN** a user who is a collaborator (not an owner) of the project
- **WHEN** the user hovers over a comment authored by another user
- **THEN** the delete icon is not shown

#### Scenario: Refresh comments

- **GIVEN** a user with the comments panel open
- **WHEN** the user clicks the refresh button in the panel header
- **THEN** the comments list is re-fetched from the server
- **AND** a loading spinner is shown during the fetch

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

### Requirement: User-scoped project queries

Projects SHALL be scoped to the authenticated user. Users only see projects they own. Collaborators cannot see project details. Admins and super users see all projects.

#### Scenario: Owner sees own projects

- **GIVEN** a user who owns projects
- **WHEN** the user navigates to the projects page
- **THEN** only projects the user owns are shown

#### Scenario: Collaborator cannot see projects

- **GIVEN** a user who is a collaborator (not an owner) of projects
- **WHEN** the user navigates to the projects list
- **THEN** the projects the user collaborates on are not visible

#### Scenario: Admin sees all projects

- **GIVEN** an admin user
- **WHEN** the user navigates to the projects list
- **THEN** all projects are shown

### Requirement: Project category display

Project and expense category names SHALL be translated via i18n using the `categoryNames` namespace, keyed by category slug. See `category-management` spec for category CRUD and schema details.

#### Scenario: Project card shows translated category

- **GIVEN** a project with a category
- **WHEN** the project card is displayed
- **THEN** the category name is resolved via `t('categoryNames.<slug>')` with fallback to the DB name

#### Scenario: Project detail shows translated category

- **GIVEN** a project with a category
- **WHEN** the project details subpage is displayed
- **THEN** the category label shows the translated name via `categoryNames.*`

#### Scenario: Expense row shows translated category

- **GIVEN** an expense with a category
- **WHEN** the expense table row is displayed
- **THEN** the category badge shows the translated name via `categoryNames.*`
