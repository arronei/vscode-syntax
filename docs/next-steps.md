# Next steps

## Next candidates

- **Upstream, the scalable CSS fix:** have vscode-custom-data fall back to `@webref/css` for properties mdn-data doesn't have. The extension's build already does this, so it's proven to work.
- **Upstream, data refresh:** vscode-custom-data's published CSS data is stale. 48 of the 61 missing descriptions are already in its `mdn-documentation.mjs`, and 13 newer properties only need its `mdn-data` dependency bumped.
- **Upstream, language services:** let later data providers override or merge built-in CSS entries (`vscode-css-languageservice` keeps the first), and dedupe tag names across HTML providers. Both would let custom data, and this extension, fix existing entries cleanly.
- **Values on existing CSS properties:** new keywords on properties VS Code already knows (for example in `display` or `text-wrap`). These need upstream changes (vscode-custom-data PR #143 is related) or a completion provider in the extension.
- **HTML data bugs:** duplicate `importance` attributes on `<link>`/`<img>`, and a duplicate `allowpaymentrequest` on `<iframe>`.

## Toward a scheduled system

Nothing runs on a schedule yet; every step is run by hand. The loop is: [gap report](gap-report.md) → [additions file](additions.md) → [build](build-extension.md) and [check in real VS Code](check-vscode.md) → apply upstream → [PR](upstream-prs.md).

A scheduled job could run the gap report against the latest webref, BCD and web-features, then `additions-from-gap-report` and the build. A small UI could list new items with "add to extension" and "create PR" actions, each running the scripts above.
