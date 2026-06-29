## ADDED Requirements

### Requirement: User can view invoices
The system SHALL allow authenticated users with `sales:view` permission to see a table of all invoices.

#### Scenario: Sales page shows invoice list
- **WHEN** the user navigates to the sales page
- **THEN** a table of invoices is displayed with columns: invoice number, client, type, issue date, grand total, status
- **AND** each row has an action menu with view, edit, and delete options (based on permissions)

#### Scenario: Sales nav link hidden without permission
- **GIVEN** a user without `sales:view` permission
- **THEN** the Sales link is not shown in the sidebar

### Requirement: User can create a product-type invoice
The system SHALL allow authenticated users with `sales:create` permission to create a new invoice with product line items via a dialog form.

#### Scenario: Successful product invoice creation
- **WHEN** the user clicks "New Invoice" button
- **THEN** a dialog form appears with fields: client (dropdown), type (product/service toggle), issue date, and a line items table
- **WHEN** the type is set to "product"
- **THEN** each line item row has: product dropdown, quantity, unit price, discount %, tax %, and computed line total
- **WHEN** the user selects a product from the dropdown
- **THEN** the description and unit price are auto-filled from the product catalog
- **WHEN** the user fills in valid data and submits
- **THEN** the form validates on the client side
- **AND** the server action recalculates totals and creates the invoice with line items
- **AND** on success the dialog closes
- **AND** the sales table updates with the new invoice
- **AND** a success toast is shown
- **WHEN** the server returns an error
- **THEN** an error toast is shown
- **AND** the dialog remains open

### Requirement: User can create a service-type invoice
The system SHALL allow authenticated users with `sales:create` permission to create a new invoice with ad-hoc service line items.

#### Scenario: Successful service invoice creation
- **WHEN** the user clicks "New Invoice" button
- **THEN** a dialog form appears with fields: client (dropdown), type (product/service toggle), issue date, and a line items table
- **WHEN** the type is set to "service"
- **THEN** each line item row has: description (free-text), quantity, unit price, discount %, tax %, and computed line total
- **WHEN** the user fills in valid data and submits
- **THEN** the invoice is created with service-type line items
- **AND** the line items have no product reference

### Requirement: User can add and remove line items
The system SHALL allow users to dynamically add or remove line item rows in the invoice form.

#### Scenario: Add a line item
- **WHEN** the user clicks "Add Item" button
- **THEN** a new empty line item row is added to the line items table

#### Scenario: Remove a line item
- **WHEN** the user clicks the remove button on a line item row
- **THEN** that row is removed from the line items table
- **AND** the totals are recalculated

### Requirement: Totals auto-calculate
The system SHALL compute line totals and invoice grand total in real-time as the user edits line items.

#### Scenario: Line total updates on qty or price change
- **WHEN** the user changes quantity, unit price, discount %, or tax % on a line item
- **THEN** the line total updates to: qty × unit_price × (1 - discount%/100) × (1 + tax%/100)

#### Scenario: Invoice totals update
- **WHEN** any line item changes
- **THEN** subtotal, discount total, tax total, and grand total are updated in the form footer

### Requirement: User can edit an invoice
The system SHALL allow authenticated users with `sales:edit` permission to edit an existing invoice via the same dialog form.

#### Scenario: Successful invoice edit
- **WHEN** the user clicks the edit action in an invoice's row action menu
- **THEN** a dialog form appears pre-filled with that invoice's data including all line items
- **WHEN** the user modifies line items and submits
- **THEN** the server action updates the invoice and replaces all line items
- **AND** on success the dialog closes
- **AND** the sales table reflects the updated data

### Requirement: User can delete an invoice
The system SHALL allow authenticated users with `sales:delete` permission to delete an invoice after confirmation.

#### Scenario: Successful invoice deletion
- **WHEN** the user clicks the delete action in an invoice's row action menu
- **THEN** a confirmation dialog is shown
- **WHEN** the user confirms the deletion
- **THEN** the invoice and its line items are removed
- **AND** a success toast is shown

### Requirement: Invoice numbers are auto-generated
The system SHALL generate unique invoice numbers in the format INV-YYYYMMDD-NNNN using a global sequential counter.

#### Scenario: Invoice number assigned on creation
- **WHEN** an invoice is created
- **THEN** it receives an auto-generated number like INV-20260628-0001
- **AND** the sequence increments atomically
- **AND** the invoice number is unique and immutable

### Requirement: Server actions require authentication and permission
The system SHALL reject unauthenticated or unauthorized requests to create, update, or delete invoices.

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated user attempts to call the server action
- **THEN** the action returns an unauthorized error
- **AND** no data is modified

#### Scenario: Delete action requires sales:delete permission
- **WHEN** a user without `sales:delete` permission calls the delete action
- **THEN** the action returns an error
- **AND** the invoice is not deleted

### Requirement: Server-side validation and sanitization
The system SHALL validate and sanitize all input on the server, including recalculating all totals to prevent tampering.

#### Scenario: Malformed invoice data is rejected
- **WHEN** the server receives invalid invoice data
- **THEN** the server rejects with a validation error
- **AND** no data is modified

#### Scenario: Tampered totals are corrected
- **WHEN** the server receives invoice data with manipulated totals
- **THEN** the server recalculates all totals from the raw line item data
- **AND** stores the correct computed values

### Requirement: Invoice form is accessible
The dialog and form SHALL be keyboard-navigable and screen-reader friendly.

#### Scenario: Keyboard navigation works
- **WHEN** the dialog is open
- **THEN** focus is trapped within the dialog
- **AND** the Escape key closes the dialog
- **AND** Tab navigates through form fields and line items in logical order

#### Scenario: Screen reader announces dialog purpose
- **WHEN** the dialog opens
- **THEN** screen readers announce the dialog title ("New Invoice" or "Edit Invoice")
- **AND** all form fields have associated labels

### Requirement: Invoice form is reusable
The form component SHALL be a reusable component that can be used outside the dialog context.

#### Scenario: Form works standalone
- **WHEN** the form is rendered outside a dialog
- **THEN** it renders all fields and line items correctly
- **AND** accepts an optional `invoice` prop for edit mode
- **AND** accepts an `onSubmit` callback for custom submission handling
