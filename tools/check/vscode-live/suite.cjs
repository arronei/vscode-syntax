// Runs inside VS Code's extension host. Executes the checks in ws/checks.json and writes the results.
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const labelOf = (x) => (typeof x.label === 'string' ? x.label : x.label.label);

async function completions(uri, pos) {
  for (let i = 0; i < 30; i++) {
    const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', uri, pos);
    // ignore word-based suggestions (words already in the file), keep language-server results
    const items = (list?.items || []).filter((x) => x.kind !== vscode.CompletionItemKind.Text).map(labelOf);
    if (items.length) return items;
    await sleep(1000);
  }
  return [];
}
async function hoverText(uri, pos) {
  const hs = await vscode.commands.executeCommand('vscode.executeHoverProvider', uri, pos);
  return (hs || []).flatMap((h) => h.contents.map((c) => (typeof c === 'string' ? c : c.value))).join(' ').replace(/!\[[^\]]*\]\([^)]*\)/g, '[badge]').replace(/\\/g, '');
}

// Switch a data-level setting, then read the data file the extension rewrote: every item in it must be at one of
// c.levels, and there must be some unless c.levels is empty. Restores the setting, and with it the file.
async function levelCheck(c) {
  const config = vscode.workspace.getConfiguration();
  const ext = vscode.extensions.all.find((e) => e.packageJSON.name === 'web-spec-additions');
  try {
    await config.update(c.setting, c.value, vscode.ConfigurationTarget.Global);
    await sleep(1000);
    const d = JSON.parse(fs.readFileSync(path.join(ext.extensionPath, 'data', c.data), 'utf8'));
    const tags = d.tags || [];
    const items = [d.properties, d.atDirectives, d.pseudoClasses, d.pseudoElements, tags, tags.flatMap((t) => t.attributes), d.globalAttributes].flat().filter((e) => e?.level);
    const wrong = items.filter((e) => !c.levels.includes(e.level));
    const ok = !wrong.length && (items.length > 0) === (c.levels.length > 0);
    return { label: c.label, ok, detail: wrong.length ? `also ${wrong[0].level}: ${wrong[0].name}` : `${items.length} items` };
  } catch {
    return { label: c.label, ok: false, detail: '(no setting)' };
  } finally {
    await config.update(c.setting, undefined, vscode.ConfigurationTarget.Global).then(() => sleep(1000), () => {});
  }
}

exports.run = async function () {
  const ws = process.env.TEST_WS;
  const checks = JSON.parse(fs.readFileSync(path.join(ws, 'checks.json'), 'utf8'));
  const out = { vscode: vscode.version, results: [] };
  const opened = new Set();
  for (const c of checks) {
    if (c.op === 'level') { out.results.push(await levelCheck(c)); continue; }
    const uri = vscode.Uri.file(path.join(ws, c.file));
    const doc = await vscode.workspace.openTextDocument(uri);
    if (!opened.has(c.file)) { await vscode.window.showTextDocument(doc); opened.add(c.file); await sleep(1500); }
    const pos = c.line !== undefined ? new vscode.Position(c.line, doc.lineAt(c.line).text.indexOf(c.find) + (c.offset || 0)) : undefined;
    const r = { label: c.label };
    if (c.op === 'complete') {
      const items = await completions(uri, pos);
      const found = c.expect.filter((e) => items.includes(e));
      r.ok = found.length === c.expect.length;
      r.detail = found.length ? found.join(', ') : '(none)';
    } else if (c.op === 'count') {
      const n = (await completions(uri, pos)).filter((l) => l === c.label_equals).length;
      r.ok = true;
      r.detail = `${n}×`;
    } else if (c.op === 'hover') {
      const text = await hoverText(uri, pos);
      r.ok = text.includes(c.contains);
      r.detail = text ? text.replace(/\s+/g, ' ').slice(0, 70) + '…' : '(none)';
    } else if (c.op === 'diagnostics') {
      await sleep(2500);
      const bad = vscode.languages.getDiagnostics(uri).map((d) => d.message).filter((m) => new RegExp(c.absent).test(m));
      r.ok = bad.length === 0;
      r.detail = bad.length ? bad.join('; ') : 'none';
    } else if (c.op === 'scope') {
      // VS Code's own grammar-test command: every token in the file with its TextMate scopes
      const tokens = await vscode.commands.executeCommand('_workbench.captureSyntaxTokens', uri);
      const t = tokens.find((t) => t.c === c.find);
      r.ok = !!t?.t.split(' ').includes(c.scope);
      r.detail = t ? t.t.split(' ').at(-1) : '(no token)';
    }
    out.results.push(r);
  }
  fs.writeFileSync(process.env.TEST_OUT, JSON.stringify(out, null, 2));
};
