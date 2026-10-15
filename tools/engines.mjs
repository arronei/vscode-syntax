// CSS properties, HTML elements and HTML attributes straight from the browser engines' source: what Blink, WebKit
// and Gecko turn on by default on their main branch, what's in preview, and what sits behind a flag. BCD records a
// feature once it ships in a release; the engines' own lists show it the day it lands, and show names BCD files
// under another key.
// Usage: node engines.mjs <node_modules dir with latest sources> [out.json]
//
//   on       enabled by default on main: in the next release, if not already shipped
//   preview  Blink "experimental" (Experimental Web Platform features flag), WebKit "preview" (Safari Technology
//            Preview), Gecko Nightly-only
//   flag     anything else behind a flag
//   listed   HTML attributes: the engine has the name. Its attribute list carries no flags or elements, and
//            Gecko has no such list at all (its names are in the shared atom table), so attributes are Blink and WebKit only.
import fs from 'fs';
import path from 'path';

const [mods, outFile] = process.argv.slice(2);
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
};
const RAW = {
  blink: 'https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/',
  webkit: 'https://raw.githubusercontent.com/WebKit/WebKit/main/Source/',
  gecko: 'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/',
};
const RANK = { flag: 0, preview: 1, on: 2, listed: 2 };
const min = (...s) => s.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));
const max = (...s) => s.filter(Boolean).reduce((a, b) => (RANK[a] >= RANK[b] ? a : b), undefined);
const listed = (names) => Object.fromEntries(names.map((n) => [n, { state: 'listed' }]));

// ponytail: only the JSON5 Chromium writes (comments, bare keys, trailing commas); the json5 package if that changes
const STR = '"(?:[^"\\\\]|\\\\.)*"';
const json5 = (s) => JSON.parse(s
  .replace(new RegExp(`${STR}|//.*|/\\*[\\s\\S]*?\\*/`, 'g'), (m) => (m[0] === '"' ? m : ''))
  .replace(new RegExp(`${STR}|([{,]\\s*)([A-Za-z_$][\\w$]*)(\\s*:)`, 'g'), (m, a, k, c) => (k ? `${a}"${k}"${c}` : m))
  .replace(new RegExp(`${STR}|,(\\s*[}\\]])`, 'g'), (m, c) => c ?? m));

async function blink() {
  const flags = new Map(json5(await get(RAW.blink + 'platform/runtime_enabled_features.json5')).data.map((f) => [f.name, f]));
  const desktop = (s) => (typeof s === 'string' ? s : s?.Win ?? s?.Mac ?? s?.Linux ?? s?.default ?? '');
  // a feature is only as on as the features it depends on
  const flag = (name) => {
    const f = flags.get(name);
    return min({ stable: 'on', experimental: 'preview' }[desktop(f?.status)] ?? 'flag', ...(f?.depends_on || []).map(flag));
  };
  const props = json5(await get(RAW.blink + 'core/css/css_properties.json5')).data;
  const byName = new Map(props.map((p) => [p.name, p]));
  const css = {};
  for (const p of props) {
    if (/^-(internal|alternative)-/.test(p.name) || p.is_property === false) continue; // is_property: false = at-rule descriptor only
    const flagsOn = [p.runtime_flag, byName.get(p.alias_for)?.runtime_flag].filter(Boolean);
    css[p.name] = { state: min('on', ...flagsOn.map(flag)), aliasOf: p.alias_for };
  }
  const tags = json5(await get(RAW.blink + 'core/html/html_tag_names.json5')).data.map((t) => (typeof t === 'string' ? { name: t } : t));
  // an HTMLUnknownElement interface means the name is only parsed (applet, keygen, …), not implemented: skipped in all three engines
  const elements = Object.fromEntries(tags.filter((t) => t.interfaceName !== 'HTMLUnknownElement').map((t) => [t.name, { state: t.runtimeEnabled ? flag(t.runtimeEnabled) : 'on' }]));
  const attributes = listed(json5(await get(RAW.blink + 'core/html/html_attribute_names.json5')).data.map((a) => a.name ?? a));
  return { css, elements, attributes };
}

