// Setup, update and the full run. The single steps are the other package.json scripts.
//
//   npm run setup     new machine: clone missing sibling repos, install and compile them, then update
//   npm run update    before a run: latest data sources, fetch upstream in the sibling repos
//   npm run all       gap-report, build-extension, check-vscode
//   npm run build-site   the GitHub Pages site, in _site/
//
// Also used by the step scripts: `warn` (last update more than STALE_HOURS old) and `archive` (dated copy of the
// gap report, plus what changed). Uses only Node built-ins, so setup works before npm install.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.dirname(root);
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
function sh(cmd, cwd = root) {
  console.log(`\n> ${cmd}${cwd === root ? '' : `   (in ${path.relative(parent, cwd)})`}`);
  try { execSync(cmd, { cwd, stdio: 'inherit' }); } catch (e) { console.error(`\nfailed: ${cmd}`); process.exit(e.status || 1); }
}

// ponytail: fork owner hard-coded, this is a personal repo. Make it an argument if someone else sets it up.
const SIBLINGS = [
  { dir: 'vscode-custom-data', fork: 'arronei/vscode-custom-data', upstream: 'microsoft/vscode-custom-data', npm: 'web-data' },
  { dir: 'mdn-data', fork: 'arronei/mdn-data', upstream: 'mdn/data', npm: '.' },
  { dir: 'vscode-css-languageservice', fork: 'arronei/vscode-css-languageservice', upstream: 'microsoft/vscode-css-languageservice', npm: '.', compile: true },
  { dir: 'vscode-html-languageservice', fork: 'arronei/vscode-html-languageservice', upstream: 'microsoft/vscode-html-languageservice', npm: '.', compile: true },
];
const DATA = ['@mdn/browser-compat-data', '@vscode/web-custom-data', '@webref/css', '@webref/elements', 'browser-specs', 'mdn-data', 'web-features'];
const PIPELINE = ['gap-report', 'build-extension', 'check-vscode'];
const STAMP = path.join(root, '.last-update');
const STALE_HOURS = 12;
const github = (repo) => `https://github.com/${repo}.git`;

function setup() {
  for (const s of SIBLINGS) {
    const dir = path.join(parent, s.dir);
    if (!fs.existsSync(dir)) sh(`git clone ${github(s.fork)} ${s.dir}`, parent);
    if (!execSync('git remote', { cwd: dir, encoding: 'utf8' }).split(/\s+/).includes('upstream')) sh(`git remote add upstream ${github(s.upstream)}`, dir);
    sh('npm install', path.join(dir, s.npm));
    if (s.compile) sh('npx tsc -p ./src', dir); // just the build the checks need; the repo's `compile` also lints
  }
  sh('npm install');
  update();
}

function update() {
  for (const s of SIBLINGS) {
    const dir = path.join(parent, s.dir);
    if (fs.existsSync(dir)) sh('git fetch -q upstream', dir);
    else console.warn(yellow(`missing ../${s.dir}: run "npm run setup"`));
  }
  const versions = () => Object.fromEntries(DATA.map((p) => [p, fs.existsSync(path.join(root, 'node_modules', p)) ? readJSON(path.join(root, 'node_modules', p, 'package.json')).version : undefined]));
  const before = versions();
  sh(`npm install -D ${DATA.map((p) => `${p}@latest`).join(' ')}`);
  const after = versions();
  const major = (v) => v?.split('.')[0];
  const changed = DATA.filter((p) => before[p] !== after[p]);
  console.log(changed.length
    ? '\nData sources updated:\n' + changed.map((p) => `  ${p} ${before[p] ?? '-'} → ${after[p]}${major(before[p]) !== major(after[p]) ? yellow('  major version: watch the next run for errors') : ''}`).join('\n')
    : '\nData sources already current.');
  fs.writeFileSync(STAMP, JSON.stringify({ at: new Date().toISOString(), versions: after }, null, 2) + '\n');
}

function warn() {
  if (process.env.VSCODE_SYNTAX_WARNED) return; // `all` already warned
  const at = fs.existsSync(STAMP) ? new Date(readJSON(STAMP).at) : undefined;
  const hours = at ? (Date.now() - at) / 36e5 : Infinity;
  if (hours > STALE_HOURS) console.warn(yellow(`\n⚠ ${at ? `Last update was ${Math.round(hours)} hours ago (${at.toISOString().slice(0, 10)})` : 'No update has been run on this machine'}. Run "npm run update" first for current data.\n`));
}

function all() {
  warn();
  process.env.VSCODE_SYNTAX_WARNED = '1';
  for (const step of PIPELINE) sh(`npm run ${step}`);
  console.log('\nNext: look over the results, see docs/review-results.md');
}

// Keep a dated copy of reports/latest.json and list what changed since the previous dated report.
function archive() {
  const dir = path.join(root, 'reports');
  const latest = readJSON(path.join(dir, 'latest.json'));
  const name = `gap-report-${latest.generatedAt.slice(0, 10)}.json`;
  const prev = fs.readdirSync(dir).filter((f) => /^gap-report-\d{4}-\d\d-\d\d\.json$/.test(f) && f < name).sort().at(-1);
  fs.copyFileSync(path.join(dir, 'latest.json'), path.join(dir, name));
  console.log(`\nsaved reports/${name}`);
  if (!prev) return;
  const old = readJSON(path.join(dir, prev));
  const lines = [];
  for (const k of Object.keys(latest.gaps)) {
    const was = new Set((old.gaps[k] || []).map((e) => e.name));
    const now = new Set(latest.gaps[k].map((e) => e.name));
    for (const e of latest.gaps[k]) if (!was.has(e.name) && e.priority !== 'P3') lines.push(`  new   ${e.priority} ${e.name}`);
    for (const e of old.gaps[k] || []) if (!now.has(e.name)) lines.push(`  gone  ${e.priority} ${e.name}`);
  }
  console.log(`\nP1/P2 changes since ${prev}:\n${lines.join('\n') || '  none'}`);
}

// The GitHub Pages site in _site/: site/index.html, the data it reads, and the packaged extension.
// .github/workflows/pages.yml runs this on every push to main.
function site() {
  const out = path.join(root, '_site');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out);
  fs.copyFileSync(path.join(root, 'site', 'index.html'), path.join(out, 'index.html'));
  fs.copyFileSync(path.join(root, 'reports', 'latest.json'), path.join(out, 'latest.json'));
  fs.copyFileSync(path.join(root, 'extension', 'package.json'), path.join(out, 'extension.json'));
  sh(`npx -y @vscode/vsce@3 package --skip-license --allow-missing-repository --no-rewrite-relative-links --out ${JSON.stringify(path.join(out, 'web-spec-additions.vsix'))}`, path.join(root, 'extension'));
  console.log(`\nsite written to _site/. Preview: npx -y serve _site`);
}

const commands = { setup, update, all, warn, archive, site };
const cmd = commands[process.argv[2]];
if (!cmd) { console.error(`usage: node tools/cli.mjs ${Object.keys(commands).join(' | ')}`); process.exit(2); }
cmd();
