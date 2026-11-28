# Dashboard navigation — Design

## Why this exists

The sidebar is the spine of the app: every module — projects, clients, products, sales, billing, administration — is reached from it, so its structure is the user's mental model of the product. It replaced a flat "Navigation" list because that list mixed system administration with day-to-day user destinations and gave no hint of who could see what.

Users in this app have wildly different roles. A regular user should never see links to `Users`, `Permissions`, or `Sales`, while a super user should see everything. The sidebar therefore treats visibility as a function of module permissions, driven from data rather than hardcoded per role, so adding a module means extending the config rather than rewriting the layout.

The app also ships Spanish routes under `/app`, works on mobile where the sidebar becomes an overlay, and supports users who belong to multiple stores and need to switch the active one without leaving the page. All of that has to coexist with full keyboard access and a collapsible layout for narrow desktop screens.

## Goals

- Split nav into Store, Admin, Navigation, and Auxiliary sections based on role and permissions.
- Filter every nav item by a per-item permission declared in a menu config.
- Highlight the active item, including when the user is on a subroute.
- Provide a store switcher that collapses to an icon when the sidebar collapses.
- Support collapse to icons-only, a mobile overlay that closes on navigation, and full keyboard navigation.
- Render every menu item with its configured icon.
- Use Spanish `/app` paths everywhere; legacy `/dashboard/*` paths return 404.

## Design

### Three areas, three sections

The sidebar on the dashboard renders three areas: the user menu, the main navigation, and the auxiliary menu. Inside the main navigation, items are grouped into four sections: **Store** for day-to-day business destinations (`Clients`, `Products`, `Sales`, `Activity`), **Admin** for system management (`Users`, `Permissions`, `Categories`, `Backups`), **Navigation** for user-facing destinations (`My Projects`, `My Tasks`, `Calendar`), and **Auxiliary** for `Help` and `Support`. This replaces the previous flat layout where all items sat in a single Navigation section.

The sidebar header shows the Agralia wordmark from `public/agralia-logo.svg`. It is hidden when the sidebar collapses, so the icons-only rail begins with the nav items — there is no separate compact mark. The user menu at the footer opens upward on desktop and downward on mobile.

### Permission filtering driven by the menu config

Menu items come from a config JSON object, and each item optionally declares a required permission such as `clients:view`. On render, items whose permission the user lacks are hidden. A user holding only `categories:view` therefore sees just "Categories" in the Admin section, while a super user sees the full set of Users, Permissions, Clients, Products, Categories, Sales, and Activity. `Activity` specifically requires `activity:view`, carries a `BellRing` icon, and links to `/app/actividad`.

Hiding a link is navigation hygiene, not access control. Enforcement lives at the route: the categories admin page at `/app/categorias` requires `categories:view` and returns a forbidden error for users without it, even if they reach the URL directly. Clients read categories through a separate unauthenticated server action, which exists purely for operational purposes and is independent of the admin page gate.

### Navigation section contents and ordering

`My Projects` sits first in the Navigation section, uses the `FolderKanban` icon, requires `projects:view`, and links to `/app/proyectos`. `My Tasks` follows, using the `ListTodo` icon, linking to `/app/mis-tareas`, and also requiring `projects:view`. `Calendar` uses the `CalendarDays` icon, requires `projects:view`, and links to `/app/calendario`. The resulting order — My Projects, My Tasks, Calendar — sits above the Auxiliary section, with permission-gated items simply dropped for users who lack them. `Profile` and `My Invoices` are no longer nav items; their routes and translations remain for direct links and breadcrumbs.

### Active state and navigation

Clicking a menu item highlights it as active. The highlight follows the resulting pathname, and subroutes keep their parent highlighted: on `/app/proyectos/123/gastos` the My Projects item stays active. The breadcrumb above the page title is gone; the top bar now carries the AI search field instead.

### Store switcher

The sidebar's store section contains a store switcher: a dropdown whose trigger shows the active store name together with the total store count. Opening it lists every store the user has access to, and selecting one makes it the active store. When the sidebar is collapsed, the switcher degrades to a compact icon-only button so it doesn't break the icons-only layout.

### Collapse, responsiveness, and keyboard access

A collapse toggle shrinks the sidebar to icons-only for users who want more horizontal space. On mobile viewports the sidebar opens as an overlay from the top-bar trigger, and tapping any navigation item closes the overlay and navigates to the selected route in one gesture. While the mobile overlay is open, the document scroll is locked on `html` (not just `body`, which is Base UI's default) so the scrollbar disappears without shifting the layout; `useIsMobile` uses `useSyncExternalStore` with a server snapshot so hydration does not mismatch on small screens. The sidebar is fully keyboard navigable: Tab moves focus through the nav items and controls in order, and the focused item activates with Enter or Space.

Every menu item displays the icon defined in the menu config — no text-only items — so the collapsed icons-only state remains legible.

### Top bar

The top bar holds the sidebar trigger and an AI-style search input with the placeholder "What can I help you today?" and a sparkles icon using the `--ring` token. It has no breadcrumb and no search behavior — the field is display-only. The bar uses `py-3` for vertical padding; the input keeps its own `h-12` and `py-3`.

### Page headers and project subsections

`PageHeader` hides its subtitle on mobile (`hidden md:block`). Subsection pages pass a `section` label plus a `sectionHref`; the label renders as a small uppercase eyebrow above the title that links back to the parent section. Main-section pages pass neither.

A project detail page has no back button and no status badge. Its header shows the `My Projects` eyebrow with the `FolderKanban` icon above the project name. Desktop shows the four section tabs (Tasks, Details, People, Expenses); mobile replaces them with a full-width `Select` whose options carry the same icons, with extra vertical padding on the items. Selecting a section navigates to its route.

### Spanish routing

The app base route is `/app` and the sidebar and all navigation use Spanish slugs: `/app/clientes`, `/app/productos`, `/app/ventas`, `/app/actividad`, `/app/categorias`, `/app/proyectos`, `/app/calendario`, `/app/perfil`, `/app/usuarios`, `/app/permisos`, `/app/mis-facturas`, `/app/mis-tareas`, with project subpages under `/app/proyectos/[id]/detalles`, `/app/proyectos/[id]/personas`, and `/app/proyectos/[id]/gastos`. Old `/dashboard/*` paths return a 404 for everyone — no redirect — so stale links fail loudly instead of silently masking a wrong URL.

## Non-goals

- The old flat, unsectioned Navigation list. The four-section split is the structure now.
- Treating sidebar visibility as security. The sidebar hides links; routes enforce permissions, as `/app/categorias` does with `categories:view`.
- Redirects from legacy `/dashboard/*` routes. They 404 by design.
- A search or command palette inside the sidebar. The config-driven menu is the whole surface.
