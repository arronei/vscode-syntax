# Setup

## Folder layout

All repos sit side by side (here under `D:\GitHub`). Open `vscode-syntax.code-workspace` to get all five in one window.

| Folder | What it's for | Remotes |
|---|---|---|
| `vscode-syntax` | This repo: tools, additions, extension, PR drafts, reports | none yet |
| `vscode-custom-data` | Where VS Code's HTML/CSS data is generated. Target of HTML and description PRs. The gap report reads it. | `origin` = arronei fork, `upstream` = microsoft |
| `mdn-data` | Target of PRs for missing CSS properties | `origin` = arronei/mdn-data, `upstream` = mdn/data |
| `vscode-css-languageservice` | Used by `check-css` | `origin` = fork, `upstream` = microsoft |
| `vscode-html-languageservice` | Used by `check-html` | `upstream` = microsoft |

The gap report runs `git fetch upstream` in `vscode-custom-data`, so that remote must exist.

## Install

Node 18 or later (developed on Node 26).

```powershell
npm install                                   # in vscode-syntax: data sources + VS Code test harness
```

Only needed for the language-service checks:

```powershell
cd ..\vscode-css-languageservice;  npm install; npm run compile
cd ..\vscode-html-languageservice; npm install; npm run compile
```

Only needed when making PRs:

```powershell
cd ..\vscode-custom-data\web-data; npm install   # to run html/generateData.mjs, css/generateData.mjs
cd ..\mdn-data; npm install                      # to run npm test (lint)
```

## Refresh the data sources

The gap report and the extension build read whatever versions are installed in `node_modules`. Refresh before a new gap report:

```powershell
npm outdated                         # what's newer
npm update                           # latest within the ^ ranges in package.json
npm i -D @webref/css@latest          # a major bump, one package at a time
```

`@vscode/web-custom-data` is special: it's what the build compares against to drop items VS Code already has. Bump it when VS Code publishes new data (see [build-extension.md](build-extension.md#when-vs-code-catches-up)).

Each gap report records the versions it used in its `sources` field.
