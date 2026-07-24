## Why

The clients list at `/dashboard/clients` currently displays all clients in a table with no way to filter or search. As the client list grows, finding a specific client becomes tedious. A search input provides quick, keyboard-driven access to any client by name, phone, email, or location.

## What Changes

- Add a search input field to the client list page header area
- Filter the displayed client table rows in real-time as the user types
- Match against name, phone, email, location, and comments fields
- Show an empty state when no clients match the search query

## Capabilities

### New Capabilities
- `client-list-search`: Client-side filtering of the client table by search query across multiple fields

### Modified Capabilities

## Impact

- **Components**: `components/clients/index.tsx` — add search input and filtering logic
- **No new dependencies**: Uses existing `Input` component and `lucide-react` SearchIcon
- **No server changes**: All filtering is client-side on the already-loaded data
