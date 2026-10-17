# Money input — Design

## Why this exists

Money fields are a quiet source of bad forms: a bare number is hard to read at a glance, and an unconstrained text box lets stray characters through to the server. This capability provides a single currency input that formats its value as the user types — the string `150000` renders as `$150,000` — while accepting digits only, so whatever the input holds is always a clean number ready for the rest of the form.

It is deliberately shaped as a `Field` type rather than a standalone control. Labels, error display, and form-row layout already belong to `Field`, and a money input that bypassed them would fork the form conventions. Making it reachable as `type="money"` means any existing field row can become a money row by changing one prop.

## Goals

- Display values as formatted currency while the user types.
- Accept digits only; strip letters, symbols, and everything else.
- Keep the cursor in the right place when formatting inserts separators.
- Integrate with `Field` via `type="money"`, with `currency` and `locale` options.

## Design

### Formatting follows the value, not the keystrokes

The input always renders its current value through currency formatting. A value of `"150000"` displays as `$150,000`, and typing `1234` into an empty input displays `$1,234` — formatting is reapplied on every keystroke, so the display is correct at every moment rather than only on blur. The example formats above assume the default currency and locale; the input formats according to whichever `currency` and `locale` it is given.

Decimal strings coming back from the database are handled by formatting the integer part: a stored `"150000.00"` displays as `$150,000`. The fractional part is not shown, so database precision never leaks into the display as a stray `.00`.

### Only digits reach the input

Every character the user types is filtered: non-numeric input — letters, symbols, punctuation — is stripped before it appears. This is enforced at the input itself rather than by validation after the fact, so the value can never be in an invalid shape that a later validator has to reject.

### The cursor survives reformatting

Formatting inserts grouping separators as the value grows, which would otherwise shove the caret around while typing. When a digit is typed in the middle of a value, the cursor stays immediately after that typed digit, with its position adjusted for any separators the reformatting inserted. Typing `1` between existing digits in `1234` to make `11234` leaves the caret right after the new `1`, not at the end of the reformatted string.

### Integration with `Field`

`Field` accepts a `type="money"` prop and renders a `MoneyInput` in place of the plain input, keeping the surrounding label and error display exactly as they are for any other field type. The pass-through options let a row format for a different currency and locale: `type="money"` with `currency="EUR"` and `locale="de-DE"` formats values per German conventions in euro, while the default configuration keeps the app's standard currency formatting. The input owns only formatting and filtering; label association, error rendering, and row layout remain `Field`'s job.

## Non-goals

- Editing or displaying fractional units (cents). The input works in whole units, and a stored decimal value shows its integer part only.
- A standalone money display component. Reading a formatted amount outside a form is a rendering concern elsewhere, not this input.
- Currency conversion or symbol selection at runtime. The currency and locale are fixed per field via props.
