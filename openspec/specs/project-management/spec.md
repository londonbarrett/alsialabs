## ADDED Requirements

### Requirement: Project CRUD
The system SHALL allow clients to create, view, edit, and delete projects. Admins and super users SHALL have read-only access to all projects.

#### Scenario: Create project
- **GIVEN** a client user with `projects:create` permission
- **WHEN** the user clicks "New Project" on the projects list page
- **THEN** a dialog opens with a form containing name, category, start/end dates, location, and budget fields
- **WHEN** the user fills in the required fields (name, category, dates, location, budget) and submits
- **THEN** a new project is created and the list refreshes

#### Scenario: View project list
- **GIVEN** a user with `projects:view` permission
- **WHEN** the user navigates to `/dashboard/projects`
- **THEN** projects are displayed as a card grid with name, category, status badge, dates, budget bar, task progress, and collaborator count
- **AND** the header shows "Portfolio" label, "Projects" title, and a subtitle description

#### Scenario: View project detail
- **GIVEN** a user with `projects:view` permission
- **WHEN** the user clicks "View" on a project card
- **THEN** the detail page shows project info (name, status, category, dates, location, budget, expenses) and a task table

#### Scenario: Edit project
- **GIVEN** a user with `projects:edit` permission
- **WHEN** the user clicks "Edit" on the project detail page
- **THEN** a dialog opens with the project's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the project is updated and the page refreshes

#### Scenario: Delete project
- **GIVEN** a user with `projects:delete` permission
- **WHEN** the user clicks "Delete" on the project detail page
- **THEN** a styled confirmation dialog appears with the project name
- **WHEN** the user confirms
- **THEN** the project is deleted and the user is redirected to the projects list

#### Scenario: Update project status inline
- **GIVEN** a user with `projects:edit` permission is viewing a project detail page
- **WHEN** the user selects a different status from the inline status dropdown
- **THEN** the project status changes immediately without a page reload

### Requirement: Project categories (read-only for clients)
The system SHALL allow clients to read project categories for project forms without granting access to the admin categories page.

#### Scenario: Client reads categories for project form
- **GIVEN** a client user
- **WHEN** the user opens the project create/edit dialog
- **THEN** the category dropdown shows all available project categories
- **AND** the client cannot see the "Categories" nav item in the sidebar
- **AND** navigating directly to `/dashboard/categories` returns a forbidden error

### Requirement: Task management
The system SHALL allow clients to manage tasks on their projects.

#### Scenario: Create task
- **GIVEN** a user with `projects:edit` permission is viewing a project detail page
- **WHEN** the user clicks "Add Task"
- **THEN** a dialog opens with fields for title, assignee, dates, status, cost, and notes
- **WHEN** the user fills required fields and submits
- **THEN** the task appears in the task table

#### Scenario: Update task status inline
- **GIVEN** a user with `projects:edit` permission is viewing a project detail page
- **WHEN** the user selects a different status from the inline status dropdown on a task row
- **THEN** the task status changes immediately without a page reload

#### Scenario: Edit task
- **GIVEN** a user with `projects:edit` permission
- **WHEN** the user clicks "Edit" on a task's action menu
- **THEN** a dialog opens with the task's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the task is updated and the table refreshes

#### Scenario: Delete task
- **GIVEN** a user with `projects:edit` permission
- **WHEN** the user clicks "Delete" on a task's action menu
- **THEN** a confirmation dialog appears
- **WHEN** the user confirms
- **THEN** the task is deleted and the table refreshes

### Requirement: Client-scoped project queries
Projects SHALL be scoped to the authenticated client. Clients only see their own projects. Admins and super users see all projects.

#### Scenario: Client sees own projects
- **GIVEN** a client user with projects
- **WHEN** the user navigates to the projects list
- **THEN** only projects belonging to that client are shown

#### Scenario: Admin sees all projects
- **GIVEN** an admin user
- **WHEN** the user navigates to the projects list
- **THEN** all projects across all clients are shown
