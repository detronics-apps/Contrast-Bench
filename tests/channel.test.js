import test from 'node:test';
import assert from 'node:assert/strict';
import { deltaE, contrast, toGreyscale, simulateCvd, CVD_TYPES } from '../js/color.js';
import {
  COLLAPSE_DE, TIGHT_DE, GREY_RATIO, LARGE_TEXT,
  separation, greyscaleLadder, colourVision, legibility,
  analyse, effectiveCount, findSeparableColour, channelFindings,
} from '../js/channel.js';

// The five content families, as published.
const FAMILIES = [
  { name: 'Thinking', hex: '#a18ac8' },
  { name: 'Building', hex: '#4f9d73' },
  { name: 'Engineering', hex: '#526f91' },
  { name: 'Family', hex: '#e9a16b' },
  { name: 'Faith', hex: '#d4b96f' },
];

// A set built to separate, as the control case.
const CLEAN = [
  { name: 'A', hex: '#1f2d3d' },
  { name: 'B', hex: '#b03a2e' },
  { name: 'C', hex: '#7fabc7' },
  { name: 'D', hex: '#f0e6d2' },
];

test('separation returns every unordered pair, worst first', () => {
  const pairs = separation(FAMILIES);
  assert.equal(pairs.length, 10);
  for (let i = 1; i < pairs.length; i++) {
    assert.ok(pairs[i - 1].deltaE <= pairs[i].deltaE, 'pairs must be sorted by distance');
  }
  for (const p of pairs) {
    assert.equal(p.deltaE, deltaE(p.a.hex, p.b.hex), 'reported distance must be measured');
    assert.ok(p.hueGap >= 0 && p.hueGap <= 180);
  }
});

test('verdicts follow the declared thresholds exactly', () => {
  for (const p of separation(FAMILIES)) {
    const expected = p.deltaE < COLLAPSE_DE ? 'collapses' : p.deltaE < TIGHT_DE ? 'tight' : 'distinct';
    assert.equal(p.verdict, expected, `${p.a.name}/${p.b.name} at ${p.deltaE.toFixed(1)}`);
  }
});

test('the published set has exactly one collapsing pair, and it is Family/Faith', () => {
  const collapsing = separation(FAMILIES).filter((p) => p.verdict === 'collapses');
  assert.equal(collapsing.length, 1);
  const names = [collapsing[0].a.name, collapsing[0].b.name].sort();
  assert.deepEqual(names, ['Faith', 'Family']);
  assert.ok(collapsing[0].deltaE < 8, `expected a severe collapse, got ${collapsing[0].deltaE.toFixed(1)}`);
});

test('greyscaleLadder orders by value and measures the real step', () => {
  const rungs = greyscaleLadder(FAMILIES);
  assert.equal(rungs.length, FAMILIES.length);
  for (let i = 1; i < rungs.length; i++) {
    assert.ok(rungs[i - 1].value <= rungs[i].value, 'ladder must ascend');
  }
  assert.equal(rungs[rungs.length - 1].stepToNext, null, 'the top rung has no next');
  for (const r of rungs.slice(0, -1)) {
    assert.equal(r.stepToNext, contrast(toGreyscale(r.hex), toGreyscale(
      rungs[rungs.indexOf(r) + 1].hex)));
  }
});

test('greyscale catches the pairs that are different hues at one value', () => {
  const collapses = analyse(FAMILIES).greyCollapses;
  assert.ok(collapses.length >= 2, 'expected Building/Thinking and Family/Faith');
  for (const c of collapses) assert.ok(c.stepToNext < GREY_RATIO);
});

test('colourVision reports a worst pair for each of the three types', () => {
  const results = colourVision(FAMILIES);
  assert.equal(results.length, CVD_TYPES.length);
  for (const r of results) {
    assert.ok(CVD_TYPES.includes(r.type));
    assert.equal(r.collapses, r.deltaE < COLLAPSE_DE);
    assert.equal(r.deltaE, deltaE(simulateCvd(r.a.hex, r.type), simulateCvd(r.b.hex, r.type)));
  }
  assert.ok(results.every((r) => r.collapses), 'every type collapses this set');
});

test('legibility measures the best available text colour, not a chosen one', () => {
  const rows = legibility(FAMILIES);
  for (const r of rows) {
    const best = Math.max(...r.options.map((o) => o.ratio));
    assert.equal(r.best.ratio, best);
    assert.equal(r.largeOk, best >= LARGE_TEXT);
    assert.equal(r.bodyOk, best >= 4.5);
  }
});

