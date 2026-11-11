// The emotion wheel: what a hue is conventionally understood to communicate,
// and - the part the wheel leaves out - what saturation and lightness do to that.
// Pure.
//
// HONESTY NOTE, which the UI must repeat rather than bury:
// These are conventions, not findings. Colour-emotion association is real but it is
// learned, culturally specific (this set is Western/commercial), and far weaker than
// the confident wheels circulating in marketing suggest. Treat an entry as "the
// expectation you are either meeting or deliberately breaking", never as a mechanism.
//
// The wheel is also incomplete in a way that matters more than its cultural bias:
// it is indexed on HUE ALONE. Saturation and lightness move the reading at least as
// much. A pale desaturated red is not desire, it is dusty and calm. `modifiers()`
// below is what restores that, and `readEmotion()` always returns both.

import {
  toHsl, toOklch, fromOklch, contrast, hueGap, deltaE,
  toGreyscale, simulateCvd, CVD_TYPES, hslHueToOklch,
} from './color.js';

/**
 * Twelve anchors at 30 degree spacing, as laid out on the common marketing wheel.
 * `hue` is HSL degrees. `signal`, `caution` and `fit` are the longer reading.
 */
export const EMOTIONS = Object.freeze([
  {
    name: 'Desire', hue: 15, family: 'Red',
    words: ['urgency', 'appetite', 'consequence', 'passion'],
    signal: 'The one hue people read as a command rather than a mood. It shortens reaction time and raises perceived importance.',
    caution: 'In any instrument, safety or status context red is already spoken for - it means fault. Spending it decoratively costs you the ability to use it meaningfully.',
    fit: 'Emergency equipment, food, sport, clearance retail',
  },
  {
    name: 'Cheerfulness', hue: 45, family: 'Orange / Gold',
    words: ['hope', 'warmth', 'optimism', 'generosity'],
    signal: 'Warmth without red\'s alarm, and the highest-luminance band of the spectrum, so it draws the eye at small sizes.',
    caution: 'Almost impossible to bring to 4.5:1 on white without going brown. Never set body text in it.',
    fit: 'Hospitality, energy, agriculture, anything promising lightness',
  },
  {
    name: 'Stimulation', hue: 75, family: 'Yellow-Green',
    words: ['alertness', 'novelty', 'visibility', 'freshness'],
    signal: 'Reads as high-visibility and modern; the hue of safety wear and new-tech branding.',
    caution: 'The most fatiguing band of the spectrum at high saturation, and it dates fast.',
    fit: 'Safety, sports nutrition, disruptive tech',
  },
  {
    name: 'Comfort', hue: 105, family: 'Green',
    words: ['ease', 'growth', 'naturalness', 'recovery'],
    signal: 'Low-arousal and restorative; the colour people report as least tiring to look at.',
    caution: 'Easily reads as institutional or municipal when desaturated.',
    fit: 'Wellbeing, outdoors, sustainability',
  },
  {
    name: 'Happiness', hue: 135, family: 'Green',
    words: ['safety', 'permission', 'health', 'normality'],
    signal: 'The "all clear" of every control room, and the strongest environmental cue available.',
    caution: 'Carries a specific operational meaning in equipment contexts - reserve it for "healthy" rather than spending it on brand.',
    fit: 'Healthcare, environmental, confirm states',
  },
  {
    name: 'Honesty', hue: 165, family: 'Green-Cyan',
    words: ['straightforwardness', 'practicality', 'balance', 'clarity'],
    signal: 'Between green\'s reassurance and blue\'s authority, which makes it read as capable without being cold.',
    caution: 'Enough of a trend colour over the last decade that it can read as generic tech.',
    fit: 'Trades, diagnostics, practical services',
  },
  {
    name: 'Optimism', hue: 195, family: 'Cyan',
    words: ['clarity', 'air', 'possibility', 'cleanliness'],
    signal: 'Open and weightless; strongly associated with clean water, filtered air and clinical hygiene.',
    caution: 'Very hard to make legible - cyan sits high on the luminance curve, so it fails text contrast on white at almost any saturation.',
    fit: 'Medical, water, travel, SaaS',
  },
  {
    name: 'Loyalty', hue: 225, family: 'Blue',
    words: ['trust', 'precision', 'stability', 'competence'],
    signal: 'The engineering blue - schematics, readouts, instrumentation. Signals that something was measured rather than guessed. The most-used corporate hue in the world precisely because it is the safest.',
    caution: 'Emotionally cool. Communicates capability well and warmth or care poorly, and its safety means low differentiation.',
    fit: 'Detection and measurement, finance, enterprise, aerospace',
  },
  {
    name: 'Reliability', hue: 255, family: 'Blue-Violet',
    words: ['depth', 'consideration', 'intelligence', 'calm authority'],
    signal: 'Blue\'s authority shifted towards the deliberate and the crafted. Reads as more considered than plain blue.',
    caution: 'Heavily used by consumer software since the 2010s, so it can read as startup-default.',
    fit: 'Data and AI products, premium services, editorial',
  },
  {
    name: 'Power', hue: 285, family: 'Violet',
    words: ['authority', 'imagination', 'ceremony', 'mystery'],
    signal: 'The historically expensive pigment, still read as elevated and non-industrial.',
    caution: 'Weak at conveying reliability, which makes it a poor fit for equipment people depend on.',
    fit: 'Luxury, creative tools, ceremony',
  },
  {
    name: 'Elegance', hue: 315, family: 'Magenta',
    words: ['refinement', 'individuality', 'confidence', 'taste'],
    signal: 'Reads as deliberately chosen rather than inherited - a colour nobody picks by accident.',
    caution: 'Strongly gendered in many markets and easily read as unserious in industrial contexts.',
    fit: 'Beauty, fashion, design practice',
  },
  {
    name: 'Excitement', hue: 345, family: 'Red-Magenta',
    words: ['energy', 'disruption', 'attention', 'play'],
    signal: 'High recall and high risk; the colour of brands that have decided to stand out rather than fit in.',
    caution: 'Exhausting over large areas and almost impossible to pair with a conservative palette.',
    fit: 'Consumer tech, campaigns, entertainment',
  },
]);

