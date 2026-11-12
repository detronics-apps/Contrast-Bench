import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, toOklch, hueGap, deltaE } from '../js/color.js';
import {
  USE, DEFAULT_NEUTRALS, buildRamp, againstNeutrals, analyseRamp, rampFindings,
} from '../js/ramp.js';

// The five content families, each judged on its own rather than against each other.
const FAMILIES = [
  ['Thinking', '#a18ac8'],
  ['Building', '#4f9d73'],
  ['Engineering', '#526f91'],
  ['Family', '#e9a16b'],
  ['Faith', '#d4b96f'],
];

test('a ramp holds the seed hue at every usable step', () => {
  for (const [, seed] of FAMILIES) {
    const want = toOklch(seed).H;
    for (const step of buildRamp(seed)) {
      // The extreme ends lose hue precision to gamut clamping; the usable band is
      // where the claim has to hold.
      if (step.lightness < 20 || step.lightness > 92) continue;
      assert.ok(hueGap(toOklch(step.hex).H, want) < 8,
        `${seed} step ${step.hex} drifted ${hueGap(toOklch(step.hex).H, want).toFixed(1)} deg`);
    }
  }
});

test('a ramp ascends in lightness and contains the seed exactly once', () => {
  for (const [, seed] of FAMILIES) {
    const ramp = buildRamp(seed);
    assert.equal(ramp.filter((s) => s.isSeed).length, 1, 'the seed must appear once');
    for (let i = 1; i < ramp.length; i++) {
      assert.ok(ramp[i].lightness >= ramp[i - 1].lightness, 'a ramp must ascend');
    }
    for (const [i, s] of ramp.entries()) assert.equal(s.index, i, 'indices must be sequential');
  }
});

test('the seed is never shadowed by a near-duplicate generated step', () => {
  for (const [, seed] of FAMILIES) {
    const ramp = buildRamp(seed);
    for (const s of ramp) {
      if (s.isSeed) continue;
      assert.ok(deltaE(s.hex, seed) > 3, `${s.hex} is a duplicate of the seed ${seed}`);
    }
  }
});

test('every step reports a use that matches its own measurements', () => {
  for (const [, seed] of FAMILIES) {
    for (const s of buildRamp(seed)) {
      assert.equal(s.onWhite, contrast(s.hex, '#ffffff'));
      assert.equal(s.onBlack, contrast(s.hex, '#000000'));
      assert.equal(s.textOnLight, s.onWhite >= 4.5);
      assert.equal(s.textOnDark, s.onBlack >= 4.5);
      const expected = s.textOnLight && s.textOnDark ? USE.bothText
        : s.textOnLight ? USE.textOnLight
        : s.textOnDark ? USE.textOnDark : USE.fill;
      assert.equal(s.use, expected, `${s.hex} mislabelled`);
    }
  }
});

test('a ramp always offers a usable text colour on both grounds', () => {
  // Any hue can be pushed dark enough for white grounds and light enough for black.
  for (const [name, seed] of FAMILIES) {
    const a = analyseRamp(seed);
    assert.ok(a.forLight, `${name} offers nothing for text on white`);
    assert.ok(a.forDark, `${name} offers nothing for text on black`);
    assert.ok(a.forLight.onWhite >= 4.5);
    assert.ok(a.forDark.onBlack >= 4.5);
  }
});

test('forLight is the LIGHTEST passing step - the smallest change from the seed', () => {
  for (const [, seed] of FAMILIES) {
    const a = analyseRamp(seed);
    for (const s of a.ramp) {
      if (s.textOnLight) assert.ok(s.lightness <= a.forLight.lightness + 1e-9,
        `${s.hex} passes and is lighter than the one offered`);
    }
  }
});

test('forDark is the DARKEST passing step', () => {
  for (const [, seed] of FAMILIES) {
    const a = analyseRamp(seed);
    for (const s of a.ramp) {
      if (s.textOnDark) assert.ok(s.lightness >= a.forDark.lightness - 1e-9,
        `${s.hex} passes and is darker than the one offered`);
    }
  }
});

