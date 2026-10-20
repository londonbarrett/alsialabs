# i18n message consolidation — Plan

Design: `docs/superpowers/specs/2026-10-18-i18n-consolidation-design.md`

## Goal

Reduce both `messages/en.json` and `messages/es.json` from 807 keys to the keys actually read, with each shared label defined exactly once. Delete 149 dead keys; collapse 148 duplicate instances into `common`, `invoice`, and `nav`; fix the breadcrumb.

## Method

1. Generate the full key→key collapse map with the validated scanner (handles dynamic lookups, template literals, string concatenation, full-path data files, `getActionT`, array destructuring).
2. Add the new `common.*` / `invoice.*` / `nav.*` keys to both locales.
3. Apply call-site edits from the map (full-path `t("a.b")` → `t("target")`).
4. Delete the resulting dead keys from both JSON files.
5. Verify.

## Tasks

1. Write design + plan docs. ✅
2. Generate and review the collapse map (source key → target key, per locale value).
3. Add missing `common.*` keys (new labels + standardized Spanish for the 7 differing groups).
4. Add the `invoice.*` namespace.
5. Add the `nav` namespace (route labels by URL segment + `nav.sections.*`).
6. Repoint generic duplicates → `common.*`.
7. Repoint `sales`/`myInvoices` duplicates → `invoice.*`.
8. Repoint page titles (`clients.title`, `projects.title`, …) → `nav.<segment>`.
9. Merge `app-sidebar.tsx` + `dashboard-breadcrumb.tsx` onto `nav`; delete `sidebar` and `breadcrumb` namespaces.
10. Handle the three namespace-relative files (`permission-matrix.tsx`, `perfil/page.tsx`, `line-items-table.tsx`) by switching to full-path root calls.
11. Delete the full dead-key set from both locale files.
12. Run `pnpm verify`; fix any fallout.
13. Run `pnpm test:e2e`; confirm English label assertions still pass.
14. Commit (only on explicit go-ahead).

## Notes

- The collapse revives currently-"dead" `common.*` keys that become targets (`common.description`, `common.type`, `common.date`, …) — do not delete those.
- `actions.sales.*` and `actions.auth.*` stay (still referenced).
- No English string changes.
