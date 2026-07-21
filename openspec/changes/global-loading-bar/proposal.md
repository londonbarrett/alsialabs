## Why

The app has no consistent global loading feedback. Two pages use `<Suspense>` with inline skeletons, forms use `Spinner` inside buttons, and most pages show nothing during data fetching. Users have no visual signal that the app is working. A global gradient bar at the top provides a lightweight, non-intrusive indicator for both route transitions and server action mutations.

## What Changes

- Add a `LoadingBar` component under `components/common/`: a fixed-position gradient line at the top of the viewport that animates during loading states
- Add a `LoadingProvider` context to coordinate loading state across the app
- Create a `useLoadingIndicator` hook under `hooks/` to dispatch global loading events from any component
- Add `loading.tsx` files at dashboard routes to show the bar during route transitions
- Mount the `LoadingBar` in the root layout

## Capabilities

### New Capabilities
- `global-loading-bar`: A fixed-position gradient indicator at the top of the app that shows during route transitions and server action mutations

### Modified Capabilities

## Impact

- Root layout (`app/layout.tsx`) — add `LoadingProvider` and `LoadingBar`
- New files: `components/common/loading-bar.tsx`, `components/loading-provider.tsx`, `hooks/use-loading-indicator.ts`
- New files: `loading.tsx` at 10+ dashboard routes
- No new dependencies — uses CSS animations and React context
