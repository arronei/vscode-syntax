# Language service checks

Faster than the [live check](check-vscode.md). These run the compiled `vscode-html-languageservice` and `vscode-css-languageservice` from the sibling checkouts directly in Node. Use them to test a language-service branch or regenerated upstream data before opening a PR.

Needs the language services compiled (`lib/esm`), see [setup.md](setup.md#install).

## HTML

```powershell
npm run check-html
```

Runs `node tools/check/completion-check.mjs ../vscode-html-languageservice extension/data/html.html-data.json`. The data file is layered on top of the built-in data, as VS Code does it. Prints `ok`/`FAIL` per case and the hover for `commandfor`. Exit code 1 on any failure.

The cases are hard-coded in the `cases` list in `tools/check/completion-check.mjs`: source text with `|` at the cursor, plus labels that must be offered. They currently cover the 17 attributes from the baseline-attributes PR. Add a line there to check something new.

Other data:

```powershell
# the language service's own data only (e.g. after npm run update-data there)
node tools/check/completion-check.mjs ../vscode-html-languageservice

# data regenerated in a vscode-custom-data branch
node tools/check/completion-check.mjs ../vscode-html-languageservice ../vscode-custom-data/web-data/data/browsers.html-data.json
```

## CSS

```powershell
npm run check-css
```

Defaults to `color-interpolation` with values `auto,sRGB,linearRGB` against the extension data. For any property:

```powershell
node tools/check/css-check.mjs ../vscode-css-languageservice <property> <value1,value2,…> [data file] [css|scss|less]

node tools/check/css-check.mjs ../vscode-css-languageservice text-fit none,grow,shrink extension/data/css.css-data.json scss
```

Four checks: property completion, value completion, a non-empty hover, and no `Unknown property` warning. Exit code 1 on any failure.

The CSS service keeps the first definition of a property, and the built-in data comes first. So for a property VS Code already knows, this checks the built-in entry, not the data file's.
