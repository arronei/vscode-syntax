**Target:** `microsoft/vscode-custom-data` ← `arronei/vscode-custom-data:css/fix-mdn-doc-paths`

**Title:** Fix MDN description lookup after MDN moved the CSS reference

---

When a property, selector or at-rule has no description, `css/generateData.mjs` asks `fetchDocFromMDN` for the first paragraph of its MDN page and prints it for `mdn-documentation.mjs`. That lookup no longer finds anything, for two reasons:

1. **Path.** MDN moved the CSS reference from `files/en-us/web/css/<name>` to `web/css/reference/properties/<name>`, `reference/at-rules/<rule>[/<descriptor>]` and `reference/selectors/<_colon_name>`. The old paths now return 404.
2. **Page format.** Current pages put `sidebar: cssref` in the front matter instead of a `{{CSSRef}}` macro line, so `extractFirstSentence` doesn't match even when the page is found.

As a result, regenerating with the current `mdn-data` (2.37.2) lists 28 entries that need a description, and all 28 come back empty. Among them are `text-fit`, `border-shape`, `flex-line-count` and the `timeline-trigger-*` properties.

**Change** (`css/mdn/mdn-documentation.mjs` only):
- Try the new reference location first and fall back to the old flat path.
- For front-matter pages, use the first prose paragraph after the front matter, skipping banner macros such as `{{SeeCompatTable}}`.
- Lowercase the path segment, because mdn/content file names are lowercase.

**Result**

| Lookup | before | after |
|---|---|---|
| `border-shape`, `flex-line-count`, `frame-sizing`, `link-parameters`, `path-length`, `text-fit`, `view-transition-scope`, 6 × `timeline-trigger-*` (13 entries) | empty | first paragraph |
| `:hover` (`_colon_hover`), `::before` | empty | ✓ |
| `@container`, `@font-face` → `font-display` | empty | ✓ |
| `window-drag`, `scroll-axis-lock`, `page-margin-safety`, 12 × `-webkit-border-*` (no MDN page yet) | empty | empty |

No generated data changes in this PR. Descriptions still go into `mdn-documentation.mjs` through the existing copy-from-output step.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_014fSnD1PNptV3WyQLkbSVcM
