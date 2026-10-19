# Dashboard navigation — Design

## Why this exists

The sidebar is the spine of the app: every module — projects, clients, products, sales, billing, administration — is reached from it, so its structure is the user's mental model of the product. It replaced a flat "Navigation" list because that list mixed system administration with day-to-day user destinations and gave no hint of who could see what.

Users in this app have wildly different roles. A regular user should never see links to `Users`, `Permissions`, or `Sales`, while a super user should see everything. The sidebar therefore treats visibility as a function of module permissions, driven from data rather than hardcoded per role, so adding a module means extending the config rather than rewriting the layout.

The app also ships Spanish routes under `/app`, works on mobile where the sidebar becomes an overlay, and supports users who belong to multiple stores and need to switch the active one without leaving the page. All of that has to coexist with full keyboard access and a collapsible layout for narrow desktop screens.

## Goals

- Split nav into Admin, Navigation, and Auxiliary sections based on role and permissions.
- Filter every nav item by a per-item permission declared in a menu config.
- Highlight the active item, including when the user is on a subroute.
- Provide a store switcher that collapses to an icon when the sidebar collapses.
- Support collapse to icons-only, a mobile overlay that closes on navigation, and full keyboard navigation.
- Render every menu item with its configured icon.
- Use Spanish `/app` paths everywhere; legacy `/dashboard/*` paths return 404.

## Design

### Three areas, three sections

The sidebar on the dashboard renders three areas: the user menu, the main navigation, and the auxiliary menu. Inside the main navigation, items are grouped into three sections: **Admin** for system-management destinations (`Users`, `Permissions`, `Clients`, `Products`, `Categories`, `Sales`, `Activity`), **Navigation** for user-facing destinations (`Profile`, `My Invoices`, `My Tasks`, `Projects`, `Calendar`), and **Auxiliary** for `Help` and `Support`. This replaces the previous flat layout where all items sat in a single Navigation section.

### Permission filtering driven by the menu config

Menu items come from a config JSON object, and each item optionally declares a required permission such as `clients:view`. On render, items whose permission the user lacks are hidden. A user holding only `categories:view` therefore sees just "Categories" in the Admin section, while a super user sees the full set of Users, Permissions, Clients, Products, Categories, Sales, and Activity. `Activity` specifically requires `activity:view`, carries a `BarChart3` icon, and links to `/app/actividad`.

Hiding a link is navigation hygiene, not access control. Enforcement lives at the route: the categories admin page at `/app/categorias` requires `categories:view` and returns a forbidden error for users without it, even if they reach the URL directly. Clients read categories through a separate unauthenticated server action, which exists purely for operational purposes and is independent of the admin page gate.

### Navigation section contents and ordering

`Profile` sits first in the Navigation section, requires no permission, and links to `/app/perfil`. `My Invoices` comes next, above `My Tasks`, uses the `Receipt` icon, requires no permission, and links to `/app/mis-facturas`. `My Tasks` uses the `ListTodo` icon, links to `/app/mis-tareas`, and requires `projects:view`. The resulting order — Profile, My Invoices, My Tasks, Projects, Calendar — sits above the Auxiliary section, with permission-gated items simply dropped for users who lack them.

### Active state and navigation

Clicking a menu item highlights it as active. In the original home-route-only nav this was the whole effect — the item lit up and the user stayed on the home route — but items now navigate to their configured paths, so clicking `My Invoices` takes the user to `/app/mis-facturas`, and the highlight follows the resulting pathname. Subroutes keep their parent highlighted: on `/app/proyectos/123` the Projects item stays active, and on `/app/mis-facturas/123` the My Invoices item stays active.

### Store switcher

The sidebar's store section contains a store switcher: a dropdown whose trigger shows the active store name together with the total store count. Opening it lists every store the user has access to, and selecting one makes it the active store. When the sidebar is collapsed, the switcher degrades to a compact icon-only button so it doesn't break the icons-only layout.

### Collapse, responsiveness, and keyboard access

A collapse toggle shrinks the sidebar to icons-only for users who want more horizontal space. On mobile viewports the sidebar opens as an overlay, and tapping any navigation item closes the overlay and navigates to the selected route in one gesture. The sidebar is fully keyboard navigable: Tab moves focus through the nav items and controls in order, and the focused item activates with Enter or Space.

Every menu item displays the icon defined in the menu config — no text-only items — so the collapsed icons-only state remains legible.

### Spanish routing

The app base route is `/app` and the sidebar and all navigation use Spanish slugs: `/app/clientes`, `/app/productos`, `/app/ventas`, `/app/actividad`, `/app/categorias`, `/app/proyectos`, `/app/calendario`, `/app/perfil`, `/app/usuarios`, `/app/permisos`, `/app/mis-facturas`, `/app/mis-tareas`, with project subpages under `/app/proyectos/[id]/detalles`, `/app/proyectos/[id]/personas`, `/app/proyectos/[id]/gastos`, and `/app/proyectos/[id]/rutinas`. Old `/dashboard/*` paths return a 404 for everyone — no redirect — so stale links fail loudly instead of silently masking a wrong URL.

## Non-goals

- The old flat, unsectioned Navigation list. The three-section split is the structure now.
- Treating sidebar visibility as security. The sidebar hides links; routes enforce permissions, as `/app/categorias` does with `categories:view`.
- Redirects from legacy `/dashboard/*` routes. They 404 by design.
- A search or command palette inside the sidebar. The config-driven menu is the whole surface.
