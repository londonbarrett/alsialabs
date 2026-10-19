# Category management — Design

## Why this exists

Projects and expenses both need to be classified, but a single flat list of categories would collide as the taxonomy grows — a "crop" category for projects means nothing next to a "crop" category for expenses. Categories are therefore grouped under taxonomies ("project", "expense"), each taxonomy owning its own set of categories with slugs unique only within that taxonomy. The database mirrors this: `taxonomy` (id PK, slug unique, name, description) and `category` (id PK, `taxonomy_id` FK cascade, slug, name, description, unique on (`taxonomy_id`, slug)), with `project.category_id` and `expense.category_id` pointing into `category`.

Two audiences share one dataset. Admins manage categories in a dedicated UI; ordinary users — for example someone creating a project — need to read categories in dropdowns without ever seeing the admin surface. Keeping those access paths separate is what lets the admin page be strictly permissioned while forms stay usable for everyone who can create the thing being categorized.

Category names also straddle two languages: built-in categories should translate with the app, while user-created ones only exist in the database. The i18n scheme handles both with one lookup pattern.

## Goals

- Provide a single category system organized by taxonomy, backing project and expense classification.
- Let admins manage categories with optimistic CRUD behind fine-grained permissions.
- Translate built-in category and taxonomy names while gracefully falling back to DB names.
- Let non-admin users read categories for forms without access to the admin page.

## Design

### Taxonomy data model

Every category belongs to exactly one taxonomy, enforced by the `taxonomy_id` foreign key with cascade delete, and its slug is unique only within that taxonomy — the same slug may exist under two different taxonomies. Projects and expenses reference categories directly (`project.category_id`, `expense.category_id`), so the taxonomy a category belongs to is what determines where it can be picked.

### Admin page

The admin UI lives at `/app/categorias`, gated on `categories:view`. It renders a `PageHeader` with a `FolderTree` icon and the "Categories" title, followed by a tabbed interface with one tab per taxonomy — "Project Categories", "Expense Categories", and so on, labels translated via `taxonomyNames.*`. Each tab shows a `Card` whose header carries the taxonomy name, an "Add Category" button, and a table of that taxonomy's categories with name, slug, and description columns. Category names in the table resolve through `categoryNames.*`.

### Category CRUD

Create, edit, and delete each run optimistically against the table with a success toast on completion, gated by their own permissions:

- **Create** requires `categories:create`. "Add Category" opens a dialog with name, slug, and description fields; name and slug are required. On submit the category is created and appears immediately in the table, and a success toast confirms it.
- **Edit** requires `categories:edit`. "Edit" on a row opens the same dialog pre-filled with the category's current values; on submit the table reflects the changes optimistically, with a success toast.
- **Delete** requires `categories:delete`. "Delete" on a row asks for confirmation first; confirming removes the row immediately via optimistic update, with a success toast.

### Slug uniqueness per taxonomy

Because slugs key the i18n lookups, uniqueness matters — but only within a taxonomy. When a user enters a slug that already exists in the same taxonomy, the form shows a validation error, "This slug is already in use", and blocks submission until the slug is unique. The same rule applies to both create and edit.

### Translated names with DB fallback

Category names resolve through the `categoryNames` i18n namespace keyed by category slug, and taxonomy names through `taxonomyNames` keyed by taxonomy slug: a category with slug `crop` renders `t('categoryNames.crop')` — "Crop" in English, "Cultivo" in Spanish. Custom categories have no i18n key, so components check `t.has()` first and fall back to the DB-stored `name` column when no translation exists. Dropdowns on project and expense forms use the same pattern — translated label where a key exists, DB name otherwise — so built-in and custom categories render uniformly everywhere.

### Read access separate from admin access

Reading categories for use in a form is not an admin capability. A user with `projects:create` but without `categories:view` still gets the full category dropdown in the project create/edit dialog, while the "Categories" nav item stays hidden from their sidebar and navigating directly to `/app/categorias` returns a forbidden error. Read access for consumption and management access are deliberately decoupled: forms work for anyone who can create the object being categorized, and the admin page remains closed to them.

## Non-goals

- User-defined taxonomies. The taxonomy set is fixed ("project", "expense", …); only categories are CRUD'd.
- Slug uniqueness across taxonomies — uniqueness is scoped per taxonomy by design.
- Managing taxonomies themselves in the UI; they are schema, not data entry.
- Permission-gated category reads in forms. Dropdown reads require no `categories:view`.
