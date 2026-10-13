# Build, package and install the extension (interim fix)

`extension/` is **Web Spec Additions (HTML & CSS)**. It adds everything in `additions/` that VS Code doesn't have yet. It applies in every window, with or without a folder, and its CSS data also covers SCSS and Less. What it currently contains: [extension/CONTENTS.md](../extension/CONTENTS.md).

## Build

```powershell
npm run build-extension
```

Reads `additions/`, fills in syntax and values from `@webref/css` (falling back to `mdn-data`), spec titles from browser-specs, browser versions from BCD and Baseline from web-features. Tags every item with a [data level](#data-levels). It drops anything the installed `@vscode/web-custom-data` already has, then writes:

| File | Used by |
|---|---|
| `extension/data/css.all.json`, `html.all.json` | the extension: everything it can add, each item with its `level` |
| `extension/data/css.css-data.json` | `contributes.css.customData`. The build writes it at the default settings; the extension rewrites it when they change. |
| `extension/data/html.html-data.json` | `contributes.html.customData`. Same. |
| `extension/data/css-hover.json` | the hover provider in `extension/extension.js` |
| `extension/CONTENTS.md` | you ([how to read it](review-results.md#read-extensioncontentsmd)) |

It prints counts per level and anything dropped.

| Error | Fix |
|---|---|
| `no syntax for <name>` | Add `syntax` to the entry |
| `value set "<x>" is not defined …` | Define it in the batch's `valueSets` |

## Data levels

Settings choose which items the extension adds, for CSS and HTML separately:

| Setting | Values |
|---|---|
| `webSpecAdditions.css.level`, `webSpecAdditions.html.level` | `off`, `baseline`, `standard`, `draft` (default) |
| `webSpecAdditions.css.proprietary`, `webSpecAdditions.html.proprietary` | `false` (default) or `true` |

Each item's level comes from `tools/levels.mjs`. The gap report uses the same code.

| Level | Item is | Shown at |
|---|---|---|
| `baseline` | Baseline in web-features (newly or widely available) | Baseline and up |
| `standard` | in a spec at Candidate Recommendation or later, or a WHATWG Living Standard (browser-specs) | Standardized and up |
| `draft` | in any other spec: Working Draft, Editor's Draft, Community Group draft | Editor's Draft |
| `proprietary` | vendor-prefixed, non-standard in BCD, or in no spec at all | any level except Off, when `proprietary` is on |

The checks run in that order, except proprietary goes first: a vendor-prefixed item is always proprietary, even if it's Baseline. To override a level that comes out wrong, set `level` on the entry in its additions file.

HTML uses the same levels. Most HTML is in the WHATWG Living Standard, so it comes out `standard` unless it's Baseline. WICG and other incubation specs come out `draft`.

When a setting changes, the extension writes the matching subset of `*.all.json` to the contributed `*-data.json` file and offers to reload the window. VS Code's language servers only read custom data when they start.

## Try it without packaging

Run the [live check](check-vscode.md), which loads `extension/` directly. Or open a VS Code window with it loaded:

```powershell
code --extensionDevelopmentPath=D:\GitHub\vscode-syntax\extension
```

## Package

Bump `version` in `extension/package.json` first, so VS Code sees an update. Then:

```powershell
npm run package-extension
```

This runs `vsce package` through npx and writes `extension/web-spec-additions-<version>.vsix`. Old `.vsix` files aren't packed (`.vscodeignore`); move them to `_to_delete/` when you're done with them.

## Install

```powershell
code --install-extension D:\GitHub\vscode-syntax\extension\web-spec-additions-0.2.0.vsix --force
```

or run **Extensions: Install from VSIX…**, then reload the window. Remove any `html.customData` or `css.customData` setting from earlier experiments. Keeping both shows duplicates.

## How it works

- Almost everything is declarative custom data, listed under `contributes` in `extension/package.json`.
- `extension.js` does two things. It keeps the contributed data files in line with the [level settings](#data-levels). It's also a small hover provider for CSS, SCSS and Less, which shows a description for built-in properties that VS Code ships with an empty one, only on property names followed by `:`. The hover is off when the CSS level is `off`.

## Limits

- The levels only filter what the extension adds. VS Code's built-in data, including its vendor-prefixed and draft items, is always there. VS Code has no setting to turn it off.
- Switching levels writes into the extension's own folder. That works for a local install, but not in a remote or web window. In a development window (`--extensionDevelopmentPath`), it changes `extension/data/` in this repo. `npm run build-extension` puts it back.
- Values follow their property's level. Custom data can't add proprietary values (such as `-webkit-box`) to built-in properties.
- VS Code's CSS service keeps the *first* definition of each property, and the built-in data loads first. Custom data can add new CSS properties but can't change existing ones (missing values, empty descriptions). The hover provider covers empty descriptions. Missing values on existing properties can only be fixed upstream.
- HTML tags the extension extends (`button`, `link`, …) appear twice in tag-name completion. Attribute and value completion are unaffected.

## When VS Code catches up

```powershell
npm run update                 # installs the latest @vscode/web-custom-data
npm run build-extension
```

Items VS Code now has move to **Dropped because VS Code now has them** in `CONTENTS.md`. Then bump the version, package and reinstall.
