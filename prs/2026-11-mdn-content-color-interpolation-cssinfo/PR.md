**Target:** `mdn/content` ← `arronei/mdn-content:css/color-interpolation-cssinfo`

**Title:** CSS: use {{CSSInfo}} for color-interpolation

**Blocked on:** mdn/data#1121 being merged and released. `{{CSSInfo}}` renders from mdn-data, which doesn't have `color-interpolation` until then. Don't open this PR before that.

---

### Description

Replaces the hand-written formal-definition table on the `color-interpolation` page with `{{CSSInfo}}`, now that mdn-data has the property (mdn/data#1121).

### Motivation

The hand-written table was wrong in two places:

- **Default value:** it said `auto`. The [SVG 2 definition](https://w3c.github.io/svgwg/svg2-draft/painting.html#ColorInterpolationProperty) gives `sRGB`, and so do Chromium (`css_properties.json5`), Gecko (`longhands.toml`) and WebKit (`CSSProperties.json`). WPT's `svg/painting/inheritance.svg` tests it. The page's own `sRGB` entry already says it's the default.
- **Applies to:** it listed only `<linearGradient>` and `<radialGradient>`. The spec says container elements, graphics elements, gradient elements, `<use>` and `<animate>`.

`{{CSSInfo}}` also adds the rows the table didn't have, such as inherited, percentages and computed value.

### Related issues and pull requests

- mdn/data#1121 adds `color-interpolation` to mdn-data.
