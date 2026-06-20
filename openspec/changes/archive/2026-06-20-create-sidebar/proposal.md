## Why

Create the dashboard sidebar structure with mock content to solve dashboard navigation. The app currently lacks a navigation sidebar, and this is the foundational piece for all future dashboard screens.

## What Changes

- Add ShadCN Sidebar component to the dashboard layout
- Create three menu areas: user menu, main navigation, auxiliary menu
- Menu items loaded from a config JSON object
- Items are clickable and highlight on selection (all point to `/` for now)
- Collapse toggle for icons-only mode
- Responsive behavior on mobile

## Capabilities

### New Capabilities
- `dashboard-navigation`: Main dashboard sidebar with three menu areas, collapse toggle, and icon support

### Modified Capabilities
_(none — new feature)_

## Impact

- New layout component wrapping the dashboard
- No impact on existing routes or functionality
- Menu data sourced from a JSON config file for future real data replacement
