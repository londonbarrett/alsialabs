## Context

The app is a Next.js 16 + React 19 dashboard with shadcn/ui components. Currently, loading feedback is inconsistent:
- 2 of 12+ dashboard pages use `<Suspense>` with inline skeleton divs (not the `Skeleton` component)
- 10+ forms use `Spinner` inside submit buttons for mutation feedback
- Most pages show nothing during server-side data fetching
- No `loading.tsx` files exist anywhere
- A `useAction` hook exists but is only used in 1 component

The app uses `next-intl` for i18n, `next-themes` for theming, and `sonner` for toasts. The root layout wraps everything in providers (Theme, Intl, Session, Tooltip).

## Goals / Non-Goals

**Goals:**
- Single gradient bar at the top of the viewport that indicates any loading state
- Trigger on route transitions (via `loading.tsx`) and server action mutations (via `useLoadingIndicator`)
- Indeterminate gradient slide animation — smooth, non-intrusive
- Zero new dependencies
- Consistent with existing project patterns (Tailwind, `cn()`, `data-slot`)

**Non-Goals:**
- Replacing existing `Spinner` usage in buttons (that's a separate concern)
- Adding skeleton fallbacks to every page (separate change)
- Deterministic progress tracking
- Page-level loading overlays

## Decisions

### 1. Event-based coordination (not React context for state)

The `LoadingBar` listens to custom DOM events (`showLoading`/`hideLoading`). Triggers dispatch these events. This avoids prop-drilling and works across server/client boundaries.

**Why over context?** The `useLoadingIndicator` hook needs to work in any client component. Event dispatching is simpler — no provider needed for the hook itself. The `LoadingProvider` exists only to render the `LoadingBar` in the tree.

**Alternatives considered:**
- React context for state: requires all triggers to be children of the provider, more boilerplate
- Zustand/external store: overkill for a boolean flag

### 2. Separate `useLoadingIndicator` hook (not extending `useAction`)

`useAction` is a generic server action wrapper. `useLoadingIndicator` is a focused hook that dispatches loading events. `useAction` can call `useLoadingIndicator` internally, but they remain decoupled.

**Why?** Keeps `useAction` focused on action execution + toast feedback. Loading indicator can be used independently in any component that needs to show/hide the bar.

### 3. `loading.tsx` files dispatch events via a small `LoadingDispatcher` client component

`loading.tsx` files are server components in Next.js App Router. They can't directly dispatch DOM events. A tiny client component (`LoadingDispatcher`) handles this: mounts → dispatches `showLoading`, unmounts → dispatches `hideLoading`.

### 4. CSS animation for the gradient (not JS-driven)

The bar uses a CSS `@keyframes` animation for the gradient slide. JS only toggles visibility via `data-loading` attribute. This keeps the animation smooth at 60fps without JS overhead.

### 5. Placement in `components/common/` (not `components/ui/`)

The loading bar is app-specific infrastructure, not a reusable shadcn primitive. It goes in `components/common/` per project conventions.

## Risks / Trade-offs

- **Brief flicker on very fast navigations** → The bar appears/disappears quickly. Mitigated by CSS transition opacity (300ms ease).
- **Routes without `loading.tsx`** → No bar on those transitions. Acceptable — we add `loading.tsx` to all data-fetching dashboard routes.
- **Multiple simultaneous triggers** → If a navigation and a server action happen at the same time, both dispatch events. The bar stays visible until the last `hideLoading` fires. This is correct behavior.
