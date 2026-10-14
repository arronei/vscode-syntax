# vscode-syntax

Keeps VS Code's HTML and CSS IntelliSense (completions, hovers, validation) current with the web specs:

1. **Find** what's missing.
2. **Review** it: interim fix, upstream fix, or skip.
3. **Use it now** through a local extension that works everywhere.
4. **Fix it upstream** with PRs, so the item ships in VS Code and drops out of the extension.

## Status

| | |
|---|---|
| [Site](https://arronei.github.io/vscode-syntax/) | [![Pages](https://github.com/arronei/vscode-syntax/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/arronei/vscode-syntax/actions/workflows/pages.yml) ![gap report](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/report.json) |
| Data the report was built from | ![mdn-data](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/npm-mdn-data.json) ![@mdn/browser-compat-data](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/npm-mdn-browser-compat-data.json) ![@webref/css](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/npm-webref-css.json) ![@webref/elements](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/npm-webref-elements.json) ![web-features](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/npm-web-features.json) |
| Upstream since the report | ![vscode-custom-data](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/repo-vscode-custom-data.json) ![mdn/data](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/repo-mdn-data.json) ![vscode-css-languageservice](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/repo-vscode-css-languageservice.json) ![vscode-html-languageservice](https://img.shields.io/endpoint?url=https://arronei.github.io/vscode-syntax/badges/repo-vscode-html-languageservice.json) |

Yellow means something newer is out: `npm run update`, `npm run all`, commit the report and push. Red Pages means the published site is behind `main`. How the badges work: [docs/site.md](docs/site.md#status-badges).

## Commands

| Command | When | What it does |
|---|---|---|
| `npm run setup` | Once, on a new machine | Clones the sibling repos, installs and compiles everything, then updates |
| `npm run update` | Just before a run | Latest data sources, fetches upstream in the sibling repos |
| `npm run all` | The full run | Gap report (dated copy + what changed), build the extension, live check in VS Code |
| `npm run <step> [-- args]` | One step on its own | Any step in the table below |

`all`, `gap-report` and `build-extension` warn if `npm run update` hasn't run in the last 12 hours. Details: [docs/setup.md](docs/setup.md).

## Docs

| Purpose | Doc | Command |
|---|---|---|
| Background | [Where VS Code's data comes from](docs/data-pipeline.md) | |
| Get info | [Gap report](docs/gap-report.md) | `npm run gap-report` |
| Look over results | [Review results](docs/review-results.md) | |
| Interim fix | [Additions files](docs/additions.md) | `npm run additions-from-gap-report -- <report> <out>` |
| Interim fix | [Build, package, install the extension](docs/build-extension.md) | `npm run build-extension`, `npm run package-extension` |
| Verify | [Live check in real VS Code](docs/check-vscode.md) | `npm run check-vscode` |
| Verify | [Language service checks](docs/check-language-service.md) | `npm run check-html`, `npm run check-css` |
| Produce PRs | [Upstream PRs](docs/upstream-prs.md) | |
| PR tool | [apply-html](docs/apply-html.md): HTML additions → vscode-custom-data | `npm run apply-html -- <additions> <web-data>` |
| PR tool | [mdn-data-add-property](docs/mdn-data-add-property.md): CSS property → mdn/data | `npm run mdn-data-add-property -- <mdn-data> <property.json>` |
| Publish | [GitHub Pages site](docs/site.md): extension download, HTML and CSS reports | `npm run build-site` |
| Plan | [Next steps](docs/next-steps.md) | |

## Current state

- **Extension:** [Web Spec Additions (HTML & CSS)](https://marketplace.visualstudio.com/items?itemName=arronei.web-spec-additions) on the Marketplace: search for it in the Extensions view, or `code --install-extension arronei.web-spec-additions`. Each version's `.vsix` is also on its [GitHub release](https://github.com/arronei/vscode-syntax/releases/latest). Contents: [extension/CONTENTS.md](extension/CONTENTS.md)
- **Latest gap report:** [reports/latest.json](reports/latest.json)
- **Latest live check:** [reports/vscode-1.141-live-check.txt](reports/vscode-1.141-live-check.txt) (21/21)
- **Upstream PRs:** three branches pushed, see [status](docs/upstream-prs.md#status)

## Layout

| Path | What it is |
|---|---|
| `additions/html/`, `additions/css/` | One file per batch: the source of truth for the extension and the PRs |
| `extension/` | The VS Code extension: `package.json`, `extension.js` (hover provider), generated `data/` and `CONTENTS.md` |
| `prs/` | Commit message, PR description and patch per upstream PR |
| `reports/` | Gap reports and live VS Code check results |
| `tools/` | The scripts behind the commands above |
| `docs/` | One doc per tool and process |
| `site/`, `.github/workflows/pages.yml` | The GitHub Pages site and the workflow that publishes it |
| `_to_delete/` | Superseded files, safe to remove |
