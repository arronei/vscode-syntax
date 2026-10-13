// Turn the CSS items of a gap report into an additions file the extension build understands.
//
//   node tools/additions-from-gap-report.mjs <gap-report.json> <additions/css/out.json> [P1,P2]
//
// Keeps the chosen priorities (default P1 and P2: standards-track, not deprecated, shipping in at
// least one engine). Skips names already listed in other additions files. If the output file exists,
// entries keep any hand-written fields (description, values, syntax).
// CSS entries need no hand-written text: the build describes them from the specs.
// HTML items need a written description, so they are listed for review instead of written.
import fs from 'fs';
import path from 'path';

const [reportFile, outFile, prioArg = 'P1,P2'] = process.argv.slice(2);
if (!reportFile || !outFile) {
  console.error('usage: node tools/additions-from-gap-report.mjs <gap-report.json> <additions/css/out.json> [P1,P2]');
  process.exit(2);
}
const priorities = new Set(prioArg.split(','));
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
const keep = (list) => (list || []).filter((e) => priorities.has(e.priority));

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
  generatedFrom: `${path.basename(reportFile)} (${report.generatedAt?.slice(0, 10) ?? 'unknown date'}), priorities ${[...priorities].join('+')}`,
  sources: report.sources,
  properties: merge('properties', keep(report.gaps.cssProperties).map((e) => e.name)),
  atRules: merge('atRules', keep(report.gaps.atRules).map((e) => e.name)),
  selectors: merge('selectors', keep(report.gaps.selectors).map((e) => e.name)),
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${outFile}: ${out.properties.length} properties, ${out.atRules.length} at-rules, ${out.selectors.length} selectors`);

const html = [...keep(report.gaps.htmlElements), ...keep(report.gaps.htmlAttributes), ...keep(report.gaps.globalAttributes)];
if (html.length) console.log(`HTML items needing a written description (add to additions/html/):\n  ` + html.map((e) => `${e.priority} ${e.name}`).join('\n  '));
