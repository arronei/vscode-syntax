// Apply a declarative additions file to a vscode-custom-data checkout.
// Usage: node apply-html-additions.mjs <additions.json> <path to vscode-custom-data/web-data>
//
// Edits web-data/html/htmlTags.json, mdnTagDescriptions.json and valueSets.json in place,
// keeping the repo's formatting (2-space JSON, trailing newline). Idempotent: running it twice
// changes nothing the second time.
import fs from 'fs';
import path from 'path';

const [additionsFile, webData] = process.argv.slice(2);
if (!additionsFile || !webData) {
  console.error('usage: node apply-html-additions.mjs <additions.json> <web-data dir>');
  process.exit(2);
}
const additions = JSON.parse(fs.readFileSync(additionsFile, 'utf8'));
const file = (n) => path.join(webData, 'html', n);
const read = (n) => JSON.parse(fs.readFileSync(file(n), 'utf8'));
const write = (n, data) => fs.writeFileSync(file(n), JSON.stringify(data, null, 2) + '\n');

const tags = read('htmlTags.json');
const descs = read('mdnTagDescriptions.json');
const valueSets = read('valueSets.json');
const log = [];

const md = (value) => ({ kind: 'markdown', value });

for (const vs of additions.valueSets || []) {
  if (valueSets.some((s) => s.name === vs.name)) { log.push(`valueSet ${vs.name}: already present`); continue; }
  valueSets.push({
    name: vs.name,
    values: vs.values.map((v) => (v.description ? { name: v.name, description: md(v.description) } : { name: v.name })),
  });
  log.push(`valueSet ${vs.name}: added (${vs.values.length} values)`);
}

for (const edit of additions.valueSetEdits || []) {
  const set = valueSets.find((s) => s.name === edit.name);
  if (!set) throw new Error(`valueSet ${edit.name} not found`);
  for (const [name, text] of Object.entries(edit.values)) {
    const v = set.values.find((x) => x.name === name);
    if (!v) throw new Error(`value ${edit.name}.${name} not found`);
    if (v.description?.value !== text) { v.description = md(text); log.push(`valueSet ${edit.name}.${name}: description updated`); }
  }
}

const knownSets = new Set(['v', ...valueSets.map((s) => s.name)]);
for (const a of additions.attributes) {
  const tag = tags.find((t) => t.name === a.tag);
  if (!tag) throw new Error(`tag <${a.tag}> not in htmlTags.json`);
  if (a.valueSet && !knownSets.has(a.valueSet)) throw new Error(`unknown valueSet ${a.valueSet} for ${a.tag}.${a.name}`);

  if (tag.attributes.some((x) => x.name === a.name)) {
    log.push(`<${a.tag} ${a.name}>: already in htmlTags.json`);
  } else {
    tag.attributes.push(a.valueSet ? { name: a.name, valueSet: a.valueSet } : { name: a.name });
    log.push(`<${a.tag} ${a.name}>: added to htmlTags.json`);
  }

  let td = descs.find((t) => t.name === a.tag);
  if (!td) { td = { name: a.tag, attributes: [] }; descs.push(td); }
  if (!td.attributes.some((x) => x.name === a.name)) {
    td.attributes.push({ name: a.name, description: a.description });
    log.push(`<${a.tag} ${a.name}>: description added`);
  }
}

write('htmlTags.json', tags);
write('mdnTagDescriptions.json', descs);
write('valueSets.json', valueSets);
console.log(log.join('\n'));
