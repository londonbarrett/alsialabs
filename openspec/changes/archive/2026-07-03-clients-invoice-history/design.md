## Context

The client profile page currently shows only profile information. The sales module already stores invoices in the `invoice` table with a `client_id` foreign key. This change adds an invoice history section to the profile page, visible to both clients (own invoices) and admins (any client's invoices). A new route `/clients/[clientId]` is needed for admin access to a full client profile.

## Goals / Non-Goals

**Goals:**
- Display invoice history on the client profile page for clients viewing their own profile
- Display invoice history on `/clients/[clientId]` for admins
- Gate access behind `sales:view-invoice-history` permission
- Seed the new permission for client and admin roles

**Non-Goals:**
- No pagination or filtering (small volume of invoices for now)
- No invoice creation or editing via this feature
- No changes to the invoice table schema

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data access pattern | Server action | Consistent with existing project conventions |
| Permission check | `sales:view-invoice-history` | Fits under sales module alongside existing sales permissions |
| Route for admin profile | `/clients/[clientId]` | Clear, RESTful path matching existing conventions |
| Invoice list loading | Full load, no pagination | Small data volume; simple to paginate later if needed |
| UI framework | shadcn/ui Table component | Existing pattern in the codebase |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Large invoice lists in the future | Pagination can be added as a follow-up without layout changes |
| Permission check duplication (client + admin) | Shared server action with unified permission gate |
