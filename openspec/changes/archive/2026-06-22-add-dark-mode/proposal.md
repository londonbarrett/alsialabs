## Why

The app currently lacks dark mode support. With shadcn theming half-implemented, users have no way to switch or persist their preference. This completes the theme system so the app respects system preference and allows manual toggling.

## What Changes

- Add a theme toggle button in the sidebar aux area (next to menu items)
- Default to system color scheme preference on first visit
- Persist user's theme choice in localStorage
- Wire up shadcn's `next-themes` provider for CSS variable switching
- Prevent flash of wrong theme on initial page load

## Capabilities

### New Capabilities
- `theme-preference`: User can view and toggle between light/dark/system themes; preference is persisted locally

### Modified Capabilities
- *(none — existing capabilities remain unchanged)*

## Impact

- Sidebar layout — needs a toggle button in the aux area
- Root layout / provider tree — needs theme provider wrapper
- CSS variables — ensure `:root` and `.dark` classes are wired via shadcn
- No API or backend changes
