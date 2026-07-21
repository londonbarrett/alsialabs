## ADDED Requirements

### Requirement: Global loading bar visibility
The system SHALL display a fixed-position gradient bar at the top of the viewport whenever the app is in a loading state. The bar SHALL be hidden when no loading state is active.

#### Scenario: Bar appears on route navigation
- **WHEN** the user navigates to a dashboard route with a `loading.tsx` file
- **THEN** the loading bar SHALL become visible at the top of the page with a gradient slide animation

#### Scenario: Bar disappears after navigation completes
- **WHEN** the route transition completes and the page content renders
- **THEN** the loading bar SHALL fade out and become hidden

#### Scenario: Bar appears during server action mutation
- **WHEN** a component calls `useLoadingIndicator().start()` or `useAction` executes a server action
- **THEN** the loading bar SHALL become visible

#### Scenario: Bar disappears after mutation completes
- **WHEN** the server action mutation completes (success or error)
- **THEN** the loading bar SHALL fade out and become hidden

### Requirement: Loading bar visual design
The loading bar SHALL be a 2px tall horizontal line fixed to the top of the viewport, spanning the full width. It SHALL use an indeterminate gradient slide animation that moves continuously from left to right while visible.

#### Scenario: Gradient animation while loading
- **WHEN** the loading bar is visible
- **THEN** it SHALL display a gradient that animates continuously from left to right

#### Scenario: Smooth transition on show/hide
- **WHEN** the loading bar transitions between visible and hidden states
- **THEN** it SHALL use a CSS opacity transition (approximately 300ms) to fade in and out smoothly

### Requirement: Loading indicator hook
The system SHALL provide a `useLoadingIndicator` hook that returns `{ start, stop }` functions. Any client component MAY call `start()` to show the bar and `stop()` to hide it.

#### Scenario: Hook dispatches show event
- **WHEN** a component calls `start()` from `useLoadingIndicator`
- **THEN** the loading bar SHALL become visible

#### Scenario: Hook dispatches hide event
- **WHEN** a component calls `stop()` from `useLoadingIndicator`
- **THEN** the loading bar SHALL become hidden

#### Scenario: Concurrent triggers
- **WHEN** multiple components call `start()` and one calls `stop()`
- **THEN** the loading bar SHALL remain visible until all `start()` calls have a matching `stop()`

### Requirement: Route-level loading via loading.tsx
Dashboard routes SHALL include `loading.tsx` files that dispatch loading events. The loading bar SHALL be visible during the server-side data fetching phase of these routes.

#### Scenario: All data-fetching dashboard routes have loading.tsx
- **WHEN** a user navigates to any dashboard route that fetches server-side data
- **THEN** a `loading.tsx` file SHALL exist at that route and trigger the loading bar

### Requirement: Accessibility
The loading bar SHALL include appropriate ARIA attributes to communicate loading state to assistive technologies.

#### Scenario: Screen reader announcement
- **WHEN** the loading bar becomes visible
- **THEN** it SHALL have `role="progressbar"` and `aria-busy="true"` to indicate a loading state
