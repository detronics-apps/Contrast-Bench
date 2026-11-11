import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, deltaE } from '../js/color.js';
import {
  REDUNDANT_RATIO, VOID_POINTS, CROWD_POINTS,
  geometry, geometries, ladder, voids, crowds, redundancies,
  scheme, cohesion, roles, ROLE_LABEL, findings, recommendations,
  emotionalRegister, headline, STATUS_SET,
} from '../js/palette.js';

const BRAND = ['#000000', '#ffffff', '#1f2d3d', '#454b52', '#7fabc7', '#d7e5f2', '#e9eaec', '#cdd1d2'];
const REVISED = ['#1f2d3d', '#454b52', '#447b9d', '#7fabc7', '#d7e5f2', '#ffffff'];

test('geometry reports measurable facts that agree with the source', () => {
  const g = geometry('#7fabc7');
  assert.equal(g.hex, '#7fabc7');
  assert.equal(g.onWhite, contrast('#7fabc7', '#ffffff'));
  assert.equal(g.onBlack, contrast('#7fabc7', '#000000'));
  assert.equal(g.neutral, false);
  assert.ok(g.L > 0 && g.L < 100);
});

test('every colour analysis states the emotion it communicates', () => {
  // The standard reading, not a separate mode.
  for (const hex of BRAND) {
    const g = geometry(hex);
    assert.ok(g.emotion, `${hex} has no emotional reading`);
    assert.ok(g.emotion.primary.name, `${hex} has no primary emotion`);
    assert.ok(g.emotion.caveat.length > 30, `${hex} lost its caveat`);
    assert.ok(g.emotion.modifiers.length >= 2, `${hex} missing the saturation/lightness reading`);
  }
  assert.equal(geometry('#526f91').emotion.primary.name, 'Loyalty');
  assert.equal(geometry('#e9eaec').emotion.neutral, true);
});

test('ladder ascends and reports the real gap to the previous rung', () => {
  const rungs = ladder(BRAND);
  assert.equal(rungs.length, BRAND.length);
  assert.equal(rungs[0].gap, null);
  for (let i = 1; i < rungs.length; i++) {
    assert.ok(rungs[i].L >= rungs[i - 1].L, 'ladder must ascend');
    assert.ok(Math.abs(rungs[i].gap - (rungs[i].L - rungs[i - 1].L)) < 1e-9);
  }
});

test('voids finds the empty lightness bands, widest first', () => {
  const found = voids(BRAND);
  assert.ok(found.length >= 1, 'the brand palette has a mid-tone hole');
  for (const v of found) assert.ok(v.size >= VOID_POINTS);
  for (let i = 1; i < found.length; i++) assert.ok(found[i - 1].size >= found[i].size);
  // The one that started the project: Slate to Steel Blue.
  assert.ok(found.some((v) => v.from.hex === '#454b52' && v.to.hex === '#7fabc7'));
});

test('crowds finds packed runs without double-counting members', () => {
  const found = crowds(BRAND);
  assert.ok(found.length >= 1, 'four near-whites should be reported as crowded');
  const seen = new Set();
  for (const c of found) {
    assert.ok(c.members.length >= 3);
    assert.ok(c.span <= CROWD_POINTS);
    for (const m of c.members) {
      assert.ok(!seen.has(m.hex), `${m.hex} counted in two crowds`);
      seen.add(m.hex);
    }
  }
});

test('redundancies finds only genuinely indistinguishable pairs', () => {
  const found = redundancies(BRAND);
  assert.ok(found.length >= 1);
  for (const r of found) {
    assert.ok(r.ratio < REDUNDANT_RATIO);
    assert.equal(r.ratio, contrast(r.a.hex, r.b.hex));
  }
  for (let i = 1; i < found.length; i++) assert.ok(found[i - 1].ratio <= found[i].ratio);
  // Mist and Fog, 1.07:1 apart.
  assert.ok(found.some((r) => [r.a.hex, r.b.hex].sort().join() === ['#d7e5f2', '#e9eaec'].sort().join()));
});

test('scheme names the spread correctly at each boundary', () => {
  assert.equal(scheme(BRAND).name, 'Monochromatic');
  assert.ok(scheme(BRAND).span <= 35);
  assert.equal(scheme(['#ffffff', '#000000', '#808080']).name, 'Neutral');
  assert.equal(scheme(['#ff0000', '#00ff00', '#0000ff']).name, 'Polychromatic');
});

test('cohesion reports spread against its own stated limits', () => {
  const c = cohesion(BRAND);
  assert.equal(c.coherent, c.lightness <= c.lightnessLimit && c.chroma <= c.chromaLimit);
  assert.ok(c.lightness > 0);
  assert.equal(cohesion([]).lightness, 0);
  assert.equal(cohesion(['#1f2d3d']).lightness, 0);
});

test('roles prefer the tinted colour where two could do the same job', () => {
  const r = roles(BRAND);
  // Black is darkest, but Ink Navy is tinted and still clears AAA - so it is the ink.
  assert.equal(r.ink.hex, '#1f2d3d');
  assert.equal(r.surface.hex, '#ffffff');
  // Mist has 8x the chroma of Fog, so it is the secondary surface.
  assert.equal(r.surfaceAlt.hex, '#d7e5f2');
  assert.equal(r.accent.hex, '#7fabc7');
  assert.equal(r.inkSoft.hex, '#454b52');
});

