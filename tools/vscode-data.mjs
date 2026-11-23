// VS Code's built-in HTML and CSS data: what vscode-css-languageservice and vscode-html-languageservice bundle,
// read from upstream/main of the sibling checkouts (../vscode-*-languageservice; npm run update fetches them).
// Not vscode-custom-data main or the @vscode/web-custom-data npm package: both run ahead of VS Code. On 2026-11-12
// custom data 0.6.4 added text-fit and 27 more names the language services didn't have yet, the gap report counted
// them as shipped, and extension 0.6.1 dropped them while VS Code still flagged them as unknown properties.
// TODO: arronei: language-service main can still be a release ahead of VS Code stable. If that gap bites, read the
// version vscode's extensions/{css,html}-language-features/server/package.json pins instead.
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const parent = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromMain = (repo, file) => {
  const ts = execFileSync('git', ['-C', path.join(parent, repo), 'show', `upstream/main:${file}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
  // generated file: `export const cssData : CSSDataV1 = { ...JSON... };`
  return JSON.parse(ts.slice(ts.indexOf(' = {') + 3, ts.lastIndexOf('}') + 1));
};
// the @vscode/web-custom-data range the language service's data was generated from
const dataVersion = (repo) => JSON.parse(execFileSync('git', ['-C', path.join(parent, repo), 'show', 'upstream/main:package.json'], { encoding: 'utf8' })).devDependencies['@vscode/web-custom-data'];

export const builtinCss = () => fromMain('vscode-css-languageservice', 'src/data/webCustomData.ts');
export const builtinHtml = () => fromMain('vscode-html-languageservice', 'src/languageFacts/data/webCustomData.ts');
export const builtinVersion = () => `vscode-css-languageservice (@vscode/web-custom-data ${dataVersion('vscode-css-languageservice')})`;
