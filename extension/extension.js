// Hover text for built-in CSS properties that VS Code ships without a description.
//
// Everything else in this extension is declarative custom data (package.json "contributes"). Custom data
// can add new CSS properties but can't change built-in ones: the CSS service keeps the first definition
// of each name, and the built-in data is loaded first. So for built-in properties whose description is
// empty (they show no hover at all), this provider supplies one from data/css-hover.json.
// Entries disappear from that file automatically once VS Code ships a description (npm run build-extension).
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
  const file = path.join(context.extensionPath, 'data', 'css-hover.json');
  const entries = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (!Object.keys(entries).length) return;

  const provider = {
    provideHover(document, position) {
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

module.exports = { activate, deactivate() {} };
