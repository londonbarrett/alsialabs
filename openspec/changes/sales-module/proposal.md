## Why

Alsia Labs CRM manages clients and products but has no way to record transactions (sales). The business needs to track what products or services are sold to which clients, for how much, including tax and discount details.

## What Changes

- New `invoice` and `invoice_item` database tables
- Sales CRUD module with server actions (getInvoices, upsertInvoice, deleteInvoice)
- Sales list page, dialog form with dynamic line items
- Product-type invoices (line items reference the product catalog) and service-type invoices (line items are ad-hoc descriptions)
- Invoice auto-numbering (INV-YYYYMMDD-NNNN, global sequential)
- Row-level permissions for sales: view, create, edit, delete
- Seed sales module permissions for super (all), admin (view/create/edit, no delete)
- Sidebar nav link for Sales (previously a placeholder)
- Existing specs modified: roles-permissions (add sales module permissions)

## Capabilities

### New Capabilities
- `sales`: Invoice creation and management with product and service line items, auto-numbering, tax/discount per line, permission-based access

### Modified Capabilities
- `roles-permissions`: Add `sales:view`, `sales:create`, `sales:edit`, `sales:delete` permissions to the permission matrix

## Impact

- Database: New `invoice`, `invoice_item`, and `invoice_sequence` tables
- Server actions: New `lib/actions/sales.ts`
- Components: New `components/sales/` directory with list view, dialog, form, action menu
- Routes: New `app/dashboard/sales/page.tsx`
- Config: Sidebar menu updated to point to real route
- Seed script: Add sales permissions seeded for super and admin roles
