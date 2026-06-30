## Why

Admins need visual reports to understand sales performance, identify top clients, and track customer inactivity. Currently the dashboard is a blank placeholder with no data visualization.

## What Changes

- New server actions for sales data aggregation (monthly revenue, top clients, inactive clients)
- New `/dashboard/reports` page with stacked bar chart (monthly revenue), horizontal bar chart (top 10 clients by revenue), and inactive clients table with period filter
- Add `reports:view` permission, seed it, update sidebar link
- Install `recharts` + shadcn chart component

## Capabilities

### New Capabilities
- `reports`: Visual sales reports including revenue trends, top client ranking, and inactive client identification with configurable period filtering

### Modified Capabilities

None.

## Impact

- **New files**: `lib/actions/reports.ts`, `app/dashboard/reports/page.tsx`, `components/reports/reports-view.tsx`
- **Modified files**: `config/sidebar-menu.ts`, `lib/drizzle/seed.ts`
- **New dependencies**: `recharts`, shadcn chart (`npx shadcn add chart`)
- **New permission**: `reports:view`