test('roles never assign one colour two jobs, and every role has a label', () => {
  for (const palette of [BRAND, REVISED, ['#000000', '#ffffff']]) {
    const r = roles(palette);
    const used = Object.values(r).filter(Boolean).map((g) => g.hex);
    assert.equal(new Set(used).size, used.length, `a colour holds two roles in ${palette}`);
    for (const key of Object.keys(r)) {
      if (r[key]) assert.ok(ROLE_LABEL[key], `no label for role ${key}`);
    }
  }
  assert.deepEqual(roles([]), {});
});

test('findings report every real problem in the brand palette', () => {
  const tags = findings(BRAND).map((f) => f.tag);
  assert.ok(tags.includes('Redundant'), 'must report the invisible pairs');
  assert.ok(tags.includes('Gap'), 'must report the mid-tone void');
  assert.ok(tags.includes('Accent'), 'must report the accent problem');
  assert.ok(tags.includes('Function'), 'must report the missing status colours');
  assert.ok(tags.includes('Register'), 'must state what the palette communicates');
});

test('findings are ordered issues first and never quote a raw float', () => {
  for (const palette of [BRAND, REVISED]) {
    const found = findings(palette);
    const rank = { issue: 0, watch: 1, works: 2 };
    for (let i = 1; i < found.length; i++) {
      assert.ok(rank[found[i - 1].level] <= rank[found[i].level], 'findings must be sorted');
    }
    for (const f of found) {
      assert.ok(['issue', 'watch', 'works'].includes(f.level));
      assert.ok(f.title && f.body && Array.isArray(f.swatches));
      assert.doesNotMatch(`${f.title} ${f.body}`, /\d+\.\d{4,}/, `unrounded number: ${f.title}`);
    }
  }
});

test('the revised palette fixes what the original was told about', () => {
  // Fog and Ash are gone, so the pairs they formed are gone...
  const left = redundancies(REVISED).map((r) => [r.a.hex, r.b.hex].sort().join('/'));
  assert.ok(!left.some((p) => p.includes('#e9eaec') || p.includes('#cdd1d2')),
    'no redundancy should involve a dropped colour');
  // ...but Mist against pure white is still only 1.28:1. A real limit worth keeping:
  // a Mist card on a white page has a near-invisible edge and needs a border.
  assert.deepEqual(left, ['#d7e5f2/#ffffff']);

  const accent = findings(REVISED).find((f) => f.tag === 'Accent');
  assert.equal(accent.level, 'works', 'the accent should now carry text');

  // The void it was aimed at is gone...
  const remaining = voids(REVISED);
  assert.ok(!remaining.some((v) => v.from.hex === '#454b52' && v.to.hex === '#7fabc7'),
    'the Slate to Steel Blue hole should be filled');
  // ...and the largest gap has shrunk, even though a smaller one survives higher up.
  const worstBefore = voids(BRAND)[0].size;
  assert.ok(remaining[0].size < worstBefore,
    `worst gap should shrink from ${worstBefore.toFixed(1)}, got ${remaining[0].size.toFixed(1)}`);
});

test('emotionalRegister reads the chromatic colours and keeps its caveat', () => {
  const r = emotionalRegister(BRAND);
  assert.ok(r, 'a palette with hue must have a register');
  assert.ok(r.top.length >= 1);
  assert.match(r.body, /not measured effects/, 'the caveat must survive');
  assert.ok(r.swatches.length > 0);
  // The loudest colour drives the reading.
  assert.equal(r.lead.hex, '#7fabc7');
  // An all-neutral palette has no message to report.
  assert.equal(emotionalRegister(['#000000', '#ffffff', '#808080']), null);
});

test('recommendations are actionable and internally consistent', () => {
  const recs = recommendations(BRAND);
  assert.ok(recs.length > 0);
  for (let i = 1; i < recs.length; i++) assert.ok(recs[i - 1].rank <= recs[i].rank);
  for (const r of recs) {
    assert.ok(r.title && r.body);
    const actions = [r.add, r.addAll, r.remove].filter(Boolean).length;
    assert.ok(actions <= 1, 'a recommendation carries at most one action');
    if (r.remove) assert.ok(BRAND.includes(r.remove), `cannot remove ${r.remove}, it is not present`);
    if (r.add) assert.match(r.add.hex, /^#[0-9a-f]{6}$/);
  }
});

test('the top recommendation actually solves the problem it names', () => {
  const top = recommendations(BRAND).find((r) => r.add);
  assert.ok(top, 'the mid-tone fix should be offered');
  assert.ok(contrast(top.add.hex, '#ffffff') >= 4.5, 'the new colour must carry text on white');
  // And it must belong to the palette, not be a stranger.
  assert.ok(deltaE(top.add.hex, '#7fabc7') < 30, 'it should read as the same brand colour');
  // Adding it removes the void.
  assert.equal(voids([...BRAND, top.add.hex]).some(
    (v) => v.from.hex === '#454b52' && v.to.hex === '#7fabc7'), false);
});

test('the status set is usable as shipped', () => {
  for (const s of STATUS_SET) {
    assert.ok(contrast(s.light, '#ffffff') >= 4.5, `${s.name} light fails on white`);
    assert.ok(contrast(s.dark, '#1f2d3d') >= 4.5, `${s.name} dark fails on Ink Navy`);
    assert.ok(s.use && s.name);
  }
});

test('headline summarises without contradicting the detail', () => {
  const line = headline(BRAND);
  assert.match(line, /Monochromatic/);
  assert.match(line, /14 of 28/);
  assert.equal(headline(['#000000', '#ffffff']), 'Neutral palette - no chromatic range to assess');
});
