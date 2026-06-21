## Context

Dark mode support is partially implemented via shadcn/ui theming primitives. The app currently lacks a theme provider wrapper, a toggle mechanism, and persistence. The existing CSS variable setup (`:root` / `.dark`) from shadcn is in place but not activated at runtime.

## Goals / Non-Goals

**Goals:**
- Add `next-themes` (or shadcn's built-in) ThemeProvider to the root layout
- Default to `system` preference
- Add a toggle button in the sidebar aux area
- Persist choice in localStorage
- Prevent flash of incorrect theme on load

**Non-Goals:**
- No new color schemes beyond light/dark/system
- No API or backend changes
- No per-page or per-component theme overrides

## Decisions

- **Provider**: Use `next-themes` `ThemeProvider` with `attribute="class"` and `defaultTheme="system"` — this is shadcn's recommended approach and handles FOUC prevention via its inline `script` tag.
- **Persistence**: `next-themes` handles localStorage automatically — no custom persistence code needed.
- **Toggle**: A simple cycle button (light → dark → system) placed in the sidebar aux area. Use `useTheme()` from `next-themes` to read/set the theme.
- **Icon**: Use `Sun`, `Moon`, and `Monitor` icons from `lucide-react` (already in the project) to indicate current mode.

## Risks / Trade-offs

- **FOUC**: `next-themes` injects an inline script to set the correct class before React hydrates → mitigated by the provider's built-in suppression script
- **localStorage reads on every page load**: Negligible performance impact; acceptable trade-off for persistence
