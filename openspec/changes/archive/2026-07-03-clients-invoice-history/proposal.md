## Why

Clients and admins currently have no way to view a client's invoice history. Both roles need visibility into past invoices — clients for their own records, admins for managing client relationships. This ties the sales and client modules together, providing a complete client profile experience.

## What Changes

- Add an invoice history section to the client profile page showing all invoices for that client
- Create `/clients/[clientId]` admin route mirroring the profile page layout
- Add `sales:view-invoice-history` permission for both client and admin roles
- Seed `sales:view-invoice-history` permission for client and admin roles
- Add "View" action to client row action menu for admins with permission

## Capabilities

### New Capabilities
- `client-invoice-history`: Viewing a client's list of invoices — accessible to clients (own invoices) and admins (any client)

### Modified Capabilities
- `client-crud`: Client profile page now includes an invoice history section. A new route `/clients/[clientId]` is added for admin access to a client's full profile. Permission `sales:view-invoice-history` is required to access any client's profile.
- `roles-permissions`: Add `sales:view-invoice-history` permission to the seed data for both client and admin roles, toggleable in the permission matrix.

## Impact

- **Server actions**: New server action(s) to fetch invoice history for a client
- **Permissions**: New `sales:view-invoice-history` permission must be seeded
- **UI**: Client profile page gets a new section; admin gets a new route `/clients/[clientId]`
- **Data**: Reads from existing `invoice` table (no schema changes expected)
