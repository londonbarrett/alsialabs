## MODIFIED Requirements

### Requirement: Task management

The system SHALL allow owners to manage tasks on their projects. Tasks are managed on the tasks subpage (`/dashboard/projects/[id]`, the default project subpage). Tasks SHALL carry an optional priority of `urgent` or `high`; tasks with no priority are allowed. Collaborators can view tasks and change status to blocked or in_review only. The tasks section uses a Card component with a ListTodo icon in the header. Task operations (create, edit, delete, status change, priority change) use optimistic updates with useReducer for instant UI feedback, global loading indicator during server requests, and success toasts on completion.

#### Scenario: Create task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Add Task" in the tasks card header on the tasks subpage
- **THEN** a dialog opens with fields for name, description, cost, status, assignee, and priority
- **AND** the assignee dropdown shows project owners and collaborators
- **AND** the priority dropdown defaults to no priority
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

#### Scenario: Edit task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Edit" on a task's action menu
- **THEN** a dialog opens with the task's current values pre-filled, including priority
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
