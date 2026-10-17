# Products — Design

## Why this exists

Products are the catalog everything else references: sales and invoices point back at them, so their identity has to be stable and unambiguous. A duplicate SKU would make two catalog entries indistinguishable to anything that looks a product up by code, which is why uniqueness is enforced at the moment of entry rather than trusted to the operator.

Managing the catalog is a permissioned, routine CRUD surface. Reading requires `products:view`, creating requires `products:create`, editing `products:edit`, and deleting `products:delete` — the sidebar link itself only appears for users who can view products. The page is built around a single dialog form reused for both create and edit, which keeps the field set and validation in one place and means an "Add Product" and an "Edit Product" don't drift apart.

Two details shape the rest. Deletion is guarded: a product referenced by other records isn't removed, it fails with a toast. And the module ships with seed data — the company itself is seeded as a provider so in-house products have something to reference, and the products permissions are seeded for every role so the surface is usable out of the box.

## Goals

- List all products for users with `products:view`, with an actions menu per row.
- Create and edit products through one shared dialog, gated by `products:create` and `products:edit`.
- Delete a product only after confirmation, gated by `products:delete`, blocking deletes that have references.
- Reject duplicate SKUs.
- Validate input on the client before any server call, with inline errors.
- Reject unauthenticated and unauthorized requests on the server, changing no data.
- Seed the company as a provider and seed products permissions for all roles.
- Keep the dialog keyboard-navigable and screen-reader friendly.

## Design

### Permissions and the product list

Authenticated users with `products:view` see a table of all products with columns for name, provider, sku, and unit. Each row carries an action menu offering edit and delete. Users without `products:view` don't see the Products link in the sidebar at all — visibility in navigation follows the same permission that opens the page.

### One dialog for create and edit

The same dialog form serves both operations, with fields for name, provider, sku, unit, and description, titled "Add Product" or "Edit Product" as appropriate. Clicking "Add Product" opens it empty; choosing edit from a row's action menu opens it pre-filled with that product's current data. Submitting runs client-side validation, then calls the server action with the data. On success the dialog closes, the table reflects the change, and a success toast appears. On error an error toast appears and the dialog stays open so the entered data isn't lost.

### Validation, including duplicate SKUs

The form validates input on the client before submitting. Invalid or missing required fields are highlighted with inline error messages and the server action is not called at all. A SKU that already exists in the database produces a validation error on the `sku` field and blocks the submission, preventing both creates and updates from colliding with an existing code.

### Deletion with confirmation

Choosing delete from a row's action menu opens a confirmation dialog rather than deleting outright. Confirming removes the product from the table and shows a success toast. If the product has related records, the delete is refused: an error toast appears and the product is left intact.

### Server-side enforcement

The create, update, and delete actions reject unauthenticated callers with an unauthorized error and modify no data. A caller lacking the relevant permission — for example a user without `products:delete` invoking the delete action — receives an error and the product is not deleted. Client validation speeds up the happy path; the server still stands on its own.

### Provider seeding

The database seed script creates the company as a provider record in the providers table, giving in-house product references a provider to point at, and creates the products module permissions for all roles so the catalog works for every role from first run.

### Dialog accessibility

The dialog is keyboard-navigable and screen-reader friendly. While it's open, focus is trapped within the dialog, Escape closes it, and Tab moves through the form fields in logical order. On open, screen readers announce the dialog title ("Add Product" or "Edit Product"), and every form field has an associated label.

## Non-goals

- Inline editing in the products table. Every create and edit goes through the dialog form.
- Deleting without confirmation, or deleting products that still have references.
- Relying on client validation alone. The server actions independently require authentication and the appropriate permission and change nothing when they reject a request.
- A separate dialog or field set for editing. Create and edit share one form.
