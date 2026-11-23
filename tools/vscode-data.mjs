// VS Code's built-in HTML and CSS data: what the vscode-css-languageservice and vscode-html-languageservice npm
// releases bundle, at the versions the latest VS Code stable installs (its pnpm-lock.yaml).
// Not language-service main, vscode-custom-data main or the @vscode/web-custom-data npm package: all run ahead of
// VS Code stable. On 2026-11-12 custom data 0.6.4 added text-fit and 27 more names, the gap report counted them as
// shipped, and extension 0.6.1 dropped them while VS Code still flagged them as unknown properties. On 2026-11-22
// language-service main took that data (7.0.0-next.3) while VS Code 1.147 still installed 7.0.0-next.2, and
// extension 0.6.7 dropped 14 properties and 39 hover descriptions VS Code didn't have yet.
// TODO: arronei: every run reads the network (VS Code's update service, GitHub, jsDelivr). Cache the data by
// version if builds need to work offline.
const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
};
const stable = JSON.parse(await get('https://update.code.visualstudio.com/api/releases/stable'))[0];
const lock = await get(`https://raw.githubusercontent.com/microsoft/vscode/${stable}/pnpm-lock.yaml`);

// the version pnpm resolved for one dependency of one of VS Code's packages (its `importers:` entry)
const pinned = (importer, pkg) => {
  const entry = lock.slice(lock.indexOf(`\n  ${importer}:\n`)).match(/^\n.*\n(?:(?: {4}.*)?\n)*/)?.[0] ?? '';
  const version = entry.match(new RegExp(`\\n {6}${pkg}:\\n {8}specifier: .*\\n {8}version: ([^\\s(]+)`))?.[1];
  if (!version) throw new Error(`VS Code ${stable}'s pnpm-lock.yaml has no ${pkg} under ${importer}`);
  return version;
};
const cssVersion = pinned('extensions/css-language-features/server', 'vscode-css-languageservice');
const htmlVersion = pinned('extensions/html-language-features/server', 'vscode-html-languageservice');

// jsDelivr serves the npm release's files. The generated file: `export const cssData = { ...JSON... };`
const data = async (pkg, version, file) => {
  const js = await get(`https://cdn.jsdelivr.net/npm/${pkg}@${version}/${file}`);
  return js.slice(js.indexOf(' = {') + 3, js.lastIndexOf('}') + 1);
};
const [css, html] = await Promise.all([
  data('vscode-css-languageservice', cssVersion, 'lib/esm/data/webCustomData.js'),
  data('vscode-html-languageservice', htmlVersion, 'lib/esm/languageFacts/data/webCustomData.js'),
]);

export const builtinCss = () => JSON.parse(css);
export const builtinHtml = () => JSON.parse(html);
export const builtinVersion = () =>
  `VS Code ${stable} (vscode-css-languageservice ${cssVersion}, vscode-html-languageservice ${htmlVersion})`;
