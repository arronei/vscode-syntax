# Additions files

`additions/css/*.json` and `additions/html/*.json` hold one batch per file. They're the source of truth for the extension and for upstream PRs. Name files `YYYY-MM-<topic>.json`. The build reads them in name order. If a CSS name appears twice, the first one wins.

## Generate batches from a gap report

```powershell
npm run additions-from-gap-report -- reports/latest.json additions/css/2026-11-shipping-from-specs.json
```

Writes the CSS batch to that path and the HTML batch to the same file name in `additions/html/`.

- Optional third argument: priorities and/or [levels](build-extension.md#data-levels) to keep, default `P1,P2`. An item is kept if it matches any of them, so `P1,P2,proprietary` adds proprietary items too. `preview` adds items that ship unflagged only in a browser preview, such as `block-ellipsis` in Safari Technology Preview.
- `npm run refresh-additions` regenerates `2026-10-shipping-from-specs.json` in both folders from `reports/latest.json` with `P1,P2,preview`, after an offline check of the HTML extraction (`tools/check/html-from-specs-check.mjs`). `npm run all` and the daily Pages run do this before the build, so newly shipping CSS and HTML get in on their own. An item that drops out of those picks also drops out of those files: to keep one anyway, put it in its own file (see `css/2026-11-fit-tolerance.json`).
- Skips names already in other additions files of the same kind.
- If the output file exists, entries keep their hand-written fields (`description`, `values`, `syntax`, `valueSet`).
- HTML descriptions come from the specs ([`tools/html-from-specs.mjs`](../tools/html-from-specs.mjs)): for WHATWG HTML attributes, the spec's attribute index gives a one-line description and the value type (boolean, keyword list as a value set, or free text); for every spec, the paragraph that defines the item, or the spec's abstract. A new element also gets its own attributes. Only new items are fetched, so a description you edit stays.
- When a spec has nothing usable (the item is only defined as IDL, or its section is empty), the entry gets a placeholder and a `review` field, and the run lists it (a warning annotation in the daily run). Write a description and delete `review`. When a spec doesn't load, the item is left out and the next run tries again.

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
| `level` | no | `baseline`, `standard`, `draft` or `proprietary`. Overrides the [computed level](build-extension.md#data-levels). |
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
| `bcd` | Adds browser versions, Baseline and the MDN link to the hover. Take it from the gap report's `bcdKey`. Also sets the [level](build-extension.md#data-levels): without it, the item has no spec link and comes out `proprietary`. |
| `level` | Overrides the computed level. Use it for items without `bcd`. Not used for `elements[].attributes`, which go with their element. |
| `valueSetEdits` | Replaces descriptions of values in an existing set |
| `elements[].attributes` | Same shape as `attributes`, without `tag` |

[apply-html](apply-html.md) uses `valueSets`, `valueSetEdits` and `attributes` only. `elements` and `globalAttributes` are extension-only until added upstream by hand.
