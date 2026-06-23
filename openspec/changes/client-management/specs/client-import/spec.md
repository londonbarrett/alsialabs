## ADDED Requirements

### Requirement: User can import clients from CSV
The system SHALL accept a CSV file upload and import client records with phone-based deduplication.

#### Scenario: Successful CSV import
- **WHEN** the user clicks "Import data" on `/dashboard/clients`
- **AND** selects a CSV file with columns NAME, PHONE, LOCATION, COMMENTS, EMAIL
- **THEN** the file is sent to the server via a Server Action
- **AND** the CSV is parsed
- **AND** rows with phone numbers not already in the `client` table are inserted
- **AND** the page reloads the client list from the database

#### Scenario: Duplicate phone number is skipped
- **WHEN** a CSV row contains a phone number that already exists in the `client` table
- **THEN** that row is skipped
- **AND** other non-duplicate rows are imported

#### Scenario: Invalid CSV format shows error toast
- **WHEN** the uploaded CSV has missing or incorrect columns
- **THEN** the server returns an error
- **AND** the user sees an error toast
- **AND** no data is imported

#### Scenario: Import failure shows error toast
- **WHEN** the CSV processing fails for any reason
- **THEN** the user sees an error toast
- **AND** the existing client list (if any) remains unchanged

### Requirement: CSV file is not persisted
The system SHALL NOT store the uploaded CSV file anywhere — it SHALL be parsed in memory and discarded after processing.

#### Scenario: File is not saved after import
- **WHEN** a CSV file is uploaded and processed
- **THEN** the file is not written to disk or any storage service
