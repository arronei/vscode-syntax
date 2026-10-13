# Setup and update

| Command | When |
|---|---|
| `npm run setup` | Once, on a new machine |
| `npm run update` | Just before a run, so the run uses current data |
| `npm run all` | The full run: gap report, build, live check. Or run one step, e.g. `npm run gap-report` |

All three live in `tools/cli.mjs`.

## New machine: `npm run setup`

Needs git and Node 18 or later (developed on Node 26). Clone this repo into the folder that will hold the others (here `D:\GitHub`), then from `vscode-syntax`:

```powershell
npm run setup
```

For each sibling repo, it:

1. clones the repo if it's missing (your fork as `origin`, the official repo as `upstream`)
2. adds the `upstream` remote if that's missing
3. runs `npm install`, and compiles the language services
4. finishes with `npm install` here and an `update`

It's safe to run again. Existing checkouts and their branches aren't touched beyond `npm install`.

| Folder | What it's for | Remotes |
|---|---|---|
| `vscode-syntax` | This repo: tools, additions, extension, PR drafts, reports | `origin` = arronei/vscode-syntax (private) |
| `vscode-custom-data` | Where VS Code's HTML/CSS data is generated. Target of HTML and description PRs. The gap report reads it. | `origin` = arronei fork, `upstream` = microsoft |
| `mdn-data` | Target of PRs for missing CSS properties | `origin` = arronei/mdn-data, `upstream` = mdn/data |
| `vscode-css-languageservice` | Used by `check-css`. Target of CSS language-service PRs. | `origin` = arronei fork, `upstream` = microsoft |
| `vscode-html-languageservice` | Used by `check-html`. Target of HTML language-service PRs. | `origin` = arronei fork, `upstream` = microsoft |

Open `vscode-syntax.code-workspace` to get all five in one window.

## Before each run: `npm run update`

```powershell
npm run update
```

1. `git fetch upstream` in each sibling repo, so the gap report and new PR branches see the latest `upstream/main`.
2. Installs the latest version of every data source: `@mdn/browser-compat-data`, `@vscode/web-custom-data`, `@webref/css`, `@webref/elements`, `browser-specs`, `mdn-data`, `web-features`. It lists what changed and flags major versions, since those can change the data format.
3. Writes the time to `.last-update`, which isn't committed.

`npm run all`, `npm run gap-report` and `npm run build-extension` print a warning if the last update is more than 12 hours old, or if this machine has never run one. It's only a warning; the run still goes ahead.

When an update changes versions, `package.json` and `package-lock.json` change too. Commit them with the run's results, so the history shows which data each report used. Each gap report also records the versions in its `sources` field.

If a major version breaks a tool, `git checkout package.json package-lock.json` and `npm install` go back to the previous versions.
