import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, toHsl, toOklch, hueGap, deltaE, toGreyscale, simulateCvd, CVD_TYPES, fromOklch } from '../js/color.js';
import {
  EMOTIONS, EMOTION_NAMES, emotionsForHue, hueForEmotion,
  modifiers, readEmotion, paletteForEmotion, separateByLightness,
} from '../js/emotion.js';

test('the wheel is twelve anchors, evenly spaced, in order', () => {
  assert.equal(EMOTIONS.length, 12);
  for (let i = 0; i < EMOTIONS.length; i++) {
    assert.equal(EMOTIONS[i].hue, 15 + i * 30, `${EMOTIONS[i].name} is off the 30 degree grid`);
    const next = EMOTIONS[(i + 1) % EMOTIONS.length];
    assert.equal(hueGap(EMOTIONS[i].hue, next.hue), 30);
  }
  assert.equal(new Set(EMOTION_NAMES).size, 12, 'names must be unique');
});

test('every anchor carries the full reading, not just a word', () => {
  for (const e of EMOTIONS) {
    assert.ok(e.name && e.family && e.signal && e.caution && e.fit, `${e.name} is incomplete`);
    assert.ok(Array.isArray(e.words) && e.words.length >= 3, `${e.name} needs association words`);
    assert.ok(e.hue >= 0 && e.hue < 360);
  }
});

test('emotionsForHue returns the nearest anchors, weighted', () => {
  // Exactly on an anchor: full weight, zero gap.
  const exact = emotionsForHue(225, 2);
  assert.equal(exact[0].emotion.name, 'Loyalty');
  assert.equal(exact[0].gap, 0);
  assert.equal(exact[0].weight, 1);
  // Halfway between two: both at half weight.
  const between = emotionsForHue(240, 2);
  assert.equal(between[0].gap, 15);
  assert.equal(between[0].weight, 0.5);
  assert.deepEqual(
    between.map((b) => b.emotion.name).sort(),
    ['Loyalty', 'Reliability'],
  );
});

test('emotionsForHue wraps around zero correctly', () => {
  assert.equal(emotionsForHue(0)[0].emotion.name, 'Desire');       // 15 is nearest
  assert.equal(emotionsForHue(355)[0].emotion.name, 'Excitement'); // 345 is nearest
  for (let h = 0; h < 360; h += 7) {
    const near = emotionsForHue(h, 1)[0];
    assert.ok(near.gap <= 15 + 1e-9, `hue ${h} was ${near.gap} from its nearest anchor`);
  }
});

test('hueForEmotion is case-insensitive and gives a band', () => {
  const loyal = hueForEmotion('loyalty');
  assert.equal(loyal.hue, 225);
  assert.equal(loyal.from, 210);
  assert.equal(loyal.to, 240);
  assert.equal(hueForEmotion('LOYALTY').hue, 225);
  assert.equal(hueForEmotion('not an emotion'), null);
  // The band wraps without going negative.
  assert.ok(hueForEmotion('Desire').from >= 0);
});

test('modifiers always report both axes, and name the neutral case', () => {
  for (const hex of ['#a18ac8', '#4f9d73', '#526f91', '#e9a16b', '#d4b96f', '#ffffff', '#1f2d3d']) {
    const mods = modifiers(hex);
    const axes = mods.map((m) => m.axis);
    assert.ok(axes.includes('saturation'), `${hex} missing saturation reading`);
    assert.ok(axes.includes('lightness'), `${hex} missing lightness reading`);
    for (const m of mods) assert.ok(m.text.length > 20, 'a modifier needs a real sentence');
  }
  assert.equal(modifiers('#e9eaec').find((m) => m.axis === 'saturation').key, 'neutral');
  assert.equal(modifiers('#d7e5f2').find((m) => m.axis === 'lightness').key, 'tint');
  assert.equal(modifiers('#1f2d3d').find((m) => m.axis === 'lightness').key, 'shade');
});

test('readEmotion carries its own caveat, always', () => {
  for (const hex of ['#526f91', '#ffffff', '#e9a16b']) {
    const r = readEmotion(hex);
    assert.ok(r.caveat.length > 30, 'the caveat must not be droppable');
    assert.ok(r.primary && r.secondary);
    assert.equal(r.hue, toHsl(hex).H);
  }
  assert.equal(readEmotion('#e9eaec').neutral, true);
  assert.match(readEmotion('#e9eaec').caveat, /does not describe it/);
});

test('the five content families land on the emotions they were chosen for', () => {
  // The owner picked each colour for a stated purpose. The wheel should agree.
  // Exact anchors.
  assert.equal(readEmotion('#d4b96f').primary.name, 'Cheerfulness'); // "hope, light"
  assert.equal(readEmotion('#526f91').primary.name, 'Loyalty');      // "precision"
  assert.equal(readEmotion('#a18ac8').primary.name, 'Reliability');  // "trust in the reasoning"

  // Blends. Building is "honest, practical progress" and sits between the two
  // anchors that say exactly that - nearer Happiness than Honesty, carrying both.
  const building = readEmotion('#4f9d73');
  assert.deepEqual(
    building.near.map((n) => n.emotion.name).sort(),
    ['Happiness', 'Honesty'],
  );
  assert.equal(building.blend, true, 'it should be reported as a blend, not an anchor');

  // Family is "warmth, for everybody" - between Desire and Cheerfulness.
  const family = readEmotion('#e9a16b');
  assert.deepEqual(
    family.near.map((n) => n.emotion.name).sort(),
    ['Cheerfulness', 'Desire'],
  );
});

