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

`.github/workflows/pages.yml` runs `build-site` and deploys `_site/` on every push to `main` that touches `site/`, `reports/latest.json` or `extension/`, and once a day. You can also run it by hand from the Actions tab.

One-time setup: **Settings → Pages → Source: GitHub Actions**. Pages on a private repo needs a paid GitHub plan, and the published site is public.

## Status badges

The README's Status table. `build-site` writes one [shields.io endpoint](https://shields.io/badges/endpoint-badge) file per badge to `_site/badges/`, and the README points shields.io at the published copies. They are on Pages because the repo is private and shields.io can't read it.

| Badge | Green | Yellow / red |
|---|---|---|
| Pages | Last run of the workflow passed, so the site matches `main` | Last run failed (GitHub's own badge, only visible to people with repo access) |
| gap report | `reports/latest.json` is under 7 days old | Yellow under 30 days, red after |
| Data packages, one per entry in the report's `sources` | The report used the latest npm release | `used → latest` |
| Upstream repos, one per sibling repo | No commits on upstream's default branch since the report | Number of new commits |

The daily run is what moves them: the comparisons are made at build time. A lookup that fails gives a grey "unknown" badge and doesn't stop the deploy. shields.io caches each badge for about 5 minutes.

## Changes

- **Marketplace link:** when the extension is published, replace the "not published yet" box in the Extension tab with the Marketplace link.
- **New report tab** (e.g. JavaScript): add a tab button, an empty `<section role="tabpanel">` and an entry in `REPORTS` listing the gap report categories it shows.
