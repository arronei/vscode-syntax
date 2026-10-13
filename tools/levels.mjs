// Data levels: how established a CSS or HTML feature is. The gap report and the extension build tag every
// item with one, and the extension's settings pick which levels it adds (extension/extension.js filterData).
//
//   baseline     Baseline in web-features (newly or widely available)
//   standard     in a spec at Candidate Recommendation or later, or a WHATWG Living Standard
//   draft        in any other spec: Working Draft, Editor's Draft, Community Group draft, …
//   proprietary  vendor-prefixed, non-standard in BCD, or in no spec at all
//
// The first three are cumulative in the extension (draft includes standard includes baseline).
// Proprietary is a separate opt-in.
const STANDARD = /^(Candidate Recommendation|Proposed Recommendation|Recommendation|Living Standard)/;

export function levelFinder({ specs, wf }) {
  const baseline = {};
  for (const f of Object.values(wf.features)) {
    if (f.kind !== 'feature') continue;
    for (const [key, st] of Object.entries(f.status?.by_compat_key || {})) baseline[key] = st.baseline;
  }
  const specFor = (href) => {
    const base = href?.split('#')[0];
    return base && specs.find((s) => [s.nightly?.url, s.release?.url, s.url].filter(Boolean).some((u) => base.startsWith(u)));
  };
  // name: as shown (`-webkit-foo`, `::bar`, `@baz`); compat: the BCD __compat; specHref: webref's link, else BCD's spec_url
  const levelOf = (name, compat, bcdKey, specHref) => {
    const href = specHref || [].concat(compat?.spec_url || [])[0];
    if (/^(::?|@)?-/.test(name) || compat?.status?.standard_track === false || !href) return 'proprietary';
    if (bcdKey && baseline[bcdKey]) return 'baseline';
    const spec = specFor(href);
    return STANDARD.test(spec?.release?.status ?? spec?.nightly?.status ?? '') ? 'standard' : 'draft';
  };
  return { levelOf, specFor };
}
