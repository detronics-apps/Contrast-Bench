// Channel mode: can a viewer tell these colours APART?
// Pure.
//
// A brand palette and a category palette are judged on different questions. A brand
// palette is asked "can this colour carry text on that one" - contrast. A set of
// category markers (content pillars, chart series, map regions, status tiers) is asked
// "will somebody know which is which", which contrast does not answer at all: two
// colours can both be perfectly legible and still be the same colour to the reader.
//
// Three ways a set fails that question, and all three have to be checked:
//   1. perceptual distance  - too close in normal vision
//   2. greyscale            - printed, photocopied, or a monochrome thumbnail
//   3. colour vision        - roughly 8% of men see fewer distinctions than the designer

import {
  contrast, deltaE, toOklch, toGreyscale, simulateCvd, hueGap, CVD_TYPES, luminance, fromOklch,
} from './color.js';

/** Under this OKLab distance, two markers are the same marker. */
export const COLLAPSE_DE = 12;
/** Between COLLAPSE_DE and this, they are distinguishable but not comfortably. */
export const TIGHT_DE = 20;
/** Adjacent greyscale values closer than this cannot be told apart without colour. */
export const GREY_RATIO = 1.2;
/** Large display type needs this much contrast; body text needs 4.5. */
export const LARGE_TEXT = 3;

const verdictFor = (d) => (d < COLLAPSE_DE ? 'collapses' : d < TIGHT_DE ? 'tight' : 'distinct');

/** Every unordered pair, with distance, hue gap and a verdict. Worst first. */
export function separation(entries) {
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      const d = deltaE(a.hex, b.hex);
      out.push({
        a, b,
        deltaE: d,
        hueGap: hueGap(toOklch(a.hex).H, toOklch(b.hex).H),
        greyRatio: contrast(toGreyscale(a.hex), toGreyscale(b.hex)),
        verdict: verdictFor(d),
      });
    }
  }
  return out.sort((x, y) => x.deltaE - y.deltaE);
}

/** The set ordered by luminance, with the contrast step to the next one up. */
export function greyscaleLadder(entries) {
  const sorted = [...entries].sort((a, b) => luminance(a.hex) - luminance(b.hex));
  return sorted.map((e, i) => {
    const next = sorted[i + 1];
    return {
      ...e,
      grey: toGreyscale(e.hex),
      value: Math.round(luminance(e.hex) * 255),
      stepToNext: next ? contrast(toGreyscale(e.hex), toGreyscale(next.hex)) : null,
      nextName: next ? next.name : null,
    };
  });
}

/** For each kind of colour blindness, the closest pair after simulation. */
export function colourVision(entries) {
  return CVD_TYPES.map((type) => {
    const sim = entries.map((e) => ({ ...e, sim: simulateCvd(e.hex, type) }));
    let worst = null;
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const d = deltaE(sim[i].sim, sim[j].sim);
        if (!worst || d < worst.deltaE) worst = { type, a: sim[i], b: sim[j], deltaE: d };
      }
    }
    return worst ? { ...worst, collapses: worst.deltaE < COLLAPSE_DE, swatches: sim } : null;
  }).filter(Boolean);
}

/** Can display type sit on each ground? Large text needs 3:1, body text 4.5:1. */
export function legibility(entries, textColors = ['#ffffff', '#1f2d3d']) {
  return entries.map((e) => {
    const options = textColors.map((t) => ({ text: t, ratio: contrast(e.hex, t) }));
    const best = options.reduce((m, o) => (o.ratio > m.ratio ? o : m));
    return {
      ...e,
      options,
      best,
      largeOk: best.ratio >= LARGE_TEXT,
      bodyOk: best.ratio >= 4.5,
    };
  });
}

/**
 * The whole verdict for a category set.
 * `entries` is [{name, hex}, ...].
 */