export const EMOTION_NAMES = EMOTIONS.map((e) => e.name);

/** The anchors nearest a hue, with a 0-1 weight for how strongly each applies. */
export function emotionsForHue(hue, count = 2) {
  return EMOTIONS
    .map((e) => ({ emotion: e, gap: hueGap(e.hue, hue) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, count)
    .map(({ emotion, gap }) => ({ emotion, gap, weight: Math.max(0, 1 - gap / 30) }));
}

/** Where on the wheel an emotion sits, and the hue band it covers. */
export function hueForEmotion(name) {
  const found = EMOTIONS.find((e) => e.name.toLowerCase() === String(name).toLowerCase());
  if (!found) return null;
  return { ...found, from: (found.hue - 15 + 360) % 360, to: (found.hue + 15) % 360 };
}

/**
 * What saturation and lightness do to the hue's reading.
 * This is the half the wheel omits, and it is often the larger half.
 */
export function modifiers(hex) {
  const { S, L } = toHsl(hex);
  const out = [];

  if (S < 8) {
    out.push({
      axis: 'saturation', key: 'neutral',
      text: 'Effectively a neutral. Hue carries no meaning here - whatever the wheel says about this angle does not apply.',
    });
  } else if (S < 25) {
    out.push({
      axis: 'saturation', key: 'muted',
      text: 'Desaturated, which damps the emotion sharply towards restraint and professionalism. This is the single biggest reason a colour does not feel like its wheel position.',
    });
  } else if (S > 65) {
    out.push({
      axis: 'saturation', key: 'vivid',
      text: 'Highly saturated, which amplifies the emotion and makes it demanding. Tiring over large areas and hard to pair.',
    });
  } else {
    out.push({
      axis: 'saturation', key: 'moderate',
      text: 'Moderately saturated - enough colour to register the association, not enough to dominate.',
    });
  }

  if (L > 82) {
    out.push({
      axis: 'lightness', key: 'tint',
      text: 'A tint. Tints read as gentle and recessive whatever their hue, and behave as surfaces rather than marks - they cannot carry text or be remembered as "the brand colour".',
    });
  } else if (L < 25) {
    out.push({
      axis: 'lightness', key: 'shade',
      text: 'A shade. Shades read as serious and weighty whatever their hue, and the emotional reading of the hue itself becomes hard to detect.',
    });
  } else {
    out.push({
      axis: 'lightness', key: 'mid',
      text: 'Mid lightness, where the hue\'s character reads most clearly - and the one band usable both as text on a light ground and as a fill under light type.',
    });
  }

  return out;
}

/** The full reading of one colour: wheel position, strength, and the modifiers. */
export function readEmotion(hex) {
  const { H, S, L } = toHsl(hex);
  const neutral = S < 8;
  const near = emotionsForHue(H, 2);
  return {
    hex,
    hue: H, saturation: S, lightness: L,
    neutral,
    primary: near[0].emotion,
    secondary: near[1].emotion,
    blend: near[0].weight < 0.6,
    near,
    modifiers: modifiers(hex),
    caveat: neutral
      ? 'This colour has almost no hue, so the wheel does not describe it. Its reading comes from lightness alone.'
      : 'Conventional association, not a measured effect. Culturally specific and modulated heavily by the saturation and lightness noted above.',
  };
}

/**
 * The inversion, and the point of the wheel: "I want to communicate X - what can I use?"
 *
 * Returns real hexes in the emotion's hue band, each with its contrast on white and
 * on a dark ground, so the answer is usable rather than merely thematic. Colours that
 * cannot carry text are still returned, flagged, because a fill is a legitimate use.
 */
export function paletteForEmotion(name, { dark = '#1f2d3d', steps = 7, chroma = 0.11 } = {}) {
  const anchor = hueForEmotion(name);
  if (!anchor) return null;

  // The anchors are stated in HSL degrees; the ramp is built in OKLCh. These are
  // different angles, so the hue has to be converted once, here, rather than assumed.
  const oklchHue = hslHueToOklch(anchor.hue);

  const swatches = [];
  for (let i = 0; i < steps; i++) {
    const L = 0.22 + (i * (0.94 - 0.22)) / (steps - 1);
    const hex = fromOklch(L, chroma, oklchHue);
    const onWhite = contrast(hex, '#ffffff');
    const onDark = contrast(hex, dark);
    swatches.push({
      hex,
      lightness: L * 100,
      onWhite,
      onDark,
      bodyOnWhite: onWhite >= 4.5,
      bodyOnDark: onDark >= 4.5,
      usableAs: onWhite >= 4.5 ? 'text on light' : onDark >= 4.5 ? 'text on dark' : 'fill only',
    });
  }

  return {
    emotion: anchor,
    swatches,
    bestOnLight: swatches.filter((s) => s.bodyOnWhite).sort((a, b) => b.lightness - a.lightness)[0] ?? null,
    bestOnDark: swatches.filter((s) => s.bodyOnDark).sort((a, b) => a.lightness - b.lightness)[0] ?? null,
  };
}

/**
 * Keep both hues, separate by lightness.
 *
 * When two categories must stay on their own emotions but collapse into each other,
 * hue cannot move - it is carrying the meaning. Lightness can, because the wheel has
 * no opinion about it. This finds the smallest lightness split that separates the pair
 * on all three tests (perceptual, greyscale, colour vision), or reports that none does.
 *
 * Returns null when hue alone is too close for ANY lightness split to rescue - which
 * is a real answer: those two categories need a different distinction, not a different shade.
 */
export function separateByLightness(aHex, bHex, {
  minDeltaE = 20, minGrey = 1.4, minCvd = 14, keep = 'a',
  // The usable band for a category marker. Outside it a colour stops being a marker:
  // below 16 it reads as black, above 90 it reads as paper and cannot hold type.
  // Stated as options so the constraint is visible and arguable, not a magic number.
  minL = 0.16, maxL = 0.90,
} = {}) {
  const fixed = keep === 'a' ? aHex : bHex;
  const moving = keep === 'a' ? bHex : aHex;
  const { C, H } = toOklch(moving);
  const startL = toOklch(moving).L / 100;

  let best = null;
  for (let L = minL; L <= maxL + 1e-9; L += 0.01) {
    const hex = fromOklch(L, C, H);
    const de = deltaE(hex, fixed);
    const grey = contrast(toGreyscale(hex), toGreyscale(fixed));
    const cvd = Math.min(...CVD_TYPES.map((t) => deltaE(simulateCvd(hex, t), simulateCvd(fixed, t))));
    if (de >= minDeltaE && grey >= minGrey && cvd >= minCvd) {
      const move = Math.abs(L - startL) * 100;
      if (!best || move < best.move) {
        best = { hex, lightness: L * 100, move, deltaE: de, grey, cvd, hue: H };
      }
    }
  }
  return best;
}
