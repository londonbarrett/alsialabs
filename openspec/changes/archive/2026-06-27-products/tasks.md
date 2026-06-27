## 1. Database Schema & Seed

- [x] 1.1 Add `providers` table to Drizzle schema
- [x] 1.2 Add `products` table to Drizzle schema with FK to providers
- [x] 1.3 Add products module permissions to seed script
- [x] 1.4 Add company provider seeding to seed script
- [x] 1.5 Generate and run Drizzle migration

## 2. Server Actions

- [x] 2.1 Create `lib/actions/products.ts` with upsert, delete, and SKU check actions
- [x] 2.2 Add permission guards (requirePermission) to each action

## 3. Sidebar & Navigation

- [x] 3.1 Add Products nav item to sidebar config with permission check
- [x] 3.2 Create `app/dashboard/products/page.tsx` server component

## 4. Products UI

- [x] 4.1 Create `ProductDialog` component wrapping the dialog
- [x] 4.2 Create `ProductForm` component with fields and validation
- [x] 4.3 Create `ProductListView` component with table and empty state
- [x] 4.4 Create `ActionMenu` component for product rows (edit/delete)
- [x] 4.5 Wire up products page with permissions
