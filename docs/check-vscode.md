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
  2. **with**: `extension/` loaded as a development extension
- Each run opens `tools/check/vscode-live/ws/test.css` and `test.html` and runs the checks in `ws/checks.json` through VS Code's own completion, hover and diagnostics commands.
- Prints a before/after table. Exit code is 1 if any check fails with the extension.

On Linux without a display, run `xvfb-run -a node tools/check/vscode-live/run.mjs`.

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
| `file` | `test.css` or `test.html` |
| `line` | 0-based line number in that file |
| `find` | Text on that line. The cursor goes to its start… |
| `offset` | …plus this many characters |
| `op` | `complete`, `hover`, `diagnostics` or `count` |
| `expect` | `complete`: labels that must all be offered |
| `contains` | `hover`: text the hover must include |
| `absent` | `diagnostics`: regex no diagnostic in the file may match. Needs no `line`. |
| `label_equals` | `count`: label to count. Always passes; it tracks a known quirk. |

A new check should fail in the *without* column. Otherwise it isn't testing the extension.
