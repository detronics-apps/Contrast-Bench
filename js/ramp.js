// One colour, on its own.
//
// A palette asks "can these colours sit together". A ramp asks something different
// and often more useful: does THIS colour work by itself, against black, white and
// the neutrals, across its own range of shades and tints?
//
// That is the right question whenever a colour never appears beside the others -
// one hue per section, per episode, per product line. Judging such colours against
// each other invents a conflict that does not exist on screen.
//
// Pure.

import { contrast, toOklch, fromOklch, deltaE, toGreyscale, luminance, toHsl, hueGap } from './color.js';
import { grade } from './wcag.js';

/** A set of colours is a ramp when they share a hue and span a wide lightness range. */
export const RAMP_HUE_TOLERANCE = 14;   // degrees
export const RAMP_MIN_SPREAD = 40;      // OKLCh lightness points
export const RAMP_MIN_STEPS = 4;

/** Where a step can be used. The whole point of the ramp. */
export const USE = Object.freeze({
  textOnLight: 'text on light',
  textOnDark: 'text on dark',
  bothText: 'text on either',
  fill: 'fill only',
});

/** The neutrals a ramp is measured against, unless the caller supplies its own. */
export const DEFAULT_NEUTRALS = Object.freeze([
  { name: 'Black', hex: '#000000' },
  { name: 'Ink', hex: '#1f2d3d' },
  { name: 'Mid grey', hex: '#767676' },
  { name: 'Paper', hex: '#f4f5f6' },
  { name: 'White', hex: '#ffffff' },
]);

/**
 * Build a ramp from one seed colour.
 *
 * Hue is held exactly; lightness is swept. Chroma is held too and left to the
 * gamut mapper, which is what produces the natural falloff at both ends - a real
 * ramp cannot stay saturated at lightness 5 or 95, and bisecting chroma down to
 * what sRGB can show is the honest way to get there rather than a hand-drawn curve.
 */
export function buildRamp(seed, { steps = 9, minL = 0.12, maxL = 0.97 } = {}) {
  if (steps < 2) throw new Error('a ramp needs at least two steps');
  const { L, C, H } = toOklch(seed);
  const seedL = L / 100;

  const out = [];
  for (let i = 0; i < steps; i++) {
    const lightness = minL + (i * (maxL - minL)) / (steps - 1);
    out.push(makeStep(fromOklch(lightness, C, H), lightness * 100, false));
  }

  // The seed itself belongs on its own ramp, in lightness order, so a reader can
  // see where the colour they actually chose sits among its own shades.
  const seedStep = makeStep(seed, L, true);
  out.push(seedStep);
  out.sort((a, b) => a.lightness - b.lightness);

  // Drop any generated step that is indistinguishable from the seed, so the seed
  // is not shadowed by a near-duplicate one position away.
  const kept = out.filter((s) => s.isSeed || deltaE(s.hex, seed) > 3);
  return kept.map((s, i) => ({ ...s, index: i, seedLightness: seedL * 100 }));
}

function makeStep(hex, lightness, isSeed) {
  const onWhite = contrast(hex, '#ffffff');
  const onBlack = contrast(hex, '#000000');
  const textOnLight = onWhite >= 4.5;
  const textOnDark = onBlack >= 4.5;
  return {
    hex,
    lightness,
    isSeed,
    onWhite,
    onBlack,
    textOnLight,
    textOnDark,
    use: textOnLight && textOnDark ? USE.bothText
      : textOnLight ? USE.textOnLight
      : textOnDark ? USE.textOnDark
      : USE.fill,
  };
}

/** Every step measured against every neutral. */
export function againstNeutrals(ramp, neutrals = DEFAULT_NEUTRALS) {
  return ramp.map((step) => ({
    step,
    pairs: neutrals.map((n) => {
      const ratio = contrast(step.hex, n.hex);
      return { neutral: n, ratio, grade: grade(ratio) };
    }),
  }));
}

/**
 * Does this set of colours already form a ramp?
 *
 * A hand-built ramp is almost always better than a generated one - it was made by
 * eye, in one hue, with the steps somebody actually wants to use. So when a palette
 * IS a ramp, the app must measure those steps rather than invent its own.
 *
 * Returns null when it is not a ramp, which is itself the answer: a set of different
 * hues is a palette, and belongs in Brand or Categories instead.
 */
export function detectRamp(colors) {
  const hexes = colors.map((c) => (typeof c === 'string' ? c : c.hex));
  if (hexes.length < RAMP_MIN_STEPS) return null;

  // Hue is only meaningful where there is some colour; a pure grey ramp has none,
  // and is still a ramp.
  const hued = hexes.filter((h) => toHsl(h).S >= 10);
  let hue = null;
  if (hued.length) {
    if (hued.length < 2 && hexes.length > 2) return null;
    hue = circularMeanHue(hued.map((h) => toHsl(h).H));
    const worst = Math.max(...hued.map((h) => hueGap(toHsl(h).H, hue)));
    if (worst > RAMP_HUE_TOLERANCE) return null;
  }

  const ls = hexes.map((h) => toOklch(h).L);
  const spread = Math.max(...ls) - Math.min(...ls);
  if (spread < RAMP_MIN_SPREAD) return null;

  const ordered = [...hexes].sort((a, b) => toOklch(a).L - toOklch(b).L);
  return {
    hue,
    spread,
    hueDrift: hued.length ? Math.max(...hued.map((h) => hueGap(toHsl(h).H, hue))) : 0,
    steps: ordered,
    count: ordered.length,
  };
}