async function webkit() {
  // UnifiedWebPreferences.yaml: a `Name:` line per setting, its fields indented below it
  const prefs = {};
  const yaml = await get(RAW.webkit + 'WTF/Scripts/Preferences/UnifiedWebPreferences.yaml');
  for (const [, name, body] of yaml.matchAll(/^(\w+):\n((?:[ \t].*\n|\n)*)/gm)) prefs[name.toLowerCase()] = /^ {2}status: (\w+)/m.exec(body)?.[1];
  // settings are lowerCamel (cssFooEnabled), preferences UpperCamel (CSSFooEnabled).
  // ponytail: a Foo_feature_status macro is Stable on the ports that build the feature (WebKit/Shared/WebPreferencesDefaultValues.h),
  // so it counts as on; evaluate those #ifs if a port-specific feature ever shows up wrongly here
  const setting = (name) => {
    const status = prefs[name.toLowerCase()];
    return { stable: 'on', mature: 'on', preview: 'preview' }[status] ?? (/_feature_status$/.test(status) ? 'on' : 'flag');
  };
  const props = JSON.parse(await get(RAW.webkit + 'WebCore/css/CSSProperties.json')).properties;
  const css = {};
  for (const [name, p] of Object.entries(props)) {
    const cg = [].concat(p['codegen-properties'] || {});
    if (cg.some((c) => c['internal-only'])) continue;
    const flag = cg.find((c) => c['settings-flag'])?.['settings-flag'];
    const state = flag ? setting(flag) : 'on';
    css[name] = { state };
    for (const a of cg.flatMap((c) => c.aliases || [])) css[a] = { state, aliasOf: name };
  }
  // HTMLTagNames.in / HTMLAttributeNames.in: `name option=value, option=value`; header lines aren't lowercase names
  const entries = (text) => [...text.matchAll(/^([a-z][a-z0-9-]*)(?:[ \t]+(.*))?$/gm)].map(([, name, opts]) => [name, Object.fromEntries((opts || '').split(/,\s*/).map((o) => o.split('=')))]);
  const elements = {};
  for (const [name, o] of entries(await get(RAW.webkit + 'WebCore/html/HTMLTagNames.in'))) {
    if (o.interfaceName === 'HTMLUnknownElement') continue;
    // settingsConditional=a&b&!c needs a and b on (and c off, which is ignored here); deprecated global settings are off by default
    const needs = (o.settingsConditional || '').split('&').filter((s) => s && !s.startsWith('!'));
    elements[name] = { state: o.deprecatedGlobalSettingsConditional ? 'flag' : min('on', ...needs.map(setting)) };
  }
  const attributes = listed(entries(await get(RAW.webkit + 'WebCore/html/HTMLAttributeNames.in')).map(([n]) => n));
  return { css, elements, attributes };
}

