# GitHub Pages site

`site/index.html` is a single static page with three tabs:

| Tab | Shows | Reads |
|---|---|---|
| Extension | What the extension does, the `.vsix` download, install steps, its settings | `extension.json` (copy of `extension/package.json`) |
| HTML report | Elements, attributes and global attributes VS Code is missing | `latest.json` (copy of `reports/latest.json`) |
| CSS report | Properties, at-rules, selectors, and built-in properties with an empty description | `latest.json` |

Both report tabs show P1 and P2 by default, with a filter for P3 and a name search.

## Build and preview

```powershell
npm run build-site
npx -y serve _site
```

`build-site` writes `_site/` (not committed): the page, the two JSON files, and `web-spec-additions.vsix` packaged from `extension/` as it is now. Run `npm run build-extension` first if the additions changed. Opening `site/index.html` straight from disk doesn't work, because the page fetches its data.

## Publish

`.github/workflows/pages.yml` runs `build-site` and deploys `_site/` on every push to `main` that touches `site/`, `reports/latest.json` or `extension/`. You can also run it by hand from the Actions tab.

One-time setup: **Settings → Pages → Source: GitHub Actions**. Pages on a private repo needs a paid GitHub plan, and the published site is public.

## Changes

- **Marketplace link:** when the extension is published, replace the "not published yet" box in the Extension tab with the Marketplace link.
- **New report tab** (e.g. JavaScript): add a tab button, an empty `<section role="tabpanel">` and an entry in `REPORTS` listing the gap report categories it shows.
