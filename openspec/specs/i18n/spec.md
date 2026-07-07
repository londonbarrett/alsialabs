## ADDED Requirements

### Requirement: Locale detection
The system SHALL resolve the user's locale from a cookie, falling back to the browser's `Accept-Language` header, and finally to a default locale.

#### Scenario: Cookie takes priority
- **GIVEN** a user has visited the app before and the `NEXT_LOCALE` cookie is set to `"en"`
- **WHEN** they visit any page
- **THEN** the UI is displayed in English

#### Scenario: Accept-Language used when no cookie
- **GIVEN** a user visits for the first time and their browser sends `Accept-Language: fr-CH, fr;q=0.9, en;q=0.8`
- **AND** no `NEXT_LOCALE` cookie is set
- **WHEN** they visit any page
- **THEN** the UI is displayed in French (closest supported match)

#### Scenario: Default locale when no match
- **GIVEN** a user visits for the first time with `Accept-Language: ja;q=1`
- **AND** no `NEXT_LOCALE` cookie is set
- **WHEN** they visit any page
- **THEN** the UI is displayed in Spanish (the default locale)

### Requirement: Locale switcher
The system SHALL provide a locale switcher in the user nav dropdown that toggles between English and Spanish.

#### Scenario: Toggle cycles locale
- **GIVEN** the current locale is English
- **WHEN** the user clicks the locale switcher in the nav dropdown
- **THEN** the locale switches to Spanish
- **AND** all UI text updates to Spanish
- **AND** the `NEXT_LOCALE` cookie is updated

#### Scenario: Switcher reflects current locale
- **GIVEN** the current locale is English
- **THEN** the switcher displays "ES" as the available option

### Requirement: Translated UI
All UI components SHALL display text in the resolved locale for all supported namespaces.

#### Scenario: Dashboard reports are translated
- **GIVEN** the locale is Spanish
- **WHEN** the user visits the reports page
- **THEN** chart labels read "Producto" and "Servicio"
- **AND** empty states read "No hay datos de ingresos aún."

#### Scenario: Server action errors are translated
- **GIVEN** the locale is Spanish
- **WHEN** a server action fails with a validation error
- **THEN** the error message is displayed in Spanish

### Requirement: Server action translation
Server actions SHALL use a shared helper to resolve the locale and provide translated error messages.

#### Scenario: getActionT returns correct translation
- **GIVEN** a server action imports `getActionT` from `lib/i18n-actions`
- **WHEN** it calls `getActionT('actions.clients')`
- **THEN** the returned function translates keys from the `actions.clients` namespace
- **AND** the locale is resolved from the `NEXT_LOCALE` cookie
