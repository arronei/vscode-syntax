// Add (or update) a CSS property in an mdn/data checkout, keeping its formatting and ordering.
// Usage: node add-property.mjs <mdn-data dir> <property.json>
// property.json: { "name": "...", "entry": { ...properties.json fields... },
//                  "l10n": { "<newKey>": { "en-US": "..." } }, "schemaEnums": { "appliesto": ["<newKey>"] } }
import fs from 'fs';
import path from 'path';
const [root, specFile] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const rd = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const wr = (f, o) => fs.writeFileSync(path.join(root, f), JSON.stringify(o, null, 2) + '\n');

// Insert `name` into an existing key order without reordering anything else: put it at the first
// position where it sorts between its neighbours (the files are mostly, not strictly, sorted).
function insertKey(keys, name) {
  if (keys.includes(name)) return keys;
  const lc = (x) => x.toLowerCase();
  let idx = keys.findIndex((k, i) => lc(k) > lc(name) && (i === 0 || lc(keys[i - 1]) < lc(name)));
  if (idx === -1) idx = keys.length;
  return [...keys.slice(0, idx), name, ...keys.slice(idx)];
}

// properties.json
const props = rd('css/properties.json');
const order = insertKey(Object.keys(props), spec.name);
props[spec.name] = spec.entry;
wr('css/properties.json', Object.fromEntries(order.map((k) => [k, props[k]])));

// l10n/css.json: add new keys, keep the existing key order and slot the new key alphabetically
if (spec.l10n) {
  const l10n = rd('l10n/css.json');
  let keys = Object.keys(l10n);
  for (const [k, v] of Object.entries(spec.l10n)) {
    if (l10n[k]) continue;
    keys = insertKey(keys, k);
    l10n[k] = v;
  }
  wr('l10n/css.json', Object.fromEntries(keys.map((k) => [k, l10n[k]])));
}

// properties.schema.json: register new l10n keys in the matching enum (appliesto, computed, ...)
if (spec.schemaEnums) {
  const schema = rd('css/properties.schema.json');
  for (const [def, add] of Object.entries(spec.schemaEnums)) {
    let list = schema.definitions[def].enum;
    for (const k of add) list = insertKey(list, k);
    schema.definitions[def].enum = list;
  }
  wr('css/properties.schema.json', schema);
}
console.log(`added ${spec.name}`);
