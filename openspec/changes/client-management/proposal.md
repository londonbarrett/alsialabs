## Why

The app needs to be populated with a list of already existing clients. No client data exists today. A user must be able to import client records from a CSV file and view them in a table on the dashboard. This is the first piece of the "Clients" main feature.

## What Changes

- Import client data from CSV files with columns: NAME, PHONE, LOCATION, COMMENTS, EMAIL
- CSV file is sent to a server action; **not persisted anywhere**
- Duplicate detection by phone number before inserting
- Create `client` database table with Drizzle ORM schema
- Create `/dashboard/clients` page with sidebar navigation link
- Display clients in a ShadCN Table with Actions column (View / Edit / Delete — dummy toasts)
- Empty state handling ("No clients yet") with Import button
- Full-page reload of client list from database on successful import
- Error feedback via toasts

## Capabilities

### New Capabilities

- `client-import`: Server-side CSV import with phone-based deduplication, validation, and insertion into the `client` table
- `client-listing`: Server-rendered client list page at `/dashboard/clients` with ShadCN Table, empty state, and sidebar navigation

### Modified Capabilities

_(none)_

## Impact

- **Database**: New `client` table — `id` (UUID PK), `name`, `phone`, `location`, `comments`, `email`, `user_id` (nullable FK to `user.id`)
- **Schema**: New `clientsTable` in `lib/drizzle/schema.ts`
- **Pages**: New `app/dashboard/clients/page.tsx` (server component)
- **Components**: New client components for import button and table; ShadCN Table package needs installation
- **Navigation**: Add Clients link to `config/sidebar-menu.json`
- **API**: New Server Action for CSV import
