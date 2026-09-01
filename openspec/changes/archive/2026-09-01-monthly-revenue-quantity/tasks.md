## 1. Server Action

- [ ] 1.1 Update `getMonthlyRevenue()` in `lib/actions/reports.ts` to JOIN `invoicesTable` with `invoiceItemsTable`, filter `unitPrice > 0`, and sum both `quantity` and `total` per month/type
- [ ] 1.2 Update return type to include `productQuantity` and `serviceQuantity`

## 2. Chart Component

- [ ] 2.1 Update `MonthlyRevenue` interface in `components/reports/monthly-revenue-chart.tsx` to include `productQuantity` and `serviceQuantity`
- [ ] 2.2 Update `ChartTooltipContent` formatter to display quantity alongside revenue

## 3. Translations

- [ ] 3.1 Add `quantity` key to `reports` namespace in `messages/en.json`
- [ ] 3.2 Add `quantity` key to `reports` namespace in `messages/es.json`
