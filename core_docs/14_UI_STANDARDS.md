# 14 — UI Standards (mandatory for every new field, menu, screen and feature)

These rules apply to all SerenTax screens. They are enforced by code (types and
shared components) and by `tests/unit/ui-standards.test.ts`. A change that
breaks them fails `npm test`. If a rule truly cannot apply, record the
exception in `13_DECISIONS_AND_OPEN_ITEMS.md` and in the test's allow-list,
never silently.

Decided 2026-11-22 (user request). This supersedes the earlier "strictly
monochrome" visual rule: the neutral black/white base stays, and colour is used
**only for meaning**.

## 1. No technical names in the UI

Users never see enum values, error codes, table names, env var names or API
paths. `CORETAX_SUBMITTED`, `SME_APPROVED`, `/v1/validate` and `OCR_API_KEY`
must not appear in any label, menu, badge, option, toast or message.

- Every enum shown to a user has an entry in `apps/web/src/i18n/codes.ts`
  (`codeRegistry`). Each entry has a colour tone, a functional label and a
  help text in both languages.
- Show a code as a badge with `<CodeBadge domain="…" code={value} />`, as text
  with `codeLabel(locale, domain, value)`, or as dropdown options with
  `codeOptions(locale, domain, values?)`.
- The technical name may only appear inside the info tooltip, under
  "Nama teknis / Technical name". That is where admins and support can find it.
- Error codes map to friendly messages in the i18n dictionaries. Never render
  `error.code` directly.
- The only exception is the documented value format a user must type, such
  as the import CSV codes. Mark those strings with the trailing comment
  `// ui-standards-allow: <reason>`.

## 2. Every field has a label and an info tip (functional + technical)

- Use `<FormField field="model.field">` from `components/ui/field.tsx`, or the
  `Field` shorthand from `components/account/forms.tsx`. `field` is
  **required** by the type system.
- The key must exist in `apps/web/src/i18n/fields.ts` (`fieldDictionary`),
  with a label and a functional help text in both Indonesian and English.
  The tooltip shows the help text first, then the technical name, which is the
  key.
- New field means a new dictionary entry. You may override the label with
  `label={…}`, but the dictionary entry is still required.
- Required fields show a red `*`, placed outside the `<label>` so accessible
  names stay exact.
- Never use a raw `<select>`. Use `Combobox` (searchable) for single choice
  and `MultiCombobox` for many2many.

## 3. Semantic colour (CTA and status)

| Colour | Token              | Use for                                                                               |
| ------ | ------------------ | ------------------------------------------------------------------------------------- |
| Blue   | `primary` / `info` | Primary action (Save, Submit, Evaluate, Create), in-progress and informational states |
| Green  | `success`          | Approve, verify, success, approved/accepted/active                                    |
| Amber  | `warning`          | Request changes, archive, waiting/pending, test/non-production                        |
| Red    | `danger`           | Delete, void, revoke, reject, end sessions, errors, rejected/expired                  |
| Violet | `violet`           | Handed over or exported, special roles                                                |
| Gray   | `muted`            | Draft, inactive, archived, neutral                                                    |

- Buttons use the `Button` variants `default` (blue), `success`, `warning`,
  `danger`, `outline`, `ghost` and `link`. Destructive confirmations use
  `ConfirmDialog tone="danger"`. Archive uses `tone="warning"`.
- Destructive menu items use `MenuItem danger`. Destructive list actions set
  `danger: true`.
- Status badges always come from the code registry tone. Never pick a colour
  ad hoc.
- `Notice` tones are `info`, `success`, `warning` and `danger`.
- Every colour has light and dark tokens in `app/globals.css`. Do not
  hard-code hex values in components.

## 4. Bounded scrolling and pagination (50 rows)

- Every list view uses `ListPage`. Its default page size is
  `LIST_PAGE_SIZE = 50` (`components/views/list-view.tsx`). Server-paged
  lists pass `pageSize: LIST_PAGE_SIZE`.
- The table body scrolls inside a bounded area with a sticky header and a
  sticky totals footer, so the page never grows without limit.
- Inner tables and feeds inside forms (import rows, export items, chatter,
  sessions, members, grants…) use `usePaged()` with `<PagedFooter>` from
  `components/views/paged.tsx`.

## 5. Totals are bold

- Columns with an `aggregate` show group subtotals and a sticky footer
  **Total** row in `font-bold`.
- Form totals (DPP, tax, amount totals) use `font-bold`, and KPI numbers use
  `font-bold tabular-nums`.

## 6. Layout: header, tabs, lines

- Record and settings screens follow the same structure:
  1. a **header** (who or what this is, its status badge, and the main
     actions);
  2. **tabs** that group related sections;
  3. **sections** (title, short intro, then content), with repeated data shown
     as **line tables**.
- Roles and permissions are rendered from `rolePermissions` /
  `permissionList` in `server/workspaces/policy.ts`, a single source of truth.
  To add a permission, add it to the policy and the `permission` code domain,
  and the Settings matrix updates itself.

## 7. Menus and modules

- Modules are declared once in `components/layout/modules.ts`, each with a
  functional label, a hint, an icon and a semantic tile colour (`tile`,
  `accent`). Menu labels are functional nouns ("Transactions", "Coretax
  exports"), never model or route names.

## Checklist for a new field, menu or feature

- [ ] Field keys added to `fields.ts` (ID and EN label and help).
- [ ] Enum values added to `codes.ts` (tone, ID and EN label and help).
- [ ] No raw code, env var or API path in the i18n strings (the test checks).
- [ ] Buttons and badges use the semantic colours above.
- [ ] Lists use `ListPage` (50 rows) or `usePaged`. Totals are bold.
- [ ] Screens use header, tabs and sections. The menu entry is in
      `modules.ts`.
- [ ] Unit test plus E2E selectors use functional labels.
