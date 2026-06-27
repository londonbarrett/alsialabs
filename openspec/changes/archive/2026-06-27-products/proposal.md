## Why

The business needs to expand from a single in-house product to managing multiple products. A new Products module is needed to support both in-house products (owned by us) and products from external providers.

## What Changes

- New `providers` database table for tracking product sources
- New `products` database table with FK reference to providers
- Full CRUD server actions for products (create, read, update, delete)
- Products UI page with table view, add/edit dialog, and action menu (mirroring the clients module)
- Permission-based access control for the products module (view, create, edit, delete)
- Company seeded as a provider record for in-house products

**Out of scope:** Inventory management, providers CRUD, CSV import

## Capabilities

### New Capabilities
- `products`: Full product lifecycle management — list, create, edit, delete products with provider assignment

### Modified Capabilities
<!-- None — this is a brand new feature -->

## Impact

- New Drizzle schema tables: `providers` and `products` in `lib/drizzle/schema.ts`
- New server actions in `lib/actions/`
- New dashboard page at `app/dashboard/products/`
- New components: product list view, product dialog, product form, action menu
- Updates to `lib/drizzle/seed.ts` to add products module permissions and seed company provider
- Updates to sidebar menu config to add Products navigation item
- No API endpoints — server actions only
- PostgreSQL via Drizzle ORM
