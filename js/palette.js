// Palette geometry: what the shape of a set of colours says about it.
// Pure - returns data and plain sentences; a UI module renders them.

import {
  contrast, toOklch, toHsl, isNeutral, deltaE, hueGap,
} from './color.js';
import { summarise } from './wcag.js';
import { deepenToPass } from './suggest.js';
import { readEmotion } from './emotion.js';

/** Below this ratio two colours cannot form a visible boundary. */
export const REDUNDANT_RATIO = 1.35;
/** A lightness gap this wide has no colour in it worth naming. */
export const VOID_POINTS = 18;
/** Three or more colours inside this many lightness points are competing. */
export const CROWD_POINTS = 15;

/**
 * Everything measurable about one colour, in one object - including what it is
 * likely to communicate. The emotional reading is part of the standard analysis,
 * not a separate mode: the message a colour sends is as much a property of it as
 * its contrast, and it is usually the reason the colour was chosen.
 */
export function geometry(hex) {
  const o = toOklch(hex);
  const h = toHsl(hex);
  return {
    hex,
    L: o.L, C: o.C, H: o.H,
    hslH: h.H, hslS: h.S, hslL: h.L,
    neutral: isNeutral(hex),
    onWhite: contrast(hex, '#ffffff'),
    onBlack: contrast(hex, '#000000'),
    emotion: readEmotion(hex),
  };
}

export const geometries = (colors) => colors.map(geometry);

/** Colours sorted by lightness, with the gap to the previous one. */
export function ladder(colors) {
  const sorted = geometries(colors).sort((a, b) => a.L - b.L);
  return sorted.map((g, i) => ({ ...g, gap: i === 0 ? null : g.L - sorted[i - 1].L }));
}

/** Lightness bands with nothing in them, widest first. */
export function voids(colors) {
  const rungs = ladder(colors);
  return rungs
    .map((g, i) => (i === 0 ? null : { from: rungs[i - 1], to: g, size: g.gap }))
    .filter((v) => v && v.size >= VOID_POINTS)
    .sort((a, b) => b.size - a.size);
}

/** Runs of three or more colours packed into one narrow lightness band. */
export function crowds(colors) {
  const rungs = ladder(colors);
  const out = [];
  for (let i = 0; i + 2 < rungs.length; i++) {
    const run = rungs.slice(i).filter((g) => g.L - rungs[i].L <= CROWD_POINTS);
    if (run.length >= 3) {
      out.push({ members: run, span: run[run.length - 1].L - run[0].L });
      i += run.length - 1;
    }
  }
  return out;
}

/** Pairs too close to form a boundary, closest first. */
export function redundancies(colors) {
  const out = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const ratio = contrast(colors[i], colors[j]);
      if (ratio < REDUNDANT_RATIO) {
        out.push({ a: geometry(colors[i]), b: geometry(colors[j]), ratio });
      }
    }
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}

/** How wide a hue range the chromatic colours cover, and what that scheme is called. */
export function scheme(colors) {
  const all = geometries(colors);
  const chromatic = all.filter((g) => !g.neutral);
  if (chromatic.length < 2) {
    return { name: 'Neutral', span: 0, chromatic, neutrals: all.filter((g) => g.neutral) };
  }
  const hues = chromatic.map((g) => g.hslH).sort((a, b) => a - b);
  const span = hues[hues.length - 1] - hues[0];
  const name = span <= 35 ? 'Monochromatic'
    : span <= 90 ? 'Analogous'
    : span <= 150 ? 'Split range'
    : 'Polychromatic';
  return { name, span, lo: hues[0], hi: hues[hues.length - 1], chromatic, neutrals: all.filter((g) => g.neutral) };
}

/** Lightness and chroma spread. Under the thresholds, the set reads as siblings. */
export function cohesion(colors) {
  const all = geometries(colors);
  const spread = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
  const lightness = spread(all.map((g) => g.L));
  const chroma = spread(all.map((g) => g.C));
  return {
    lightness, chroma,
    coherent: lightness <= 8 && chroma <= 0.03,
    lightnessLimit: 8,
    chromaLimit: 0.03,
  };
}

