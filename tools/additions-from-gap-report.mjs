// Turn the CSS items of a gap report into an additions file the extension build understands.
//
//   node tools/additions-from-gap-report.mjs <gap-report.json> <additions/css/out.json> [P1,P2]
//
// Keeps items with any of the chosen priorities or levels (default P1 and P2: standards-track, not
// deprecated, shipping in at least one engine). Levels are baseline, standard, draft and proprietary,
// so `proprietary` or `P1,P2,proprietary` work too. `preview` keeps items that ship unflagged only in a browser preview
// (previewIn in the report), such as block-ellipsis in Safari Technology Preview. Skips names already listed in other additions
// files. If the output file exists, entries keep any hand-written fields (description, values, syntax).
// CSS entries need no hand-written text: the build describes them from the specs.
// HTML items need a written description, so they are listed for review instead of written.
import fs from 'fs';
import path from 'path';

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

// HTML items not yet in additions/html/, named as the report does: <tag>, <tag attr>, or a global attribute
const htmlDir = path.join(cssDir, '..', 'html');
const covered = new Set();
for (const f of fs.existsSync(htmlDir) ? fs.readdirSync(htmlDir).filter((f) => f.endsWith('.json')) : []) {
  const a = JSON.parse(fs.readFileSync(path.join(htmlDir, f), 'utf8'));
  for (const e of a.elements || []) [`<${e.name}>`, ...(e.attributes || []).map((t) => `<${e.name} ${t.name}>`)].forEach((n) => covered.add(n.toLowerCase()));
  for (const t of a.attributes || []) covered.add(`<${t.tag} ${t.name}>`.toLowerCase());
  for (const g of a.globalAttributes || []) covered.add(g.name.toLowerCase());
}
const html = [...keep(report.gaps.htmlElements), ...keep(report.gaps.htmlAttributes), ...keep(report.gaps.globalAttributes)].filter((e) => !covered.has(e.name.toLowerCase()));
if (html.length) {
  const list = html.map((e) => `${e.priority} ${e.level} ${e.name}`);
  console.log(`HTML items needing a written description (add to additions/html/):\n  ` + list.join('\n  '));
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=HTML additions needed::${list.join(', ')}`);
}
