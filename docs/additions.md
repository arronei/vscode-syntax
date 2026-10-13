# Additions files

`additions/css/*.json` and `additions/html/*.json` hold one batch per file. They're the source of truth for the extension and for upstream PRs. Name files `YYYY-MM-<topic>.json`. The build reads them in name order. If a CSS name appears twice, the first one wins.

## Generate a CSS batch from a gap report

```powershell
npm run additions-from-gap-report -- reports/latest.json additions/css/2026-11-shipping-from-specs.json
```

- Optional third argument: priorities to keep, default `P1,P2`.
- Skips names already in other CSS additions files.
- If the output file exists, entries keep their hand-written fields (`description`, `values`, `syntax`).
- Prints the HTML items it found. Those need a written description, so add them to an HTML file by hand.

Then [build the extension](build-extension.md).

## CSS format

```jsonc
{
  "title": "What this batch is",
  "why": "Optional free text",
  "properties": [
    { "name": "text-fit" },
    { "name": "color-interpolation", "description": "…", "values": { "auto": "…", "sRGB": "…" } }
  ],
  "atRules":   [ { "name": "@function", "description": "…" } ],
  "selectors": [ { "name": "::scroll-button", "description": "…" } ],
  "fillEmptyBuiltinDescriptions": true
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | |
| `description` | no | Default for properties: facts from the spec ("Defined in …. Initial value: …"). Selectors: the spec's first sentences. At-rules: the spec prose. |
| `values` | no | Keyword → description. The keywords themselves come from the syntax. |
| `syntax` | only if not in `@webref/css` or `mdn-data` | The build fails with `no syntax for <name>` otherwise. |
| `bcd` | no | BCD key, when it isn't `css.properties.<name>`, `css.at-rules.<name>` or `css.selectors.<name>`. |
| `fillEmptyBuiltinDescriptions` | no | Batch-level. Writes hover text for every built-in property with an empty description. One file has it already (`2026-10-fill-empty-descriptions.json`). |

## HTML format

```jsonc
{
  "title": "What this batch is",
  "criteria": "Why these items were picked",
  "valueSets": [
    { "name": "command", "values": [ { "name": "show-modal", "description": "Opens the target `<dialog>` as a modal." } ] }
  ],
  "valueSetEdits": [ { "name": "loading", "values": { "eager": "New description" } } ],
  "attributes": [
    { "tag": "button", "name": "command", "valueSet": "command", "bcd": "html.elements.button.command", "description": "…" }
  ],
  "globalAttributes": [
    { "name": "writingsuggestions", "valueSet": "writingsuggestions", "bcd": "html.global_attributes.writingsuggestions", "description": "…" }
  ],
  "elements": [
    { "name": "camera", "bcd": "html.elements.camera", "description": "…", "attributes": [ { "name": "…", "description": "…" } ] }
  ]
}
```

| Field | Notes |
|---|---|
| `description` | Required, markdown. Write it yourself; don't copy MDN text. |
| `valueSet` | `v` for a boolean attribute, the name of a built-in set (`loading`, `fetchpriority`, `referrerpolicy`, …), or one defined in `valueSets`. Built-in sets you reference are copied into the extension data automatically. |
| `bcd` | Adds browser versions, Baseline and the MDN link to the hover. Take it from the gap report's `bcdKey`. |
| `valueSetEdits` | Replaces descriptions of values in an existing set |
| `elements[].attributes` | Same shape as `attributes`, without `tag` |

[apply-html](apply-html.md) uses `valueSets`, `valueSetEdits` and `attributes` only. `elements` and `globalAttributes` are extension-only until added upstream by hand.