/** Mean of angles, which a plain average gets wrong across the 0/360 seam. */
function circularMeanHue(hues) {
  const x = hues.reduce((s, h) => s + Math.cos((h * Math.PI) / 180), 0);
  const y = hues.reduce((s, h) => s + Math.sin((h * Math.PI) / 180), 0);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Measure a ramp somebody supplied, step by step.
 *
 * `brandIndex` names which step is the brand colour. Left unset, the most chromatic
 * step is taken, which is what a ramp's "the colour" almost always is - the ends are
 * near-black and near-white by construction.
 */
export function analyseSteps(hexes, { neutrals = DEFAULT_NEUTRALS, brandIndex = null } = {}) {
  if (!hexes.length) throw new Error('a ramp needs at least one step');
  const ordered = [...hexes].sort((a, b) => toOklch(a).L - toOklch(b).L);

  let brand = brandIndex;
  if (brand === null || !ordered[brand]) {
    let best = 0;
    ordered.forEach((h, i) => { if (toOklch(h).C > toOklch(ordered[best]).C) best = i; });
    brand = best;
  }

  const ramp = ordered.map((hex, i) => ({
    ...makeStep(hex, toOklch(hex).L, i === brand),
    index: i,
  }));
  return finish(ordered[brand], ramp, neutrals);
}

/**
 * The full reading for one colour on its own.
 *
 * `seedStep` carries the finding that matters most: the flat brand colour somebody
 * picked is very often a fill, and the ramp says which step to reach for instead.
 */
export function analyseRamp(seed, { steps = 9, neutrals = DEFAULT_NEUTRALS } = {}) {
  return finish(seed, buildRamp(seed, { steps }), neutrals);
}

function finish(seed, ramp, neutrals) {
  const seedStep = ramp.find((s) => s.isSeed) ?? ramp[0];
  const grid = againstNeutrals(ramp, neutrals);

  const forLight = ramp.filter((s) => s.textOnLight).sort((a, b) => b.lightness - a.lightness)[0] ?? null;
  const forDark = ramp.filter((s) => s.textOnDark).sort((a, b) => a.lightness - b.lightness)[0] ?? null;

  // Which neutrals this colour can never carry text against, at any step.
  const unreachable = neutrals.filter(
    (n) => !ramp.some((s) => contrast(s.hex, n.hex) >= 4.5),
  );

  return {
    seed,
    seedStep,
    ramp,
    grid,
    neutrals,
    forLight,
    forDark,
    unreachable,
    greyscale: ramp.map((s) => ({ hex: s.hex, grey: toGreyscale(s.hex), value: Math.round(luminance(s.hex) * 255) })),
  };
}

const f = (n, d = 2) => n.toFixed(d);

/** Plain sentences about one colour, worst first. */
export function rampFindings(seed, name = 'This colour', options = {}) {
  return findingsFor(analyseRamp(seed, options), name);
}

/** The same sentences, for a ramp that was supplied rather than generated. */
export function findingsFor(a, name = 'This colour') {
  const seed = a.seed;
  const out = [];
  const s = a.seedStep;

  if (s.use === USE.fill) {
    out.push({
      level: 'issue', tag: 'The swatch',
      title: `${name} is a fill, not a text colour`,
      body: `At lightness ${f(s.lightness, 0)} it reaches ${f(s.onWhite)}:1 on white and `
        + `${f(s.onBlack)}:1 on black, so it clears neither 4.5:1 threshold. That is fine for a `
        + 'panel, a block or a background, and it means headings and body copy have to come from '
        + 'somewhere else in its own range.',
      swatches: [seed],
    });
  } else {
    out.push({
      level: 'works', tag: 'The swatch',
      title: `${name} can carry text ${s.use === USE.bothText ? 'on either ground' : s.use.replace('text ', '')}`,
      body: `${f(s.onWhite)}:1 on white and ${f(s.onBlack)}:1 on black. `
        + 'A colour that carries its own text is rarer than it sounds; most brand mid-tones cannot.',
      swatches: [seed],
    });
  }

  if (a.forLight) {
    out.push({
      level: 'works', tag: 'On light',
      title: `Use ${a.forLight.hex} for text on white`,
      body: `The lightest step of this colour that still clears 4.5:1 on white `
        + `(${f(a.forLight.onWhite)}:1), so it is as close to the original as legibility allows. `
        + `Same hue, lightness ${f(a.forLight.lightness, 0)} instead of ${f(s.lightness, 0)}.`,
      swatches: [seed, a.forLight.hex],
    });
  } else {
    out.push({
      level: 'issue', tag: 'On light',
      title: 'No step of this colour can carry text on white',
      body: 'Across the whole range, nothing in this hue reaches 4.5:1 against white. Body copy in '
        + 'this colour on a white page is not available at any shade - use a neutral for the text '
        + 'and keep this colour for fills and rules.',
      swatches: [seed],
    });
  }

  if (a.forDark) {
    out.push({
      level: 'works', tag: 'On dark',
      title: `Use ${a.forDark.hex} for text on black`,
      body: `The darkest step that still clears 4.5:1 against black (${f(a.forDark.onBlack)}:1). `
        + 'Pair it with the light-ground value above and the colour has a usable form on both '
        + 'kinds of page without changing hue.',
      swatches: [seed, a.forDark.hex],
    });
  }

  for (const n of a.unreachable) {
    out.push({
      level: 'watch', tag: 'Out of reach',
      title: `Nothing in this range carries text against ${n.name}`,
      body: `No step of this hue reaches 4.5:1 against ${n.hex}. If that is a ground this colour `
        + 'has to appear on as text, the answer is a different hue rather than a different shade.',
      swatches: [seed, n.hex],
    });
  }

  const order = { issue: 0, watch: 1, works: 2 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}
