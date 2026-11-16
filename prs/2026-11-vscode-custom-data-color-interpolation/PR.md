**Target:** `microsoft/vscode-custom-data` ← `arronei/vscode-custom-data:css/color-interpolation`

**Title:** Turn on the color-interpolation entry in css-schema.json

---

`css-schema.json` already has a `color-interpolation` entry with its three values and their descriptions, but it is marked `"browsers": "none"`, so `generateData.mjs` skips it. The property has shipped in every major browser for years (`css.properties.color-interpolation` in BCD, Baseline widely available since 2020), and VS Code reports it as *Unknown property*.

**Change**
- Drop `"browsers": "none"`. Browser data and Baseline come from BCD, as for the other entries.
- Drop "alpha compositing" from the description. [SVG 2](https://w3c.github.io/svgwg/svg2-draft/painting.html#ColorInterpolationProperty) removed it because no browser implemented it. The property now covers gradient stops and color animations.
- Point `ref` at the SVG 2 editor's draft.
- Regenerate `data/browsers.css-data.json`. The only change is the new `color-interpolation` entry.

**Why the hand-written entry, not just mdn-data:** mdn/data#1121 adds the property to mdn-data with the current SVG 2 syntax, `auto | sRGB | linearRGB | <color-interpolation-method>`. `getValuesFromSytax` collects values only from keyword-only syntaxes, so mdn-data alone would give the property but no keyword completions. Hand-written values take precedence over mdn-data's, so with this entry the keywords keep completing after the mdn-data bump. This PR doesn't depend on #1121.

**Testing**
- `npm test` passes.
- Ran the regenerated data through `vscode-css-languageservice`: `color-interpolation` completes, `auto`/`sRGB`/`linearRGB` complete, the hover shows the description and Baseline, and the *Unknown property* warning is gone.
- Same check with the mdn/data#1121 branch dropped into `node_modules/mdn-data`: the generated data gains only the `syntax` line, and all four checks still pass.
