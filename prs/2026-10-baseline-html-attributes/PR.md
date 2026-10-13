**Target:** `microsoft/vscode-custom-data` ← `arronei/vscode-custom-data:html/baseline-attributes`

**Title:** Add missing HTML attributes from the HTML Standard (invoker commands, declarative shadow DOM, fetchpriority, …)

---

The HTML element list in `web-data/html/htmlTags.json` is maintained by hand. Several attributes from the WHATWG HTML Standard that now ship in browsers were never added, so VS Code gives no completion, value completion or hover for them. This PR adds 17 of them.

| Element | Attribute(s) | Value set | Baseline |
|---|---|---|---|
| `<area>` | `referrerpolicy` | `referrerpolicy` (existing) | Widely available |
| `<button>` | `command`, `commandfor` | `command` (**new**) | Newly available (2025) |
| `<form>` | `rel` | | Widely available |
| `<iframe>` | `loading` | `loading` (existing) | Newly available (2023) |
| `<link>` | `disabled` | boolean | Widely available |
| `<link>` | `fetchpriority` | `fetchpriority` (existing) | Newly available (2024) |
| `<link>` | `imagesizes`, `imagesrcset` | | Newly available (2023) |
| `<script>` | `fetchpriority` | `fetchpriority` (existing) | Newly available (2024) |
| `<source>` | `width`, `height` | | Widely available |
| `<template>` | `shadowrootmode` | `shadowrootmode` (**new**) | Newly available (2024) |
| `<template>` | `shadowrootclonable`, `shadowrootdelegatesfocus` | boolean | Newly available (2024) |
| `<template>` | `shadowrootserializable` | boolean | Limited (Chromium, WebKit) |
| `<video>` | `playsinline` | boolean | Limited (Chromium, WebKit) |

Baseline status comes from the regenerated data (compute-baseline / web-features), so the hovers show it.

**Other changes**
- The `loading` value set descriptions now say "resource" instead of "image", because `<iframe>` now shares the set.
- `data/browsers.html-data.json` was regenerated with `node html/generateData.mjs`. No dependency versions changed, and the CSS data was not regenerated.

**How these were found:** I compared the shipped data against `@mdn/browser-compat-data` 8.1.5, `@webref/elements` 2.9.1 and `web-features` 3.42.0. I kept attributes that are in the HTML Standard and ship in at least two engines. I left out `<input webkitdirectory>` (WICG, not the HTML Standard) and attributes that ship only in Chromium (`interestfor`, `closedby`, `blocking`, …).

**Testing**
- Packed this branch and fed it to `vscode-html-languageservice` (`npm i -D <tgz> && node build/generateData.js`). The full test suite passes (178/178).
- Ran completion checks against the built language service. All 12 fail on `main` and pass with this branch:
  - `<button comm|` offers `command`, `commandfor`
  - `<button command="|"` offers `show-modal`, `close`, `request-close`, `show-popover`, `hide-popover`, `toggle-popover`
  - `<template shadowroot|` offers all four `shadowroot*` attributes; `shadowrootmode="|"` offers `open`, `closed`
  - `<iframe loading="|"` → `eager`, `lazy`; `<link fetch|`, `<link image|`, `<script fetchpriority="|"`, `<source wi|`, `<form re|`, `<area referrer|`, `<video plays|` all complete
- Hovers show the description and the Baseline badge, e.g. `commandfor`: *Newly available across major browsers (Baseline since 2025)*.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_014fSnD1PNptV3WyQLkbSVcM
