# Reports — Design

## Why this exists

Admins need a read on how the business is actually performing month over month, not just a pile of individual invoices. The monthly revenue chart answers the first question anyone asks — how much money came in, and when — while splitting revenue by invoice type so product sales and services can be told apart at a glance.

Revenue alone is misleading, though: a flat month could mean fewer sales at the same price, or the same volume at a lower price. That is why each bar segment's tooltip reports quantity sold next to its revenue, giving the reader the volume behind the number. Items priced at zero are left out entirely — they add no revenue and would inflate the quantity figure beyond what was actually sold.

The chart is deliberately retrospective and unfiltered: it shows every month that has invoice data, so it doubles as a full history rather than a snapshot of a chosen window.

## Goals

- Show monthly revenue as a stacked bar chart split by invoice type (product/service).
- Compute revenue from invoice items, excluding items with `unit_price = 0`.
- Report quantity sold alongside revenue in each segment's tooltip.
- Cover every month that has invoice data, in chronological order.
- Show a placeholder message when there are no invoices at all.
- Restrict the page to users with `reports:view` permission.

## Design

### Access

The reports page is reached by an admin holding `reports:view`. That permission gates the page; without it the report is not available.

### Chart shape and data source

The report renders a stacked bar chart with months on the x-axis and revenue on the y-axis, where each month's bar is split into a product segment and a service segment by invoice type. Revenue is computed from invoice items — the line items behind invoices — rather than from invoice totals, which is what makes the product/service split and the quantity figures possible.

### Excluding zero-price items

Invoice items with `unit_price = 0` are excluded from both the revenue and the quantity calculations. They contribute nothing to revenue and would otherwise pad the sold-quantity counts with giveaways, so the tooltip's quantity stays an honest measure of what was actually sold.

### Tooltip

Hovering a bar segment reveals a tooltip showing both the revenue amount and the quantity sold for that segment, so a reader comparing months can distinguish a change in price from a change in volume.

### Coverage and empty state

The chart displays every month that has invoice data, ordered chronologically — including data stretching back multiple years — rather than truncating to a recent window. When the system has no invoices at all, the chart area shows a placeholder message indicating there is no data to display.

## Non-goals

- Date-range or invoice-type filters. The chart shows all available data by default.
- Drill-down from a bar segment to the individual invoices behind it.
- Additional chart types or breakdowns beyond monthly revenue by invoice type.
