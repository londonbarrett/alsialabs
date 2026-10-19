# Client invoice history — Design

## Why this exists

Billing history is one of the main reasons anyone opens a client's profile. A client wants to confirm what they were charged and when; staff want the same view to answer questions without opening the sales module. Showing every invoice a client has ever received, newest first, on the profile page puts that record where both audiences already are.

The section is deliberately read-only and permission-gated. It is only meaningful to someone allowed to see sales data, so a user without `sales:view-invoice-history` never sees the section and the invoices are never fetched for them. The same profile layout serves both the client's own page and the staff route to any client, so there is one place to maintain.

## Goals

- Show a client's invoices on their profile page, newest first.
- List each invoice with its number, type, issue date, grand total, and status.
- Let a client see their own history and an admin see any client's.
- Provide a `/clients/[clientId]` route with the same profile and history layout.
- Hide the section and skip fetching when the viewer lacks `sales:view-invoice-history`.

## Design

### The invoice history section

The section renders below the client's profile information and lists every invoice belonging to that client in a table with columns for invoice number, type, issue date, grand total, and status. Its header reads "Invoice History". Invoices are ordered by issue date descending, so the most recent billing is at the top.

### Client and admin views

A client authenticated with `sales:view-invoice-history` sees the section on their own profile after navigating there. An admin with the same permission reaches any client's history through the clients page: choosing the "View" button in the client's action menu takes them to `/clients/[clientId]`, where the client's profile — including the invoice history section — is rendered.

### The client profile route

`/clients/[clientId]` renders the client's profile with the invoice history section, using the same layout as the profile page. Any authenticated user can load the route, but the invoice history section only appears when they hold `sales:view-invoice-history`.

### Permission gating

For a user without `sales:view-invoice-history`, the profile information still renders but the invoice history section is absent, and the invoice data is not fetched at all — the hidden section is not a cosmetic overlay on top of a completed request.

### The server action

A server action fetches a client's invoices. It is gated on authentication and on `sales:view-invoice-history`: an authorized caller gets the client's invoices with their line items and totals, while a caller without the permission receives an unauthorized error and no invoice data.

## Non-goals

- Editing or creating invoices from the profile. This section is a read-only history.
- Changing the invoice list's order or columns per viewer; the newest-first, fixed-column view is the same for clients and admins.
- Fetching invoice data for users who cannot see it, even to hide it client-side.
</content>
