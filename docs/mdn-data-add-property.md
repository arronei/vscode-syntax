# mdn-data-add-property: CSS property → mdn/data

Adds or updates one CSS property in an mdn/data checkout. mdn-data's files are mostly, not strictly, sorted, so a plain sort would rewrite them. This tool slots the new keys in without reordering anything else. Used for the `color-interpolation` PR.

## Run

On a PR branch ([upstream-prs.md](upstream-prs.md#steps)):

```powershell
npm run mdn-data-add-property -- ../mdn-data prs/2026-10-mdn-data-color-interpolation/property.json
```

Then in `../mdn-data`: `npm test`. The lint fails if `appliesto`, `computed` and similar fields point to undefined keys.

## Input

Example: [prs/2026-10-mdn-data-color-interpolation/property.json](../prs/2026-10-mdn-data-color-interpolation/property.json).

| Field | Goes to | Notes |
|---|---|---|
| `name` | | Property name |
| `entry` | `css/properties.json` | The full entry. Copy the shape from a similar property. Replaces an existing entry of the same name. |
| `l10n` | `l10n/css.json` | Only new keys the entry uses, such as a new `appliesto` text. Existing keys are left alone. |
| `schemaEnums` | `css/properties.schema.json` | Registers new l10n keys in the matching enum, keyed by definition name (`appliesto`, `computed`, …) |
| `source` | | For your reference only (spec link) |

Take the facts from the spec. `@webref/css` has them parsed:

```powershell
node -e "console.log(require('./node_modules/@webref/css/css.json').properties.find(p=>p.name==='color-interpolation'))"
```
