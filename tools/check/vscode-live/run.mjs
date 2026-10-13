// Launch real VS Code (downloaded by @vscode/test-electron) and compare completions, hovers and
// diagnostics with and without the extension.
//   node tools/check/vscode-live/run.mjs            -> runs both and prints a before/after table
// On Linux without a display, wrap it in `xvfb-run -a`.
import { runTests, downloadAndUnzipVSCode } from '@vscode/test-electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ws = path.join(here, 'ws');
const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
const results = {};
for (const [name, ext] of [['without', path.join(here, 'no-extension')], ['with', path.resolve(here, '../../../extension')]]) {
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
