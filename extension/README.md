# Web Spec Additions (HTML & CSS)

Adds HTML and CSS features that are in current web specs and ship in at least one browser, but are missing from VS Code's built-in data. You get completions, value completions, hovers with browser support and Baseline status, and no false "Unknown property" or "Unknown at rule" warnings. See [CONTENTS.md](CONTENTS.md) for the full list.

- Works in every window, with or without a folder open. The CSS data also applies to SCSS and Less.
- Settings choose how much it adds, separately for CSS and HTML. **Level** (`webSpecAdditions.css.level`, `webSpecAdditions.html.level`) can be Off (VS Code's built-in data only), Baseline, Standardized (spec at Candidate Recommendation or later, or a WHATWG Living Standard), or Editor's Draft (any spec; the default). Each level includes the ones before it. **Proprietary** (`webSpecAdditions.css.proprietary`, `webSpecAdditions.html.proprietary`) also adds vendor-prefixed and non-standard features. A change applies after a window reload. These settings can't hide VS Code's own built-in data.
- New items are declarative custom data (`html.customData`, `css.customData`).
- `extension.js` applies the settings, and is a small hover provider. VS Code can't change the description of a CSS property it already knows, so for built-in properties that ship with an empty description, the provider shows one from the spec instead.

Each item is also sent upstream as a PR. When VS Code ships an item, rebuilding the extension (`npm run build-extension` in `vscode-syntax`) drops it automatically.

Data sources: CSS syntax and facts from [w3c/webref](https://github.com/w3c/webref) (extracted from the specs). Spec titles come from [browser-specs](https://github.com/w3c/browser-specs), browser versions from [@mdn/browser-compat-data](https://github.com/mdn/browser-compat-data) (CC0), and Baseline from [web-features](https://github.com/web-platform-dx/web-features). Selector descriptions quote the defining spec where noted; other descriptions are original text.
