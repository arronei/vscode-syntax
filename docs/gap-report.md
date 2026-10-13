# Gap report: find what VS Code is missing

Compares VS Code's data on `upstream/main` of microsoft/vscode-custom-data with browser-compat-data, `@webref/css`, `@webref/elements` and web-features. Lists the CSS properties, at-rules, selectors, HTML elements, attributes and global attributes VS Code doesn't have, plus built-in CSS properties with an empty description.

## Run

```powershell
npm run update
npm run gap-report      # or `npm run all`, which also builds the extension and runs the live check
```

That runs `node tools/gap-report.mjs ../vscode-custom-data node_modules reports/latest.json`. It fetches `upstream` first (needs network), and always reads `upstream/main`, whatever branch is checked out.

It then saves a dated copy, such as `reports/gap-report-2026-10-13.json`, and lists the P1/P2 items that are new or gone since the previous dated report.

## Output

**Console:** source versions, counts of what VS Code ships, a summary per category, then every P1/P2 item, for example `P2 border-shape [chrome,edge]`.

**`reports/latest.json`:**

```
{ generatedAt, sources, shipped, summary,
  gaps: { cssProperties, atRules, selectors, htmlElements, htmlAttributes, globalAttributes },
  emptyCssDescriptions: [names] }
```

Each gap entry:

| Field | Meaning |
|---|---|
| `name` | `border-shape`, `@function`, `::search-text`, `<geolocation>`, `<button command>`, `writingsuggestions` |
| `priority` | **P1** standards-track, not deprecated, ships in all four of Chrome, Edge, Firefox, Safari. **P2** same, but ships in 1–3. **P3** not shipping, deprecated or non-standard. |
| `shipsIn` | Which of the four ship it unflagged and unprefixed |
| `baseline` | Widely available / Newly available / Limited (web-features) |
| `spec`, `mdn` | Links to check the item by hand |
| `bcdKey` | BCD key. Use it as `bcd` in an additions file. |
| `inSpec` | CSS properties only: `true` if `@webref/css` has it |
| `deprecated`, `nonStandard` | From BCD status |

## Quick looks

```powershell
# summary counts
node -e "console.log(require('./reports/latest.json').summary)"

# P1 HTML attributes
node -e "const r=require('./reports/latest.json');for(const e of r.gaps.htmlAttributes)if(e.priority==='P1')console.log(e.name,'|',e.baseline)"

# what's new or gone since an older report (gone = VS Code's data now has it)
node -e "const [a,b]=['./reports/gap-report-2026-10-09.json','./reports/latest.json'].map(f=>require(f));for(const k in b.gaps){const o=new Set(a.gaps[k].map(e=>e.name)),n=new Set(b.gaps[k].map(e=>e.name));for(const e of b.gaps[k])if(!o.has(e.name))console.log('new ',k,e.priority,e.name);for(const e of a.gaps[k])if(!n.has(e.name))console.log('gone',k,e.priority,e.name)}"
```

## Limits

- It compares against `upstream/main`, not the published npm package and not the extension. Items already in the extension stay in the report until VS Code's data has them. Items merged upstream drop out before they're published.
- Vendor-prefixed names are skipped. So are HTML attribute keys containing `_` (BCD uses those for sub-features) and deprecated attributes.
- For selectors found only in BCD, `:` vs `::` is inferred from the spec and MDN URLs and can occasionally be wrong.

Next: [review-results.md](review-results.md).
