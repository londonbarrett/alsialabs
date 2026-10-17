# Client list search — Design

## Why this exists

A client list grows quickly, and scrolling it to find one name does not scale. A search input in the list header lets staff narrow the table as they type, matching against any of the fields that identify a client rather than forcing them to remember which column holds the value they know.

Alongside the input, the list shows how many clients exist as plain text. At a glance the count tells the user the size of the result they are looking at, and — after typing — it makes it obvious that a query has narrowed things down. Both live in the `PageHeader` actions area so the list itself stays uncluttered.

## Goals

- Let users filter the client list as they type.
- Match across name, phone, email, location, and comments, case-insensitively.
- Show the total client count before the search input.
- Tell the user when a query matches nothing, and restore the full list when cleared.
- Keep the input accessible to screen readers and keyboard users.

## Design

### The search input

The clients list at `/app/clientes` renders a search input in the `PageHeader` actions area when there are clients to show. It uses the `InputGroup` component with a `Search` icon prefix, and carries placeholder text indicating that it searches clients.

### The client count

The total number of clients is displayed as plain text immediately before the search input, phrased as a count — with 400 clients in the database the header reads "400 clients". It sits ahead of the input so the reader's eye passes the size of the list before reaching the filter.

### Filtering behavior

Typing into the input filters the table rows to only those clients matching the query. The match is case-insensitive and runs against a client's name, phone, email, location, and comments, so a query finds a client by any of the details staff might recall. A query that matches nothing replaces the table with a message indicating that no clients match the search. Clearing the input restores all clients.

### Accessibility

The search input is built to be usable without sight or a mouse. It has an associated label or `aria-label` for screen readers, and focusing it allows typing to search without any keyboard conflicts, so the input does not trap or override keys used for navigation.

## Non-goals

- Fuzzy matching, ranking, or search history. Filtering is a straightforward case-insensitive substring match across the five fields.
- Server-side search or pagination; the list filters what is already on the page.
- Searching fields other than name, phone, email, location, and comments.
</content>
