// Ask a built vscode-html-languageservice for completions/hover at the | cursor.
// Usage: node completion-check.mjs <path to vscode-html-languageservice (compiled)> [custom data file]
// With a custom data file, the data is layered on top of the built-in data the way VS Code does it.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const lsRoot = process.argv[2] || '../vscode-html-languageservice';
const { getLanguageService, getDefaultHTMLDataProvider, newHTMLDataProvider, TextDocument } = await import(pathToFileURL(path.resolve(lsRoot, 'lib/esm/htmlLanguageService.js')).href);
const dataFile = process.argv[3];
const ls = dataFile
  ? getLanguageService({ useDefaultDataProvider: false, customDataProviders: [getDefaultHTMLDataProvider(), newHTMLDataProvider('additions', JSON.parse(fs.readFileSync(dataFile, 'utf8')))] })
  : getLanguageService();
function at(src) {
  const offset = src.indexOf('|');
  const text = src.replace('|', '');
  const doc = TextDocument.create('test://t.html', 'html', 0, text);
  return { doc, pos: doc.positionAt(offset), html: ls.parseHTMLDocument(doc) };
}
const cases = [
  ['<button comm|', ['command', 'commandfor']],
  ['<button command="|"', ['show-modal', 'close', 'request-close', 'show-popover', 'hide-popover', 'toggle-popover']],
  ['<template shadowroot|', ['shadowrootmode', 'shadowrootclonable', 'shadowrootdelegatesfocus', 'shadowrootserializable']],
  ['<template shadowrootmode="|"', ['open', 'closed']],
  ['<iframe loading="|"', ['eager', 'lazy']],
  ['<link fetch|', ['fetchpriority']],
  ['<link image|', ['imagesizes', 'imagesrcset']],
  ['<script fetchpriority="|"', ['high', 'low', 'auto']],
  ['<link fetchpriority="|"', ['high', 'low', 'auto']],
  ['<area referrerpolicy="|"', ['no-referrer', 'origin', 'strict-origin-when-cross-origin']],
  ['<source wi|', ['width']],
  ['<form re|', ['rel']],
  ['<area referrer|', ['referrerpolicy']],
  ['<video plays|', ['playsinline']],
];
let failed = 0;
for (const [src, want] of cases) {
  const { doc, pos, html } = at(src);
  const got = ls.doComplete(doc, pos, html).items.map((i) => i.label);
  const missing = want.filter((w) => !got.includes(w));
  if (missing.length) failed++;
  console.log(`${missing.length ? 'FAIL' : 'ok  '} ${src.padEnd(32)} ${missing.length ? 'missing: ' + missing.join(', ') : want.join(', ')}`);
}
const { doc, pos, html } = at('<button comma|ndfor="d">');
const hover = ls.doHover(doc, pos, html);
console.log('\nhover on commandfor:\n' + (hover?.contents?.value ?? JSON.stringify(hover)));
process.exit(failed ? 1 : 0);
