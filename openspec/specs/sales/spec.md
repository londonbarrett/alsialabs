## MODIFIED Requirements

### Requirement: User can view invoices
The system SHALL allow authenticated users with `sales:view` permission to see a table of all invoices regardless of who created them.

#### Scenario: Sales page shows all invoices
- **WHEN** a user with `sales:view` permission navigates to the sales page
- **THEN** a table of all invoices is displayed with columns: invoice number, client, type, issue date, grand total, status

#### Scenario: Sales nav link hidden without permission
- **GIVEN** a user without `sales:view` permission
- **THEN** the Sales link is not shown in the sidebar

### Requirement: User can delete an invoice
The system SHALL allow authenticated users with `sales:delete` permission to delete an invoice after confirmation. Non-admin users may only delete their own invoices.

#### Scenario: User deletes own invoice
- **WHEN** a non-admin user clicks the delete action on an invoice they created
- **THEN** the invoice is deleted after confirmation

#### Scenario: Admin deletes any invoice
- **WHEN** an admin user clicks the delete action on any invoice
- **THEN** the invoice is deleted after confirmation

#### Scenario: User cannot delete others' invoices
- **WHEN** a non-admin user attempts to delete an invoice they did not create
- **THEN** the action is rejected

## ADDED Requirements

### Requirement: User can create a product-type invoice
The system SHALL allow authenticated users with `sales:create` permission to create a new invoice with product line items via a dialog form.

#### Scenario: Successful product invoice creation
- **WHEN** the user clicks "New Invoice" button
- **THEN** a dialog form appears with fields: client (autocomplete combobox), type (product/service toggle), issue date, and a line items table
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
- **THEN** a dialog form appears with fields: client (autocomplete combobox), type (product/service toggle), issue date, and a line items table
- **WHEN** the type is set to "service"
- **THEN** each line item row has: description (free-text), quantity, unit price, discount %, tax %, and computed line total
- **WHEN** the user fills in valid data and submits
- **THEN** the invoice is created with service-type line items
- **AND** the line items have no product reference

### Requirement: Client field is a searchable combobox
The system SHALL use a searchable autocomplete combobox for the client field in the invoice form, integrated with Base UI's combobox pattern via a reusable `ClientCombobox` component.

#### Scenario: User can search clients by name
- **WHEN** the user types in the client field
- **THEN** the dropdown filters to show only clients whose name matches the typed text
- **AND** the filtering is case-insensitive and client-side only

#### Scenario: User selects a client from the dropdown
- **WHEN** the user clicks or presses Enter on a client option
- **THEN** the field shows the selected client's name

#### Scenario: Combobox supports initial value for edit mode
- **WHEN** the invoice form opens in edit mode
- **THEN** the client field is pre-populated with the existing invoice's client
- **AND** the dropdown shows all other clients as options

#### Scenario: No inline client creation
- **WHEN** the user types a name that doesn't match any client
- **THEN** the dropdown shows no results
- **AND** there is no option to create a new client inline

#### Scenario: Combobox works inside a dialog
- **WHEN** the invoice form is inside a dialog
- **THEN** the combobox dropdown renders above the dialog overlay
- **AND** clicking a client option dismisses the dropdown

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

### Requirement: Invoice numbers are auto-generated
The system SHALL generate unique invoice numbers.

#### Scenario: Invoice number assigned on creation
- **WHEN** an invoice is created
- **THEN** it receives an auto-generated number
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

### Requirement: User can view monthly revenue chart
The sales page SHALL display a stacked bar chart showing monthly revenue split by invoice type (product/service). Revenue SHALL be computed from invoice items, excluding items with `unit_price = 0`. The chart tooltip SHALL display quantity sold alongside revenue for each bar segment.

#### Scenario: Revenue chart shows data grouped by month and type
- **WHEN** a user with `sales:view` permission visits the sales page
- **THEN** they see a stacked bar chart with months on the x-axis and revenue on the y-axis
- **AND** each month's bar is split into product revenue and service revenue segments

#### Scenario: Revenue chart shows all available data
- **WHEN** there are invoices dating back multiple years
- **THEN** the chart SHALL display every month that has invoice data, ordered chronologically

#### Scenario: Revenue chart shows empty state
- **WHEN** there are no invoices in the system
- **THEN** the chart area SHALL display a placeholder message indicating no data

#### Scenario: Tooltip shows quantity sold alongside revenue
- **WHEN** a user hovers over a bar segment in the monthly revenue chart
- **THEN** the tooltip SHALL display both the revenue amount and the quantity sold for that segment

#### Scenario: Items with zero unit price are excluded
- **WHEN** an invoice item has `unit_price = 0`
- **THEN** that item SHALL NOT be included in the revenue or quantity calculations

### Requirement: User can view top clients by revenue
The sales page SHALL display a horizontal bar chart ranking the top 10 clients by total invoice amount.

#### Scenario: Top clients chart shows highest revenue clients
- **WHEN** a user with `sales:view` permission visits the sales page
- **THEN** they see a horizontal bar chart with client names on the y-axis and total revenue on the x-axis
- **AND** clients are ordered from highest to lowest revenue
- **AND** at most 10 clients are shown

#### Scenario: Top clients chart shows empty state
- **WHEN** there are no invoices in the system
- **THEN** the chart area SHALL display a placeholder message indicating no data
