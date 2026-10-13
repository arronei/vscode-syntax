# Build, package and install the extension (interim fix)

`extension/` is **Web Spec Additions (HTML & CSS)**. It adds everything in `additions/` that VS Code doesn't have yet. It applies in every window, with or without a folder, and its CSS data also covers SCSS and Less. What it currently contains: [extension/CONTENTS.md](../extension/CONTENTS.md).

## Build

```powershell
npm run build-extension
```

Reads `additions/`, fills in syntax and values from `@webref/css` (falling back to `mdn-data`), spec titles from browser-specs, browser versions from BCD and Baseline from web-features. It drops anything the installed `@vscode/web-custom-data` already has, then writes:

| File | Used by |
|---|---|
| `extension/data/css.css-data.json` | `contributes.css.customData` |
| `extension/data/html.html-data.json` | `contributes.html.customData` |
| `extension/data/css-hover.json` | the hover provider in `extension/extension.js` |
| `extension/CONTENTS.md` | you ([how to read it](review-results.md#read-extensioncontentsmd)) |

It prints counts and anything dropped.

| Error | Fix |
|---|---|
| `no syntax for <name>` | Add `syntax` to the entry |
| `value set "<x>" is not defined …` | Define it in the batch's `valueSets` |

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
- `extension.js` is a small hover provider for CSS, SCSS and Less. It shows a description for built-in properties that VS Code ships with an empty one, and only on property names followed by `:`.

## Limits

- VS Code's CSS service keeps the *first* definition of each property, and the built-in data loads first. Custom data can add new CSS properties but can't change existing ones (missing values, empty descriptions). The hover provider covers empty descriptions. Missing values on existing properties can only be fixed upstream.
- HTML tags the extension extends (`button`, `link`, …) appear twice in tag-name completion. Attribute and value completion are unaffected.

## When VS Code catches up

```powershell
npm run update                 # installs the latest @vscode/web-custom-data
npm run build-extension
```

Items VS Code now has move to **Dropped because VS Code now has them** in `CONTENTS.md`. Then bump the version, package and reinstall.
