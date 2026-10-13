**Target:** `mdn/data` ← `arronei/mdn-data:css/color-interpolation`

**Title:** feat(css): add color-interpolation property

---

`color-interpolation` is a standard property that every major browser has shipped for years, and MDN documents it at [Web/CSS/Reference/Properties/color-interpolation](https://developer.mozilla.org/docs/Web/CSS/Reference/Properties/color-interpolation). But it's missing from `css/properties.json`, while its sibling `color-interpolation-filters` is present.

The entry follows the SVG 2 definition ([Painting § color-interpolation](https://w3c.github.io/svgwg/svg2-draft/painting.html#ColorInterpolationProperty), also in `@webref/css`):

| Field | Value |
|---|---|
| syntax | `auto \| sRGB \| linearRGB` |
| initial | `sRGB` |
| applies to | container elements, graphics elements, gradient elements, `use` and `animate` (new l10n key `limitedSVGElementsContainerGraphicsGradientUseAnimate`) |
| inherited | yes |
| percentages | no |
| computed | as specified |
| animation type | discrete |
| group | Scalable Vector Graphics |

**Notes**
- The MDN page currently has a hand-written formal-definition table that lists the initial value as `auto`, but the spec says `sRGB`. Once this lands, the page could switch to `{{CSSInfo}}`.
- Downstream impact: VS Code builds its CSS IntelliSense from this package through `microsoft/vscode-custom-data`. VS Code currently flags `color-interpolation` as *Unknown property* and offers no completion for it.

**Testing**
- `npm test` passes. I also checked that the lint fails if `appliesto` points to an undefined key.
- Regenerated VS Code's CSS data with this branch and ran it through `vscode-css-languageservice`. The property now completes, its values `auto`/`sRGB`/`linearRGB` complete, the hover shows Baseline, and the *Unknown property* warning is gone. The language service's test suite still passes (359/359).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_014fSnD1PNptV3WyQLkbSVcM
