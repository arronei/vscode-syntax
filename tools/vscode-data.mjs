// VS Code's built-in HTML and CSS data: what the vscode-css-languageservice and vscode-html-languageservice npm
// releases bundle, at the versions the latest VS Code stable installs (its pnpm-lock.yaml). Each tarball comes from
// the npm registry and must match the sha512 in that lockfile, so the data is byte for byte what VS Code installed.
// Not language-service main, vscode-custom-data main or the @vscode/web-custom-data npm package: all run ahead of
// VS Code stable. On 2026-11-12 custom data 0.6.4 added text-fit and 27 more names, the gap report counted them as
// shipped, and extension 0.6.1 dropped them while VS Code still flagged them as unknown properties. On 2026-11-22
// language-service main took that data (7.0.0-next.3) while VS Code 1.147 still installed 7.0.0-next.2, and
// extension 0.6.7 dropped 14 properties and 39 hover descriptions VS Code didn't have yet.
// Looked up on every run, so the data is never older than VS Code stable. Anything that doesn't resolve throws:
// no build from data that couldn't be checked.
import crypto from 'crypto';
import zlib from 'zlib';

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};
const stable = JSON.parse(await get('https://update.code.visualstudio.com/api/releases/stable'))[0];
const lock = (await get(`https://raw.githubusercontent.com/microsoft/vscode/${stable}/pnpm-lock.yaml`)).toString();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fail = (msg) => { throw new Error(`VS Code ${stable}'s pnpm-lock.yaml: ${msg}`); };

// the version pnpm resolved for one dependency of one of VS Code's packages (its `importers:` entry)
const pinned = (importer, pkg) => {
  const entry = lock.slice(lock.indexOf(`\n  ${importer}:\n`)).match(/^\n.*\n(?:(?: {4}.*)?\n)*/)?.[0] ?? '';
  return entry.match(new RegExp(`\\n {6}${esc(pkg)}:\\n {8}specifier: .*\\n {8}version: ([^\\s(]+)`))?.[1] ?? fail(`no ${pkg} under ${importer}`);
};

// one file of the npm release, from the registry tarball the lockfile's integrity hash vouches for
const fromRelease = async (pkg, version, file) => {
  const integrity = lock.match(new RegExp(`\\n  ${esc(pkg)}@${esc(version)}:\\n {4}resolution: \\{integrity: (sha512-[^,}\\s]+)`))?.[1] ?? fail(`no integrity for ${pkg}@${version}`);
  const tgz = await get(`https://registry.npmjs.org/${pkg}/-/${pkg}-${version}.tgz`);
  const got = `sha512-${crypto.createHash('sha512').update(tgz).digest('base64')}`;
  if (got !== integrity) throw new Error(`${pkg}@${version}: the registry tarball is ${got}, VS Code's lockfile says ${integrity}`);
  const tar = zlib.gunzipSync(tgz);
  const str = (from, len) => tar.toString('utf8', from, from + len).replace(/\0.*$/s, '');
  for (let at = 0; at + 512 <= tar.length; ) {
    const name = [str(at + 345, 155), str(at, 100)].filter(Boolean).join('/'); // ustar prefix + name
    const size = parseInt(str(at + 124, 12), 8) || 0;
    if (name === `package/${file}`) return tar.toString('utf8', at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${pkg}@${version} has no ${file}`);
};
// the generated file: `export const cssData = { ...JSON... };`
const data = (js) => js.slice(js.indexOf(' = {') + 3, js.lastIndexOf('}') + 1);

export const baseline = {
  version: stable,
  'vscode-css-languageservice': pinned('extensions/css-language-features/server', 'vscode-css-languageservice'),
  'vscode-html-languageservice': pinned('extensions/html-language-features/server', 'vscode-html-languageservice'),
};
const [css, html] = (await Promise.all([
  fromRelease('vscode-css-languageservice', baseline['vscode-css-languageservice'], 'lib/esm/data/webCustomData.js'),
  fromRelease('vscode-html-languageservice', baseline['vscode-html-languageservice'], 'lib/esm/languageFacts/data/webCustomData.js'),
])).map(data);

export const builtinCss = () => JSON.parse(css);
export const builtinHtml = () => JSON.parse(html);
export const builtinVersion = () =>
  `VS Code ${stable} (vscode-css-languageservice ${baseline['vscode-css-languageservice']}, vscode-html-languageservice ${baseline['vscode-html-languageservice']})`;

// Throws unless `recorded` (the `vscode` field of a gap report or a generated additions file) names the language-service
// releases VS Code stable installs now, so no step builds on another step's older or newer idea of VS Code's data.
// The VS Code version may differ: a release that keeps the same language services has the same data.
export function assertBaseline(recorded, file, rerun) {
  for (const pkg of ['vscode-css-languageservice', 'vscode-html-languageservice']) {
    if (recorded?.[pkg] !== baseline[pkg]) {
      throw new Error(`${file} was made against ${pkg} ${recorded?.[pkg] ?? '(not recorded)'}, but VS Code ${stable} installs ${baseline[pkg]}. Run ${rerun} first.`);
    }
  }
}