test('Family and Faith are adjacent on the wheel - the collapse has a cause', () => {
  const gap = hueGap(toHsl('#e9a16b').H, toHsl('#d4b96f').H);
  assert.ok(gap < 30, `expected adjacent emotions, got ${gap.toFixed(0)} degrees`);
  assert.ok(deltaE('#e9a16b', '#d4b96f') < 12, 'and therefore the same colour in practice');
});

test('paletteForEmotion returns usable swatches, labelled honestly', () => {
  for (const name of EMOTION_NAMES) {
    const p = paletteForEmotion(name);
    assert.ok(p, `${name} should produce a palette`);
    assert.ok(p.swatches.length >= 5);
    for (const s of p.swatches) {
      assert.match(s.hex, /^#[0-9a-f]{6}$/);
      assert.equal(s.onWhite, contrast(s.hex, '#ffffff'));
      assert.equal(s.bodyOnWhite, s.onWhite >= 4.5);
      assert.ok(['text on light', 'text on dark', 'fill only'].includes(s.usableAs));
    }
    // Swatches must ascend in lightness.
    for (let i = 1; i < p.swatches.length; i++) {
      assert.ok(p.swatches[i].lightness > p.swatches[i - 1].lightness);
    }
  }
  assert.equal(paletteForEmotion('nonsense'), null);
});

test('paletteForEmotion keeps the hue it was asked for', () => {
  for (const name of ['Loyalty', 'Happiness', 'Desire']) {
    const p = paletteForEmotion(name);
    for (const s of p.swatches) {
      // Very dark and very light swatches lose hue precision to gamut clamping;
      // the mid band is where the claim has to hold.
      if (s.lightness < 35 || s.lightness > 85) continue;
      const gap = hueGap(toHsl(s.hex).H, p.emotion.hue);
      assert.ok(gap < 25, `${name} swatch ${s.hex} drifted ${gap.toFixed(0)} degrees`);
    }
  }
});

test('every emotion offers at least one swatch that can carry text somewhere', () => {
  for (const name of EMOTION_NAMES) {
    const p = paletteForEmotion(name);
    assert.ok(p.bestOnLight || p.bestOnDark,
      `${name} produced nothing usable for text on either ground`);
  }
});

test('separateByLightness keeps the hue and separates on all three tests', () => {
  const fix = separateByLightness('#e9a16b', '#d4b96f', { keep: 'a' });
  assert.ok(fix, 'Family/Faith should be separable by lightness alone');
  // The emotion survives: hue barely moves.
  assert.ok(hueGap(toOklch('#d4b96f').H, toOklch(fix.hex).H) < 6, 'hue must not move');
  // And it genuinely separates.
  assert.ok(fix.deltaE >= 20, `only reached dE ${fix.deltaE.toFixed(1)}`);
  assert.ok(fix.grey >= 1.4, `only reached grey ${fix.grey.toFixed(2)}`);
  assert.ok(fix.cvd >= 14, `only reached cvd ${fix.cvd.toFixed(1)}`);
  // Independently verified, not just reported.
  assert.ok(Math.abs(deltaE(fix.hex, '#e9a16b') - fix.deltaE) < 1e-9);
  assert.ok(Math.abs(contrast(toGreyscale(fix.hex), toGreyscale('#e9a16b')) - fix.grey) < 1e-9);
  for (const t of CVD_TYPES) {
    assert.ok(deltaE(simulateCvd(fix.hex, t), simulateCvd('#e9a16b', t)) >= fix.cvd - 1e-9);
  }
});

test('separateByLightness finds the SMALLEST move that works', () => {
  const fix = separateByLightness('#e9a16b', '#d4b96f', { keep: 'a' });
  const startL = toOklch('#d4b96f').L;
  assert.ok(Math.abs(fix.lightness - startL) >= fix.move - 1e-6);
  // Nothing closer to the original should have passed.
  const { C, H } = toOklch('#d4b96f');
  // Probe only inside the declared usable band - outside it a colour is not a marker.
  for (let L = Math.max(16, startL - fix.move + 1); L < Math.min(90, startL + fix.move - 1); L += 1) {
    if (Math.abs(L - startL) >= fix.move) continue;
    const probe = fromOklch(L / 100, C, H);
    const ok = deltaE(probe, '#e9a16b') >= 20
      && contrast(toGreyscale(probe), toGreyscale('#e9a16b')) >= 1.4
      && Math.min(...CVD_TYPES.map((t) => deltaE(simulateCvd(probe, t), simulateCvd('#e9a16b', t)))) >= 14;
    assert.ok(!ok, `a smaller move existed at L=${L.toFixed(0)}`);
  }
});

test('separateByLightness returns null rather than a wrong answer', () => {
  // Two colours of the same hue cannot be separated under colour blindness by lightness
  // alone if the bar is set impossibly high.
  assert.equal(separateByLightness('#e9a16b', '#d4b96f', { minCvd: 90 }), null);
});
