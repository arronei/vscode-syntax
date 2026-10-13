# apply-html: HTML additions → vscode-custom-data

Applies an HTML [additions file](additions.md#html-format) to a vscode-custom-data checkout, keeping the repo's JSON formatting. Running it twice changes nothing the second time. Used for the baseline-attributes PR.

## Run

On a PR branch ([upstream-prs.md](upstream-prs.md#steps)):

```powershell
npm run apply-html -- additions/html/2026-10-baseline-html-attributes.json ../vscode-custom-data/web-data
```

It edits, in `web-data/html/`:

| File | What changes |
|---|---|
| `htmlTags.json` | Attribute added to its tag, with its `valueSet` |
| `mdnTagDescriptions.json` | Attribute description added |
| `valueSets.json` | New sets from `valueSets`; changed value descriptions from `valueSetEdits` |

It prints one line per item: `added`, `description added`, `already present`, and so on.

Then regenerate: `cd ../vscode-custom-data/web-data; node html/generateData.mjs`.

## Notes

- It only reads `valueSets`, `valueSetEdits` and `attributes`. Add `elements` (to `htmlTags.json`) and `globalAttributes` (to `htmlGlobalAttributes.json`) by hand.
- It applies the whole file. For a PR that should carry only some items, make a copy with just those.
- It stops with an error if a tag isn't in `htmlTags.json`, a `valueSet` is unknown, or a `valueSetEdits` target doesn't exist.
