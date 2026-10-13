// Compare VS Code's shipped HTML/CSS custom data against current web data sources.
// Usage: node gap-report.mjs <vscode-custom-data checkout> <node_modules dir with latest sources> [out.json]
// Always reads upstream/main of the checkout (fetched first), whatever branch is checked out.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const [customData, mods, outFile] = process.argv.slice(2);
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
execFileSync('git', ['-C', customData, 'fetch', '-q', 'upstream'], { stdio: 'inherit' });
const fromMain = (p) => JSON.parse(execFileSync('git', ['-C', customData, 'show', `upstream/main:${p}`], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const css = fromMain('web-data/data/browsers.css-data.json');
const html = fromMain('web-data/data/browsers.html-data.json');
const webrefCss = load(path.join(mods, '@webref/css/css.json'));
const webrefHtml = load(path.join(mods, '@webref/elements/html.json'));
const bcd = load(path.join(mods, '@mdn/browser-compat-data/data.json'));
const wf = load(path.join(mods, 'web-features/data.json'));

const BROWSERS = ['chrome', 'edge', 'firefox', 'safari'];

// Which of the four major desktop browsers ship this BCD feature unflagged?
function shippingIn(compat) {
  if (!compat?.support) return [];
  const out = [];
  for (const b of BROWSERS) {
    let s = compat.support[b];
    if (!s) continue;
    if (!Array.isArray(s)) s = [s];
    const ok = s.some((x) => x.version_added && x.version_added !== 'preview' && !x.flags && !x.partial_implementation && !x.prefix && !x.alternative_name && !x.version_removed);
    if (ok) out.push(b);
  }
  return out;
}

// web-features: map BCD key -> baseline status
const baselineByKey = {};
for (const [id, f] of Object.entries(wf.features)) {
  if (f.kind !== 'feature') continue;
  for (const key of f.compat_features || []) baselineByKey[key] = { feature: id, baseline: f.status?.baseline };
}
const baselineLabel = (b) => (b === 'high' ? 'Widely available' : b === 'low' ? 'Newly available' : 'Limited');

function entry(name, bcdKey, compat, specHref) {
  const ships = shippingIn(compat);
  const bl = baselineByKey[bcdKey];
  return {
    name,
    deprecated: compat?.status?.deprecated || undefined,
    nonStandard: compat && compat.status && !compat.status.standard_track ? true : undefined,
    bcdKey: compat ? bcdKey : undefined,
    shipsIn: ships,
    baseline: bl ? baselineLabel(bl.baseline) : (ships.length === 4 ? 'All 4 browsers' : undefined),
    spec: specHref || compat?.__compat?.spec_url || compat?.spec_url,
    mdn: compat?.mdn_url,
  };
}

// P1 = standards-track, not deprecated, shipping in all four engines; P2 = shipping somewhere; P3 = not shipping / non-standard
const priority = (e) => (e.deprecated || e.nonStandard ? 'P3' : e.shipsIn.length === 4 ? 'P1' : e.shipsIn.length >= 1 ? 'P2' : 'P3');
const sortGaps = (arr) => arr.sort((a, b) => b.shipsIn.length - a.shipsIn.length || a.name.localeCompare(b.name));

// ---------- CSS properties ----------
const haveProps = new Set(css.properties.map((p) => p.name));
const bcdProps = bcd.css.properties;
const webrefProps = new Map(webrefCss.properties.map((p) => [p.name, p]));
const cssPropGaps = [];
const candidateProps = new Set([...Object.keys(bcdProps), ...webrefProps.keys()]);
for (const name of candidateProps) {
  if (haveProps.has(name) || name.startsWith('-') || name === 'custom-property' || name === '--*') continue;
  const compat = bcdProps[name]?.__compat;
  const e = entry(name, `css.properties.${name}`, compat, webrefProps.get(name)?.href);
  e.inSpec = webrefProps.has(name);
  cssPropGaps.push(e);
}
sortGaps(cssPropGaps);

// Properties shipped with empty descriptions
const emptyDesc = css.properties.filter((p) => !p.description || (typeof p.description === 'string' && !p.description.trim())).map((p) => p.name);

// ---------- CSS at-rules ----------
const haveAt = new Set(css.atDirectives.map((a) => a.name));
const atGaps = [];
const webrefAt = new Map(webrefCss.atrules.map((a) => [a.name, a]));
for (const name of new Set([...Object.keys(bcd.css['at-rules']).map((n) => '@' + n), ...webrefAt.keys()])) {
  if (haveAt.has(name) || name.startsWith('@-')) continue;
  const compat = bcd.css['at-rules'][name.slice(1)]?.__compat;
  const e = entry(name, `css.at-rules.${name.slice(1)}`, compat, webrefAt.get(name)?.href);
  atGaps.push(e);
}
sortGaps(atGaps);

// ---------- CSS selectors (pseudo-classes / pseudo-elements) ----------
const haveSel = new Set([...css.pseudoClasses.map((s) => s.name.replace(/\(.*$/, '')), ...css.pseudoElements.map((s) => s.name.replace(/\(.*$/, ''))]);
const webrefSel = new Map(webrefCss.selectors.map((s) => [s.name.replace(/\(.*$/, ''), s]));
const selGaps = [];
const bcdSel = bcd.css.selectors;
const bcdSelName = (k) => {
  // BCD doesn't store ':' prefix; infer from spec URL / mdn url
  const c = (bcdSel[k] || bcdSel[k + 'function']).__compat;
  const u = (c?.mdn_url || '') + ' ' + (Array.isArray(c?.spec_url) ? c.spec_url.join(' ') : c?.spec_url || '');
  if (webrefSel.has('::' + k) || /pseudo-element|selectordef-[a-z-]*$/.test('') ) {}
  if (webrefSel.has('::' + k) || /::/.test(u) || /Pseudo-elements/.test(u)) return '::' + k;
  return ':' + k;
};
for (const k of Object.keys(bcdSel)) {
  if (k === '__compat') continue;
  const c = bcdSel[k].__compat;
  if (!c) continue;
  // skip combinators / basic selectors
  if (/^(child|descendant|next-sibling|subsequent-sibling|column|class|id|type|universal|attribute|list|namespace|nesting|selector_list)$/.test(k)) continue;
  const name = bcdSelName(k.replace(/function$/, ''));
  if (haveSel.has(name) || k.startsWith('-')) continue;
  selGaps.push(entry(name, `css.selectors.${k}`, c, webrefSel.get(name)?.href));
}
for (const [name, s] of webrefSel) {
  if (haveSel.has(name) || selGaps.some((g) => g.name === name) || !name.startsWith(':') || name.startsWith(':-') || name.startsWith('::-')) continue;
  const k = name.replace(/^::?/, '');
  if (bcdSel[k]) continue;
  selGaps.push(entry(name, undefined, undefined, s.href));
}
sortGaps(selGaps);

// ---------- HTML elements ----------
const haveTags = new Map(html.tags.map((t) => [t.name, t]));
const tagGaps = [];
const webrefEls = new Map(webrefHtml.elements.map((e) => [e.name, e]));
for (const name of new Set([...Object.keys(bcd.html.elements), ...webrefEls.keys()])) {
  if (haveTags.has(name)) continue;
  const compat = bcd.html.elements[name]?.__compat;
  const e = entry(`<${name}>`, `html.elements.${name}`, compat, webrefEls.get(name)?.href);
  if (compat?.status?.deprecated) e.deprecated = true;
  tagGaps.push(e);
}
sortGaps(tagGaps);

// ---------- HTML element attributes ----------
const attrGaps = [];
for (const [tag, node] of Object.entries(bcd.html.elements)) {
  const have = haveTags.get(tag);
  if (!have) continue;
  const haveAttrs = new Set((have.attributes || []).map((a) => a.name));
  for (const [attr, anode] of Object.entries(node)) {
    if (attr === '__compat' || haveAttrs.has(attr)) continue;
    const c = anode.__compat;
    if (!c || c.status?.deprecated) continue;
    // BCD sometimes nests values (e.g. input.type_xxx) — skip non-attribute nodes
    if (/^type_|_value$|^value_|^implicit|^attributes$/.test(attr) || attr.includes('_')) continue;
    attrGaps.push(entry(`<${tag} ${attr}>`, `html.elements.${tag}.${attr}`, c));
  }
}
sortGaps(attrGaps);

// ---------- HTML global attributes ----------
const haveGlobals = new Set(html.globalAttributes.map((a) => a.name));
const globalGaps = [];
for (const [attr, node] of Object.entries(bcd.html.global_attributes)) {
  if (haveGlobals.has(attr) || attr.startsWith('__')) continue;
  const c = node.__compat;
  if (!c || c.status?.deprecated || attr.includes('_')) continue;
  globalGaps.push(entry(attr, `html.global_attributes.${attr}`, c));
}
sortGaps(globalGaps);

const count = (arr) => ({ total: arr.length, P1: arr.filter((e) => priority(e) === 'P1').length, P2: arr.filter((e) => priority(e) === 'P2').length, P3: arr.filter((e) => priority(e) === 'P3').length });
const report = {
  generatedAt: new Date().toISOString(),
  sources: Object.fromEntries(['mdn-data', '@mdn/browser-compat-data', '@webref/css', '@webref/elements', 'web-features'].map((p) => [p, load(path.join(mods, p, 'package.json')).version])),
  shipped: { cssProperties: css.properties.length, atRules: css.atDirectives.length, pseudoClasses: css.pseudoClasses.length, pseudoElements: css.pseudoElements.length, htmlTags: html.tags.length, globalAttributes: html.globalAttributes.length },
  summary: { cssProperties: count(cssPropGaps), atRules: count(atGaps), selectors: count(selGaps), htmlElements: count(tagGaps), htmlAttributes: count(attrGaps), globalAttributes: count(globalGaps), emptyCssDescriptions: emptyDesc.length },
  gaps: { cssProperties: cssPropGaps, atRules: atGaps, selectors: selGaps, htmlElements: tagGaps, htmlAttributes: attrGaps, globalAttributes: globalGaps },
  emptyCssDescriptions: emptyDesc,
};
for (const list of Object.values(report.gaps)) for (const e of list) e.priority = priority(e);
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ sources: report.sources, shipped: report.shipped, summary: report.summary }, null, 2));
for (const [k, list] of Object.entries(report.gaps)) {
  console.log(`\n## ${k} — P1 (all 4 browsers) / P2 (some browsers)`);
  console.log(list.filter((e) => e.priority !== 'P3').map((e) => `${e.priority} ${e.name} [${e.shipsIn.join(',')}]`).join('\n'));
}
