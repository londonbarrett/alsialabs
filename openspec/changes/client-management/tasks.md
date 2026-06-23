## 1. Database Schema

- [x] 1.1 Add `clientTable` to `lib/drizzle/schema.ts` with columns: `id` (UUID PK), `name`, `phone`, `location`, `comments`, `email`, `user_id` (nullable FK to `user.id`)
- [x] 1.2 Generate and run Drizzle migration

## 2. ShadCN Components

- [x] 2.1 Install ShadCN Table component (`npx shadcn@latest add table`)
- [x] 2.2 Verify toast/sonner component is available

## 3. Server Action — CSV Import

- [x] 3.1 Create Server Action that receives FormData with CSV file
- [x] 3.2 Parse CSV and validate columns (NAME, PHONE, LOCATION, COMMENTS, EMAIL)
- [x] 3.3 Check for duplicate phone numbers before inserting
- [x] 3.4 Insert valid rows into `client` table
- [x] 3.5 Return success/error response and revalidate `/dashboard/clients`

## 4. Clients Page — Server Component

- [x] 4.1 Create `app/dashboard/clients/page.tsx` as a server component
- [x] 4.2 Fetch client list from database on the server
- [x] 4.3 Render empty state ("No clients yet" + Import button) when no data
- [x] 4.4 Render ShadCN Table with columns: Name, Phone, Location, Comments, Email, Actions
- [x] 4.5 Add three-dot dropdown menu in Actions column (View / Edit / Delete with icons, dummy toast handlers, Delete in red)

## 5. Import Button — Client Component

- [x] 5.1 Create a client component with the Import button
- [x] 5.2 Wire file picker dialog to the Server Action
- [x] 5.3 On success: trigger page revalidation to reload client list
- [x] 5.4 On failure: show error toast

## 6. Navigation

- [x] 6.1 Add "Clients" link to `config/sidebar-menu.ts` under Navigation group with URL `/dashboard/clients`

## 7. Accessibility

- [x] 7.1 Ensure table has proper ARIA labels and semantic markup
- [x] 7.2 Ensure keyboard navigation works for the table and interactive elements
