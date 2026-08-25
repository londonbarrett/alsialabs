## MODIFIED Requirements

### Requirement: Project CRUD

The system SHALL allow owners to create, view, edit, and delete projects. The primary owner and super users SHALL have full control. Projects SHALL carry a required color chosen from a fixed palette of 6 colors; the color identifies the project on cards and calendar events but is not unique across projects. Owners can manage collaborators and tasks. Collaborators can view projects and comment on tasks.

#### Scenario: Create project

- **GIVEN** a user with `projects:create` permission
- **WHEN** the user clicks "New Project" on the projects list page
- **THEN** a dialog opens with a form containing name, category, start/end dates, location, budget, and color fields
- **AND** the color field offers exactly 6 selectable swatches and has no default selection
- **WHEN** the user fills in the required fields (name, category, dates, location, budget) and submits without choosing a color
- **THEN** a "color is required" validation error is shown and no project is created
- **WHEN** the user fills in the required fields including a color and submits
- **THEN** a new project is created with the chosen color and the user as primary owner
- **AND** the user is added to the project_owners table

#### Scenario: View project list

- **GIVEN** a user with `projects:view` permission
- **WHEN** the user navigates to `/dashboard/projects`
- **THEN** projects are displayed as a card grid with name, category, status badge, dates, budget bar, task progress, and primary owner shown with a crown icon
- **AND** each card shows the project's color as a dot next to the project name
- **AND** the header shows "Portfolio" label, "Projects" title, and a subtitle description

#### Scenario: Project card links to detail

- **GIVEN** a user viewing the projects list
- **WHEN** the user clicks on a project card's title
- **THEN** the user is navigated to `/dashboard/projects/[id]`
- **AND** the tasks subpage is shown by default

#### Scenario: View project details subpage

- **GIVEN** a user who is an owner of the project
- **WHEN** the user navigates to `/dashboard/projects/[id]/details`
- **THEN** the details subpage shows the project info in a Card with entries ordered: primary owner, category, color, location, start date, end date, budget, and description
- **AND** the color entry shows the project's color as a swatch with its localized color name
- **AND** edit and delete buttons appear in the details card footer

#### Scenario: Edit project

- **GIVEN** a user who is an owner of the project or a super user
- **WHEN** the user clicks the secondary "Edit" button in the project details footer
- **THEN** a dialog opens with the project's current values pre-filled, including its current color selected among the 6 swatches
- **WHEN** the user modifies fields (optionally picking a different color) and submits
- **THEN** the project is updated and the page refreshes

#### Scenario: Colors may repeat across projects

- **GIVEN** two projects owned by any users
- **WHEN** an owner creates or edits a project choosing a color already used by another project
- **THEN** the choice is accepted; colors are not unique across projects

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