export function analyse(entries) {
  const pairs = separation(entries);
  const grey = greyscaleLadder(entries);
  const cvd = colourVision(entries);
  const text = legibility(entries);

  const Ls = entries.map((e) => toOklch(e.hex).L);
  const Cs = entries.map((e) => toOklch(e.hex).C);
  const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);

  return {
    entries,
    pairs,
    grey,
    cvd,
    text,
    collapsing: pairs.filter((p) => p.verdict === 'collapses'),
    tight: pairs.filter((p) => p.verdict === 'tight'),
    greyCollapses: grey.filter((g) => g.stepToNext !== null && g.stepToNext < GREY_RATIO),
    cvdCollapses: cvd.filter((c) => c.collapses),
    illegible: text.filter((t) => !t.largeOk),
    cohesion: {
      lightness: spread(Ls),
      chroma: spread(Cs),
      coherent: spread(Ls) <= 8 && spread(Cs) <= 0.03,
    },
    /** Per-viewer counts, plus the worst case. Never unioned across scenarios. */
    distinguish: distinguishability(entries),
    effectiveCount: effectiveCount(entries),
  };
}

/** Count distinct groups under one "do these two merge?" predicate. */
function groupCount(entries, merges) {
  const n = entries.length;
  if (n === 0) return 0;
  const parent = entries.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (merges(entries[i], entries[j])) parent[find(i)] = find(j);
    }
  }
  return new Set(entries.map((_, i) => find(i))).size;
}

/**
 * How many categories each kind of viewer can actually tell apart.
 *
 * Counted PER SCENARIO, never unioned across them. A viewer is one person in one
 * context: someone reading a greyscale print is not also a deuteranope seeing it in
 * colour. Merging the scenarios chains unrelated collapses together (A and B merge in
 * greyscale, B and C under deuteranopia, so all three are called one) and reports a
 * far worse number than any real viewer experiences.
 *
 * Within a scenario, chaining IS correct: if adjacent markers merge pairwise, the
 * code cannot be read reliably even when the ends differ.
 */
export function distinguishability(entries) {
  const scenarios = {
    colour: (a, b) => deltaE(a.hex, b.hex) < COLLAPSE_DE,
    greyscale: (a, b) => contrast(toGreyscale(a.hex), toGreyscale(b.hex)) < GREY_RATIO,
  };
  for (const t of CVD_TYPES) {
    scenarios[t] = (a, b) => deltaE(simulateCvd(a.hex, t), simulateCvd(b.hex, t)) < COLLAPSE_DE;
  }

  const counts = {};
  for (const [name, merges] of Object.entries(scenarios)) {
    counts[name] = groupCount(entries, merges);
  }
  const values = Object.values(counts);
  const worstName = Object.keys(counts).reduce((w, k) => (counts[k] < counts[w] ? k : w),
    Object.keys(counts)[0]);
  return {
    counts,
    total: entries.length,
    worst: entries.length ? Math.min(...values) : 0,
    worstScenario: entries.length ? worstName : null,
    best: entries.length ? Math.max(...values) : 0,
  };
}

/** The worst-case number of distinguishable markers, across all viewer scenarios. */
export const effectiveCount = (entries) => distinguishability(entries).worst;

/**
 * Search for a colour that would separate cleanly from every one of `keep`.
 * Returns candidates ranked by their worst-case separation, best first.
 *
 * A null result is a real finding, not a failure: it means no colour at this chroma
 * satisfies all four constraints, and the set needs restructuring rather than retinting.
 */
export function findSeparableColour(keep, {
  chroma = 0.105,
  minDeltaE = TIGHT_DE,
  minGrey = 1.3,
  minCvd = 14,
  minText = LARGE_TEXT,
  limit = 8,
} = {}) {
  const hexes = keep.map((k) => (typeof k === 'string' ? k : k.hex));
  const hits = [];

  for (let H = 0; H < 360; H += 6) {
    for (let L = 0.34; L <= 0.86; L += 0.02) {
      const hex = fromOklch(L, chroma, H);
      const dists = hexes.map((o) => deltaE(hex, o));
      const greys = hexes.map((o) => contrast(toGreyscale(hex), toGreyscale(o)));
      const cvds = CVD_TYPES.flatMap((t) =>
        hexes.map((o) => deltaE(simulateCvd(hex, t), simulateCvd(o, t))));
      const onWhite = contrast(hex, '#ffffff');

      const worstDe = Math.min(...dists);
      const worstGrey = Math.min(...greys);
      const worstCvd = Math.min(...cvds);

      if (worstDe >= minDeltaE && worstGrey >= minGrey && worstCvd >= minCvd && onWhite >= minText) {
        hits.push({ hex, hue: H, lightness: L * 100, worstDe, worstGrey, worstCvd, onWhite });
      }
    }
  }

  return hits
    .sort((a, b) => (b.worstCvd + b.worstDe) - (a.worstCvd + a.worstDe))
    .slice(0, limit);
}

