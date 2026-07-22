## ADDED Requirements

### Requirement: Money input field formats currency as user types
The system SHALL provide a money input component that displays values formatted as currency (e.g., $1,234) while allowing users to type only digits.

#### Scenario: Initial value displays formatted
- **WHEN** a money input is rendered with value "150000"
- **THEN** it SHALL display "$150,000"

#### Scenario: Decimal values from database are handled
- **WHEN** a money input receives a decimal string value like "150000.00" from the database
- **THEN** it SHALL display "$150,000" (integer part only)

#### Scenario: Typing updates formatted display
- **WHEN** a user types "1234" into an empty money input
- **THEN** it SHALL display "$1,234"

#### Scenario: Only digits are accepted
- **WHEN** a user types non-numeric characters (letters, symbols)
- **THEN** they SHALL be stripped and not appear in the input

#### Scenario: Cursor position is preserved
- **WHEN** a user types a digit in the middle of a value
- **THEN** the cursor SHALL remain after the typed digit, accounting for formatting changes

### Requirement: Money input integrates with Field component
The Field component SHALL support a `type="money"` prop to render a MoneyInput.

#### Scenario: Field with type="money" renders MoneyInput
- **WHEN** a Field component is rendered with `type="money"`
- **THEN** it SHALL render a MoneyInput with proper label and error display

#### Scenario: Field supports currency and locale options
- **WHEN** a Field component is rendered with `type="money"` and `currency="EUR"` and `locale="de-DE"`
- **THEN** the MoneyInput SHALL format values according to the specified currency and locale
