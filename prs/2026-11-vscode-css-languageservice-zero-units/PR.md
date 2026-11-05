**Target:** `microsoft/vscode-css-languageservice` ← `arronei/vscode-css-languageservice:css/zero-units-math-functions`

**Title:** Lint zeros in math functions by their type

---

Inside a math function, a number token is always a `<number>`. [CSS Values 4](https://drafts.csswg.org/css-values-4/#calc-type-checking): "unitless 0 `<length>`s aren't supported in math functions", and `width: calc(0 + 5px)` is invalid. So a zero length in a math function needs its unit. Today the linter gets this backwards in both directions:

```css
.icon {
  margin-block: calc(var(--glyph-height, 0px) / -2);   /* valid, but zeroUnits says to drop the unit */
  margin-block: calc(var(--glyph-height, 0) / -2);     /* invalid, no warning */
}
```

`var()` substitutes its fallback, so with `--glyph-height` unset the second line is `calc(0 / -2)`, a `<number>`, which `margin-block` doesn't accept. In Edge with `--glyph-height: 12px` and no `--glyph-descent`, `vertical-align: calc(var(--glyph-height, 0px) / 2 - var(--glyph-descent, 0px))` computes to `6px`, and the same declaration with `0` computes to `baseline`, because it is thrown out.

**zeroUnits** (`src/services/lint.ts`)

microsoft/vscode#46997 stopped the hint for a zero whose nearest enclosing function is `calc`. A zero in a `var()` fallback inside `calc`, zeros in `min()`, `max()`, `clamp()` and the other math functions, and `CALC()` still get it. Now any enclosing math function counts, compared case-insensitively. The list covers CSS Values 4 (`calc`, `min`, `max`, `clamp`, `round`, `mod`, `rem`, the trig, exponential and sign functions), `-webkit-calc` and `-moz-calc`, and the Values 5 functions `calc-size`, `progress`, `media-progress`, `container-progress` and `random`.

**unitlessZeroInMath** (new rule, warning; `src/services/lint.ts`, `lintRules.ts`)

It follows the spec's type checking and flags a unitless `0` that has to be a dimension:

- With + or -, both sides need the same type, and `min()`, `max()`, `clamp()`, `hypot()`, `round()`, `mod()`, `rem()` and `abs()` need consistent arguments. So a `0` next to a dimension is flagged, wherever the math function is: `calc(0 + 5px)`, `max(0, 10vw)`, `translate(calc(0 + 1px))`.
- A math function that is the whole value resolves to its calculation's type. If the property takes a length or percentage but not a number, the `0` that carries that type is flagged: `width: calc(0)`, `margin-block: calc(var(--h, 0) / -2)`.

What isn't flagged:

- A `0` that stays a `<number>`: a multiplier (`calc(0 * 10px)`, `calc(var(--n, 0) * 1px)`), a divisor, an argument of `pow()`, `sign()` and other number functions, or a value of a property that takes numbers (`line-height: max(0, 1.5)`).
- Anything whose type can't be told. `/` may divide by a dimension (typed arithmetic), so `calc(var(--a, 0) / var(--b))` is skipped. Expressions with Sass or Less variables are skipped too, because their math lets unitless numbers mix with lengths.

The parser chains `+ - * /` left to right without precedence, so the check regroups them into products first. `NumericValue.getValue()` reads no sign, so `-2` comes back as unit `-2`. The check reads the number from the text instead.

Property types come from `restrictions`. 262 properties have none, including `margin-block`, `padding-inline`, `inset`, `gap` and `scroll-margin-*`, so the check falls back to the MDN `syntax` (`<'margin-top'>{1,2}`) and resolves property references. `stroke-width` and `stroke-dashoffset` are listed as length-only but also take a `<number>`, so they're excluded.

**Checks**

- Tests cover both sides, for CSS, LESS and SCSS.
- 228 properties are treated as length or percentage only. Checked against mdn-data syntax, none of them accepts a `<number>` at the top level.
- No hits on 204 real stylesheets with 5,143 math functions (Tailwind, VS Code and others from `node_modules`).

**Result**

| Input | zeroUnits before → after | unitlessZeroInMath |
|---|---|---|
| `margin-block: calc(var(--glyph-height, 0px) / -2)` | hint → no hint | – |
| `margin-block: calc(var(--glyph-height, 0) / -2)` | – | warning |
| `vertical-align: calc(var(--h, 0) / 2 - var(--d, 0))` | – | 2 warnings |
| `CALC(0px - 10vw)` | hint → no hint | – |
| `width: max(0px, 10vw - 20px)` | hint → no hint | – |
| `width: max(0, 10vw - 20px)` | – | warning |
| `width: calc(0 + 5px)`, `width: calc(0)` | – | warning |
| `width: calc(0 * 10px)` | – | – |
| `line-height: max(0, 1.5)` | – | – |
| `width: var(--w, 0px)`, `translate(0px, 10px)` | hint → hint | – |

**Follow-up:** a `css.lint.unitlessZeroInMath` setting (and the `scss`/`less` ones) in microsoft/vscode `extensions/css-language-features/package.json`, so the rule shows up in Settings.
