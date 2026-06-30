## Context

The dashboard currently has a blank welcome page and a "Reports" nav item in the sidebar linking to a non-existent `#reports` hash. The app has existing sales/invoice data (invoices, clients, products) tracked via Drizzle ORM with PostgreSQL.

## Goals / Non-Goals

**Goals:**
- Provide admins with 3 visual reports: monthly revenue (stacked bar), top clients by revenue (horizontal bar), inactive clients (filterable table)
- Install and configure shadcn chart component + recharts for chart rendering
- Add `reports:view` permission and register it in the seed script
- Follow existing code patterns (server page component + client view component)

**Non-Goals:**
- PDF export or email delivery of reports
- Custom date range pickers (only preset periods)
- Drill-down or interactive chart exploration
- Real-time data updates (page refresh to see new data)

## Decisions

1. **Charting library: recharts via shadcn chart component**
   - Why: shadcn chart is a first-party shadcn/ui component that wraps recharts with theme-consistent tooltips, legends, and responsive containers. Uses existing CSS variables for color theming.
   - Alternatives considered: chart.js (no native shadcn integration), nivo (heavier dependency)

2. **Server actions for data aggregation (no API routes)**
   - Why: Follows existing pattern in the codebase. All mutations and reads go through server actions with auth + permission guards. No need for REST endpoints since we don't have external consumers.
   - Alternative: API route at `/api/reports/*` — unnecessary complexity for internal-only feature

3. **Client-side filter for inactive clients via server action**
   - Why: The period dropdown (30/60/90/No purchases) changes the query. Calling the server action from the client component keeps the filter dynamic without full page reloads.
   - Alternative: Fetch all with the longest period and filter on client — inefficient with large datasets

4. **`reports:view` as a new permission (not reusing `sales:view`)**
   - Why: Clean separation of concerns. The permission management UI already supports dynamic module creation. Admins can assign reports access independently of sales access.
   - Alternative: Reuse `sales:view` — conflates read access to sales data with analytics access

## Risks / Trade-offs

- **Performance on large datasets**: Aggregation queries scan all invoices. With thousands of invoices, consider adding database indexes on `issue_date` and `client_id`. → Mitigation: Start without indexes, monitor performance.
- **recharts + shadcn chart with Tailwind v4**: The shadcn chart component was designed for Tailwind v3. May need CSS variable adjustments for v4. → Mitigation: Already confirmed the project's shadcn setup works; test immediately after installing.
- **Empty states edge case**: Charts with no data could cause recharts rendering errors. → Mitigation: Handle empty arrays before passing to chart components; show placeholder UI.
