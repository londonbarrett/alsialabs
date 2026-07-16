## MODIFIED Requirements

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

#### Scenario: View project detail
- **GIVEN** a user with `projects:view` permission
- **WHEN** the user clicks "View" on a project card
- **THEN** the detail page shows project info (name, status, category, dates, location, budget, expenses), owner/collaborator management sections, and a task table

#### Scenario: Edit project
- **GIVEN** a user who is an owner of the project or a super user
- **WHEN** the user clicks "Edit" on the project detail page
- **THEN** a dialog opens with the project's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the project is updated and the page refreshes

#### Scenario: Delete project
- **GIVEN** a user who is the primary owner of the project or a super user
- **WHEN** the user clicks "Delete" on the project detail page
- **THEN** a styled confirmation dialog appears with the project name
- **WHEN** the user confirms
- **THEN** the project is deleted and the user is redirected to the projects list

#### Scenario: Update project status inline
- **GIVEN** a user who is an owner of the project or a super user
- **WHEN** the user selects a different status from the inline status dropdown
- **THEN** the project status changes immediately without a page reload

#### Scenario: Collaborator cannot edit project
- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user views the project detail page
- **THEN** the edit button and status dropdown are not visible

### Requirement: Project ownership model
Projects SHALL support multiple owners and collaborators. The primary owner has full control. Owners can manage collaborators and tasks. Collaborators can view and comment on tasks.

#### Scenario: Primary owner manages owners
- **GIVEN** a user who is the primary owner of a project
- **WHEN** the user views the project detail page
- **THEN** an "Owners" section is visible with a dropdown to add owners
- **AND** a remove button appears next to each non-primary owner

#### Scenario: Non-primary owner cannot manage owners
- **GIVEN** a user who is an owner (but not primary) of a project
- **WHEN** the user views the project detail page
- **THEN** the add/remove owner controls are not visible

#### Scenario: Primary owner can transfer ownership
- **GIVEN** a user who is the primary owner of a project
- **WHEN** the user selects another owner as primary owner
- **THEN** the ownership is transferred and the page refreshes

#### Scenario: Owner manages collaborators
- **GIVEN** a user who is an owner of a project
- **WHEN** the user views the project detail page
- **THEN** a "Collaborators" section is visible with a dropdown to add collaborators
- **AND** a remove button appears next to each collaborator

#### Scenario: Collaborator cannot manage collaborators
- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user views the project detail page
- **THEN** the add/remove collaborator controls are not visible

### Requirement: Task management
The system SHALL allow owners to manage tasks on their projects. Collaborators can view tasks and change status to blocked or in_review only.

#### Scenario: Create task
- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Add Task"
- **THEN** a dialog opens with fields for name, description, cost, status, and assignee
- **AND** the assignee dropdown shows project owners and collaborators
- **WHEN** the user fills required fields and submits
- **THEN** the task appears in the task table with the assignee name displayed

#### Scenario: Collaborator can change task status to blocked or in_review
- **GIVEN** a user who is a collaborator of a project
- **WHEN** the user views the task table
- **THEN** the status dropdown is restricted to "blocked" and "in_review" options only

#### Scenario: Collaborator cannot create or delete tasks
- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user views the task table
- **THEN** the "Add Task" button and task action menus are not visible

#### Scenario: Update task status inline
- **GIVEN** a user who is an owner of the project
- **WHEN** the user selects a different status from the inline status dropdown on a task row
- **THEN** the task status changes immediately without a page reload

#### Scenario: Edit task
- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Edit" on a task's action menu
- **THEN** a dialog opens with the task's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the task is updated and the table refreshes

#### Scenario: Delete task
- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Delete" on a task's action menu
- **THEN** a confirmation dialog appears
- **WHEN** the user confirms
- **THEN** the task is deleted and the table refreshes

### Requirement: User-scoped project queries
Projects SHALL be scoped to the authenticated user. Users only see projects they own or collaborate on. Admins and super users see all projects.

#### Scenario: Owner sees own projects
- **GIVEN** a user who owns or collaborates on projects
- **WHEN** the user navigates to the projects list
- **THEN** only projects the user owns or collaborates on are shown

#### Scenario: Admin sees all projects
- **GIVEN** an admin user
- **WHEN** the user navigates to the projects list
- **THEN** all projects are shown

### Requirement: Project categories (read-only for clients)
The system SHALL allow clients to read project categories for project forms without granting access to the admin categories page.

#### Scenario: Client reads categories for project form
- **GIVEN** a client user
- **WHEN** the user opens the project create/edit dialog
- **THEN** the category dropdown shows all available project categories
- **AND** the client cannot see the "Categories" nav item in the sidebar
- **AND** navigating directly to `/dashboard/categories` returns a forbidden error
