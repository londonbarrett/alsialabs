## 1. Permission Setup

- [x] 1.1 Add `sales:view-invoice-history` permission to seed data for client and admin roles
- [x] 1.2 Seed the `sales:view-invoice-history` permission in the permission matrix module

## 2. Server Action

- [x] 2.1 Create server action to fetch invoice history for a client (gated by `sales:view-invoice-history`)
- [x] 2.2 Return invoices with line items and totals, ordered by issue date descending

## 3. Invoice History Component

- [x] 3.1 Create reusable invoice history section component (shadcn Table)
- [x] 3.2 Display columns: invoice number, type, issue date, grand total, status

## 4. Client Profile Page

- [x] 4.1 Add invoice history section to existing client profile page (below profile info)
- [x] 4.2 Create `/clients/[clientId]` route for admin access with matching layout
- [x] 4.3 Add `sales:view-invoice-history` permission check on the route/page

## 5. Client Row Action Menu

- [x] 5.1 Add "View" action to client row dropdown menu (gated by `sales:view-invoice-history`)
- [x] 5.2 Wire "View" action to navigate to `/clients/[clientId]`
