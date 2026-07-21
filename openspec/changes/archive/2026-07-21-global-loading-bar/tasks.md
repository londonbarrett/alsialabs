## 1. Core Components

- [x] 1.1 Create `components/common/app-loading-indicator/loading-bar.tsx` — gradient bar with CSS animation, context-based show/hide, `role="progressbar"`, `aria-busy`, `data-loading` attribute
- [x] 1.2 Create `components/common/app-loading-indicator/loading-provider.tsx` — context provider holding isLoading state, renders LoadingBar, wraps children
- [x] 1.3 Create `hooks/use-loading-indicator.ts` — hook returning `{ isLoading, start, stop }` via context

## 2. Layout Integration

- [x] 2.1 Update `app/layout.tsx` — wrap children with LoadingProvider

## 3. Route Loading Files

- [x] 3.1 Create `loading.tsx` at `app/dashboard/clients/`
- [x] 3.2 Create `loading.tsx` at `app/dashboard/clients/[clientId]/`
- [x] 3.3 Create `loading.tsx` at `app/dashboard/projects/`
- [x] 3.4 Create `loading.tsx` at `app/dashboard/projects/[id]/`
- [x] 3.5 Create `loading.tsx` at `app/dashboard/my-tasks/`
- [x] 3.6 Create `loading.tsx` at `app/dashboard/products/`
- [x] 3.7 Create `loading.tsx` at `app/dashboard/sales/`
- [x] 3.8 Create `loading.tsx` at `app/dashboard/contractors/`
- [x] 3.9 Create `loading.tsx` at `app/dashboard/categories/`
- [x] 3.10 Create `loading.tsx` at `app/dashboard/users/`
- [x] 3.11 Create `loading.tsx` at `app/dashboard/permissions/`
- [x] 3.12 Create `loading.tsx` at `app/dashboard/reports/`
- [x] 3.13 Create `loading.tsx` at `app/dashboard/profile/`

## 4. Action Integration

- [x] 4.1 Create `hooks/use-server-action.ts` — wraps server actions with transition, toasts, and loading bar via `useLoadingIndicator`

## 5. Verification

- [x] 5.1 Run `pnpm run lint` — no errors from changes
- [x] 5.2 Run `npx tsc --noEmit` — no type errors
