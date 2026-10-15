// Build the "Web Spec Additions" VS Code extension data from the additions files.
//
//   node tools/build-extension.mjs
//
// Reads additions/html/*.json and additions/css/*.json, fills in spec, browser and Baseline data,
// drops anything VS Code's built-in data (@vscode/web-custom-data) already has, and writes
// extension/data/html.html-data.json, extension/data/css.css-data.json and extension/CONTENTS.md.
//
// Sources:
//   CSS syntax, values, spec facts .. @webref/css (crawled daily from the specs' editor's drafts)
//   spec titles ..................... browser-specs
//   fallback for non-spec CSS ....... mdn-data
//   browser versions ................ @mdn/browser-compat-data
//   Baseline status ................. web-features
//   HTML descriptions ............... the additions files (written by us)
//
// Also writes extension/data/css-hover.json for the hover provider in extension/extension.js.
//
// Every item gets a data level (tools/levels.mjs). The full data goes to extension/data/{css,html}.all.json.
// The extension filters it to the levels its settings ask for, into the {css,html}.*-data.json files that
// package.json contributes. The build writes those two at the settings' defaults.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { definitionSyntax } from 'css-tree';
import { levelFinder } from './levels.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const md = (value) => ({ kind: 'markdown', value });

// read package files directly (several of these packages restrict subpath imports via "exports")
const mod = (pkg, file) => readJSON(path.join(root, 'node_modules', pkg, file));
const webrefCss = mod('@webref/css', 'css.json');
const specs = mod('browser-specs', 'index.json');
const mdnProps = mod('mdn-data', 'css/properties.json');
const mdnL10n = mod('mdn-data', 'l10n/css.json');
const bcd = mod('@mdn/browser-compat-data', 'data.json');
const wf = mod('web-features', 'data.json');
const builtinCss = mod('@vscode/web-custom-data', 'data/browsers.css-data.json');
const builtinHtml = mod('@vscode/web-custom-data', 'data/browsers.html-data.json');
const builtinVersion = mod('@vscode/web-custom-data', 'package.json').version;

// ---------- shared helpers ----------
const BROWSERS = [['edge', 'E'], ['firefox', 'FF'], ['firefox_android', 'FFA'], ['safari', 'S'], ['safari_ios', 'SM'], ['chrome', 'C'], ['chrome_android', 'CA'], ['opera', 'O']];
function compatAt(key) {
  let node = bcd;
  for (const part of key.split('.')) node = node?.[part];
  return node?.__compat;
}
function browserStrings(compat) {
  if (!compat) return undefined;
  const out = [];
  for (const [id, abbr] of BROWSERS) {
    let s = compat.support[id];
    if (!s) continue;
    s = [s].flat().find((x) => !x.flags && !x.prefix && !x.alternative_name);
    if (!s || !s.version_added || s.flags || s.version_removed || s.version_added === 'preview') continue;
    out.push(typeof s.version_added === 'string' ? abbr + s.version_added.replace(/^≤/, '') : abbr);
  }
  return out.length ? out : undefined;
}
const statusByKey = {};
for (const f of Object.values(wf.features)) {
  if (f.kind !== 'feature') continue;
  for (const [key, st] of Object.entries(f.status?.by_compat_key || {})) statusByKey[key] = st;
}
function baseline(key) {
  const st = statusByKey[key];
  if (!st) return undefined;
  const b = { status: st.baseline === false ? 'false' : st.baseline };
  if (st.baseline_low_date) b.baseline_low_date = st.baseline_low_date.replace(/^≤/, '');
  if (st.baseline_high_date) b.baseline_high_date = st.baseline_high_date.replace(/^≤/, '');
  return b;
}
const htmlStatus = (b) => b && { baseline: b.status === 'false' ? false : b.status, ...(b.baseline_low_date && { baseline_low_date: b.baseline_low_date }), ...(b.baseline_high_date && { baseline_high_date: b.baseline_high_date }) };
function references(compat, specHref) {
  const refs = [];
  if (compat?.mdn_url) refs.push({ name: 'MDN Reference', url: compat.mdn_url });
  const spec = specHref || [].concat(compat?.spec_url || [])[0];
  if (spec) refs.push({ name: 'Specification', url: spec });
  return refs.length ? refs : undefined;
}
const cssStatus = (compat) => (compat?.status?.deprecated ? 'obsolete' : compat?.status?.experimental ? 'experimental' : compat && !compat.status?.standard_track ? 'nonstandard' : undefined);

