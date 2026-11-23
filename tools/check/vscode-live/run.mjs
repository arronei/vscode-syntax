// Launch real VS Code (downloaded by @vscode/test-electron) and compare completions, hovers and
// diagnostics with and without the extension.
//   node tools/check/vscode-live/run.mjs            -> runs both and prints a before/after table
// On Linux without a display, wrap it in `xvfb-run -a`.
import { runTests, downloadAndUnzipVSCode } from '@vscode/test-electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { builtinCss } from '../../vscode-data.mjs';

delete process.env.ELECTRON_RUN_AS_NODE; // inherited when launched from a VS Code extension host; makes Code.exe run as plain node
const here = path.dirname(fileURLToPath(import.meta.url));
// Copies of the workspace and the extension: the level checks make the extension rewrite its data files, and in CI a
// changed extension/data means a new release.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-live-'));
const ws = path.join(tmp, 'ws');
const extension = path.join(tmp, 'extension');
fs.cpSync(path.join(here, 'ws'), ws, { recursive: true });
fs.cpSync(path.resolve(here, '../../../extension'), extension, { recursive: true });
// every CSS property VS Code's data has plus every one the extension adds: with the extension, real VS Code must know
// them all (the "every property is known" check). Catches built-in data that isn't what VS Code really has.
const names = new Set([...builtinCss().properties, ...JSON.parse(fs.readFileSync(path.join(extension, 'data', 'css.css-data.json'), 'utf8')).properties].map((p) => p.name));
fs.writeFileSync(path.join(ws, 'all-properties.css'), `a {\n${[...names].map((n) => `  ${n}: initial;`).join('\n')}\n}\n`);
const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
const results = {};
for (const [name, ext] of [['without', path.join(here, 'no-extension')], ['with', extension]]) {
  const out = path.join(os.tmpdir(), `vscode-live-${name}.json`);
  const userData = path.join(os.tmpdir(), `vsud-${name}`); // keep short: the IPC socket path has a length limit
  fs.rmSync(userData, { recursive: true, force: true });
  await runTests({
    vscodeExecutablePath,
    extensionDevelopmentPath: ext,
    extensionTestsPath: path.join(here, 'suite.cjs'),
    launchArgs: [ws, `--user-data-dir=${userData}`, `--extensions-dir=${userData}-ext`, '--disable-extensions', '--disable-workspace-trust', '--no-sandbox', '--disable-gpu'],
    extensionTestsEnv: { TEST_WS: ws, TEST_OUT: out },
  });
  results[name] = JSON.parse(fs.readFileSync(out, 'utf8'));
}
const pad = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t.padEnd(n));
console.log(`VS Code ${results.with.vscode}\n`);
console.log(`${pad('Check', 52)} | ${pad('Without extension', 34)} | With extension`);
let failures = 0;
results.with.results.forEach((w, i) => {
  const wo = results.without.results[i];
  if (!w.ok) failures++;
  console.log(`${pad(w.label, 52)} | ${pad(wo.detail, 34)} | ${w.ok ? 'PASS' : 'FAIL'}  ${w.detail}`);
});
console.log(`\n${results.with.results.length - failures}/${results.with.results.length} checks pass with the extension`);
process.exitCode = failures ? 1 : 0;
