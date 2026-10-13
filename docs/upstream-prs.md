# Upstream PRs

The permanent fix. Once VS Code ships an item, the next extension build drops it.

## Where each fix goes

| Problem | Repo | Files | Tool |
|---|---|---|---|
| HTML element or attribute missing | microsoft/vscode-custom-data | `web-data/html/htmlTags.json`, `mdnTagDescriptions.json`, `valueSets.json` | [apply-html](apply-html.md) |
| HTML global attribute missing | microsoft/vscode-custom-data | `web-data/html/htmlGlobalAttributes.json` | by hand |
| CSS property missing from mdn-data | mdn/data | `css/properties.json`, `l10n/css.json`, `css/properties.schema.json` | [mdn-data-add-property](mdn-data-add-property.md) |
| CSS at-rule or selector missing from mdn-data | mdn/data | `css/at-rules.json`, `css/selectors.json` | by hand |
| Empty CSS hover description | microsoft/vscode-custom-data | `web-data/css/mdn/mdn-documentation.mjs` | by hand |
| In mdn-data but not yet in VS Code | microsoft/vscode-custom-data | `mdn-data` dependency bump + regenerate | usually the VS Code team's periodic update |
| Language service behavior (first definition wins, duplicate tag names) | microsoft/vscode-css-languageservice, vscode-html-languageservice | `src/` | by hand |

Background: [data-pipeline.md](data-pipeline.md).

## Steps

1. **Branch from upstream** in the sibling checkout. Name branches `html/<topic>` or `css/<topic>`.
   ```powershell
   git -C ../vscode-custom-data fetch upstream
   git -C ../vscode-custom-data switch -c html/<topic> upstream/main
   ```
2. **Make the change**, with the tool from the table or by hand.
3. **Regenerate and test in that repo.** Regenerate only what you changed, so the diff stays reviewable.
   - vscode-custom-data HTML: `cd ../vscode-custom-data/web-data; node html/generateData.mjs`
   - vscode-custom-data CSS: `node css/generateData.mjs`. It prints entries that still need a description.
   - mdn-data: `npm test` (lint)
   - language services: `npm test`
4. **Verify** with the [language service checks](check-language-service.md), passing the regenerated data file.
5. **Write the PR folder** `prs/<YYYY-MM>-<slug>/`:
   - `COMMIT_MSG.txt`: the commit message
   - `PR.md`: `**Target:**` and `**Title:**` lines, a `---` line, then the PR body
   - `change.patch`: `git -C ../vscode-custom-data diff upstream/main > prs/<name>/change.patch`
   - any input files, such as `property.json` for mdn-data
6. **Commit and push to your fork.**
   ```powershell
   git -C ../vscode-custom-data add -A
   git -C ../vscode-custom-data commit -F ../vscode-syntax/prs/<name>/COMMIT_MSG.txt
   git -C ../vscode-custom-data push -u origin html/<topic>
   ```
7. **Open the PR** on GitHub from the fork branch. Use the title from `PR.md` and paste everything below its `---` as the description.
8. **Update the status table** below.

## After a PR merges

- **mdn/data:** wait for an mdn-data release. Then vscode-custom-data needs its `mdn-data` dependency bumped, data regenerated, and a description added in `mdn-documentation.mjs`. That's usually part of the VS Code team's periodic "update" PR, or it can be a small PR of ours.
- **vscode-custom-data:** it ships once `@vscode/web-custom-data` is published and the language services run `npm run update-data`.
- **Here:** [bump `@vscode/web-custom-data` and rebuild](build-extension.md#when-vs-code-catches-up). The item moves to "Dropped" in `CONTENTS.md`.

## Status

| Batch | Repo | Branch (on your fork) | Folder |
|---|---|---|---|
| 17 HTML attributes | microsoft/vscode-custom-data | `arronei/vscode-custom-data:html/baseline-attributes` (pushed) | `prs/2026-10-baseline-html-attributes` |
| `color-interpolation` | mdn/data | `arronei/mdn-data:css/color-interpolation` (pushed) | `prs/2026-10-mdn-data-color-interpolation` |
| MDN description lookup fix | microsoft/vscode-custom-data | `arronei/vscode-custom-data:css/fix-mdn-doc-paths` (pushed) | `prs/2026-10-vscode-custom-data-mdn-doc-paths` |
