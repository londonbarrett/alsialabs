## 1. Install Dependencies

- [x] 1.1 Install recharts and add shadcn chart component
- [x] 1.2 Verify chart component renders correctly with Tailwind v4

## 2. Permission & Navigation Setup

- [x] 2.1 Add `reports: view` to seed script default modules
- [x] 2.2 Grant `reports` permissions to admin role in seed script
- [x] 2.3 Update sidebar Reports URL to `/dashboard/reports` and add `requiredPermission: 'reports:view'`

## 3. Server Actions

- [x] 3.1 Create `lib/actions/reports.ts` with `getMonthlyRevenue()` aggregation query
- [x] 3.2 Add `getTopClientsByRevenue(limit)` aggregation query
- [x] 3.3 Add `getInactiveClients(days)` aggregation query

## 4. Page & Components

- [x] 4.1 Create `app/dashboard/reports/page.tsx` server page with auth + permission guard
- [x] 4.2 Create `components/reports/reports-view.tsx` client component with chart cards + inactive clients table
- [x] 4.3 Implement monthly revenue stacked bar chart with empty state
- [x] 4.4 Implement top clients horizontal bar chart with empty state
- [x] 4.5 Implement inactive clients table with period dropdown (30/60/90/No purchases) and empty state
