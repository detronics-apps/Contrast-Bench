// Shift suggestions: the smallest change to a colour that makes a failing pair pass.
// Pure.
//
// The move is always lightness in OKLCh, holding hue and chroma. That is deliberate:
// it is the one axis that can be changed without the result reading as a different
// brand colour, which is what makes a suggestion adoptable rather than merely correct.

import { contrast, toOklch, fromOklch, deltaE, driftWord } from './color.js';

const STEP = 0.0015;   // ~1/650 of the lightness range: finer than anyone can see
const MAX_STEPS = 700;

/**
 * Walk lightness away from `base` in one direction until the pair clears `target`.
 *
 * Stepping rather than bisecting on purpose: contrast against a fixed colour is NOT
 * monotonic in lightness. A mid-tone moving towards the other colour gets worse before
 * it gets better, and a bisection would either miss the crossing or find the far one.
 * Stepping finds the nearest crossing, which is the smallest change.
 *
 * @param {number} direction +1 to lighten, -1 to darken
 * @returns {{hex, ratio, drift, deltaL}|null} null when that direction never gets there
 */
export function searchShift(base, other, target, direction) {
  const { L, C, H } = toOklch(base);
  const from = L / 100;
  for (let i = 1; i <= MAX_STEPS; i++) {
    const lightness = from + direction * STEP * i;
    if (lightness > 1.0001 || lightness < -0.0001) break;
    const hex = fromOklch(lightness, C, H);
    const ratio = contrast(hex, other);
    if (ratio >= target) {
      return { hex, ratio, drift: deltaE(base, hex), deltaL: (lightness - from) * 100 };
    }
  }
  return null;
}

/**
 * Every way to make this pair reach `target`, nearest first.
 * Four candidates are tried - lighten or darken, the text or the background - and
 * the ones that work are ranked by how far they drift from the original colour.
 */
export function suggestions(foreground, background, target) {
  if (contrast(foreground, background) >= target) return [];

  const out = [];
  const roles = [
    { role: 'text', base: foreground, other: background },
    { role: 'background', base: background, other: foreground },
  ];
  for (const { role, base, other } of roles) {
    for (const [direction, verb] of [[1, 'Lighten'], [-1, 'Darken']]) {
      const found = searchShift(base, other, target, direction);
      if (!found) continue;
      if (found.hex.toLowerCase() === base.toLowerCase()) continue;
      out.push({ role, verb, base, ...found, drift: found.drift, word: driftWord(found.drift) });
    }
  }

  const seen = new Set();
  return out
    .filter((s) => {
      const key = `${s.role}:${s.hex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.drift - b.drift);
}

/**
 * The single best fix, or null if lightness alone cannot reach the target.
 * A null here is a real finding: the pair needs a different colour, not an adjustment.
 */
export function bestFix(foreground, background, target) {
  return suggestions(foreground, background, target)[0] ?? null;
}

/**
 * The deepest version of a hue that still clears `target` against `against`.
 * This is how the missing mid-tone is derived: take the palette's own accent hue and
 * push it down until it can carry text, so the new colour belongs to the family.
 */
export function deepenToPass(source, against, target, { maxChroma = 0.085 } = {}) {
  const { C, H } = toOklch(source);
  const chroma = Math.min(maxChroma, C * 1.25);
  for (let L = 0.75; L >= 0.3; L -= 0.005) {
    const hex = fromOklch(L, chroma, H);
    if (contrast(hex, against) >= target) {
      return { hex, ratio: contrast(hex, against), drift: deltaE(source, hex), hue: H };
    }
  }
  return null;
}
