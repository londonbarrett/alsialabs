## ADDED Requirements

### Requirement: User can view and toggle theme preference
The system SHALL allow users to toggle between light, dark, and system-default themes via a button in the sidebar aux area. The user's choice SHALL persist across sessions.

#### Scenario: First-time user sees system-preferred theme
- **WHEN** user loads the application for the first time
- **THEN** the theme matches the user's OS/browser system preference

#### Scenario: Returning user sees their saved choice
- **WHEN** user previously selected a theme
- **WHEN** they load the application again
- **THEN** the theme persists from their last visit

#### Scenario: User toggles theme via sidebar button
- **WHEN** user clicks the theme toggle button in the sidebar aux area
- **THEN** the theme switches to the next mode (light → dark → system → light)
- **WHEN** user reloads the page
- **THEN** the toggled theme is still active

#### Scenario: User selects system-default and OS changes preference
- **WHEN** user has selected "system" theme
- **WHEN** their OS preference changes from light to dark
- **THEN** the application theme updates to match without requiring a page reload
