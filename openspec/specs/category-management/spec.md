## MODIFIED Requirements

### Requirement: Category management

The system SHALL provide a unified category system organized by taxonomy. Each taxonomy (e.g., "project", "expense") groups related categories. Categories are managed via an admin UI at `/dashboard/categories` with tabbed navigation per taxonomy.

#### Schema

- **taxonomy**: id (PK), slug (unique), name, description
- **category**: id (PK), taxonomy_id (FK → taxonomy, cascade), slug, name, description; unique on (taxonomy_id, slug)
- **project.category_id** → category.id
- **expense.category_id** → category.id

#### Scenario: View categories admin page

- **GIVEN** a user with `categories:view` permission
- **WHEN** the user navigates to `/dashboard/categories`
- **THEN** a PageHeader with a FolderTree icon and the "Categories" title is displayed
- **AND** a tabbed interface shows one tab per taxonomy (e.g., "Project Categories", "Expense Categories")
- **AND** each tab displays a Card containing the taxonomy name as the CardHeader title, an "Add Category" button, and a table of categories with name, slug, and description columns
- **AND** taxonomy tab labels and category names are translated via i18n (`taxonomyNames.*`, `categoryNames.*`)

#### Scenario: Create category

- **GIVEN** a user with `categories:create` permission
- **WHEN** the user clicks "Add Category" on a taxonomy tab
- **THEN** a dialog opens with a form containing name, slug, and description fields
- **WHEN** the user fills in required fields (name, slug) and submits
- **THEN** the category is created and appears immediately in the table via optimistic update
- **AND** a success toast confirms the creation

#### Scenario: Edit category

- **GIVEN** a user with `categories:edit` permission
- **WHEN** the user clicks "Edit" on a category row
- **THEN** a dialog opens with the category's current values pre-filled
- **WHEN** the user modifies fields and submits
- **THEN** the category is updated and the table reflects changes via optimistic update
- **AND** a success toast confirms the update

#### Scenario: Delete category

- **GIVEN** a user with `categories:delete` permission
- **WHEN** the user clicks "Delete" on a category row
- **THEN** a confirmation dialog appears
- **WHEN** the user confirms
- **THEN** the category is removed immediately via optimistic update
- **AND** a success toast confirms the deletion

#### Scenario: Slug uniqueness per taxonomy

- **GIVEN** a user creating or editing a category
- **WHEN** the user enters a slug that already exists within the same taxonomy
- **THEN** the form shows a validation error "This slug is already in use"
- **AND** the form prevents submission until the slug is unique

### Requirement: Category name translations

Category names SHALL be translated via i18n using the `categoryNames` namespace, keyed by category slug. Taxonomy names SHALL be translated via the `taxonomyNames` namespace, keyed by taxonomy slug. Components SHALL use `t.has()` to check for translation existence and fall back to the DB-stored name for custom categories without i18n keys.

#### Scenario: Display translated category name

- **GIVEN** a category with slug "crop"
- **WHEN** the category name is displayed in a component
- **THEN** the component resolves `t('categoryNames.crop')` which returns "Crop" in English or "Cultivo" in Spanish

#### Scenario: Fallback for custom category

- **GIVEN** a category with slug "custom-slug" that has no i18n key
- **WHEN** the category name is displayed
- **THEN** the component falls back to the DB-stored `name` column value

#### Scenario: Category names in dropdowns

- **GIVEN** a project or expense form with a category dropdown
- **WHEN** the dropdown renders category options
- **THEN** each option label is translated via `categoryNames.*` with fallback to the DB name

### Requirement: Category read access for non-admin users

Non-admin users (e.g., project owners) SHALL be able to read categories for use in project and expense forms without requiring `categories:view` permission on the admin page.

#### Scenario: Client reads categories for project form

- **GIVEN** a user with `projects:create` permission but not `categories:view`
- **WHEN** the user opens the project create/edit dialog
- **THEN** the category dropdown shows all available project categories
- **AND** the user cannot see the "Categories" nav item in the sidebar
- **AND** navigating directly to `/dashboard/categories` returns a forbidden error
