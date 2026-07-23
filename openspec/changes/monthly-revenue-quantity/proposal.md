## Why

The monthly revenue chart currently shows only dollar amounts, giving admins no visibility into how many units were sold. Adding quantity to the tooltip lets admins correlate revenue with sales volume at a glance — essential for understanding whether revenue changes come from pricing or volume shifts.

## What Changes

- The monthly revenue server action joins invoice items to sum quantity sold per month/type, excluding items with `unit_price = 0`
- The chart tooltip displays quantity alongside revenue for each bar segment
- Revenue is now computed from filtered invoice item totals (consistent with quantity)

## Capabilities

### Modified Capabilities

- `reports`: The monthly revenue chart requirement gains a new scenario for tooltip content showing quantity, and a filter excluding zero-unit-price items

### New Capabilities

(none)

## Impact

- `lib/actions/reports.ts` — `getMonthlyRevenue()` query rewritten to join `invoiceItemsTable`
- `components/reports/monthly-revenue-chart.tsx` — `MonthlyRevenue` interface extended, tooltip updated
- `messages/en.json`, `messages/es.json` — new `quantity` translation key
