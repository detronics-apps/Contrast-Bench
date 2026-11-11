import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast } from '../js/color.js';
import {
  CRITERIA, TARGETS, grade, GRADE_LABEL, GRADE_TEXT, atLeast,
  judge, nextTarget, judgeAll, summarise, reach,
} from '../js/wcag.js';

const BRAND = ['#000000', '#ffffff', '#1f2d3d', '#454b52', '#7fabc7', '#d7e5f2', '#e9eaec', '#cdd1d2'];

test('grade boundaries are exact, not approximate', () => {
  assert.equal(grade(21), 'aaa');
  assert.equal(grade(7), 'aaa');
  assert.equal(grade(6.999), 'aa');
  assert.equal(grade(4.5), 'aa');
  assert.equal(grade(4.499), 'aaLarge');
  assert.equal(grade(3), 'aaLarge');
  assert.equal(grade(2.999), 'fail');
  assert.equal(grade(1), 'fail');
});

test('grade is monotonic across the whole range', () => {
  let prev = 'fail';
  for (let r = 1; r <= 21; r += 0.01) {
    const g = grade(r);
    assert.ok(atLeast(g, prev), `grade went backwards at ${r.toFixed(2)}`);
    prev = g;
  }
});

test('every grade a judgement can produce has a label and a sentence', () => {
  // Pitfall: an unrecognised enum falling back in silence. Both sides must agree.
  const produced = new Set(['same']);
  for (let r = 1; r <= 21; r += 0.05) produced.add(grade(r));
  for (const g of produced) {
    assert.ok(GRADE_LABEL[g], `no label for grade ${g}`);
    assert.ok(GRADE_TEXT[g], `no sentence for grade ${g}`);
  }
  // And nothing unreachable is declared either.
  for (const key of Object.keys(GRADE_LABEL)) {
    assert.ok(produced.has(key), `${key} is declared but never produced`);
  }
});

test('criteria thresholds match the standard', () => {
  const byKey = Object.fromEntries(CRITERIA.map((c) => [c.key, c.req]));
  assert.equal(byKey.aaNormal, 4.5);
  assert.equal(byKey.aaaNormal, 7);
  assert.equal(byKey.aaLarge, 3);
  assert.equal(byKey.aaaLarge, 4.5);
  assert.equal(byKey.ui, 3);
  assert.equal(CRITERIA.length, 5);
});

test('judge agrees with grade and reports every criterion', () => {
  const j = judge('#1f2d3d', '#ffffff');
  assert.equal(j.ratio.toFixed(2), '13.99');
  assert.equal(j.grade, 'aaa');
  assert.equal(j.same, false);
  assert.equal(j.criteria.length, 5);
  assert.ok(j.criteria.every((c) => c.pass), 'AAA should pass all five');

  const fail = judge('#7fabc7', '#ffffff');
  assert.equal(fail.grade, 'fail');
  assert.ok(fail.criteria.every((c) => !c.pass), '2.46:1 should fail all five');
});

test('judge marks a colour against itself as same, not as a failure', () => {
  const j = judge('#1f2d3d', '#1f2d3d');
  assert.equal(j.same, true);
  assert.equal(j.grade, 'same');
  assert.equal(j.ratio, 1);
});

test('nextTarget names the smallest unmet level', () => {
  assert.equal(nextTarget(1), 3);
  assert.equal(nextTarget(3), 4.5);
  assert.equal(nextTarget(4.6), 7);
  assert.equal(nextTarget(7), null);
  assert.equal(nextTarget(21), null);
  for (const t of TARGETS) assert.ok(TARGETS.includes(t));
});

test('judgeAll returns each unordered pair exactly once', () => {
  const pairs = judgeAll(BRAND);
  assert.equal(pairs.length, (BRAND.length * (BRAND.length - 1)) / 2);
  assert.equal(pairs.length, 28);
  const seen = new Set(pairs.map((p) => `${p.i}-${p.j}`));
  assert.equal(seen.size, pairs.length, 'a pair was counted twice');
  for (const p of pairs) assert.ok(p.i < p.j, 'pairs should be in canonical order');
});

test('summarise accounts for every pair exactly once', () => {
  const s = summarise(BRAND);
  assert.equal(s.pairs, 28);
  assert.equal(s.bodySafe + s.largeOnly + s.unusable, s.pairs,
    'every pair must land in exactly one band');
  assert.ok(s.aaa <= s.bodySafe, 'AAA pairs are a subset of body-safe pairs');
  // The finding that started this project.
  assert.equal(s.bodySafe, 14);
  assert.equal(s.largeOnly, 1);
  assert.equal(s.unusable, 13);
});

test('summarise handles degenerate palettes without dividing by zero', () => {
  assert.equal(summarise([]).pairs, 0);
  assert.equal(summarise([]).bodySafeFraction, 0);
  assert.equal(summarise(['#ffffff']).pairs, 0);
});

test('reach counts each colour against all the others, never itself', () => {
  const r = reach(BRAND);
  assert.equal(r.length, BRAND.length);
  for (const row of r) {
    assert.equal(row.total, BRAND.length - 1);
    assert.ok(!row.others.some((o) => o.j === row.i), 'a colour was compared with itself');
    assert.ok(row.bodySafe <= row.largeSafe, 'body-safe is a subset of large-safe');
    for (let k = 1; k < row.others.length; k++) {
      assert.ok(row.others[k - 1].ratio >= row.others[k].ratio, 'reach should sort by ratio');
    }
  }
});

test('reach agrees with contrast for a known row', () => {
  const steel = reach(BRAND).find((r) => r.hex === '#7fabc7');
  assert.equal(steel.bodySafe, 2, 'Steel Blue reaches AA against black and Ink Navy only');
  for (const o of steel.others) {
    assert.equal(o.ratio, contrast('#7fabc7', o.other));
  }
});
