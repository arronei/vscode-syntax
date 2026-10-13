// Ask a built vscode-css-languageservice about a CSS property: completion, value completion, hover, validation.
// Usage: node css-check.mjs <path to vscode-css-languageservice> <property> <value1,value2,...> [custom data file] [css|scss|less]
// With a custom data file, the data is layered on top of the built-in data the way VS Code does it.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const [lsRoot = '../vscode-css-languageservice', prop = 'color-interpolation', vals = 'auto,sRGB,linearRGB', dataFile, lang = 'css'] = process.argv.slice(2);
const mod = await import(pathToFileURL(path.resolve(lsRoot, 'lib/esm/cssLanguageService.js')).href);
const { getCSSLanguageService, getSCSSLanguageService, getLESSLanguageService, newCSSDataProvider, TextDocument } = mod;
const factory = { css: getCSSLanguageService, scss: getSCSSLanguageService, less: getLESSLanguageService }[lang];
const ls = factory();
if (dataFile) ls.setDataProviders(true, [newCSSDataProvider(JSON.parse(fs.readFileSync(dataFile, 'utf8')))]);
const doc = (src) => { const o = src.indexOf('|'); const d = TextDocument.create('t://a.' + lang, lang, 0, src.replace('|', '')); return { d, pos: d.positionAt(o), ss: ls.parseStylesheet(d) }; };
let fail = 0;
const check = (ok, label, detail) => { if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(44)} ${detail}`); };

let { d, pos, ss } = doc(`svg { ${prop.slice(0, 8)}| }`);
const names = ls.doComplete(d, pos, ss).items.map((i) => i.label);
check(names.includes(prop), `property completion "${prop.slice(0, 8)}|"`, names.filter((n) => n.startsWith(prop.slice(0, 8))).join(', '));

({ d, pos, ss } = doc(`svg { ${prop}: | }`));
const values = ls.doComplete(d, pos, ss).items.map((i) => i.label);
const want = vals.split(',');
check(want.every((v) => values.includes(v)), `value completion "${prop}: |"`, want.filter((v) => values.includes(v)).join(', ') || '(none)');

({ d, pos, ss } = doc(`svg { ${prop.slice(0, 3)}|${prop.slice(3)}: ${want[0]}; }`));
const hover = ls.doHover(d, pos, ss);
const text = hover ? (typeof hover.contents === 'string' ? hover.contents : hover.contents.value ?? JSON.stringify(hover.contents)) : '';
check(!!text && !/^\s*$/.test(text), 'hover', text.replace(/!\[Baseline[^)]*\)/, '[Baseline badge]').replace(/\n+/g, ' / ').slice(0, 220));

({ d, ss } = doc(`svg { ${prop}: ${want[0]}; }|`));
const diags = ls.doValidation(d, ss).map((x) => x.message);
check(!diags.some((m) => /Unknown property/i.test(m)), 'validation (no "Unknown property")', diags.join('; ') || 'no diagnostics');
process.exit(fail ? 1 : 0);
