## MODIFIED Requirements

### Requirement: User can view monthly revenue chart
The system SHALL display a stacked bar chart showing monthly revenue split by invoice type (product/service). Revenue SHALL be computed from invoice items, excluding items with `unit_price = 0`. The chart tooltip SHALL display quantity sold alongside revenue for each bar segment.

#### Scenario: Revenue chart shows data grouped by month and type
- **WHEN** an admin with `reports:view` permission visits the reports page
- **THEN** they see a stacked bar chart with months on the x-axis and revenue on the y-axis
- **AND** each month's bar is split into product revenue and service revenue segments

#### Scenario: Revenue chart shows all available data
- **WHEN** there are invoices dating back multiple years
- **THEN** the chart SHALL display every month that has invoice data, ordered chronologically

#### Scenario: Revenue chart shows empty state
- **WHEN** there are no invoices in the system
- **THEN** the chart area SHALL display a placeholder message indicating no data

#### Scenario: Tooltip shows quantity sold alongside revenue
- **WHEN** a user hovers over a bar segment in the monthly revenue chart
- **THEN** the tooltip SHALL display both the revenue amount and the quantity sold for that segment

#### Scenario: Items with zero unit price are excluded
- **WHEN** an invoice item has `unit_price = 0`
- **THEN** that item SHALL NOT be included in the revenue or quantity calculations
