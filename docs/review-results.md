# Look over results

Three outputs to review:

| Output | Made by | Tells you |
|---|---|---|
| `reports/latest.json` | [gap report](gap-report.md) | What VS Code is missing |
| `extension/CONTENTS.md` | [build-extension](build-extension.md) | What the extension adds, and what the last build dropped |
| `reports/vscode-<version>-live-check.txt` | [check-vscode](check-vscode.md) | That it works in real VS Code |

## Triage a gap report

Go through the P1 and P2 items. For each one, decide: add it to the extension now, send it upstream, or skip it.

| Item | Interim fix (extension) | Upstream fix |
|---|---|---|
| CSS property | [`additions-from-gap-report`](additions.md#generate-a-css-batch-from-a-gap-report) picks it up. No text needed. | mdn/data, if `mdn-data` `css/properties.json` lacks it ([mdn-data-add-property](mdn-data-add-property.md)). vscode-custom-data then picks it up after an mdn-data release. |
| CSS at-rule or selector | Same tool. Write a `description` when the spec prose is missing or reads badly. | mdn/data (`css/at-rules.json`, `css/selectors.json`) |
| HTML element or attribute | Hand-write an entry with a description in `additions/html/` ([format](additions.md#html-format)) | vscode-custom-data `htmlTags.json` ([apply-html](apply-html.md)) |
| HTML global attribute | `globalAttributes` in `additions/html/` | vscode-custom-data `htmlGlobalAttributes.json`, by hand |
| Empty CSS description (`emptyCssDescriptions`) | Automatic: the `fillEmptyBuiltinDescriptions` batch covers every one with a spec or mdn-data entry | vscode-custom-data `css/mdn/mdn-documentation.mjs`, then regenerate |
| P3 | Skip, unless there's a reason. Record the reason in the batch's `criteria`. Proprietary items are hidden unless the `proprietary` [setting](build-extension.md#data-levels) is on, so they can go in without changing the default. Draft items show at the default level. | Skip |

Before adding an item:
- Open its `spec` and `mdn` links. Is it standards-track, and is the name right?
- For single-engine items, check it isn't only an origin trial.
- For HTML attributes with values, check whether VS Code already has a value set you can reuse (`../vscode-custom-data/web-data/html/valueSets.json`).

See [data-pipeline.md](data-pipeline.md) for why each fix goes where it does, and [upstream-prs.md](upstream-prs.md) for how.

## Read `extension/CONTENTS.md`

- A count per kind and [level](build-extension.md#data-levels), then a table per kind: name, level, Chrome/Firefox/Safari versions, and the additions file it came from.
- **Dropped because VS Code now has them**: items the last build pruned. That's the signal an upstream fix has shipped. Update the [PR status](upstream-prs.md#status).

## Read a live check

Columns: check, result without the extension, result with it.
- *Without* should show the gap: `(none)`, `Unknown property: …`.
- *With* must say PASS.
- Regression guards (for example `display values`) show the same result in both.
- `'button' entries in tag completion` showing `2×` is a known quirk, not a failure (see [build-extension.md](build-extension.md#limits)).

## Why the report and the extension overlap

The gap report compares against `upstream/main` of vscode-custom-data. The extension build compares against the installed `@vscode/web-custom-data` package. So everything in the extension also shows up in the gap report, until VS Code's own data has it.