/**
 * Which colour does which job. Assigned by lightness, then corrected for chroma:
 * where two colours could do the same job, the tinted one wins, because it belongs
 * to the palette and a flat neutral does not.
 */
export function roles(colors) {
  if (!colors.length) return {};
  const all = geometries(colors);
  const byL = [...all].sort((a, b) => a.L - b.L);
  const byChroma = (list) => [...list].sort((a, b) => b.C - a.C);

  const darks = byL.filter((g) => g.L < 50);
  const lights = byL.filter((g) => g.L > 74);

  let ink = byL[0];
  const tintedDark = byChroma(darks)[0];
  if (tintedDark && tintedDark !== ink && tintedDark.onWhite >= 7) ink = tintedDark;
  const inkSoft = byChroma(darks.filter((g) => g !== ink))[0] ?? null;

  const surface = byL[byL.length - 1];
  const surfaceAlt = byChroma(lights.filter((g) => g !== surface))[0] ?? null;

  // No fallback: a palette with nothing left over has no accent, and saying so is
  // more useful than handing the same colour two jobs.
  const accent = byChroma(all).find(
    (g) => g !== ink && g !== inkSoft && g !== surface && g !== surfaceAlt && g.C > 0.01,
  ) ?? null;

  return { ink, inkSoft, surface, surfaceAlt, accent };
}

export const ROLE_LABEL = Object.freeze({
  surface: 'Dominant surface',
  surfaceAlt: 'Secondary surface',
  ink: 'Primary ink',
  inkSoft: 'Secondary ink',
  accent: 'Accent',
});

const f = (n, d = 2) => n.toFixed(d);

/**
 * Everything worth telling the reader about this palette, worst first.
 * Each finding is {level, tag, title, body, swatches}. `level` is one of
 * 'issue' | 'watch' | 'works' - the UI maps those to colour, not this module.
 */
