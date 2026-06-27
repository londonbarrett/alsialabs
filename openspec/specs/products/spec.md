## ADDED Requirements

### Requirement: User can view products
The system SHALL allow authenticated users with `products:view` permission to see a table of all products.

#### Scenario: Products page shows product list
- **WHEN** the user navigates to the products page
- **THEN** a table of products is displayed with columns: name, provider, sku, unit
- **AND** each row has an action menu with edit and delete options

#### Scenario: Products nav link hidden without permission
- **GIVEN** a user without `products:view` permission
- **THEN** the Products link is not shown in the sidebar

### Requirement: User can add a product
The system SHALL allow authenticated users with `products:create` permission to add a new product via a dialog form.

#### Scenario: Successful product creation
- **WHEN** the user clicks "Add Product" button
- **THEN** a dialog form appears with fields: name, provider, sku, unit, description
- **WHEN** the user fills in valid data and submits
- **THEN** the form validates on the client side
- **AND** the server action is called with the data
- **AND** on success the dialog closes
- **AND** the products table updates with the new product
- **AND** a success toast is shown
- **WHEN** the server returns an error
- **THEN** an error toast is shown
- **AND** the dialog remains open

### Requirement: User can edit a product
The system SHALL allow authenticated users with `products:edit` permission to edit an existing product via the same dialog form, pre-filled with the product's current data.

#### Scenario: Successful product edit
- **WHEN** the user clicks the edit action in a product's row action menu
- **THEN** a dialog form appears pre-filled with that product's data
- **WHEN** the user modifies the data and submits
- **THEN** the form validates on the client side
- **AND** the server action is called with the updated data
- **AND** on success the dialog closes
- **AND** the products table reflects the updated data
- **AND** a success toast is shown
- **WHEN** the server returns an error
- **THEN** an error toast is shown
- **AND** the dialog remains open

### Requirement: User can delete a product
The system SHALL allow authenticated users with `products:delete` permission to delete a product after confirmation.

#### Scenario: Successful product deletion
- **WHEN** the user clicks the delete action in a product's row action menu
- **THEN** a confirmation dialog is shown
- **WHEN** the user confirms the deletion
- **THEN** the product is removed from the table
- **AND** a success toast is shown

#### Scenario: Delete product with existing references is blocked
- **WHEN** the user attempts to delete a product that has related records
- **THEN** an error toast is shown
- **AND** the product is not deleted

### Requirement: Duplicate SKUs are rejected
The system SHALL prevent creating or updating a product with a SKU that already exists in the database.

#### Scenario: Duplicate SKU detected
- **WHEN** the user enters a SKU that already exists in the database
- **THEN** the form shows a validation error for the sku field
- **AND** the submission is blocked

### Requirement: Form validation catches invalid data
The system SHALL validate form input on the client before submitting to the server, and display inline error messages for invalid fields.

#### Scenario: Invalid data submission is blocked
- **WHEN** the user submits the form with invalid or missing required fields
- **THEN** the form highlights the invalid fields with error messages
- **AND** the server action is not called

### Requirement: Server actions require authentication and permission
The system SHALL reject unauthenticated or unauthorized requests to create, update, or delete products.

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated user attempts to call the server action
- **THEN** the action returns an unauthorized error
- **AND** no data is modified

#### Scenario: Delete action requires products:delete permission
- **WHEN** a user without `products:delete` permission calls the delete action
- **THEN** the action returns an error
- **AND** the product is not deleted

### Requirement: Provider seeding
The system SHALL seed the company as a provider in the providers table for in-house product references.

#### Scenario: Company provider exists after seeding
- **WHEN** the database seed script runs
- **THEN** the company is created as a provider record
- **AND** products module permissions are created for all roles

### Requirement: Dialog is accessible
The dialog and form SHALL be keyboard-navigable and screen-reader friendly.

#### Scenario: Keyboard navigation works
- **WHEN** the dialog is open
- **THEN** focus is trapped within the dialog
- **AND** the Escape key closes the dialog
- **AND** Tab navigates through form fields in logical order

#### Scenario: Screen reader announces dialog purpose
- **WHEN** the dialog opens
- **THEN** screen readers announce the dialog title ("Add Product" or "Edit Product")
- **AND** all form fields have associated labels
