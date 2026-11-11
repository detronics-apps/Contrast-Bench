// WCAG 2.1 conformance: what a contrast ratio is allowed to be used for.
// Pure. Thresholds come from SC 1.4.3 (text) and SC 1.4.11 (non-text contrast).

import { contrast } from './color.js';

/**
 * The five things a colour pair gets judged on. `req` is the minimum ratio.
 * "Large" means 18.66px bold or 24px regular and up.
 */
export const CRITERIA = Object.freeze([
  { key: 'aaNormal',  label: 'Body text',       req: 4.5, sc: '1.4.3',  note: 'AA - under 18.66px bold / 24px' },
  { key: 'aaaNormal', label: 'Body text',       req: 7,   sc: '1.4.6',  note: 'AAA - the enhanced target' },
  { key: 'aaLarge',   label: 'Large text',      req: 3,   sc: '1.4.3',  note: 'AA - 18.66px bold or 24px up' },
  { key: 'aaaLarge',  label: 'Large text',      req: 4.5, sc: '1.4.6',  note: 'AAA - headings, display type' },
  { key: 'ui',        label: 'UI and graphics', req: 3,   sc: '1.4.11', note: 'AA - borders, icons, focus rings, chart strokes' },
]);

/** Targets a reader can aim a fix at, smallest first. */
export const TARGETS = Object.freeze([3, 4.5, 7]);

const ORDER = ['fail', 'aaLarge', 'aa', 'aaa'];

/**
 * The best grade a ratio earns.
 *   aaa     7:1 and up - passes every level
 *   aa      4.5:1      - body text safe
 *   aaLarge 3:1        - large text and UI only
 *   fail    under 3:1  - decorative use only
 */
export function grade(ratio) {
  if (ratio >= 7) return 'aaa';
  if (ratio >= 4.5) return 'aa';
  if (ratio >= 3) return 'aaLarge';
  return 'fail';
}

export const GRADE_LABEL = Object.freeze({
  aaa: 'AAA', aa: 'AA', aaLarge: 'AA L', fail: 'FAIL', same: 'SAME',
});

export const GRADE_TEXT = Object.freeze({
  aaa: 'Passes every WCAG level',
  aa: 'Safe for body text (AA)',
  aaLarge: 'Large text and UI only',
  fail: 'Not usable for text',
  same: 'Identical colours',
});

/** True when `a` is at least as good as `b`. Used to assert the grades are ordered. */
export const atLeast = (a, b) => ORDER.indexOf(a) >= ORDER.indexOf(b);

/** Full judgement of one pair: the ratio, its grade, and every criterion's verdict. */
export function judge(foreground, background) {
  const ratio = contrast(foreground, background);
  const same = foreground.toLowerCase() === background.toLowerCase();
  return {
    foreground,
    background,
    ratio,
    grade: same ? 'same' : grade(ratio),
    same,
    criteria: CRITERIA.map((c) => ({ ...c, pass: ratio >= c.req })),
  };
}

/** The smallest target this pair has not yet met, or null when it clears them all. */
export function nextTarget(ratio) {
  return TARGETS.find((t) => ratio < t) ?? null;
}

/**
 * Every unordered pair in a palette, judged. Contrast is symmetric, so a palette of
 * n colours has n*(n-1)/2 distinct pairs, not n^2 - counting both orientations would
 * double every statistic.
 */
export function judgeAll(colors) {
  const out = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      out.push({ i, j, ...judge(colors[i], colors[j]) });
    }
  }
  return out;
}

/** How a palette scores overall. Counts are over unordered pairs. */
export function summarise(colors) {
  const pairs = judgeAll(colors);
  const count = (g) => pairs.filter((p) => p.grade === g).length;
  const bodySafe = count('aaa') + count('aa');
  return {
    pairs: pairs.length,
    aaa: count('aaa'),
    bodySafe,
    largeOnly: count('aaLarge'),
    unusable: count('fail'),
    bodySafeFraction: pairs.length ? bodySafe / pairs.length : 0,
  };
}

/**
 * For each colour: how many of the others it can sit against as body text.
 * Answers "where does this colour actually work", which a matrix shows but does not total.
 */
export function reach(colors) {
  return colors.map((hex, i) => {
    const others = colors
      .map((other, j) => ({ j, other, ratio: contrast(hex, other) }))
      .filter((x) => x.j !== i)
      .map((x) => ({ ...x, grade: grade(x.ratio) }))
      .sort((a, b) => b.ratio - a.ratio);
    return {
      i,
      hex,
      others,
      total: others.length,
      bodySafe: others.filter((x) => x.ratio >= 4.5).length,
      largeSafe: others.filter((x) => x.ratio >= 3).length,
    };
  });
}
