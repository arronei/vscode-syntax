// CSS properties straight from the browser engines' source: what Blink, WebKit and Gecko turn on by default on
// their main branch, what's in preview, and what sits behind a flag. BCD records a feature once it ships in a
// release; the engines' own property lists show it the day it lands, and show names BCD files under another key.
// Usage: node engines.mjs <node_modules dir with latest sources> [out.json]
//
//   on       enabled by default on main: in the next release, if not already shipped
//   preview  Blink "experimental" (Experimental Web Platform features flag), WebKit "preview" (Safari Technology
//            Preview), Gecko Nightly-only
//   flag     anything else behind a flag
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
const RANK = { flag: 0, preview: 1, on: 2 };
const min = (...s) => s.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));
const max = (...s) => s.filter(Boolean).reduce((a, b) => (RANK[a] >= RANK[b] ? a : b), undefined);

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
  const out = {};
  for (const p of props) {
    if (/^-(internal|alternative)-/.test(p.name) || p.is_property === false) continue; // is_property: false = at-rule descriptor only
    const flagsOn = [p.runtime_flag, byName.get(p.alias_for)?.runtime_flag].filter(Boolean);
    out[p.name] = { state: min('on', ...flagsOn.map(flag)), aliasOf: p.alias_for };
  }
  return out;
}

async function webkit() {
  // UnifiedWebPreferences.yaml: a `Name:` line per setting, its fields indented below it
  const prefs = {};
  const yaml = await get(RAW.webkit + 'WTF/Scripts/Preferences/UnifiedWebPreferences.yaml');
  for (const [, name, body] of yaml.matchAll(/^(\w+):\n((?:[ \t].*\n|\n)*)/gm)) prefs[name.toLowerCase()] = /^ {2}status: (\w+)/m.exec(body)?.[1];
  const props = JSON.parse(await get(RAW.webkit + 'WebCore/css/CSSProperties.json')).properties;
  const out = {};
  for (const [name, p] of Object.entries(props)) {
    const cg = [].concat(p['codegen-properties'] || {});
    if (cg.some((c) => c['internal-only'])) continue;
    // settings-flag is lowerCamel (cssFooEnabled), the preference UpperCamel (CSSFooEnabled)
    const setting = cg.find((c) => c['settings-flag'])?.['settings-flag'];
    // ponytail: a Foo_feature_status macro is Stable on the ports that build the feature (WebKit/Shared/WebPreferencesDefaultValues.h),
    // so it counts as on; evaluate those #ifs if a port-specific feature ever shows up wrongly here
    const status = prefs[setting?.toLowerCase()];
    const state = !setting ? 'on' : { stable: 'on', mature: 'on', preview: 'preview' }[status] ?? (/_feature_status$/.test(status) ? 'on' : 'flag');
    out[name] = { state };
    for (const a of cg.flatMap((c) => c.aliases || [])) out[a] = { state, aliasOf: name };
  }
  return out;
}

async function gecko() {
  const prefs = {};
  const yaml = await get(RAW.gecko + 'modules/libpref/init/StaticPrefList.yaml');
  for (const [, name, value] of yaml.matchAll(/^- name: (\S+)\n(?: {2}.*\n)*? {2}value: (.*)/gm)) prefs[name] = value.replace(/\s*#.*/, '').trim();
  const state = (pref) => (!pref || prefs[pref] === 'true' ? 'on'
    : /^@IS_(NIGHTLY_BUILD|EARLY_BETA_OR_EARLIER|NOT_RELEASE_OR_BETA)@$/.test(prefs[pref]) ? 'preview' : 'flag');
  const out = {};
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
      out[name] = { state: s };
      // aliases and extra_gecko_aliases: "name" or "name:pref"; extra_prefixes: "webkit" or "moz:pref"
      for (const a of [...(v('aliases') || []), ...(v('extra_gecko_aliases') || [])]) {
        const [n, pref] = a.split(':');
        out[n] = { state: min(s, state(pref)), aliasOf: name };
      }
      for (const a of v('extra_prefixes') || []) {
        const [prefix, pref] = a.split(':');
        out[`-${prefix}-${name}`] = { state: min(s, state(pref)), aliasOf: name };
      }
    }
  }
  return out;
}

const ENGINES = ['blink', 'webkit', 'gecko'];
const engines = Object.fromEntries(ENGINES.map((e, i) => [e, [blink, webkit, gecko][i]()]));
for (const e of ENGINES) engines[e] = await engines[e];

const vscode = new Set(load(path.join(mods, '@vscode/web-custom-data/data/browsers.css-data.json')).properties.map((p) => p.name));
const extension = new Set(load(new URL('../extension/data/css.all.json', import.meta.url)).properties.map((p) => p.name));
const bcd = load(path.join(mods, '@mdn/browser-compat-data/data.json')).css.properties;
// browsers BCD says ship it unprefixed and unflagged; undefined when BCD has no entry under this name
const bcdShips = (name) => {
  const c = bcd[name]?.__compat;
  return c && ['chrome', 'firefox', 'safari'].filter((b) => [c.support[b]].flat()
    .some((x) => x?.version_added && x.version_added !== 'preview' && !x.flags && !x.prefix && !x.alternative_name && !x.version_removed));
};

const names = [...new Set(ENGINES.flatMap((e) => Object.keys(engines[e])))].sort();
const rows = names.map((name) => {
  const r = { name };
  for (const e of ENGINES) r[e] = engines[e][name]?.state;
  r.aliasOf = ENGINES.map((e) => engines[e][name]?.aliasOf).find(Boolean);
  r.best = max(...ENGINES.map((e) => r[e]));
  r.vscode = vscode.has(name);
  r.extension = extension.has(name);
  r.bcd = bcdShips(name);
  return r;
});
const unprefixedGap = (r) => !r.name.startsWith('-') && !r.vscode && !r.extension;
const report = {
  generatedAt: new Date().toISOString(),
  counts: Object.fromEntries(ENGINES.map((e) => [e, Object.fromEntries(Object.keys(RANK).map((s) => [s, Object.values(engines[e]).filter((p) => p.state === s).length]))])),
  // unprefixed, on in at least one engine, neither VS Code nor the extension has it
  missingOn: rows.filter((r) => unprefixedGap(r) && r.best === 'on'),
  // the same, but only in preview so far
  missingPreview: rows.filter((r) => unprefixedGap(r) && r.best === 'preview'),
  // the extension adds it, but no engine has it on by default
  extensionNotOn: [...extension].map((n) => rows.find((r) => r.name === n) ?? { name: n }).filter((r) => r.best !== 'on'),
  properties: rows,
};

const fmt = (r) => `  ${r.name.padEnd(34)} ${ENGINES.map((e) => (r[e] ?? '-').padEnd(8)).join('')}${r.aliasOf ? `alias of ${r.aliasOf}; ` : ''}BCD: ${r.bcd ? r.bcd.join(', ') || 'none ship' : 'no entry'}`;
const head = `  ${'property'.padEnd(34)} ${ENGINES.map((e) => e.padEnd(8)).join('')}`;
for (const e of ENGINES) console.log(`${e.padEnd(7)} ${Object.entries(report.counts[e]).map(([s, n]) => `${n} ${s}`).join(', ')}`);
for (const [title, list] of [
  ['On in an engine, missing from VS Code and the extension', report.missingOn],
  ['In preview only, missing from VS Code and the extension', report.missingPreview],
  ['Added by the extension, but on by default in no engine', report.extensionNotOn],
]) console.log(`\n${title}: ${list.length}\n${list.length ? `${head}\n${list.map(fmt).join('\n')}` : ''}`);
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
