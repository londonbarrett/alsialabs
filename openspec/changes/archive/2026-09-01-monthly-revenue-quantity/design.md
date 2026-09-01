## Context

The monthly revenue chart currently queries `invoicesTable` directly, grouping by month and type and summing `grandTotal`. Invoice items live in a separate `invoice_items` table with a `quantity` column and `unit_price` column. The chart tooltip only shows revenue amounts.

## Goals / Non-Goals

**Goals:**
- Show quantity sold per month/type in the chart tooltip
- Exclude items with `unit_price = 0` from both revenue and quantity calculations

**Non-Goals:**
- Changing the chart type or layout
- Adding quantity as a separate Y-axis or chart

## Decisions

### Query approach: JOIN invoices → invoice_items

Instead of querying `invoicesTable.grandTotal` (invoice-level pre-computed total), the query will JOIN `invoice_items` and compute revenue from `invoice_items.total WHERE unit_price > 0`. This ensures revenue and quantity are derived from the same filtered item set.

**Alternatives considered:**
- Keep using `grandTotal` for revenue, only sum quantity from items — rejected because revenue and quantity would be computed from different item sets, creating inconsistency.

### Tooltip format

Display quantity inline with revenue in the existing tooltip formatter, e.g. "Product — $1,200 · 45 units". No new tooltip component needed — just extend the existing `formatter` callback.

## Risks / Trade-offs

- **Revenue rounding difference** → `SUM(invoice_items.total)` may differ slightly from `invoicesTable.grandTotal` due to rounding at item vs invoice level. Mitigation: the difference is negligible and consistency between revenue and quantity is more important.
- **Performance** → JOIN with `invoice_items` adds a slightly heavier query. Mitigation: the query is already simple with small datasets; no indexes needed beyond existing foreign key.
