// Turn the CSS and HTML items of a gap report into additions files the extension build understands.
//
//   node tools/additions-from-gap-report.mjs <gap-report.json> <additions/css/out.json> [P1,P2]
//
// Keeps items with any of the chosen priorities or levels (default P1 and P2: standards-track, not
// deprecated, shipping in at least one engine). Levels are baseline, standard, draft and proprietary,
// so `proprietary` or `P1,P2,proprietary` work too. `preview` keeps items that ship unflagged only in a browser preview
// (previewIn in the report), such as block-ellipsis in Safari Technology Preview. Skips names already listed in other additions
// files. If the output file exists, entries keep any hand-written fields (description, values, syntax).
// CSS entries need no hand-written text: the build describes them from the specs. HTML items go to
// additions/html/<same file name>, described from the specs by tools/html-from-specs.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { htmlDescriber } from './html-from-specs.mjs';

const [reportFile, outFile, pickArg = 'P1,P2'] = process.argv.slice(2);
if (!reportFile || !outFile) {
  console.error('usage: node tools/additions-from-gap-report.mjs <gap-report.json> <additions/css/out.json> [P1,P2 | levels]');
  process.exit(2);
}
const picks = new Set(pickArg.split(','));
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
const keep = (list) => (list || []).filter((e) => picks.has(e.priority) || picks.has(e.level) || (picks.has('preview') && e.previewIn));

const cssDir = path.dirname(path.resolve(outFile));
const elsewhere = new Set();
for (const f of fs.existsSync(cssDir) ? fs.readdirSync(cssDir) : []) {
  if (!f.endsWith('.json') || path.resolve(cssDir, f) === path.resolve(outFile)) continue;
  const a = JSON.parse(fs.readFileSync(path.join(cssDir, f), 'utf8'));
  for (const x of [...(a.properties || []), ...(a.atRules || []), ...(a.selectors || [])]) elsewhere.add(x.name);
}
const previous = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
const merge = (kind, names) => {
  const old = new Map((previous[kind] || []).map((x) => [x.name, x]));
  return names.filter((n) => !elsewhere.has(n)).map((n) => ({ ...(old.get(n) || {}), name: n }));
};

const out = {
  title: previous.title || 'CSS features in the specs that ship in browsers but are missing from VS Code',
  generatedFrom: `${path.basename(reportFile)} (${report.generatedAt?.slice(0, 10) ?? 'unknown date'}), kept ${[...picks].join('+')}`,
  sources: report.sources,
  properties: merge('properties', keep(report.gaps.cssProperties).map((e) => e.name)),
  atRules: merge('atRules', keep(report.gaps.atRules).map((e) => e.name)),
  selectors: merge('selectors', keep(report.gaps.selectors).map((e) => e.name)),
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${outFile}: ${out.properties.length} properties, ${out.atRules.length} at-rules, ${out.selectors.length} selectors`);

// ---------- HTML ----------
// Same picks, written to additions/html/<same file name>, described from the specs by html-from-specs.mjs. Only new
// items are fetched; an entry that already has a description keeps it, so edit any by hand.
const htmlOut = path.join(cssDir, '..', 'html', path.basename(outFile));
const htmlDir = path.dirname(htmlOut);
const keyOf = (kind, x) => (kind === 'elements' ? `<${x.name}>` : kind === 'attributes' ? `<${x.tag} ${x.name}>` : x.name).toLowerCase();
const covered = new Set();
const otherHtmlSets = [];
for (const f of fs.existsSync(htmlDir) ? fs.readdirSync(htmlDir) : []) {
  if (!f.endsWith('.json') || path.resolve(htmlDir, f) === htmlOut) continue;
  const a = JSON.parse(fs.readFileSync(path.join(htmlDir, f), 'utf8'));
  otherHtmlSets.push(...(a.valueSets || []));
  for (const e of a.elements || []) [keyOf('elements', e), ...(e.attributes || []).map((t) => keyOf('attributes', { tag: e.name, name: t.name }))].forEach((k) => covered.add(k));
  for (const t of a.attributes || []) covered.add(keyOf('attributes', t));
  for (const g of a.globalAttributes || []) covered.add(keyOf('globalAttributes', g));
}
const prevHtml = fs.existsSync(htmlOut) ? JSON.parse(fs.readFileSync(htmlOut, 'utf8')) : {};
const prevEntry = new Map(['elements', 'attributes', 'globalAttributes'].flatMap((k) => (prevHtml[k] || []).map((x) => [keyOf(k, x), x])));

// Value sets to reuse when the keywords match: our own, then VS Code's (which come with value descriptions)
const builtinHtml = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '@vscode', 'web-custom-data', 'data', 'browsers.html-data.json'), 'utf8'));
const { describe, newValueSets } = htmlDescriber({ knownSets: [...otherHtmlSets, ...builtinHtml.valueSets] });

const htmlFile = { title: prevHtml.title || 'HTML features in the specs that ship in browsers but are missing from VS Code', generatedFrom: out.generatedFrom };
const skipped = [];
for (const [kind, list] of [['elements', report.gaps.htmlElements], ['attributes', report.gaps.htmlAttributes], ['globalAttributes', report.gaps.globalAttributes]]) {
  htmlFile[kind] = [];
  for (const e of keep(list)) {
    const key = e.name.toLowerCase();
    if (covered.has(key)) continue;
    const entry = prevEntry.get(key)?.description ? prevEntry.get(key) : await describe(e);
    if (entry) htmlFile[kind].push(entry);
    else skipped.push(e.name);
  }
}
const entries = [...htmlFile.elements.flatMap((el) => [el, ...(el.attributes || []).map((a) => ({ ...a, tag: el.name }))]), ...htmlFile.attributes, ...htmlFile.globalAttributes];
const used = new Set(entries.map((x) => x.valueSet));
htmlFile.valueSets = [...(prevHtml.valueSets || []), ...newValueSets].filter((vs, i, all) => used.has(vs.name) && all.findIndex((x) => x.name === vs.name) === i);
fs.writeFileSync(htmlOut, JSON.stringify(htmlFile, null, 2) + '\n');
console.log(`wrote ${htmlOut}: ${htmlFile.elements.length} elements, ${htmlFile.attributes.length} attributes, ${htmlFile.globalAttributes.length} global attributes`);
const review = [
  ...skipped.map((n) => `${n} (spec didn't load; the next run retries)`),
  ...entries.filter((x) => x.review).map((x) => `${x.tag ? `<${x.tag} ${x.name}>` : x.name} (no definition found; write a description)`),
];
if (review.length) {
  console.log(`HTML items to look at:\n  ` + review.join('\n  '));
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=HTML additions to review::${review.join(', ')}`);
}
