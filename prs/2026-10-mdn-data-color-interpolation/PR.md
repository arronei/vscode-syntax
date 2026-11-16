**Target:** `mdn/data` ← `arronei/mdn-data:css/color-interpolation`

**Title:** feat(css): add color-interpolation property

---

### Description

Adds `color-interpolation` to `css/properties.json`, following the SVG 2 definition ([Painting § color-interpolation](https://w3c.github.io/svgwg/svg2-draft/painting.html#ColorInterpolationProperty), also in `@webref/css`). Also adds the l10n key `limitedSVGElementsContainerGraphicsGradientUseAnimate` (`en-US` and `fr`) for "applies to" and registers it in `properties.schema.json`.

| Field | Value |
|---|---|
| syntax | `auto \| sRGB \| linearRGB \| <color-interpolation-method>` |
| initial | `sRGB` |
| applies to | container elements, graphics elements, gradient elements, `use` and `animate` |
| inherited | yes |
| percentages | no |
| computed | as specified |
| animation type | discrete |
| group | Scalable Vector Graphics |

### Motivation

`color-interpolation` is a standard property that every major browser has shipped for years (`css.properties.color-interpolation` in BCD), and MDN documents it at [Web/CSS/Reference/Properties/color-interpolation](https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/color-interpolation). But it's missing from `css/properties.json`, while its sibling `color-interpolation-filters` is present.

- The MDN page can't use `{{CSSInfo}}` without this entry. Its hand-written formal-definition table gives the initial value as `auto` and lists only `<linearGradient>` and `<radialGradient>` under "Applies to".
- VS Code builds its CSS IntelliSense from this package through `microsoft/vscode-custom-data`, and currently flags `color-interpolation` as *Unknown property*.

### Additional details

- **Syntax:** SVG 2 recently added `<color-interpolation-method>` from CSS Color 4 to this property ([w3c/svgwg#1173](https://github.com/w3c/svgwg/pull/1173), for [w3c/svgwg#366](https://github.com/w3c/svgwg/issues/366)). It also defined `sRGB` and `linearRGB` as `in srgb` and `in srgb-linear`. `<color-interpolation-method>` is already in `css/syntaxes.json`. No browser parses it yet: Chromium, Gecko and WebKit all accept only the three keywords. The syntax here follows the spec, as `docs/updating_css_json.md` asks.
- **Initial value:** all three engines use `sRGB` (Chromium `css_properties.json5`, Gecko `longhands.toml`, WebKit `CSSProperties.json`), and WPT's `svg/painting/inheritance.svg` tests it.
- **Testing:**
  - `npm test` passes. I also checked that the lint fails if `appliesto` points to an undefined key.
  - Regenerated VS Code's CSS data with this branch and ran it through `vscode-css-languageservice`. The property completes, and the *Unknown property* warning is gone.

### Related issues and pull requests

- Once this is released, a follow-up mdn/content PR will replace the page's hand-written table with `{{CSSInfo}}`.
