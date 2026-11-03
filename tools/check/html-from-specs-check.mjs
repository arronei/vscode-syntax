// Offline check of tools/html-from-specs.mjs on small pages shaped like the real specs' markup.
//   node tools/check/html-from-specs-check.mjs
import assert from 'assert/strict';
import { htmlDescriber } from '../html-from-specs.mjs';

const W = 'https://html.spec.whatwg.org/multipage/';
const pages = {
  [W + 'indices.html']: `<table>
    <tr><th> <code>closedby</code><td> <code><a>dialog</a></code><td> Which user actions will close the dialog<td> "<code>any</code>"; "<code>closerequest</code>"; "<code>none</code>"
    <tr><th> <code>loading</code><td> <code><a>img</a></code>; <code><a>iframe</a></code><td> Used when determining loading deferral<td> "<code>lazy</code>"; "<code>eager</code>"
    <tr><th> <code>shadowrootclonable</code><td> <code>template</code><td> Sets clonable on a declarative shadow root<td> Boolean attribute
    <tr><th> <code>width</code><td> <code>img</code>; <code>source</code> (in <code>picture</code>)<td> Horizontal dimension<td> Valid non-negative integer
  </table>`,
  [W + 'x.html']: `
    <p>The <dfn data-dfn-for=dialog id=attr-dialog-closedby data-dfn-type=element-attr><code>closedby</code></dfn> content attribute is an enumerated attribute with the following keywords and states:<table></table>
    <p>The <dfn data-dfn-for=iframe id=attr-iframe-loading data-dfn-type=element-attr><code>loading</code></dfn> attribute is a lazy loading attribute. Its purpose is to indicate the policy for loading <code>iframe</code> elements. [HTML]
    <p>The <dfn data-dfn-for=template id=attr-template-shadowrootclonable data-dfn-type=element-attr><code>shadowrootclonable</code></dfn> content attribute is a boolean attribute.
    <p id=attr-dim-width>Author requirements: the <code>width</code> attribute may be specified.`,
  'https://example.org/model/': `<title>The &lt;model&gt; element</title>
    <h2 id="abstract">Abstract</h2><div><p>The <code><a>model</a></code> element allows embedding 3D content within an <a>[HTML]</a> document.</p></div>
    <h3 id="x"><dfn data-dfn-type="element" id="elementdef-model">model</dfn></h3><dl><dt>Categories<dd>Flow content.</dl>
    <h3 id="src"><dfn data-dfn-for="model" data-dfn-type="element-attr"><code>src</code></dfn> attribute</h3>
    <p>The <code>src</code> attribute gives the URL of the model resource. The IDL attribute <code>src</code> must reflect the content attribute.</p>
    <h3 id="controls"><dfn data-dfn-for="model" data-dfn-type="element-attr"><code>controls</code></dfn> attribute</h3>
    <h3 id="crossorigin"><dfn data-dfn-for="model" data-dfn-type="element-attr"><code>crossorigin</code></dfn> attribute</h3>
    <p>The <code>crossorigin</code> attribute is a CORS settings attribute. It controls request credentials.</p>`,
  'https://example.org/camera/': `<section><h3>The [^camera^] HTML element</h3>
    <p>The &lt;<dfn data-dfn-type="element">camera</dfn>&gt; HTML element is an [[HTML]] element that can mediate access to a camera's video {{MediaStreamTrack}}.
      The [^camera^] element uses the following [=element interface=]:</p><pre class=idl>interface HTMLCameraElement {};</pre></section>`,
  'https://example.org/timing/': `<title>Element Timing API</title>
    <p id="dom-element-elementtiming">If record's element's "<code>elementtiming</code>" content attribute is absent, then abort these steps.</p>`,
};
const { describe, newValueSets } = htmlDescriber({
  knownSets: [{ name: 'loading', values: [{ name: 'eager' }, { name: 'lazy' }] }],
  fetchText: async (url) => pages[url] ?? '',
});
const d = (name, spec, bcdKey) => describe({ name, spec, bcdKey });

// WHATWG: index line and value type; a defining paragraph is added, a bare type sentence is not
assert.deepEqual(await d('<dialog closedby>', W + 'x.html#attr-dialog-closedby', 'html.elements.dialog.closedby'),
  { tag: 'dialog', name: 'closedby', bcd: 'html.elements.dialog.closedby', valueSet: 'dialog-closedby', description: 'Which user actions will close the dialog.' });
assert.deepEqual(newValueSets, [{ name: 'dialog-closedby', values: [{ name: 'any' }, { name: 'closerequest' }, { name: 'none' }] }]);
assert.deepEqual(await d('<iframe loading>', W + 'x.html#attr-iframe-loading'),
  { tag: 'iframe', name: 'loading', valueSet: 'loading', description: 'Used when determining loading deferral. Its purpose is to indicate the policy for loading `iframe` elements.' });
assert.deepEqual(await d('<template shadowrootclonable>', W + 'x.html#attr-template-shadowrootclonable'),
  { tag: 'template', name: 'shadowrootclonable', valueSet: 'v', description: 'Sets clonable on a declarative shadow root.' });
assert.equal((await d('<source width>', W + 'x.html#attr-dim-width')).description, 'Horizontal dimension. Value: valid non-negative integer.');

// Bikeshed element: abstract for the element, its own attributes from element-attr dfns, sections don't bleed
const model = await d('<model>', 'https://example.org/model/#elementdef-model', 'html.elements.model');
assert.equal(model.description, 'The `model` element allows embedding 3D content within an HTML document.');
assert.deepEqual(model.attributes.map((a) => [a.name, a.bcd, a.description, a.review !== undefined]), [
  ['src', 'html.elements.model.src', 'The `src` attribute gives the URL of the model resource.', false],
  ['controls', 'html.elements.model.controls', 'The `controls` attribute of `<model>`, from *The `<model>` element*.', true],
  ['crossorigin', 'html.elements.model.crossorigin', 'It controls request credentials.', false],
]);

// ReSpec source served unrendered
assert.equal((await d('<camera>', 'https://example.org/camera/#the-camera-html-element')).description,
  "The `<camera>` HTML element is an HTML element that can mediate access to a camera's video `MediaStreamTrack`.");

// only an algorithm step mentions it: placeholder plus review
const timing = await d('elementtiming', 'https://example.org/timing/#dom-element-elementtiming');
assert.equal(timing.description, 'The `elementtiming` global attribute, from *Element Timing API*.');
assert.ok(timing.review);

// spec or WHATWG index didn't load: left out, so the next run retries
assert.equal(await d('<a ping>', 'https://example.org/gone/#x'), undefined);
const noIndex = htmlDescriber({ fetchText: async (url) => (url.endsWith('indices.html') ? '' : pages[url] ?? '') });
assert.equal(await noIndex.describe({ name: '<dialog closedby>', spec: W + 'x.html#attr-dialog-closedby' }), undefined);

console.log('html-from-specs: all checks pass');
