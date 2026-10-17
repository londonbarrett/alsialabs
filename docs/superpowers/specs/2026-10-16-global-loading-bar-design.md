# Global loading bar — Design

## Why this exists

This app fetches data on the server for nearly every route, and much of its mutation traffic runs through server actions. Both kinds of wait are invisible to the user: a navigation either paints quickly or leaves a blank screen, and a submit either succeeds or seems to do nothing. Without a shared indicator, every screen ends up inventing its own spinner — or none at all.

One fixed bar at the top of the viewport covers both cases. Route transitions pick it up automatically through `loading.tsx` files, and mutations opt in through a hook. Because it lives at the app level, the visual language of "something is loading" is identical everywhere and needs no per-page wiring beyond the route file.

Two properties matter most: the bar must not hide while work is still outstanding, even when several components are loading at once, and it must not lock out assistive technologies from knowing the app is busy.

## Goals

- Show a fixed gradient bar at the top of the viewport whenever the app is loading, and hide it when nothing is.
- Drive it from route-level `loading.tsx` files and from `useLoadingIndicator` during server-action mutations.
- Keep it visible until every `start()` has a matching `stop()`, regardless of success or error.
- Animate it as a 2px indeterminate gradient sliding left to right, fading in and out smoothly.
- Announce the loading state to assistive technologies.

## Design

### When the bar shows and hides

Navigating to a dashboard route that has a `loading.tsx` file makes the bar visible at the top of the page with its gradient slide; once the transition completes and the page content renders, the bar fades out and hides. Mutations follow the same lifecycle: a component calling `useLoadingIndicator().start()`, or a `useServerAction` executing a server action, shows the bar, and it fades away when the mutation finishes — on success or on error alike.

### Visual design

The bar is a 2px horizontal line fixed to the top of the viewport, spanning the full width. While visible it runs an indeterminate gradient animation that travels continuously from left to right; it makes no claim about actual progress. Toggling between visible and hidden uses a CSS opacity transition of roughly 300ms so the bar fades rather than pops.

### The `useLoadingIndicator` hook

`useLoadingIndicator` returns `{ isLoading, start, stop }`, and any client component may call `start()` to show the bar and `stop()` to hide it. The hook ref-counts its callers: if three components call `start()` and one later calls `stop()`, the bar stays visible until the remaining two have stopped. One component's early completion can't blank the bar out from under another's in-flight work.

### Route-level loading via `loading.tsx`

Every dashboard route that fetches data server-side includes a `loading.tsx` that dispatches the loading events, so the bar is visible for the entire server-side data-fetching phase — not just the first paint. Navigating to any such route therefore shows the bar for the duration of the fetch and hides it when the real content lands.

### Accessibility

When visible, the bar carries `role="progressbar"` and `aria-busy="true"` so screen readers announce the loading state instead of leaving the UI silently busy.

## Non-goals

- A determinate, percentage-based bar. The animation is indeterminate by design; there is no progress to report.
- Automatic tracking of every async read. Components and routes opt in explicitly through `loading.tsx` or `start()`/`stop()`.
- A loading surface other than the top bar — no bottom bars, overlays, or full-page blockers.
