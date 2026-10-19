# Client profile — Design

## Why this exists

A client is more than a row in a list: staff need one place to see who they are, what was invoiced, and everything that has happened with them. The client profile page is that place. It collects the client's contact details, an invoice-history section, and an activity timeline into a single scroll, so a rep never has to bounce between screens to understand the relationship.

The page is shaped around a header and stacked sections rather than tabs, because the three concerns are read together: details at the top, Activity below them, and Invoice History after that. Both sections are permission-gated, so a user without the relevant access simply sees a shorter page rather than an empty or erroring block.

The profile is also the natural home for navigation. A client switcher sits in the header so staff can move between clients without returning to the list, and edits made here — or from the client list — apply instantly through the optimistic stores rather than waiting on a round trip.

## Goals

- Present a client's details, invoice history, and activity timeline on one page.
- Let users move between client profiles from a header switcher without going back to the list.
- Gate the invoice-history and activity sections on their respective permissions.
- Make edits to a client feel instant, both on the profile card and in the client list.

## Design

### Page structure and ordering

The client profile is a `PageHeader` whose title is the client's name, with a `Users` icon beside it and the client switcher placed in the header's actions area. Below the header the page stacks its sections: the client info card first, then the Activity section, then the Invoice History section. Invoice history deliberately moved below Activity — it used to sit directly beneath the client info — so the page reads from identity to recent relationship history to billing record.

The Invoice History section is shown only to users holding `sales:view-invoice-history` and its header reads "Invoice History". The Activity section is shown only to users holding `client-activity:view`, its header reads "Activity", and its timeline lists both activities and reminders sorted by date descending.

### Client switcher

The switcher is a combobox at the top of the profile page that lets a user jump straight to another client's profile. It starts empty — no pre-selected value — with the input showing only its placeholder text, since the page already tells the user who they are looking at. Typing in the input filters the dropdown to matching clients, and selecting one navigates to that client's profile while the combobox is disabled for the duration of the navigation so a second selection can't land mid-transition. A clear button empties the input back to its starting state.

### Client info card

Client details — name, phone, email, location, and comments — render in a `Card` with a "Details" header and an edit button (pencil icon) in the card header. Clicking edit opens the `ClientDialog` pre-filled with the current values. Saving updates the info card immediately, closes the dialog, and runs the server action in the background while the global loading indicator shows, so the edit is reflected before the server confirms it.

### Optimistic edits in the list

Editing a client from the clients list takes the same optimistic approach: the row updates immediately with the new values, the dialog closes, and the server action runs in the background. Creation is the one case that does not go optimistic — creating a client refreshes the page, because the new row needs its server-generated ID before it can be rendered truthfully.

## Non-goals

- Tabs or separate routes per section. The profile is a single stacked page.
- Showing invoice history or activity to users who lack the permissions for them; those sections are simply omitted.
- Optimistic creation. New clients wait for the refresh so they carry their server-assigned ID.
</content>

</invoke>