export function findings(colors) {
  const out = [];
  const all = geometries(colors);
  const sch = scheme(colors);
  const names = (list) => list.map((g) => g.hex);

  // --- hue coherence
  if (sch.chromatic.length >= 2) {
    if (sch.span <= 35) {
      out.push({
        level: 'works', tag: 'Coherence',
        title: `A genuinely monochromatic palette - ${f(sch.span, 0)} degrees of hue, total`,
        body: `Every chromatic colour sits between ${f(sch.lo, 0)} and ${f(sch.hi, 0)} degrees. `
          + 'That is unusually disciplined, and it is the palette\'s strongest asset: nothing can '
          + 'clash, and the identity holds together even when applied badly.',
        swatches: names(sch.chromatic),
      });
      out.push({
        level: 'watch', tag: 'Risk',
        title: 'The same discipline is also the limitation',
        body: 'With one hue there is no second voice. You cannot signal "a different kind of thing" '
          + 'with colour, only with lightness, so hierarchy has to be carried by type, spacing and '
          + 'weight instead. Budget for that in the design system rather than discovering it later.',
        swatches: [],
      });
    } else {
      out.push({
        level: 'works', tag: 'Scheme',
        title: `Reads as ${sch.name.toLowerCase()} - ${f(sch.span, 0)} degrees of hue spread`,
        body: `Hues run from ${f(sch.lo, 0)} to ${f(sch.hi, 0)} degrees. `
          + (sch.span <= 90
            ? 'Analogous palettes feel harmonious with more variety than a single hue allows.'
            : 'A wide spread gives flexibility but needs a strict dominance rule, or it looks arbitrary.'),
        swatches: names(sch.chromatic),
      });
    }
  }

  // --- temperature
  const warm = sch.chromatic.filter((g) => g.hslH < 75 || g.hslH > 320);
  if (sch.chromatic.length && warm.length === 0) {
    out.push({
      level: 'watch', tag: 'Temperature',
      title: 'Entirely cool - no warm hue anywhere in the palette',
      body: 'Cool palettes communicate precision, hygiene and control well, and human warmth, '
        + 'urgency and care not at all. For instrumentation that trade is usually right. It becomes '
        + 'a problem the moment you need to say "someone will help you" or "act now".',
      swatches: [],
    });
  }

  // --- redundancy
  for (const dup of redundancies(colors).slice(0, 3)) {
    out.push({
      level: 'issue', tag: 'Redundant',
      title: `${dup.a.hex} and ${dup.b.hex} are the same colour in practice`,
      body: `They sit ${f(dup.ratio)}:1 apart. A boundary between them is invisible - you cannot `
        + 'use one as a card on the other, or as a divider, or as a hover state. Two swatches are '
        + 'doing one job, which dilutes the palette and slows every future colour decision.',
      swatches: [dup.a.hex, dup.b.hex],
    });
  }

  // --- the mid-tone void
  const [worstVoid] = voids(colors);
  if (worstVoid) {
    const mid = (worstVoid.from.L + worstVoid.to.L) / 2;
    out.push({
      level: 'issue', tag: 'Gap',
      title: `No mid-tone - a ${f(worstVoid.size, 0)}-point hole between ${worstVoid.from.hex} and ${worstVoid.to.hex}`,
      body: `The band around lightness ${f(mid, 0)} is empty. That band is the most useful one in `
        + 'any palette: the only place a colour is dark enough to carry text on a light ground and '
        + 'light enough to sit under white type. Without it every accent use collapses into either '
        + '"too pale to read" or "basically the dark neutral".',
      swatches: [worstVoid.from.hex, worstVoid.to.hex],
    });
  }

  // --- crowding
  for (const crowd of crowds(colors)) {
    out.push({
      level: 'watch', tag: 'Crowded',
      title: `${crowd.members.length} colours inside ${f(crowd.span, 0)} lightness points`,
      body: 'They compete for the same job. One of them is the surface; the others are variations '
        + 'nobody will be able to tell apart in use.',
      swatches: names(crowd.members),
    });
  }

  // --- accent strength
  const byC = [...all].sort((a, b) => b.C - a.C);
  if (byC.length >= 2 && byC[0].C > 0.02) {
    const lead = byC[0];
    const ratio = byC[1].C > 0 ? lead.C / byC[1].C : 99;
    const usable = lead.onWhite >= 4.5;
    out.push({
      level: usable ? 'works' : 'issue', tag: 'Accent',
      title: `${lead.hex} is the only real accent${usable ? '' : ' - and it cannot hold text'}`,
      body: `At chroma ${f(lead.C, 3)} it carries ${f(ratio, 1)} times the colour of the next most `
        + 'saturated swatch, so it is doing all of the palette\'s expressive work. '
        + (usable
          ? 'It clears 4.5:1 on white, so it can be used for links and labels as well as fills.'
          : `But at ${f(lead.onWhite)}:1 on white it fails body text, large text and even the 3:1 UI `
            + 'threshold, so the signature colour is restricted to large fills and decoration.'),
      swatches: [lead.hex],
    });
  }

  // --- status colours
  const hasBand = (lo, hi) => all.some((g) => !g.neutral && g.hslS > 20 && g.hslH >= lo && g.hslH <= hi);
  const missing = [];
  if (!hasBand(0, 20) && !hasBand(340, 360)) missing.push('alarm red');
  if (!hasBand(35, 70)) missing.push('warning amber');
  if (!hasBand(95, 165)) missing.push('healthy green');
  if (missing.length >= 2) {
    out.push({
      level: 'issue', tag: 'Function',
      title: `No status colours - ${missing.join(', ')} are all absent`,
      body: 'A palette for something that reports a condition needs a second, functional set. Red, '
        + 'amber and green are not stylistic choices there; people are trained on them and standards '
        + 'assume them. If they are not defined now they get improvised later, inconsistently.',
      swatches: [],
    });
  }

  // --- what the palette is saying
  const register = emotionalRegister(colors);
  if (register) {
    out.push({
      level: 'works', tag: 'Register',
      title: register.title,
      body: register.body,
      swatches: register.swatches,
    });
  }

  // --- the dark anchor
  const anchor = [...all].filter((g) => g.L < 45).sort((a, b) => b.C - a.C)[0];
  if (anchor) {
    out.push({
      level: 'works', tag: 'Anchor',
      title: `A strong dark anchor in ${anchor.hex}`,
      body: `At lightness ${f(anchor.L, 0)} it reaches ${f(anchor.onWhite, 1)}:1 on white, clearing `
        + 'AAA - text, logo and dark interfaces all have a home. '
        + (anchor.C > 0.02
          ? 'It is tinted rather than flat black, so the darkest value still belongs to the hue story.'
          : 'It is an untinted neutral, so the darkest value sits outside the hue story; a slightly '
            + 'tinted dark would tie the palette together better.'),
      swatches: [anchor.hex],
    });
  }

  const order = { issue: 0, watch: 1, works: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/**
 * What the palette as a whole is likely to communicate.
 *
 * Reported from the chromatic colours only - a neutral has no hue to read - and
 * weighted by chroma, because the most saturated colour does most of the talking.
 * Returns null for an all-neutral palette rather than inventing a message.
 */
export function emotionalRegister(colors) {
  const chromatic = geometries(colors).filter((g) => !g.neutral);
  if (!chromatic.length) return null;

  const byC = [...chromatic].sort((a, b) => b.C - a.C);
  const lead = byC[0];
  const tally = new Map();
  for (const g of chromatic) {
    for (const { emotion, weight } of g.emotion.near) {
      tally.set(emotion.name, (tally.get(emotion.name) ?? 0) + weight * g.C);
    }
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 3).map(([name]) => name);
  const spread = scheme(colors).span;

  const body = spread <= 35
    ? `Every chromatic colour sits in one emotional band, so the palette says one thing `
      + `clearly and says it everywhere. The loudest voice is ${lead.hex}, reading as `
      + `${lead.emotion.primary.name.toLowerCase()}: ${lead.emotion.primary.signal} `
      + `${lead.emotion.primary.caution}`
    : `The palette spans several emotional bands - ${top.join(', ').toLowerCase()} - so which one `
      + `a viewer takes away depends entirely on which colour dominates the piece in front of them. `
      + `That is a dominance rule to write down, not a detail. The most saturated colour, ${lead.hex}, `
      + `reads as ${lead.emotion.primary.name.toLowerCase()}: ${lead.emotion.primary.signal}`;

  return {
    top,
    lead,
    title: `Communicates ${top.slice(0, 2).join(' and ').toLowerCase()}`,
    body: `${body} These are conventional associations, not measured effects - culturally specific, `
      + 'and moved at least as much by saturation and lightness as by hue.',
    swatches: byC.slice(0, 4).map((g) => g.hex),
  };
}

/** The status set, tuned to sit beside a cool palette. Each clears 4.5:1 on white. */
export const STATUS_SET = Object.freeze([
  { name: 'Alarm red', light: '#c94d44', dark: '#dc756b', use: 'fault, alarm, destructive actions' },
  { name: 'Warning amber', light: '#a66800', dark: '#c7852a', use: 'caution, degraded state, unsaved work' },
  { name: 'Normal green', light: '#35864c', dark: '#4aa462', use: 'healthy, armed, confirmed' },
  { name: 'Info cyan', light: '#0a819d', dark: '#00a0c2', use: 'neutral notices and tips' },
]);

/**
 * Concrete changes, ranked by how much each fixes.
 * Each is {rank, title, body, swatches} plus at most one action:
 *   add: {name, hex} | addAll: [...] | remove: hex
 */
export function recommendations(colors) {
  const out = [];
  const all = geometries(colors);
  const byC = [...all].sort((a, b) => b.C - a.C);
  const lead = byC[0];

  const [worstVoid] = voids(colors);
  if (worstVoid && lead && lead.C > 0.015) {
    const fix = deepenToPass(lead.hex, '#ffffff', 4.5);
    if (fix) {
      out.push({
        rank: 1,
        title: `Add a deep version of ${lead.hex} - ${fix.hex}`,
        body: `The highest-value single change. It fills the ${f(worstVoid.size, 0)}-point void, and `
          + `because it holds the same hue it reads as the same brand colour rather than a new one. `
          + `It clears ${f(fix.ratio)}:1 on white, so the signature colour can carry link text, button `
          + 'labels, headings and chart strokes instead of being restricted to fills.',
        swatches: [lead.hex, fix.hex],
        add: { name: 'Deep accent', hex: fix.hex },
      });
    }
  }

  for (const dup of redundancies(colors).slice(0, 2)) {
    const keep = dup.a.C >= dup.b.C ? dup.a : dup.b;
    const drop = keep === dup.a ? dup.b : dup.a;
    out.push({
      rank: 2,
      title: `Drop ${drop.hex}, keep ${keep.hex}`,
      body: `At ${f(dup.ratio)}:1 these are indistinguishable in use. ${keep.hex} is the one to keep `
        + `- chroma ${f(keep.C, 3)} against ${f(drop.C, 3)}, so it is a tinted colour that belongs to `
        + `the palette while ${drop.hex} is effectively a plain grey. Fewer swatches that each do one `
        + 'job beats more swatches that overlap.',
      swatches: [dup.a.hex, dup.b.hex],
      remove: drop.hex,
    });
  }

  const hasBand = (lo, hi) => all.some((g) => !g.neutral && g.hslS > 20 && g.hslH >= lo && g.hslH <= hi);
  if (!hasBand(0, 20) && !hasBand(95, 165)) {
    out.push({
      rank: 3,
      title: 'Define a functional set alongside the brand set',
      body: 'These are tuned to sit with a cool palette - desaturated enough not to fight it, and '
        + 'each clears 4.5:1 on white. Each has a lighter twin for dark backgrounds, because the '
        + 'light versions fall below 4.5:1 on a dark ground. Keep them strictly functional: the '
        + 'moment red appears decoratively, it stops meaning fault.',
      swatches: STATUS_SET.map((s) => s.light),
      addAll: STATUS_SET.map((s) => ({ name: s.name, hex: s.light })),
    });
  }

  const black = all.find((g) => g.hex.toLowerCase() === '#000000');
  const otherDark = all.find((g) => g !== black && g.L < 45);
  if (black && otherDark) {
    out.push({
      rank: 4,
      title: `Retire pure black in favour of ${otherDark.hex}`,
      body: `They are only ${f(contrast('#000000', otherDark.hex))}:1 apart, so black adds no usable `
        + 'contrast step - but it does break the hue story, because it is the one swatch with no hue '
        + 'at all. On screen it also vibrates against white in a way a tinted dark does not, which '
        + 'makes long text more tiring. Keep it as a print-only value if a supplier demands 100% K.',
      swatches: ['#000000', otherDark.hex],
      remove: '#000000',
    });
  }

  return out.sort((a, b) => a.rank - b.rank);
}

/** One line the header can show. */
export function headline(colors) {
  const sch = scheme(colors);
  const s = summarise(colors);
  if (sch.chromatic.length < 2) return 'Neutral palette - no chromatic range to assess';
  return `${sch.name} - ${f(sch.span, 0)} degree hue spread - ${sch.chromatic.length} chromatic, `
    + `${sch.neutrals.length} neutral - ${s.bodySafe} of ${s.pairs} pairs safe for body text`;
}

export { deltaE, hueGap };
