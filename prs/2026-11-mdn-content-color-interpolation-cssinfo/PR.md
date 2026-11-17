**Target:** `mdn/content` ← `arronei/mdn-content:css/color-interpolation-cssinfo`

**Title:** CSS: use {{CSSInfo}} for color-interpolation

---

### Description

Replaces the hand-written formal-definition table on the `color-interpolation` page with `{{CSSInfo}}`, now that mdn-data has the property (mdn/data#1121, released in mdn-data 2.38.0).

### Motivation

The hand-written table was wrong in two places:

- **Default value:** it said `auto`. The [SVG 2 definition](https://w3c.github.io/svgwg/svg2-draft/painting.html#ColorInterpolationProperty) gives `sRGB`, and so do Chromium (`css_properties.json5`), Gecko (`longhands.toml`) and WebKit (`CSSProperties.json`). WPT's `svg/painting/inheritance.svg` tests it. The page's own `sRGB` entry already says it's the default.
- **Applies to:** it listed only `<linearGradient>` and `<radialGradient>`. The spec says container elements, graphics elements, gradient elements, `<use>` and `<animate>`.

`{{CSSInfo}}` also adds the rows the table didn't have, such as inherited, percentages and computed value.

### Additional details

Built the page locally with rari 1.3.0, which pulled mdn-data 2.38.0. The rendered table shows initial value `sRGB`, applies to "Container elements, graphics elements, gradient elements, `<use>`, and `<animate>` in `<svg>`", inherited yes, computed value as specified, and animation type discrete.

### Related issues and pull requests

- mdn/data#1121 adds `color-interpolation` to mdn-data.
