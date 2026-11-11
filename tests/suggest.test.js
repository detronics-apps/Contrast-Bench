import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, toOklch, hueGap, deltaE, fromOklch } from '../js/color.js';
import { TARGETS } from '../js/wcag.js';
import { searchShift, suggestions, bestFix, deepenToPass } from '../js/suggest.js';

test('a suggestion actually reaches the target it was asked for', () => {
  for (const target of TARGETS) {
    for (const s of suggestions('#7fabc7', '#ffffff', target)) {
      const other = s.role === 'text' ? '#ffffff' : '#7fabc7';
      assert.ok(contrast(s.hex, other) >= target,
        `${s.verb} the ${s.role} to ${s.hex} only reached ${contrast(s.hex, other).toFixed(2)}`);
      assert.ok(Math.abs(s.ratio - contrast(s.hex, other)) < 1e-9, 'reported ratio must be real');
    }
  }
});

test('a suggestion holds hue and chroma - it stays the same brand colour', () => {
  const before = toOklch('#7fabc7');
  for (const s of suggestions('#7fabc7', '#ffffff', 4.5)) {
    if (s.role !== 'text') continue;
    const after = toOklch(s.hex);
    assert.ok(hueGap(before.H, after.H) < 6, `hue moved ${hueGap(before.H, after.H).toFixed(1)} deg`);
    assert.ok(Math.abs(before.C - after.C) < 0.025, 'chroma moved more than gamut clamping explains');
  }
});

test('suggestions are ranked by drift, nearest first', () => {
  const list = suggestions('#7fabc7', '#ffffff', 4.5);
  assert.ok(list.length > 0, 'this pair must be fixable');
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].drift <= list[i].drift, 'suggestions must be sorted by drift');
  }
  assert.equal(bestFix('#7fabc7', '#ffffff', 4.5).hex, list[0].hex);
  assert.ok(list.every((s) => s.drift === deltaE(s.base, s.hex)), 'drift must be measured, not guessed');
});

test('a pair that already passes gets no suggestions', () => {
  assert.deepEqual(suggestions('#1f2d3d', '#ffffff', 4.5), []);
  assert.equal(bestFix('#1f2d3d', '#ffffff', 4.5), null);
  // ...but a stricter target it does not meet still produces them.
  // Deep Steel clears 4.5 on white (4.60) and falls short of 7.
  assert.deepEqual(suggestions('#447b9d', '#ffffff', 4.5), []);
  assert.ok(suggestions('#447b9d', '#ffffff', 7).length > 0);
});

test('searchShift finds the NEAREST crossing, not just any crossing', () => {
  // Contrast is not monotonic in lightness: a mid-tone moving towards the other
  // colour gets worse before it gets better. Stepping must stop at the first pass.
  const found = searchShift('#7fabc7', '#ffffff', 4.5, -1);
  assert.ok(found, 'darkening should work against white');
  const { L, C, H } = toOklch('#7fabc7');
  // Nothing lighter than the answer, but still darker than the original, should pass.
  const answerL = toOklch(found.hex).L;
  for (let probe = answerL + 1; probe < L; probe += 0.5) {
    assert.ok(contrast(fromOklch(probe / 100, C, H), '#ffffff') < 4.5,
      `a nearer solution existed at L=${probe.toFixed(1)}`);
  }
});

test('searchShift returns null rather than inventing a result', () => {
  // Nothing lighter than white, so lightening cannot raise contrast against white.
  assert.equal(searchShift('#ffffff', '#ffffff', 4.5, 1), null);
  // Black against black cannot be darkened into contrast either.
  assert.equal(searchShift('#000000', '#000000', 4.5, -1), null);
});

test('suggestions offer both roles when both can be moved', () => {
  const roles = new Set(suggestions('#7fabc7', '#ffffff', 4.5).map((s) => s.role));
  assert.ok(roles.has('text'), 'the text can be darkened');
  assert.ok(roles.has('background'), 'the background can be darkened');
});

test('deepenToPass derives the missing mid-tone from the palette own hue', () => {
  const fix = deepenToPass('#7fabc7', '#ffffff', 4.5);
  assert.ok(fix, 'Steel Blue must be deepenable');
  assert.ok(contrast(fix.hex, '#ffffff') >= 4.5);
  assert.ok(hueGap(toOklch('#7fabc7').H, toOklch(fix.hex).H) < 6, 'the hue must survive');
  // It should be the LIGHTEST colour that passes, i.e. the smallest change.
  const { C, H } = toOklch(fix.hex);
  const lighter = fromOklch((toOklch(fix.hex).L + 2) / 100, C, H);
  assert.ok(contrast(lighter, '#ffffff') < 4.5, 'a lighter colour would also have passed');
});

test('deepenToPass returns null when the hue cannot reach the target', () => {
  // Nothing at any lightness clears 21:1 against white except black, which has no hue.
  assert.equal(deepenToPass('#7fabc7', '#ffffff', 21), null);
});

test('no suggestion silently returns the colour it was handed', () => {
  for (const target of TARGETS) {
    for (const pair of [['#7fabc7', '#ffffff'], ['#454b52', '#1f2d3d'], ['#d7e5f2', '#e9eaec']]) {
      for (const s of suggestions(pair[0], pair[1], target)) {
        assert.notEqual(s.hex.toLowerCase(), s.base.toLowerCase(),
          'a fix that changes nothing is not a fix');
      }
    }
  }
});
