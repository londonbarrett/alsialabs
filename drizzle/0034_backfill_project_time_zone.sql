-- Backfill project time zones from the project's country. This mirrors the
-- first candidate of every COUNTRY_TIMEZONES entry in lib/projects/location.ts
-- (Task 2); when a country is added or its default zone changes, update both
-- the TypeScript map and this CASE expression. Unknown/stale countries get UTC.
UPDATE "project"
SET "time_zone" = CASE "country"
  WHEN 'CA' THEN 'America/Toronto'
  WHEN 'US' THEN 'America/New_York'
  WHEN 'MX' THEN 'America/Mexico_City'
  WHEN 'GT' THEN 'America/Guatemala'
  WHEN 'BZ' THEN 'America/Belize'
  WHEN 'HN' THEN 'America/Tegucigalpa'
  WHEN 'SV' THEN 'America/El_Salvador'
  WHEN 'NI' THEN 'America/Managua'
  WHEN 'CR' THEN 'America/Costa_Rica'
  WHEN 'PA' THEN 'America/Panama'
  WHEN 'BS' THEN 'America/Nassau'
  WHEN 'CU' THEN 'America/Havana'
  WHEN 'HT' THEN 'America/Port-au-Prince'
  WHEN 'DO' THEN 'America/Santo_Domingo'
  WHEN 'JM' THEN 'America/Jamaica'
  WHEN 'PR' THEN 'America/Puerto_Rico'
  WHEN 'BB' THEN 'America/Barbados'
  WHEN 'TT' THEN 'America/Port_of_Spain'
  WHEN 'CO' THEN 'America/Bogota'
  WHEN 'VE' THEN 'America/Caracas'
  WHEN 'GY' THEN 'America/Guyana'
  WHEN 'SR' THEN 'America/Paramaribo'
  WHEN 'EC' THEN 'America/Guayaquil'
  WHEN 'PE' THEN 'America/Lima'
  WHEN 'BR' THEN 'America/Sao_Paulo'
  WHEN 'BO' THEN 'America/La_Paz'
  WHEN 'PY' THEN 'America/Asuncion'
  WHEN 'CL' THEN 'America/Santiago'
  WHEN 'AR' THEN 'America/Buenos_Aires'
  WHEN 'UY' THEN 'America/Montevideo'
  ELSE 'UTC'
END;
