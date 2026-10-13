// Two jobs:
//
// 1. Data levels. data/css.all.json and data/html.all.json hold everything the extension can add, each item
//    tagged baseline, standard, draft or proprietary (tools/levels.mjs). The webSpecAdditions.* settings pick
//    which of them to use; this writes that subset to the data/*-data.json files package.json contributes.
//    VS Code reads those when its CSS and HTML language servers start, so a change needs a window reload.
//
// 2. Hover text for built-in CSS properties that VS Code ships without a description. Custom data can add new
//    CSS properties but can't change built-in ones: the CSS service keeps the first definition of each name,
//    and the built-in data is loaded first. So for built-in properties whose description is empty (they show
//    no hover at all), this provider supplies one from data/css-hover.json.
//    Entries disappear from that file automatically once VS Code ships a description (npm run build-extension).
const fs = require('fs');
const path = require('path');

const RANK = { baseline: 1, standard: 2, draft: 3 };

// The data at one setting: items up to `level` (off adds nothing), plus proprietary ones if asked for.
// tools/build-extension.mjs also calls this, to write the defaults, so it must not need `vscode`.
function filterData(data, level, proprietary) {
  const max = RANK[level] || 0;
  const keep = (e) => !e.level || (e.level === 'proprietary' ? max > 0 && proprietary : RANK[e.level] <= max);
  if (!data.tags) {
    return { ...data, properties: data.properties.filter(keep), atDirectives: data.atDirectives.filter(keep), pseudoClasses: data.pseudoClasses.filter(keep), pseudoElements: data.pseudoElements.filter(keep) };
  }
  // tags without a level are built-in elements we only add attributes to: drop them when no attribute is left
  const tags = data.tags.filter(keep).map((t) => ({ ...t, attributes: t.attributes.filter(keep) })).filter((t) => t.description || t.attributes.length);
  return { ...data, tags, globalAttributes: data.globalAttributes.filter(keep) };
}

function activate(context) {
  const vscode = require('vscode');
  const dir = path.join(context.extensionPath, 'data');
  const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const setting = (lang, key) => vscode.workspace.getConfiguration(`webSpecAdditions.${lang}`).get(key);
  // what this window's language servers read at startup
  const loaded = { css: read('css.css-data.json'), html: read('html.html-data.json') };

  function applyLevels() {
    try {
      let reload = false;
      for (const lang of ['css', 'html']) {
        const file = `${lang}.${lang}-data.json`;
        const wanted = filterData(read(`${lang}.all.json`), setting(lang, 'level'), setting(lang, 'proprietary'));
        if (!same(read(file), wanted)) fs.writeFileSync(path.join(dir, file), JSON.stringify(wanted, null, 2) + '\n');
        reload ||= !same(loaded[lang], wanted);
      }
      if (reload) {
        vscode.window.showInformationMessage('Web Spec Additions: reload the window to use the new data level.', 'Reload Window')
          .then((pick) => pick && vscode.commands.executeCommand('workbench.action.reloadWindow'));
      }
    } catch (e) {
      // ponytail: writes into the extension folder, which works for local installs. Remote/web would need the
      // language servers to read data from globalStorage instead.
      vscode.window.showWarningMessage(`Web Spec Additions couldn't switch data level: ${e.message}`);
    }
  }
  applyLevels();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('webSpecAdditions') && applyLevels()));

  const entries = read('css-hover.json');
  if (!Object.keys(entries).length) return;
  const provider = {
    provideHover(document, position) {
      if (setting('css', 'level') === 'off') return undefined;
      const range = document.getWordRangeAtPosition(position, /-?[a-zA-Z][\w-]*/);
      if (!range) return undefined;
      const name = document.getText(range);
      const entry = entries[name];
      if (!entry) return undefined;
      // only property names in declarations: the name must be followed by a colon
      const rest = document.lineAt(range.end.line).text.slice(range.end.character);
      if (!/^\s*:/.test(rest)) return undefined;
      const md = new vscode.MarkdownString(entry.description);
      if (entry.syntax) md.appendMarkdown(`\n\nSyntax: \`${entry.syntax}\``);
      if (entry.references?.length) md.appendMarkdown('\n\n' + entry.references.map((r) => `[${r.name}](${r.url})`).join(' | '));
      return new vscode.Hover(md, range);
    },
  };
  context.subscriptions.push(vscode.languages.registerHoverProvider(['css', 'scss', 'less'], provider));
}

module.exports = { activate, deactivate() {}, filterData };
