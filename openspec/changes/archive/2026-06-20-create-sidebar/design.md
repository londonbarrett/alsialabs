## Context

The dashboard needs a navigation sidebar. Currently there is no navigation structure — this is the foundational layout component. The sidebar uses ShadCN's Sidebar block from radix-nova, following Next.js App Router layout conventions.

## Goals / Non-Goals

**Goals:**
- Create a responsive sidebar with three menu areas (user, navigation, aux)
- Menu items loaded from a JSON config object for easy future updates
- Click-to-highlight interaction with collapse/expand toggle
- Keyboard accessible and WCAG compliant

**Non-Goals:**
- Real route navigation (all items point to `/`)
- User authentication or login functionality
- Dynamic or API-driven menu content

## Decisions

- **ShadCN Sidebar**: Use the Sidebar component from shadcn/ui (radix-nova) as the foundation — already available in the project's component library
- **JSON config**: Menu structure defined in a static JSON file. Easy to replace with API data later without changing the component
- **Next.js App Router**: Sidebar should be part of the root dashboard layout (`app/dashboard/layout.tsx`) for persistent rendering across pages

## Risks / Trade-offs

- **Mobile behavior**: Sidebar must collapse gracefully on narrow viewports — ShadCN Sidebar supports this natively
- **Mock routes**: All items linking to `/` means no real navigation feedback yet; future ticket will wire real routes