const { levelOf, specFor } = levelFinder({ specs, wf });
const specTitle = (href) => specFor(href)?.title;

function loadAdditions(kind) {
  const dir = path.join(root, 'additions', kind);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: `additions/${kind}/${f}`, ...readJSON(path.join(dir, f)) }));
}
const included = { css: [], html: [] };
const pruned = [];

// ---------- CSS ----------
const RESTRICTIONS = {
  length: 'length', 'length-percentage': ['length', 'percentage'], percentage: 'percentage', number: 'number', integer: 'integer',
  color: 'color', image: 'image', url: 'url', string: 'string', time: 'time', angle: 'angle', 'easing-function': 'timing-function',
  position: 'position', 'custom-ident': 'identifier', 'dashed-ident': 'identifier', 'line-style': 'line-style', 'line-width': 'line-width',
  'basic-shape': 'shape', 'geometry-box': 'geometry-box', 'visual-box': 'box', 'layout-box': 'box', 'paint-box': 'box', 'coord-box': 'box',
};
const webrefProp = new Map(webrefCss.properties.map((p) => [p.name, p]));
const webrefType = new Map(webrefCss.types.filter((t) => t.syntax).map((t) => [t.name.replace(/^<|>$/g, ''), t.syntax]));
const builtinProp = new Map(builtinCss.properties.map((p) => [p.name, p]));
const syntaxOf = (name) => webrefProp.get(name)?.syntax || webrefProp.get(name)?.value || mdnProps[name]?.syntax || builtinProp.get(name)?.syntax;

// Visit the terms of a syntax tree that stand at the value's top level, skipping function arguments:
// in `repeat( auto , <color># )`, `auto` and <integer> are not values of the property itself.
function walkTopLevel(node, cb) {
  if (node.type === 'Group') {
    let inFunction = 0;
    for (const t of node.terms) {
      if (t.type === 'Function') inFunction++;
      else if (t.type === 'Token' && t.value === ')' && inFunction) inFunction--;
      else if (!inFunction) walkTopLevel(t, cb);
    }
  } else if (node.type === 'Multiplier') {
    walkTopLevel(node.term, cb);
  } else {
    cb(node);
  }
}

// Keywords and value restrictions in a syntax. Follows <'other-property'> references (shorthands), using
// VS Code's own restrictions for known properties, and expands spec-defined types such as
// <line-color-list> until it reaches a type VS Code already knows how to complete (<color>, <length>, …).
function analyseSyntax(syntax, depth = 0, seen = new Set()) {
  const keywords = new Set();
  const restrictions = new Set();
  const visit = (sub) => {
    sub.keywords.forEach((k) => keywords.add(k));
    sub.restrictions.forEach((r) => r !== 'enum' && restrictions.add(r));
  };
  try {
    walkTopLevel(definitionSyntax.parse(syntax), (node) => {
      if (node.type === 'Keyword') keywords.add(node.name);
      if (node.type === 'Type') {
        const known = RESTRICTIONS[node.name];
        if (known) [known].flat().forEach((r) => restrictions.add(r));
        else if (depth < 5 && !seen.has('<' + node.name) && webrefType.has(node.name)) {
          seen.add('<' + node.name);
          visit(analyseSyntax(webrefType.get(node.name), depth + 1, seen));
        }
      }
      if (node.type === 'Property' && depth < 5 && !seen.has(node.name)) {
        seen.add(node.name);
        const b = builtinProp.get(node.name);
        if (b) {
          (b.restrictions || []).filter((r) => r !== 'enum').forEach((r) => restrictions.add(r));
          (b.values || []).forEach((v) => keywords.add(v.name));
        }
        const ref = webrefProp.get(node.name)?.syntax || mdnProps[node.name]?.syntax;
        if (ref) visit(analyseSyntax(ref, depth + 1, seen));
      }
    });
  } catch (e) {
    console.warn(`  could not parse syntax "${syntax}": ${e.message}`);
  }
  if (keywords.size) restrictions.add('enum');
  return { keywords: [...keywords], restrictions: [...restrictions] };
}

