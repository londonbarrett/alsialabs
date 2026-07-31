## MODIFIED Requirements

### Requirement: User can view invoices
The system SHALL allow authenticated users with `sales:view` permission to see a table of all invoices regardless of who created them.

#### Scenario: Sales page shows all invoices
- **WHEN** a user with `sales:view` permission navigates to the sales page
- **THEN** a table of all invoices is displayed with columns: invoice number, client, type, issue date, due date, grand total, outstanding balance, status

#### Scenario: Sales nav link hidden without permission
- **GIVEN** a user without `sales:view` permission
- **THEN** the Sales link is not shown in the sidebar

### Requirement: User can create a product-type invoice
The system SHALL allow authenticated users with `sales:create` permission to create a new invoice with product line items via a dialog form.

#### Scenario: Successful product invoice creation
- **WHEN** the user clicks "New Invoice" button
- **THEN** a dialog form appears with fields: client (autocomplete combobox), type (product/service toggle), issue date, due date, amount paid (create only), and a line items table
- **WHEN** the type is set to "product"
- **THEN** each line item row has: product dropdown, quantity, unit price, discount %, tax %, and computed line total
- **WHEN** the user selects a product from the dropdown
- **THEN** the description and unit price are auto-filled from the product catalog
- **WHEN** the user fills in valid data and submits
- **THEN** the form validates on the client side
- **AND** the server action recalculates totals and creates the invoice with line items
- **AND** the invoice status is "draft" when no amount paid is entered, or derived from the amount paid otherwise (a payment record is created for it)
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
- **THEN** a dialog form appears with fields: client (autocomplete combobox), type (product/service toggle), issue date, due date, amount paid (create only), and a line items table
- **WHEN** the type is set to "service"
- **THEN** each line item row has: description (free-text), quantity, unit price, discount %, tax %, and computed line total
- **WHEN** the user fills in valid data and submits
- **THEN** the invoice is created with service-type line items
- **AND** the invoice status is "draft" when no amount paid is entered, or derived from the amount paid otherwise
- **AND** the line items have no product reference

### Requirement: Invoice form is reusable
The form component SHALL be a reusable component that can be used outside the dialog context.

#### Scenario: Form works standalone
- **WHEN** the form is rendered outside a dialog
- **THEN** it renders all fields and line items correctly
- **AND** accepts an optional `invoice` prop for edit mode
- **AND** accepts `onSuccess` and `onCancel` callbacks for custom dialog handling