/** Plain sentences describing what the analysis found, worst first. */
export function channelFindings(entries) {
  const a = analyse(entries);
  const out = [];
  const f = (n, d = 1) => n.toFixed(d);

  for (const p of a.collapsing) {
    out.push({
      level: 'issue', tag: 'Collapses',
      title: `${p.a.name} and ${p.b.name} are the same colour`,
      body: `Perceptual distance ${f(p.deltaE)} - anything under ${COLLAPSE_DE} is one marker, not two. `
        + `They are ${f(p.hueGap, 0)} degrees apart in hue and ${f(p.greyRatio, 2)}:1 apart in greyscale. `
        + 'A viewer cannot learn a code that has two identical symbols in it.',
      swatches: [p.a.hex, p.b.hex],
    });
  }

  for (const g of a.greyCollapses) {
    out.push({
      level: 'issue', tag: 'Greyscale',
      title: `${g.name} and ${g.nextName} are identical without colour`,
      body: `${f(g.stepToNext, 2)}:1 apart in value. Printed in mono, photocopied, or seen by someone `
        + 'with severe colour blindness, these two carry no distinction at all. Different hue, same '
        + 'lightness is the most common way a category palette fails.',
      swatches: [g.hex, g.grey],
    });
  }

  for (const c of a.cvdCollapses) {
    out.push({
      level: 'issue', tag: c.type,
      title: `${c.a.name} and ${c.b.name} merge under ${c.type}`,
      body: `Distance falls to ${f(c.deltaE)} after simulation. Around 8% of men and 0.5% of women `
        + 'see one of these conditions, so this is not an edge case - it is a predictable slice of '
        + 'the audience for whom two of the categories are one.',
      swatches: [simulateCvd(c.a.hex, c.type), simulateCvd(c.b.hex, c.type)],
    });
  }

  for (const t of a.illegible) {
    out.push({
      level: 'issue', tag: 'Type',
      title: `Display type on ${t.name} is below the floor`,
      body: `The best of the tested text colours reaches only ${f(t.best.ratio, 2)}:1 against `
        + `${t.hex}. Large display type needs ${LARGE_TEXT}:1 and body text needs 4.5:1, so headlines `
        + 'on this ground are below even the large-text minimum. Darken the ground or change the type.',
      swatches: [t.hex, t.best.text],
    });
  }

  if (a.distinguish.worst < entries.length) {
    const per = Object.entries(a.distinguish.counts)
      .map(([k, v]) => `${k} ${v}`).join(', ');
    out.push({
      level: 'issue', tag: 'Effective count',
      title: `${entries.length} colours, ${a.distinguish.worst} distinguishable in the worst case`,
      body: `Counted per viewer rather than pooled: ${per}. The worst is ${a.distinguish.worstScenario}, `
        + 'and that is the number the design has to survive - a reader in that situation sees fewer '
        + 'categories than you drew, so the extra markers cost effort without carrying information.',
      swatches: entries.map((e) => e.hex),
    });
  }

  if (!a.cohesion.coherent) {
    out.push({
      level: 'watch', tag: 'Cohesion',
      title: 'These do not read as one family',
      body: `Lightness spread is ${f(a.cohesion.lightness)} points and chroma spread `
        + `${f(a.cohesion.chroma, 3)}. Under about 8 and 0.03 a set reads as siblings; past that it `
        + 'reads as separate brands. That is survivable if the treatment - the grain, the light, the '
        + 'type - is doing the work of holding the identity together, but then colour is only a tag.',
      swatches: entries.map((e) => e.hex),
    });
  }

  if (!a.collapsing.length && !a.greyCollapses.length && !a.cvdCollapses.length) {
    out.push({
      level: 'works', tag: 'Separation',
      title: 'Every category is distinguishable by all three tests',
      body: 'No pair merges in normal vision, in greyscale, or under any of the three common forms '
        + 'of colour blindness. The code is learnable.',
      swatches: entries.map((e) => e.hex),
    });
  }

  const order = { issue: 0, watch: 1, works: 2 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}
