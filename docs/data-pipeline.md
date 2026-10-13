# Where VS Code's HTML/CSS knowledge comes from

Read this to decide where an upstream fix belongs.

```
CSS specs (csswg-drafts, SVG 2, …)
   │  crawled daily by w3c/webref ──────────────► @webref/css   (syntax straight from the specs)
   │
   ├─ mdn/data (css/properties.json) ── hand-maintained, being deprecated in favor of webref
   ├─ mdn/browser-compat-data ── browser versions          web-features ── Baseline status
   └─ mdn/content ── first paragraph used as the hover description
        │
        ▼  npm run generate-data
microsoft/vscode-custom-data  web-data/  →  npm: @vscode/web-custom-data
        │  npm run update-data (VS Code team)
        ▼
vscode-html-languageservice / vscode-css-languageservice  →  VS Code
```

## CSS

| Piece | Comes from | Upstream fix |
|---|---|---|
| Whether a property exists | `mdn-data` `css/properties.json` (plus an old hand list) | PR to **mdn/data** |
| Whether an at-rule or selector exists | `mdn-data` `css/at-rules.json`, `css/selectors.json` | PR to mdn/data |
| Syntax shown in hover | `mdn-data` syntax | PR to mdn/data |
| Value completions | old hand list, or simple `a \| b \| c` syntaxes in mdn-data | mdn-data, or vscode-custom-data PR #143 (unmerged) |
| Browsers and Baseline | BCD and web-features | usually already right |
| Hover description | `vscode-custom-data` `web-data/css/mdn/mdn-documentation.mjs`, seeded from the MDN page | vscode-custom-data |

## HTML

Elements and attributes come from hand-maintained lists in vscode-custom-data (`web-data/html/htmlTags.json`, `htmlGlobalAttributes.json`, descriptions in `mdnTagDescriptions.json`, values in `valueSets.json`). HTML PRs go there.

## Why specs and webref matter

mdn-data still accepts new properties, but says it's being deprecated in favor of w3c/webref. webref is the specs, parsed automatically. As of 2026-10-09 it has 205 of the 223 CSS properties VS Code is missing. The extension already takes CSS syntax from webref. The scalable upstream fix would be a vscode-custom-data change that falls back to `@webref/css` for properties mdn-data doesn't have, which would fix the whole class at once. See [next-steps.md](next-steps.md).
