// Describe an HTML item of a gap report from its spec, for additions-from-gap-report.mjs.
//
//   const { describe, newValueSets } = htmlDescriber({ knownSets });
//   await describe({ name: '<dialog closedby>', spec: 'https://html.spec.whatwg.org/…#attr-dialog-closedby', bcdKey })
//   → { tag, name, bcd, valueSet?, description, review?, attributes? }   (undefined if the spec didn't load)
//
// Sources, in order: for WHATWG HTML attributes, the spec's attribute index (one-line description and the value
// type: boolean, keyword list or free text); then the paragraph that defines the item, found from its <dfn> or the
// report's spec fragment, else the spec's abstract. Text that doesn't name the item, IDL reflection, algorithm
// steps and lead-ins to tables are skipped. When nothing is left, the description is a placeholder and `review`
// is set. A new element also gets its own attributes, from the element-attr <dfn>s for it on the same page.
// Keyword lists reuse a value set from knownSets with the same keywords, or become new ones in newValueSets.
//
// Check: node tools/check/html-from-specs-check.mjs
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const toText = (h) => h
  .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + c.replace(/<[^>]+>/g, '') + '`')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m))
  // ReSpec specs are served unrendered: [[CITE]], {{IDL}}, [=term=], [^element^]
  .replace(/\[\[([\w-]+)\]\](?= [a-z])/g, '$1')
  .replace(/\s*\[\[[^\]]*\]\]/g, '')
  .replace(/\{\{([^}]+)\}\}/g, '`$1`')
  .replace(/\[=([^\]]+?)=\]/g, (_, t) => t.split('|').at(-1).split('/').at(-1))
  .replace(/\[\^([^\]]+?)\^\]/g, '`<$1>`')
  .replace(/`?<(\w[\w-]*)>`?/g, '`<$1>`')
  .replace(/\[([A-Z][A-Z0-9-]*)\](?= [a-z])/g, '$1') // a citation read as a word: "an [HTML] document"
  .replace(/\s*\[[A-Z][A-Z0-9-]*\]/g, '') // [REFERRERPOLICY]-style citations
  .replace(/`(\w+)`="`([^`]+)`"/g, '`$1="$2"`')
  .replace(/\s+/g, ' ').trim();
