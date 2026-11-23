# Live check in real VS Code

Proves the extension works in VS Code itself: completions, value completions, hovers and diagnostics.

## Run

[Build the extension](build-extension.md) first (packaging isn't needed). Then:

```powershell
npm run check-vscode
```

- Downloads the latest stable VS Code into `.vscode-test/` in the folder you run it from (first run only).
- Runs VS Code twice, with separate throwaway profiles, so your own VS Code and settings aren't touched:
  1. **without**: a dummy extension, so built-in data only
  2. **with**: a temporary copy of `extension/` loaded as a development extension. A copy, because the `level` checks make the extension rewrite its data files.
- Each run opens `tools/check/vscode-live/ws/test.css` and `test.html` (also copied) and runs the checks in `ws/checks.json` through VS Code's own completion, hover, diagnostics and syntax-token commands.
- Also writes `all-properties.css`: every CSS property in VS Code's built-in data (`tools/vscode-data.mjs`) plus every one the extension adds. With the extension, real VS Code must flag none of them as unknown. If `tools/vscode-data.mjs` ever claims VS Code has a property it doesn't, the build drops it and this check fails.
- Prints a before/after table. Exit code is 1 if any check fails with the extension.

The daily workflow runs this after building the extension and before it commits, packages or releases anything, so a failed check means no release.

On Linux without a display, run `xvfb-run -a node tools/check/vscode-live/run.mjs`.

From VS Code's own terminal, `ELECTRON_RUN_AS_NODE` is set and the test VS Code starts as plain Node (`Cannot find module …\ws`). Clear it first: `env -u ELECTRON_RUN_AS_NODE npm run check-vscode` in Git Bash, or `$env:ELECTRON_RUN_AS_NODE = $null` in PowerShell.

Save the table as `reports/vscode-<version>-live-check.txt`, with a first line saying the date and extension version (see `reports/vscode-1.141-live-check.txt`). [How to read it](review-results.md#read-a-live-check).

## Add a check

1. Add a line using the new item to `ws/test.css` or `ws/test.html`.
2. Add an entry to `ws/checks.json`:

```json
{ "label": "CSS: rule-co| completes rule-color", "file": "test.css", "line": 5, "find": "rule-co", "offset": 7, "op": "complete", "expect": ["rule-color"] }
```

| Field | Meaning |
|---|---|
| `label` | Text in the results table |
| `file` | `test.css`, `test.html` or the generated `all-properties.css` |
| `line` | 0-based line number in that file |
| `find` | Text on that line. The cursor goes to its start… |
| `offset` | …plus this many characters |
| `op` | `complete`, `hover`, `diagnostics`, `scope`, `count` or `level` |
| `expect` | `complete`: labels that must all be offered |
| `contains` | `hover`: text the hover must include |
| `absent` | `diagnostics`: regex no diagnostic in the file may match. Needs no `line`. |
| `scope` | `scope`: TextMate scope the first token whose text equals `find` must have. Needs no `line`. |
| `label_equals` | `count`: label to count. Always passes; it tracks a known quirk. |
| `setting`, `value`, `data`, `levels` | `level`: set `setting` to `value`, then check the extension rewrote `extension/data/<data>` with only items at `levels`. An empty `levels` means no items. The setting is reset afterwards. Needs no `file`. |

A new check should fail in the *without* column. Otherwise it isn't testing the extension.