const isShorthandValue = (v) => /^see individual properties$/i.test(v || '') || /^as longhands?$/i.test(v || '');
function specPropertyDescription(p) {
  const title = specTitle(p.href);
  const facts = [];
  if (isShorthandValue(p.initial)) {
    facts.push('Shorthand property.');
    if (p.appliesTo && !isShorthandValue(p.appliesTo)) facts.push(`Applies to: ${p.appliesTo.length > 120 && /^same as/i.test(p.appliesTo) ? 'same as its longhand properties' : p.appliesTo}.`);
  } else {
    if (p.initial) facts.push(`Initial value: \`${p.initial}\`.`);
    if (p.appliesTo) facts.push(`Applies to: ${p.appliesTo}.`);
    if (p.inherited) facts.push(`Inherited: ${p.inherited}.`);
    if (p.animationType) facts.push(`Animation type: ${p.animationType}.`);
  }
  return md([title ? `Defined in *${title}*.` : undefined, facts.join(' ')].filter(Boolean).join('\n\n'));
}
const l10n = (key) => (typeof key === 'string' ? (mdnL10n[key]?.['en-US'] ?? key) : undefined);
const stripMacros = (s) => s?.replace(/\{\{\s*\w+\("([^"]+)"[^}]*\)\s*\}\}/g, '<$1>').replace(/<\/?code>/g, '`');
function mdnPropertyDescription(name) {
  const m = mdnProps[name];
  if (!m) return undefined;
  const facts = [];
  if (m.groups?.length) facts.push(`Part of ${m.groups.join(', ')}.`);
  if (typeof m.initial === 'string') facts.push(`Initial value: \`${l10n(m.initial)}\`.`);
  if (typeof m.appliesto === 'string') facts.push(`Applies to: ${stripMacros(l10n(m.appliesto))}.`);
  if (typeof m.inherited === 'boolean') facts.push(`Inherited: ${m.inherited ? 'yes' : 'no'}.`);
  return md(facts.join(' '));
}

function buildProperty(add, origin) {
  const spec = webrefProp.get(add.name);
  const syntax = add.syntax || spec?.syntax || spec?.value || mdnProps[add.name]?.syntax;
  if (!syntax) throw new Error(`${origin}: no syntax for ${add.name} (not in @webref/css or mdn-data; add "syntax")`);
  const bcdKey = add.bcd || `css.properties.${add.name}`;
  const compat = compatAt(bcdKey);
  const { keywords, restrictions } = analyseSyntax(syntax);
  const valueNotes = add.values || {};
  return {
    name: add.name,
    level: add.level || levelOf(add.name, compat, bcdKey, spec?.href),
    syntax,
    values: keywords.map((k) => {
      const v = { name: k };
      if (valueNotes[k]) v.description = valueNotes[k];
      const vc = compatAt(`${bcdKey}.${k}`);
      if (vc) {
        v.browsers = browserStrings(vc);
        const b = baseline(`${bcdKey}.${k}`);
        if (b) v.baseline = b;
      }
      return v;
    }),
    restrictions: restrictions.length ? restrictions : undefined,
    status: cssStatus(compat),
    browsers: browserStrings(compat),
    baseline: baseline(bcdKey),
    references: references(compat, spec?.href),
    description: add.description || (spec ? specPropertyDescription(spec) : mdnPropertyDescription(add.name)),
  };
}

const firstSentences = (s, max = 320) => {
  const text = s.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
};
const plain = (name) => name.replace(/\(\)$/, '');
const webrefSelector = (name) => webrefCss.selectors.find((s) => plain(s.name) === plain(name));
function buildSelector(add) {
  const spec = webrefSelector(add.name);
  const key = add.bcd || `css.selectors.${plain(add.name).replace(/^::?/, '')}`;
  const compat = compatAt(key);
  const title = specTitle(spec?.href);
  const description = add.description
    ? md(add.description)
    : md([spec?.prose ? firstSentences(spec.prose) : undefined, title ? `— *${title}*` : undefined].filter(Boolean).join('\n\n'));
  return { name: plain(add.name), level: add.level || levelOf(add.name, compat, key, spec?.href), description, status: cssStatus(compat), browsers: browserStrings(compat), baseline: baseline(key), references: references(compat, spec?.href) };
}
function buildAtRule(add) {
  const spec = webrefCss.atrules.find((a) => a.name === add.name);
  const key = add.bcd || `css.at-rules.${add.name.slice(1)}`;
  const compat = compatAt(key);
  const title = specTitle(spec?.href);
  const text = add.description || spec?.prose;
  const syntax = spec?.syntax ? `\n\nSyntax: \`${spec.syntax}\`` : '';
  return {
    name: add.name,
    level: add.level || levelOf(add.name, compat, key, spec?.href),
    description: md([text, title ? `— *${title}*` : undefined].filter(Boolean).join('\n\n') + syntax),
    status: cssStatus(compat),
    browsers: browserStrings(compat),
    baseline: baseline(key),
    references: references(compat, spec?.href),
  };
}

const cssProperties = [];
const cssAtRules = [];
const pseudoClasses = [];
const pseudoElements = [];
const builtinAt = new Set(builtinCss.atDirectives.map((a) => a.name));
const builtinPseudo = new Set([...builtinCss.pseudoClasses, ...builtinCss.pseudoElements].map((p) => plain(p.name)));
const seenCss = new Set();
const cssHover = {};

for (const batch of loadAdditions('css')) {
  for (const add of batch.properties || []) {
    if (seenCss.has(add.name)) continue;
    seenCss.add(add.name);
    if (builtinProp.has(add.name)) { pruned.push(`css property ${add.name}`); continue; }
    cssProperties.push(buildProperty(add, batch.file));
    included.css.push({ kind: 'property', name: add.name, file: batch.file, entry: cssProperties.at(-1) });
  }
  for (const add of batch.atRules || []) {
    if (builtinAt.has(add.name)) { pruned.push(`css at-rule ${add.name}`); continue; }
    cssAtRules.push(buildAtRule(add));
    included.css.push({ kind: 'at-rule', name: add.name, file: batch.file, entry: cssAtRules.at(-1) });
  }
  for (const add of batch.selectors || []) {
    if (builtinPseudo.has(plain(add.name))) { pruned.push(`css selector ${add.name}`); continue; }
    const entry = buildSelector(add);
    (add.name.startsWith('::') ? pseudoElements : pseudoClasses).push(entry);
    included.css.push({ kind: add.name.startsWith('::') ? 'pseudo-element' : 'pseudo-class', name: entry.name, file: batch.file, entry });
  }
  // Built-in properties that ship without a hover description. Custom data can't change them (the CSS
  // service keeps the first definition of a name, and the built-in data comes first), so these go to
  // data/css-hover.json, which the extension's hover provider (extension.js) shows instead.
  if (batch.fillEmptyBuiltinDescriptions) {
    for (const p of builtinCss.properties) {
      const empty = !p.description || (typeof p.description === 'string' && !p.description.trim());
      if (!empty || seenCss.has(p.name)) continue;
      const spec = webrefProp.get(p.name);
      const description = spec ? specPropertyDescription(spec) : mdnPropertyDescription(p.name);
      if (!description) continue;
      seenCss.add(p.name);
      const compat = compatAt(`css.properties.${p.name}`);
      cssHover[p.name] = {
        description: description.value,
        syntax: p.syntax,
        references: references(compat, spec?.href),
      };
      included.css.push({ kind: 'description', name: p.name, file: batch.file, entry: { browsers: p.browsers || browserStrings(compat) } });
    }
  }
}

// Old names of renamed properties that browsers still accept: BCD's unprefixed alternative_name entries, such as
// flow-tolerance for fit-tolerance. Level `legacy`, so only added when webSpecAdditions.css.legacyNames is on.
// Status obsolete makes VS Code strike them through in completions; the hover points to the current name.
const legacyNames = {};
for (const [target, data] of Object.entries(bcd.css.properties)) {
  for (const [browser, support] of Object.entries(data.__compat?.support || {})) {
    for (const s of [support].flat()) {
      const name = s?.alternative_name;
      if (!name || name.startsWith('-') || !s.version_added || s.version_removed || s.flags) continue;
      (legacyNames[name] ??= { target, support: {} }).support[browser] = { version_added: s.version_added };
    }
  }
}
// ponytail: BCD says Chrome still accepts these, but Blink's source has no such alias (npm run engines). Drop once
// BCD records their version_removed.
const deadLegacyNames = new Set(['motion-distance', 'offset-rotation']);
for (const [name, { target, support }] of Object.entries(legacyNames)) {
  if (seenCss.has(name) || builtinProp.has(name) || deadLegacyNames.has(name)) continue;
  seenCss.add(name);
  const current = buildProperty({ name: target, syntax: syntaxOf(target) }, `${name} (old name of ${target})`);
  cssProperties.push({
    name,
    level: 'legacy',
    syntax: current.syntax,
    values: current.values.map((v) => ({ name: v.name, ...(v.description && { description: v.description }) })),
    restrictions: current.restrictions,
    status: 'obsolete',
    browsers: browserStrings({ support }),
    references: current.references,
    description: md(`Old name for \`${target}\`. Some browsers still accept it; use \`${target}\` instead.\n\n${current.description?.value ?? ''}`.trim()),
  });
  included.css.push({ kind: 'property', name, file: `@mdn/browser-compat-data: old name of \`${target}\``, entry: cssProperties.at(-1) });
}

// ---------- HTML ----------
const builtinTags = new Map(builtinHtml.tags.map((t) => [t.name, new Set(t.attributes.map((a) => a.name))]));
const builtinGlobals = new Set(builtinHtml.globalAttributes.map((a) => a.name));
const htmlBatches = loadAdditions('html');
const htmlTags = [];
const htmlGlobals = [];
const htmlValueSets = [];

// level: for top-level attributes only; an element's own attributes go with the element
function buildAttribute(a, withLevel) {
  const compat = a.bcd ? compatAt(a.bcd) : undefined;
  const attr = { name: a.name };
  if (withLevel) attr.level = htmlLevel(a, compat);
  if (a.valueSet) attr.valueSet = a.valueSet;
  attr.description = md(a.description);
  const browsers = browserStrings(compat);
  if (browsers) attr.browsers = browsers;
  const st = htmlStatus(a.bcd && baseline(a.bcd));
  if (st) attr.status = st;
  const refs = references(compat);
  if (refs) attr.references = refs;
  return attr;
}
// HTML items without a `bcd` key have no spec link, so they come out proprietary unless they set `level`
const htmlLevel = (a, compat) => a.level || levelOf(a.name, compat, a.bcd);
const tagEntry = (name) => {
  let tag = htmlTags.find((t) => t.name === name);
  if (!tag) htmlTags.push((tag = { name, attributes: [] }));
  return tag;
};

for (const batch of htmlBatches) {
  for (const a of batch.attributes || []) {
    if (builtinTags.get(a.tag)?.has(a.name)) { pruned.push(`html <${a.tag} ${a.name}>`); continue; }
    const attr = buildAttribute(a, true);
    tagEntry(a.tag).attributes.push(attr);
    included.html.push({ kind: 'attribute', name: `<${a.tag} ${a.name}>`, file: batch.file, level: attr.level, browsers: browserStrings(a.bcd && compatAt(a.bcd)) });
  }
  for (const a of batch.globalAttributes || []) {
    if (builtinGlobals.has(a.name)) { pruned.push(`html global ${a.name}`); continue; }
    htmlGlobals.push(buildAttribute(a, true));
    included.html.push({ kind: 'global attribute', name: a.name, file: batch.file, level: htmlGlobals.at(-1).level, browsers: browserStrings(a.bcd && compatAt(a.bcd)) });
  }
  for (const el of batch.elements || []) {
    if (builtinTags.has(el.name)) { pruned.push(`html <${el.name}>`); continue; }
    const compat = el.bcd ? compatAt(el.bcd) : undefined;
    const tag = tagEntry(el.name);
    tag.level = htmlLevel(el, compat);
    tag.description = md(el.description);
    const browsers = browserStrings(compat);
    if (browsers) tag.browsers = browsers;
    const st = htmlStatus(el.bcd && baseline(el.bcd));
    if (st) tag.status = st;
    const refs = references(compat);
    if (refs) tag.references = refs;
    tag.attributes.push(...(el.attributes || []).map(buildAttribute));
    included.html.push({ kind: 'element', name: `<${el.name}>`, file: batch.file, level: tag.level, browsers });
  }
}

// Value sets are resolved per data file, so every value set an included attribute references must be in
// our file, including ones VS Code already has built in (e.g. `loading`, `fetchpriority`).
const referenced = new Set([...htmlTags.flatMap((t) => t.attributes), ...htmlGlobals].map((a) => a.valueSet).filter((v) => v && v !== 'v'));
for (const name of referenced) {
  const own = htmlBatches.flatMap((b) => b.valueSets || []).find((vs) => vs.name === name);
  const set = own
    ? { name, values: own.values.map((v) => ({ name: v.name, ...(v.description && { description: md(v.description) }) })) }
    : structuredClone(builtinHtml.valueSets.find((vs) => vs.name === name));
  if (!set) throw new Error(`value set "${name}" is not defined in the additions or the built-in data`);
  for (const edit of htmlBatches.flatMap((b) => b.valueSetEdits || []).filter((e) => e.name === name)) {
    for (const v of set.values) if (edit.values[v.name]) v.description = md(edit.values[v.name]);
  }
  htmlValueSets.push(set);
}

// ---------- write ----------
const outDir = path.join(root, 'extension', 'data');
fs.mkdirSync(outDir, { recursive: true });
const write = (file, data) => fs.writeFileSync(path.join(outDir, file), JSON.stringify(data, null, 2) + '\n');
const { filterData } = createRequire(import.meta.url)('../extension/extension.js');
const settings = readJSON(path.join(root, 'extension', 'package.json')).contributes.configuration.properties;
const atDefaults = (lang, data) => filterData(data, ...['level', 'proprietary', 'legacyNames'].map((k) => settings[`webSpecAdditions.${lang}.${k}`]?.default));
const cssData = { version: 1.1, properties: cssProperties, atDirectives: cssAtRules, pseudoClasses, pseudoElements };
const htmlData = { version: 1.1, tags: htmlTags, globalAttributes: htmlGlobals, valueSets: htmlValueSets };
write('css.all.json', cssData);
write('css.css-data.json', atDefaults('css', cssData));
write('html.all.json', htmlData);
write('html.html-data.json', atDefaults('html', htmlData));
write('css-hover.json', cssHover);

// CONTENTS.md: what the extension adds, and where each item came from
const short = (b) => (b ? b.filter((x) => /^(C|FF|S)\d/.test(x)).join(' ') : '—');
const lines = [
  '# Extension contents',
  '',
  `Generated by \`npm run build-extension\` on ${new Date().toISOString().slice(0, 10)}. Compared against built-in data \`@vscode/web-custom-data\` ${builtinVersion}; anything VS Code already has is dropped automatically.`,
  '',
  'Level: which setting adds the item (see `tools/levels.mjs`). Baseline, standard and draft are cumulative; proprietary and legacy are opt-in.',
  '',
  '| Kind | Count | Baseline | Standard | Draft | Proprietary | Legacy |',
  '|---|---|---|---|---|---|---|',
];
const LEVELS = ['baseline', 'standard', 'draft', 'proprietary', 'legacy'];
const levelOfItem = (x) => x.entry?.level ?? x.level;
const groups = [
  ['CSS properties', included.css.filter((x) => x.kind === 'property')],
  ['CSS at-rules', included.css.filter((x) => x.kind === 'at-rule')],
  ['CSS pseudo-classes', included.css.filter((x) => x.kind === 'pseudo-class')],
  ['CSS pseudo-elements', included.css.filter((x) => x.kind === 'pseudo-element')],
  ['Hover descriptions for built-in CSS properties that have none (extension.js)', included.css.filter((x) => x.kind === 'description')],
  ['HTML elements', included.html.filter((x) => x.kind === 'element')],
  ['HTML attributes', included.html.filter((x) => x.kind === 'attribute')],
  ['HTML global attributes', included.html.filter((x) => x.kind === 'global attribute')],
];
const byLevel = (list) => LEVELS.map((l) => list.filter((x) => levelOfItem(x) === l).length);
for (const [label, list] of groups) lines.push(`| ${label} | ${list.length} | ${list.some(levelOfItem) ? byLevel(list).join(' | ') : LEVELS.map(() => '—').join(' | ')} |`);
for (const [label, list] of groups) {
  if (!list.length) continue;
  lines.push('', `## ${label}`, '', '| Name | Level | Chrome / Firefox / Safari | Source |', '|---|---|---|---|');
  for (const x of list) lines.push(`| \`${x.name}\` | ${levelOfItem(x) ?? '—'} | ${short(x.entry?.browsers ?? x.browsers)} | ${x.file} |`);
}
if (pruned.length) lines.push('', '## Dropped because VS Code now has them', '', ...pruned.map((p) => `- ${p}`));
fs.writeFileSync(path.join(root, 'extension', 'CONTENTS.md'), lines.join('\n') + '\n');

console.log(`built-in data compared against: @vscode/web-custom-data ${builtinVersion}`);
for (const [label, list] of groups) console.log(`  ${label}: ${list.length}${list.some(levelOfItem) ? `  (${LEVELS.map((l, i) => `${l} ${byLevel(list)[i]}`).join(', ')})` : ''}`);
if (pruned.length) console.log(`dropped, already built in (${pruned.length}):\n  ` + pruned.join('\n  '));
