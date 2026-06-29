## Context

Sales module is the next major capability after clients and products. The existing modules (clients, products) provide the foundational data model — now we need to track transactions. The design follows established patterns: Drizzle ORM with PostgreSQL, server actions with auth/permission guards, shadcn/ui components, and dialog-based forms. The key departure is the line-item model — invoices have dynamic rows, which affects the form UX.

## Goals / Non-Goals

**Goals:**
- `invoice` and `invoice_item` database tables with all computed fields
- Auto-generated invoice numbers (INV-YYYYMMDD-NNNN, global sequential)
- Full CRUD for invoices via server actions
- Sales UI: table list, create/edit dialog with dynamic line items, action menu
- Two invoice types: product (references product catalog) and service (ad-hoc descriptions)
- Per-line tax percentage and discount percentage, computed totals
- Permission enforcement (view, create, edit, delete)
- Seed sales permissions: super (all 4), admin (view/create/edit), client (none)

**Non-Goals:**
- Partial payments or payment tracking beyond "paid"
- Inventory/stock management
- Invoice status workflow beyond single "paid" status
- Reports or analytics
- CSV import of invoices
- Email/sending invoices

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Line-item model | `invoice_item` table with FK to `invoice` | Normalized, flexible, follows established patterns. Each line has its own discount, tax, and computed total. |
| Invoice numbering | Global sequential counter in `invoice_sequence` table | Atomic increments via DB transaction. `INV-YYYYMMDD-NNNN` format gives human-readable IDs with daily grouping. |
| Type (product vs service) | Enum on `invoice` table, not separate tables | Minimal schema difference; same line-item structure with optional `product_id` FK. Cleaner than separate tables or inheritance. |
| Dialog for create/edit | Dialog (matching clients/products pattern) | Consistent UX. Line items will be an inline editable table within the dialog. Limited to reasonable number of items. |
| Product line items | Dropdown selects from `product` table, auto-fills description and unit_price | Reduces data entry errors and leverages existing product catalog. Prices editable on the fly in case of custom pricing. |
| Service line items | Free-text description, manual price entry | No service catalog — services are ad-hoc. |
| Computed totals | Computed client-side in form AND server-side in action | Defense in depth. Client provides instant feedback; server recalculates to prevent tampering. |
| Permission model | `sales:view/create/edit/delete` matching existing pattern | Consistency. Admin gets no delete (same as products pattern). |
| Delete behavior | Cascade deletes invoice_items | If an invoice is deleted, its line items have no meaning. |

## Risks / Trade-offs

- **Line-item dialog UX** → Dynamic line-item table inside a dialog is more complex than simple field forms. Mitigation: Keep dialog large, use a table with add/remove row buttons, compute totals inline.
- **No invoice status workflow** → Starting with only "paid" status. Adding draft/pending/overdue later requires a migration and form changes. Field is an enum so it's extensible.
- **No inventory integration** → Products can be sold without tracking stock. No impact now, but adding inventory later would need a sales-triggered decrement.
- **Invoice number collision on concurrent creation** → Mitigated by DB-level sequence with atomic increment in the same transaction as invoice insert.