test('four of the five families are dark-ground colours, not fills', () => {
  // Each was picked as a panel colour. None can carry text on WHITE - but all four
  // clear 4.5:1 against black comfortably, so they are text-on-dark colours rather
  // than fills. The distinction decides whether a section can set type in its own
  // colour at all, which is exactly what the ramp exists to answer.
  for (const hex of ['#a18ac8', '#4f9d73', '#e9a16b', '#d4b96f']) {
    const s = analyseRamp(hex).seedStep;
    assert.equal(s.textOnLight, false, `${hex} should fail on white`);
    assert.equal(s.use, USE.textOnDark, `${hex} should be usable as text on dark`);
  }
  // Engineering is darker and goes the other way.
  const eng = analyseRamp('#526f91').seedStep;
  assert.equal(eng.use, USE.textOnLight);
});

test('each family gets its own light-ground value without changing hue', () => {
  for (const hex of ['#a18ac8', '#4f9d73', '#e9a16b', '#d4b96f']) {
    const { forLight } = analyseRamp(hex);
    assert.ok(forLight, `${hex} must offer something for white grounds`);
    assert.notEqual(forLight.hex, hex, 'it has to differ from the seed');
    assert.ok(contrast(forLight.hex, '#ffffff') >= 4.5);
    assert.ok(hueGap(toOklch(forLight.hex).H, toOklch(hex).H) < 8, 'same hue, darker only');
  }
});

test('againstNeutrals measures every step against every neutral', () => {
  const ramp = buildRamp('#526f91');
  const grid = againstNeutrals(ramp);
  assert.equal(grid.length, ramp.length);
  for (const row of grid) {
    assert.equal(row.pairs.length, DEFAULT_NEUTRALS.length);
    for (const p of row.pairs) {
      assert.equal(p.ratio, contrast(row.step.hex, p.neutral.hex));
      assert.ok(p.grade);
    }
  }
});

test('a custom neutral set is honoured', () => {
  const mine = [{ name: 'Only', hex: '#808080' }];
  const a = analyseRamp('#526f91', { neutrals: mine });
  assert.deepEqual(a.neutrals, mine);
  assert.equal(a.grid[0].pairs.length, 1);
});

test('unreachable names the neutrals no step can carry text against', () => {
  const a = analyseRamp('#526f91');
  for (const n of a.unreachable) {
    for (const s of a.ramp) {
      assert.ok(contrast(s.hex, n.hex) < 4.5,
        `${n.name} was called unreachable but ${s.hex} reaches it`);
    }
  }
  // Mid grey is the hard one: it sits in the middle, so most hues cannot clear it.
  assert.ok(a.unreachable.some((n) => n.hex === '#767676'),
    'mid grey should be out of reach for a mid-lightness blue');
});

test('buildRamp refuses a degenerate request rather than returning nonsense', () => {
  assert.throws(() => buildRamp('#526f91', { steps: 1 }), /at least two steps/);
});

test('findings are ordered, complete and quote no raw floats', () => {
  for (const [name, seed] of FAMILIES) {
    const found = rampFindings(seed, name);
    assert.ok(found.length >= 2);
    const rank = { issue: 0, watch: 1, works: 2 };
    for (let i = 1; i < found.length; i++) {
      assert.ok(rank[found[i - 1].level] <= rank[found[i].level], 'findings must be sorted');
    }
    for (const x of found) {
      assert.ok(x.title && x.body && Array.isArray(x.swatches));
      assert.doesNotMatch(`${x.title} ${x.body}`, /\d+\.\d{4,}/, `unrounded number: ${x.title}`);
    }
    assert.ok(found.some((x) => x.tag === 'The swatch'), 'must judge the seed itself');
  }
});

test('the headline finding names the hex a reader should actually use', () => {
  const found = rampFindings('#d4b96f', 'Faith');
  const onLight = found.find((x) => x.tag === 'On light');
  assert.match(onLight.title, /#[0-9a-f]{6}/, 'it must name a colour, not describe one');
  const hex = onLight.title.match(/#[0-9a-f]{6}/)[0];
  assert.ok(contrast(hex, '#ffffff') >= 4.5, 'and that colour must actually pass');
  assert.ok(hueGap(toOklch(hex).H, toOklch('#d4b96f').H) < 8, 'while staying the same hue');
});
