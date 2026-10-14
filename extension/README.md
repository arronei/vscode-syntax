# Web Spec Additions (HTML & CSS)

Adds HTML and CSS features that are in current web specs and ship in at least one browser, but are missing from VS Code's built-in data. See [CONTENTS.md](CONTENTS.md) for the full list.

## Features

- Completions and value completions for the added CSS properties, at-rules, pseudo-classes and pseudo-elements, and HTML elements and attributes.
- Hovers with browser support and Baseline status.
- No false "Unknown property" or "Unknown at rule" warnings.
- Descriptions from the spec for built-in CSS properties that VS Code ships with an empty one.
- Works in every window, with or without a folder open. The CSS data also applies to SCSS and Less.

## Settings

| Setting | Description |
| --- | --- |
| `webSpecAdditions.css.level` | How much CSS to add. Each level includes the ones before it. |
| `webSpecAdditions.html.level` | How much HTML to add. Each level includes the ones before it. |
| `webSpecAdditions.css.proprietary` | Also add vendor-prefixed and non-standard CSS features. |
| `webSpecAdditions.html.proprietary` | Also add vendor-prefixed and non-standard HTML features. |

Levels:

- **Off**: VS Code's built-in data only.
- **Baseline**: features that are newly or widely available across browsers.
- **Standardized (CR or higher)**: also features in a spec at Candidate Recommendation or later, or a WHATWG Living Standard.
- **Editor's Draft** (default): also features only in Working Drafts, Editor's Drafts or Community Group drafts.

A change applies after a window reload. These settings can't hide VS Code's own built-in data.

## How it works

- New items are declarative custom data (`html.customData`, `css.customData`).
- `extension.js` applies the settings and adds a small hover provider. VS Code can't change the description of a CSS property it already knows, so for built-in properties with an empty description, the provider shows one from the spec instead.

## Data sources

- CSS syntax and facts: [w3c/webref](https://github.com/w3c/webref) (extracted from the specs).
- Spec titles: [browser-specs](https://github.com/w3c/browser-specs).
- Browser versions: [@mdn/browser-compat-data](https://github.com/mdn/browser-compat-data) (CC0).
- Baseline: [web-features](https://github.com/web-platform-dx/web-features).

Selector descriptions quote the defining spec where noted; other descriptions are original text.
