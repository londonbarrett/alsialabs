## ADDED Requirements

### Requirement: User can view and toggle theme preference
The system SHALL default to the user's system theme and SHALL allow users to toggle between light and dark themes via the theme toggle item in the sidebar aux area (user menu). The user's choice SHALL persist across sessions.

#### Scenario: First-time user sees system-preferred theme
- **WHEN** user loads the application for the first time
- **THEN** the theme matches the user's OS/browser system preference

#### Scenario: Returning user sees their saved choice
- **WHEN** user previously selected a theme
- **WHEN** they load the application again
- **THEN** the theme persists from their last visit

#### Scenario: Toggle switches between light and dark
- **WHEN** user opens the user menu in the sidebar aux area
- **AND** clicks the theme toggle item
- **THEN** the theme switches to the opposite of the currently displayed theme (light ⇄ dark)

#### Scenario: Toggle reflects the resolved theme while in system mode
- **GIVEN** the user is following the system theme, resolved to dark
- **WHEN** the theme toggle item is displayed
- **THEN** it shows "Dark" as the current theme
- **AND** clicking it switches to light

#### Scenario: Toggled theme persists after reload
- **WHEN** the user toggles the theme and reloads the page
- **THEN** the toggled theme is still active