test('effectiveCount groups everything that merges under any test', () => {
  assert.equal(effectiveCount([]), 0);
  assert.equal(effectiveCount([{ name: 'one', hex: '#1f2d3d' }]), 1);
  // Two identical colours are one marker.
  assert.equal(effectiveCount([
    { name: 'a', hex: '#1f2d3d' }, { name: 'b', hex: '#1f2d3d' },
  ]), 1);
  // The published five do not survive as five.
  const n = effectiveCount(FAMILIES);
  assert.ok(n < FAMILIES.length, `expected fewer than 5 effective markers, got ${n}`);
  assert.ok(n >= 1);
});

test('a set built to separate passes every test', () => {
  const a = analyse(CLEAN);
  assert.equal(a.collapsing.length, 0, 'no pair should collapse');
  assert.equal(a.greyCollapses.length, 0, 'no pair should merge in greyscale');
  assert.equal(a.cvdCollapses.length, 0, 'no pair should merge under colour blindness');
  assert.equal(a.effectiveCount, CLEAN.length, 'all four should stay distinct');
  assert.ok(channelFindings(CLEAN).some((f) => f.level === 'works'));
});

test('analyse never contradicts its own parts', () => {
  const a = analyse(FAMILIES);
  assert.equal(a.collapsing.length, a.pairs.filter((p) => p.verdict === 'collapses').length);
  assert.equal(a.tight.length, a.pairs.filter((p) => p.verdict === 'tight').length);
  assert.ok(a.collapsing.length + a.tight.length <= a.pairs.length);
  assert.equal(a.cvdCollapses.length, a.cvd.filter((c) => c.collapses).length);
  assert.equal(a.illegible.length, a.text.filter((t) => !t.largeOk).length);
});

test('findSeparableColour returns only candidates that meet every constraint', () => {
  const keep = FAMILIES.slice(0, 4);
  const hits = findSeparableColour(keep, { limit: 20 });
  for (const h of hits) {
    assert.match(h.hex, /^#[0-9a-f]{6}$/);
    assert.ok(h.worstDe >= TIGHT_DE, `${h.hex} only reached dE ${h.worstDe.toFixed(1)}`);
    assert.ok(h.worstGrey >= 1.3, `${h.hex} only reached grey ${h.worstGrey.toFixed(2)}`);
    assert.ok(h.worstCvd >= 14, `${h.hex} only reached cvd ${h.worstCvd.toFixed(1)}`);
    assert.ok(h.onWhite >= LARGE_TEXT);
    // And the claims must be independently true.
    for (const k of keep) {
      assert.ok(deltaE(h.hex, k.hex) >= h.worstDe - 1e-9);
    }
  }
});

test('findSeparableColour returns nothing rather than a bad answer', () => {
  // Nothing can be 60 OKLab units from every one of these and still be a colour.
  assert.deepEqual(findSeparableColour(FAMILIES, { minDeltaE: 60 }), []);
});

test('channelFindings names each real problem once', () => {
  const found = channelFindings(FAMILIES);
  assert.ok(found.length > 0);
  const tags = found.map((f) => f.tag);
  assert.ok(tags.includes('Collapses'), 'must report the collapsing pair');
  assert.ok(tags.includes('Greyscale'), 'must report the greyscale merge');
  assert.ok(tags.includes('Effective count'), 'must report the reduced count');
  for (const f of found) {
    assert.ok(['issue', 'watch', 'works'].includes(f.level), `bad level ${f.level}`);
    assert.ok(f.title && f.body, 'every finding needs a title and a body');
    assert.ok(Array.isArray(f.swatches));
  }
  // Issues first.
  const levels = found.map((f) => f.level);
  assert.deepEqual(levels, [...levels].sort((a, b) =>
    ({ issue: 0, watch: 1, works: 2 }[a] - { issue: 0, watch: 1, works: 2 }[b])));
});

test('no finding quotes a raw unrounded float', () => {
  // Pitfall: "draws 19.6078431373 mA" - an internal value interpolated into prose.
  for (const f of channelFindings(FAMILIES)) {
    const text = `${f.title} ${f.body}`;
    assert.doesNotMatch(text, /\d+\.\d{4,}/, `unrounded number in: ${text}`);
  }
});
