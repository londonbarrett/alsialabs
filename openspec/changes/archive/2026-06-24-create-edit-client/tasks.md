## 1. Setup

- [x] 1.1 Add shadcn Dialog component (`npx shadcn@latest add dialog`)
- [x] 1.2 Install Zod for form validation (`pnpm add zod`)

## 2. Server Actions

- [x] 2.1 Create `lib/actions/clients.ts` with auth guard, validation schema (Zod), and sanitization
- [x] 2.2 Implement `upsertClient(data)` server action — inserts new or updates existing client
- [x] 2.3 Add phone uniqueness check as a separate server-validatable function
- [x] 2.4 Wire `revalidatePath('/dashboard/clients')` after successful mutations

## 3. Reusable Client Form

- [x] 3.1 Create `components/client-form.tsx` with fields: name, phone, location, comments, email
- [x] 3.2 Add Zod schema for client-side validation (shared types with server)
- [x] 3.3 Wire async phone uniqueness check on the phone field (debounced)
- [x] 3.4 Implement submit handler with loading/disabled state
- [x] 3.5 Support optional `client` prop for edit mode (pre-fill fields)
- [x] 3.6 Add error display per field using shadcn FieldGroup/Field validation pattern

## 4. Dialog Integration

- [x] 4.1 Create `components/client-dialog.tsx` wrapping form in shadcn Dialog
- [x] 4.2 Add "New Client" button next to "Import Data" in `client-list-view.tsx`
- [x] 4.3 Wire Edit action in DropdownMenu to open dialog in edit mode
- [x] 4.4 Handle dialog close + data refresh on success

## 5. Clients Page Update

- [x] 5.1 Update `client-list-view.tsx` to support dialog state management
- [x] 5.2 Ensure clients list revalidates after create/edit across page navigation

## 6. Accessibility

- [x] 6.1 Add ARIA labels to all interactive elements
- [x] 6.2 Ensure dialog focus trapping and keyboard navigation work
- [x] 6.3 Verify screen reader announces dialog purpose on open

## 7. Tests

- [x] 7.1 Update `e2e/clients.spec.ts` with create client flow
- [x] 7.2 Update `e2e/clients.spec.ts` with edit client flow
- [x] 7.3 Add test for duplicate phone rejection
- [x] 7.4 Add test for unauthenticated server action rejection
