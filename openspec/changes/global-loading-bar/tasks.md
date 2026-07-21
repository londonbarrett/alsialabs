## 1. Core Components

- [ ] 1.1 Create `components/common/loading-bar.tsx` — gradient bar with CSS animation, event listeners for showLoading/hideLoading, `role="progressbar"`, `aria-busy`, `data-loading` attribute
- [ ] 1.2 Create `components/loading-provider.tsx` — client component that renders LoadingBar, wraps children
- [ ] 1.3 Create `hooks/use-loading-indicator.ts` — hook returning `{ start, stop }` that dispatches showLoading/hideLoading events

## 2. Layout Integration

- [ ] 2.1 Update `app/layout.tsx` — wrap children with LoadingProvider

## 3. Route Loading Files

- [ ] 3.1 Create `loading.tsx` at `app/dashboard/clients/`
- [ ] 3.2 Create `loading.tsx` at `app/dashboard/clients/[clientId]/`
- [ ] 3.3 Create `loading.tsx` at `app/dashboard/projects/`
- [ ] 3.4 Create `loading.tsx` at `app/dashboard/projects/[id]/`
- [ ] 3.5 Create `loading.tsx` at `app/dashboard/my-tasks/`
- [ ] 3.6 Create `loading.tsx` at `app/dashboard/products/`
- [ ] 3.7 Create `loading.tsx` at `app/dashboard/sales/`
- [ ] 3.8 Create `loading.tsx` at `app/dashboard/contractors/`
- [ ] 3.9 Create `loading.tsx` at `app/dashboard/categories/`
- [ ] 3.10 Create `loading.tsx` at `app/dashboard/users/`
- [ ] 3.11 Create `loading.tsx` at `app/dashboard/permissions/`
- [ ] 3.12 Create `loading.tsx` at `app/dashboard/reports/`
- [ ] 3.13 Create `loading.tsx` at `app/dashboard/profile/`

## 4. Action Integration

- [ ] 4.1 Update `hooks/use-action.ts` — call `useLoadingIndicator` to show bar during startTransition

## 5. Verification

- [ ] 5.1 Run `pnpm run lint` — no errors
- [ ] 5.2 Run `pnpm run typecheck` — no type errors