// Drop sentences that say nothing to an author: IDL reflection, value defaults, a bare type ("The `x` attribute is a
// boolean attribute.", which the value set already says), and a lead-in to a list or table ("…states:")
const NOISE = [/\breflects?\b|\bIDL attributes?\b/i, /(missing|invalid) value default/i, /^The `[^`]+` (content )?attribute is an? [\w ]+ attribute\.$/, /:$/];
const clean = (t) => t.split(/(?<=[.!?])\s+(?=[A-Z`])/).filter((s) => !NOISE.some((re) => re.test(s))).join(' ');
const isAlgorithm = (t) => /^(If|For each|Let|Otherwise|Return|Set|Run|Assert|Append)\b/.test(t);
const firstSentences = (s, max = 320) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
};
// ponytail: regex over spec HTML, not a parser. Ceiling: a block ends at the next block tag, which is right for the
// p/dd/li paragraphs specs use. Add parse5 if a spec's markup defeats it.
const BOUNDARY = /<\/?(?:p|dd|dt|li|div|dl|ul|ol|table|pre|h[1-6]|section|blockquote)\b/gi;
const blockText = (html, at) => {
  const start = html.indexOf('>', at) + 1;
  BOUNDARY.lastIndex = start;
  return toText(html.slice(start, BOUNDARY.exec(html)?.index ?? html.length));
};
// Paragraphs near position i, minus algorithm steps: the one holding it, then the next few in the same section
function paragraphsNear(html, i) {
  const heads = [...html.slice(i, i + 50000).matchAll(/<h[1-6][\s>]/g)].map((m) => i + m.index);
  // an id on a <section> sits just before the section's own heading: the section ends at the heading after that
  const inHeading = /<h[1-6][\s>](?![\s\S]*<\/h[1-6]>)/.test(html.slice(Math.max(0, i - 2000), i));
  const own = !inHeading && heads[0] - i < 300 && !/<p[\s>]/.test(html.slice(i, heads[0]));
  const stop = heads[own ? 1 : 0] ?? html.length;
  const out = [];
  const at = Math.max(...['<p>', '<p ', '<dd', '<li'].map((t) => html.lastIndexOf(t, i)));
  if (at >= 0) {
    BOUNDARY.lastIndex = html.indexOf('>', at) + 1;
    const b = BOUNDARY.exec(html);
    if (!b || b.index > i) out.push(blockText(html, at));
  }
  const next = /<p[\s>]/gi;
  next.lastIndex = i;
  for (let n = 0, m; n < 6 && (m = next.exec(html)) && m.index < stop; n++) out.push(blockText(html, m.index));
  return out.filter((t) => !isAlgorithm(t));
}
const attrOf = (tag, name) => tag.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((v) => v !== undefined);
const dfns = (html) => [...html.matchAll(/<dfn\b([^>]*)>([\s\S]*?)<\/dfn>/gi)].map((m) => ({
  at: m.index, text: toText(m[2]).replace(/`/g, '').toLowerCase(), type: attrOf(m[1], 'data-dfn-type'), for: (attrOf(m[1], 'data-dfn-for') || '').split(/[\s,]+/),
}));
// The item's own <dfn>: type element or element-attr, for the right element (or a global), text = name
const isDfnOf = (d, item) => d.text === item.name && (item.tag ? d.type === 'element-attr' && d.for.includes(item.tag) : item.global ? d.type === 'element-attr' && d.for.some((f) => /global/.test(f)) : d.type === 'element');
const sameKeywords = (vs, kw) => vs.values.length === kw.length && kw.every((k) => vs.values.some((v) => v.name === k));
const WHATWG_INDEX = 'https://html.spec.whatwg.org/multipage/indices.html';

const defaultFetch = (url) => fetch(url).then((r) => (r.ok ? r.text() : '')).catch(() => '');

export function htmlDescriber({ knownSets = [], fetchText = defaultFetch } = {}) {
  const pages = new Map();
  const get = (url) => (pages.has(url) ? pages.get(url) : pages.set(url, fetchText(url)).get(url));
  const newValueSets = [];

  // WHATWG attribute index row for the item: [attribute, elements, description, value]. Globals list "HTML elements".
  // null when the index didn't load.
  async function whatwgIndex(item) {
    const html = await get(WHATWG_INDEX);
    if (!html) return null;
    const plain = (h) => toText(h).replace(/`/g, '');
    for (const row of html.split(/<tr\b/i).slice(1)) {
      const cells = row.split(/<t[dh]\b[^>]*>/i).slice(1);
      if (cells.length !== 4 || plain(cells[0]) !== item.name) continue;
      const els = plain(cells[1]).split(/;\s*/).map((s) => s.replace(/\*$|\s*\(.*\)$/g, '').trim()); // "source (in picture)"
      if (els.includes(item.tag ?? 'HTML elements')) return cells;
    }
  }

  async function describe(e) {
    const m = e.name.match(/^<(\S+?)(?: (\S+))?>$/);
    const item = m ? (m[2] ? { tag: m[1], name: m[2].toLowerCase() } : { name: m[1].toLowerCase() }) : { name: e.name.toLowerCase(), global: true };
    const kind = item.tag || item.global ? 'attribute' : 'element';
    const out = { ...(item.tag && { tag: item.tag }), name: item.name, ...(e.bcdKey && { bcd: e.bcdKey }) };
    const [page = '', frag] = (e.spec || '').split('#');
    const html = page ? await get(page) : '';
    if (page && !html) return undefined; // fetch failed: leave it out, the next run retries
    const mentions = (t) => new RegExp('`<?' + escRe(item.name) + '>?`', 'i').test(t) || (item.name.length > 4 && new RegExp(`\\b${escRe(item.name)}\\b`, 'i').test(t));
    const parts = [];
    const cells = kind === 'attribute' && page.startsWith('https://html.spec.whatwg.org/') ? await whatwgIndex(item) : undefined;
    if (cells === null) return undefined; // as above
    if (cells) {
      parts.push(toText(cells[2]).replace(/\.?$/, '.'));
      const value = toText(cells[3]).replace(/\*$/, '');
      const keywords = [...cells[3].matchAll(/"<code[^>]*>([\s\S]*?)<\/code>"/g)].map((k) => toText(k[1]).replace(/`/g, ''));
      if (/^boolean attribute$/i.test(value)) out.valueSet = 'v';
      else if (keywords.length) {
        const known = [...knownSets, ...newValueSets].find((vs) => sameKeywords(vs, keywords));
        out.valueSet = known?.name ?? (item.tag ? `${item.tag}-${item.name}` : item.name);
        if (!known) newValueSets.push({ name: out.valueSet, values: keywords.map((k) => ({ name: k })) });
      } else if (value) parts.push(`Value: ${/^[A-Z][a-z]/.test(value) ? value[0].toLowerCase() + value.slice(1) : value}.`);
    }
    const all = html ? dfns(html) : [];
    if (html) {
      const own = all.find((d) => isDfnOf(d, item))?.at ?? -1;
      const near = [own, frag ? html.search(new RegExp(`\\sid=["']?${escRe(frag)}["'\\s>]`)) : -1].filter((i) => i >= 0).flatMap((i) => paragraphsNear(html, i));
      const abstractAt = html.search(/\sid=["']?abstract["'\s>]/);
      const abstract = abstractAt < 0 ? [] : paragraphsNear(html, abstractAt).slice(0, 3);
      const defines = (t) => new RegExp(`^(The|An?|This)\\b[^.]{0,40}\`<?${escRe(item.name)}>?\``, 'i').test(t);
      const pick = (list, test = () => true) => list.filter((t) => mentions(t) && test(t)).map(clean).find(Boolean);
      // a defining paragraph ("The `x` attribute …") first, then the spec's abstract, then whatever is nearby.
      // Next to an index line, only a defining paragraph adds anything.
      const para = pick([...near, ...abstract], defines) ?? (parts.length ? undefined : pick(abstract) ?? pick(near));
      if (para) parts.push(firstSentences(para));
      if (!out.valueSet && kind === 'attribute' && near.some((t) => new RegExp(`\`${escRe(item.name)}\`[^.]* is a boolean attribute`, 'i').test(t))) out.valueSet = 'v';
    }
    if (!parts.length) {
      const title = html.match(/<title>([^<]*)<\/title>/i)?.[1];
      const what = kind === 'element' ? `The \`<${item.name}>\` element` : item.tag ? `The \`${item.name}\` attribute of \`<${item.tag}>\`` : `The \`${item.name}\` global attribute`;
      parts.push(`${what}${title ? `, from *${toText(title)}*` : ''}.`);
      out.review = 'no definition found in the spec: write a description, then delete this field';
    }
    out.description = parts.join(' ');
    if (kind === 'element' && html) {
      out.attributes = [];
      for (const a of new Set(all.filter((d) => d.type === 'element-attr' && d.for.includes(item.name)).map((d) => d.text))) {
        const { tag, ...attr } = await describe({ name: `<${item.name} ${a}>`, spec: page, bcdKey: e.bcdKey && `${e.bcdKey}.${a}` });
        out.attributes.push(attr);
      }
    }
    return out;
  }

  return { describe, newValueSets };
}
