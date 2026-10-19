# Theme preference — Design

## Why this exists

The app is used in bright offices and dim rooms alike, so its look should follow whatever the operating system is already set to rather than forcing one appearance on everyone. The cost of getting this wrong is small but constant: a dark-mode user opening a bright screen every morning. The preference is therefore set once, respected from the first paint, and needs no settings page to be useful.

## Goals

- Follow the system light/dark setting by default, including on a first-ever visit.
- Offer an explicit light/dark switch in the sidebar user menu.
- Remember the user's choice across sessions and reloads.

## Design

### Default to the system, then to the user's choice

The resolved theme starts from the operating system: a user who has never chosen sees whatever their OS or browser reports through `prefers-color-scheme`. The moment they pick light or dark from the toggle, that choice becomes authoritative and is persisted, so it wins over the system on every later visit. There is no third "system" state to return to; the toggle is a binary switch between light and dark.

### The toggle lives in the sidebar user menu

The theme toggle is an item in the sidebar aux area's user menu, sitting beside the other account-level controls. It is presented as a menu item rather than a bare icon so it reads as an account preference and stays out of the primary navigation.

### The toggle shows the resolved theme, not the mode

When the user is still following the system, the toggle displays the theme that has actually been resolved — a system set to dark shows "Dark" as the current value, and clicking it switches to light. The control reflects what the user is looking at, not an abstract "follow system" state that would be invisible in the UI.

A first-time visitor therefore sees the system's theme immediately; a returning visitor sees the theme they last chose; a click always flips to the opposite of what is currently displayed; and the flipped value survives a reload.

## Non-goals

- A separate "follow the system" option in the toggle. The system is the starting point, not a selectable state.
- Per-project or per-page themes. This is a single account-level preference.
- A dedicated settings page. The sidebar menu item is the whole surface.
