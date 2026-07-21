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

#### Scenario: Project card links to detail

- **GIVEN** a user viewing the projects list
- **WHEN** the user clicks on a project card's title
- **THEN** the user is navigated to the project detail page

#### Scenario: View project detail

- **GIVEN** a user who is an owner of the project
- **WHEN** the user navigates to the project detail page
- **THEN** the detail page shows project info in Card sections (details, co-owners, collaborators, tasks)
- **AND** primary owner is shown in the details card
- **AND** co-owners section excludes the primary owner
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
- **WHEN** the user selects a different status from the inline status dropdown
- **THEN** the project status changes immediately without a page reload

#### Scenario: Collaborator cannot view project

- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user navigates to the project detail page
- **THEN** the project is not visible (only owners can access project details)

### Requirement: Project ownership model

Projects SHALL support multiple owners and collaborators. The primary owner has full control. Owners can manage collaborators and tasks. Collaborators can view and comment on tasks.

#### Scenario: Primary owner manages co-owners

- **GIVEN** a user who is the primary owner of a project
- **WHEN** the user views the project detail page
- **THEN** a "Co-owners" section is visible with a combobox to search for users to add
- **AND** a remove button appears next to each non-primary owner

#### Scenario: Non-primary owner cannot manage owners

- **GIVEN** a user who is an owner (but not primary) of a project
- **WHEN** the user views the project detail page
- **THEN** the add/remove co-owner controls are not visible

#### Scenario: Primary owner can transfer ownership

- **GIVEN** a user who is the primary owner of a project
- **WHEN** the user selects another owner as primary owner
- **THEN** the ownership is transferred and the page refreshes

#### Scenario: Owner manages collaborators

- **GIVEN** a user who is an owner of a project
- **WHEN** the user views the project detail page
- **THEN** a "Collaborators" section is visible with a combobox to search for users to add
- **AND** a remove button appears next to each collaborator

#### Scenario: Collaborator cannot manage collaborators

- **GIVEN** a user who is a collaborator (not an owner) of a project
- **WHEN** the user views the project detail page
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

The system SHALL allow owners to manage tasks on their projects. Collaborators can view tasks and change status to blocked or in_review only. The tasks section uses a Card component with a ListTodo icon in the header.

#### Scenario: Create task

- **GIVEN** a user who is an owner of the project
- **WHEN** the user clicks "Add Task" in the tasks card header
- **THEN** a dialog opens with fields for name, description, cost, status, and assignee
- **AND** the assignee dropdown shows project owners and collaborators
- **WHEN** the user fills required fields and submits
- **THEN** the task appears in the task table with the assignee name displayed

#### Scenario: Collaborator can change task status to blocked or in_review

- **GIVEN** a user who is a collaborator of a project
- **WHEN** the user views the task table
- **THEN** the status dropdown (TaskStatusSelect component) is restricted to "blocked" and "in_review" options only

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

#### Scenario: Task row shows comment count

- **GIVEN** a user viewing the task table
- **WHEN** tasks are displayed
- **THEN** each task row shows a comment count next to a MessageSquare icon
- **AND** the count is always visible, including 0

#### Scenario: Double-click task row opens comments

- **GIVEN** a user viewing the task table
- **WHEN** the user double-clicks anywhere on a task row
- **THEN** the comments panel opens as a slide-over Sheet

### Requirement: Task comments

The system SHALL allow project members (owners and collaborators) to have conversations on tasks. Comments are displayed in a slide-over Sheet panel. Only the comment author or project owners can delete comments. Only the comment author can edit their own comments.

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
- **THEN** the project name is shown as description text (muted)
- **AND** the task name is shown as the title (bold, with MessageSquare icon)
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
- **THEN** the comment is created with the current user as author
- **AND** the comments list updates to show the new comment
- **AND** the comment count on the task row increments

#### Scenario: Edit own comment in place

- **GIVEN** a user viewing a comment they authored
- **WHEN** the user hovers over the comment
- **THEN** a pencil (edit) icon appears
- **WHEN** the user clicks the edit icon
- **THEN** the comment content becomes an editable textarea
- **AND** Save and Cancel buttons appear below the textarea
- **WHEN** the user modifies the content and clicks Save (or presses Enter)
- **THEN** the comment is updated and "(edited)" appears in the timestamp
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
- **THEN** the comment is deleted and the comments list updates
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

### Requirement: My Tasks page

The system SHALL provide a "My Tasks" page accessible from the sidebar that shows all tasks assigned to the current user across all projects they have access to.

#### Scenario: Navigate to My Tasks

- **GIVEN** a user logged into the dashboard
- **WHEN** the user clicks "My Tasks" in the sidebar
- **THEN** the user is navigated to `/dashboard/my-tasks`

#### Scenario: View assigned tasks

- **GIVEN** a user on the My Tasks page
- **WHEN** the page loads
- **THEN** a table is displayed with all tasks assigned to the current user
- **AND** each row shows task name, project name, status, cost, and comment count

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
- **THEN** the task status changes immediately
- **AND** collaborators cannot set status to "done" (restricted to todo, in_progress, in_review, blocked)

#### Scenario: Open comments from My Tasks

- **GIVEN** a user on the My Tasks page
- **WHEN** the user double-clicks a task row or clicks the comment count button
- **THEN** the comments panel opens as a slide-over Sheet

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

### Requirement: Project categories (read-only for clients)

The system SHALL allow clients to read project categories for project forms without granting access to the admin categories page.

#### Scenario: Client reads categories for project form

- **GIVEN** a client user
- **WHEN** the user opens the project create/edit dialog
- **THEN** the category dropdown shows all available project categories
- **AND** the client cannot see the "Categories" nav item in the sidebar
- **AND** navigating directly to `/dashboard/categories` returns a forbidden error