async function gecko() {
  const prefs = {};
  const yaml = await get(RAW.gecko + 'modules/libpref/init/StaticPrefList.yaml');
  for (const [, name, value] of yaml.matchAll(/^- name: (\S+)\n(?: {2}.*\n)*? {2}value: (.*)/gm)) prefs[name] = value.replace(/\s*#.*/, '').trim();
  const state = (pref) => (!pref || prefs[pref] === 'true' ? 'on'
    : /^@IS_(NIGHTLY_BUILD|EARLY_BETA_OR_EARLIER|NOT_RELEASE_OR_BETA)@$/.test(prefs[pref]) ? 'preview' : 'flag');
  const css = {};
  for (const file of ['longhands', 'shorthands']) {
    // ponytail: line-based TOML, just the [property] headers and the one-line keys read here
    const parts = (await get(`${RAW.gecko}servo/components/style/properties/${file}.toml`)).split(/^\[(.+)\]\r?\n/m);
    for (let i = 1; i < parts.length; i += 2) {
      const [name, body] = [parts[i], parts[i + 1]];
      const v = (k) => { const m = new RegExp(`^${k} = (.*)$`, 'm').exec(body); return m ? JSON.parse(m[1]) : undefined; };
      // enabled_in "ua"/"chrome" forces it on in browser-internal sheets; web content still follows gecko_pref, so
      // it's internal only without one ("" is never parsed). See enabled_in in properties/data.py.
      const where = v('enabled_in') ?? 'content';
      if (v('engine') === 'servo' || where === '' || (where !== 'content' && !v('gecko_pref'))) continue;
      const s = state(v('gecko_pref'));
      css[name] = { state: s };
      // aliases and extra_gecko_aliases: "name" or "name:pref"; extra_prefixes: "webkit" or "moz:pref"
      for (const a of [...(v('aliases') || []), ...(v('extra_gecko_aliases') || [])]) {
        const [n, pref] = a.split(':');
        css[n] = { state: min(s, state(pref)), aliasOf: name };
      }
      for (const a of v('extra_prefixes') || []) {
        const [prefix, pref] = a.split(':');
        css[`-${prefix}-${name}`] = { state: min(s, state(pref)), aliasOf: name };
      }
    }
  }
  // nsHTMLTagList.inc: HTML_TAG(name, Interface, …) and HTML_HTMLELEMENT_TAG(name); HTML_OTHER is parser tokens
  // (text, comment, …), and an Unknown interface is a name that's only parsed
  const tags = (await get(RAW.gecko + 'parser/htmlparser/nsHTMLTagList.inc')).matchAll(/^HTML_(?:HTMLELEMENT_)?TAG\((\w+)(?!, Unknown)\b/gm);
  const elements = Object.fromEntries([...tags].map(([, n]) => [n, { state: 'on' }]));
  return { css, elements, attributes: {} };
}

const ENGINES = ['blink', 'webkit', 'gecko'];
const fetched = await Promise.all([blink(), webkit(), gecko()]);
const engines = Object.fromEntries(ENGINES.map((e, i) => [e, fetched[i]]));

// what VS Code's built-in data and the extension already have, and BCD's entries, per category
const builtinCss = load(path.join(mods, '@vscode/web-custom-data/data/browsers.css-data.json'));
const builtinHtml = load(path.join(mods, '@vscode/web-custom-data/data/browsers.html-data.json'));
const extCss = load(new URL('../extension/data/css.all.json', import.meta.url));
const extHtml = load(new URL('../extension/data/html.all.json', import.meta.url));
const attrNames = (data) => [...data.tags.flatMap((t) => t.attributes), ...data.globalAttributes].map((a) => a.name);
const bcd = load(path.join(mods, '@mdn/browser-compat-data/data.json'));
const CATEGORIES = {
  css: {
    title: 'CSS properties',
    vscode: builtinCss.properties.map((p) => p.name),
    extension: extCss.properties.map((p) => p.name),
    bcd: (n) => [bcd.css.properties[n]],
  },
  elements: {
    title: 'HTML elements',
    vscode: builtinHtml.tags.map((t) => t.name),
    extension: extHtml.tags.filter((t) => t.level).map((t) => t.name), // tags without a level only add attributes
    bcd: (n) => [bcd.html.elements[n]],
  },
  attributes: {
    title: 'HTML attributes',
    vscode: attrNames(builtinHtml),
    extension: attrNames(extHtml),
    bcd: (n) => [bcd.html.global_attributes[n], ...Object.values(bcd.html.elements).map((e) => e[n])],
  },
};

// browsers BCD says ship it unprefixed and unflagged, under any of its BCD entries; undefined when BCD has none
const bcdShips = (entries) => {
  const compats = entries.map((e) => e?.__compat).filter(Boolean);
  if (!compats.length) return undefined;
  const ships = ['chrome', 'firefox', 'safari'].filter((b) => compats.some((c) => [c.support[b]].flat()
    .some((x) => x?.version_added && x.version_added !== 'preview' && !x.flags && !x.prefix && !x.alternative_name && !x.version_removed)));
  return { ships, deprecated: compats.every((c) => c.status?.deprecated) || undefined };
};

const report = { generatedAt: new Date().toISOString() };
for (const [key, cat] of Object.entries(CATEGORIES)) {
  const vscode = new Set(cat.vscode);
  const extension = new Set(cat.extension);
  const names = [...new Set(ENGINES.flatMap((e) => Object.keys(engines[e][key])))].sort();
  const rows = names.map((name) => {
    const r = { name };
    for (const e of ENGINES) r[e] = engines[e][key][name]?.state;
    r.aliasOf = ENGINES.map((e) => engines[e][key][name]?.aliasOf).find(Boolean);
    r.best = max(...ENGINES.map((e) => r[e]));
    r.vscode = vscode.has(name);
    r.extension = extension.has(name);
    r.bcd = bcdShips(cat.bcd(name));
    return r;
  });
  // not vendor-specific (-webkit-foo, webkitfoo, onwebkitfoo, x-apple-foo) and not deprecated in BCD
  const gap = (r) => !/^(-|x-|webkit|onwebkit)/.test(r.name) && !r.bcd?.deprecated && !r.vscode && !r.extension;
  report[key] = {
    counts: Object.fromEntries(ENGINES.map((e) => [e, Object.values(engines[e][key]).reduce((c, p) => ({ ...c, [p.state]: (c[p.state] || 0) + 1 }), {})])),
    // unprefixed, on (or listed) in at least one engine, neither VS Code nor the extension has it
    missingOn: rows.filter((r) => gap(r) && RANK[r.best] === 2),
    // the same, but only in preview so far
    missingPreview: rows.filter((r) => gap(r) && r.best === 'preview'),
    // the extension adds it, but no engine has it on by default
    extensionNotOn: [...extension].map((n) => rows.find((r) => r.name === n) ?? { name: n }).filter((r) => RANK[r.best] !== 2),
    rows,
  };
}

const bcdText = (b) => (!b ? 'no entry' : `${b.ships.join(', ') || 'none ship'}${b.deprecated ? ', deprecated' : ''}`);
const fmt = (r) => `  ${r.name.padEnd(34)} ${ENGINES.map((e) => (r[e] ?? '-').padEnd(8)).join('')}${r.aliasOf ? `alias of ${r.aliasOf}; ` : ''}BCD: ${bcdText(r.bcd)}`;
const head = `  ${'name'.padEnd(34)} ${ENGINES.map((e) => e.padEnd(8)).join('')}`;
for (const [key, { title }] of Object.entries(CATEGORIES)) {
  const r = report[key];
  console.log(`\n=== ${title}\n${ENGINES.map((e) => `${e.padEnd(7)} ${Object.entries(r.counts[e]).map(([s, n]) => `${n} ${s}`).join(', ') || 'no list'}`).join('\n')}`);
  for (const [label, list] of [
    ['On in an engine, missing from VS Code and the extension', r.missingOn],
    ['In preview only, missing from VS Code and the extension', r.missingPreview],
    ['Added by the extension, but on by default in no engine', r.extensionNotOn],
  ]) console.log(`\n${label}: ${list.length}${list.length ? `\n${head}\n${list.map(fmt).join('\n')}` : ''}`);
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
