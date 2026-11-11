import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColor, toHex, isColor, normalise, harvest,
  luminance, contrast, toOklab, toOklch, fromOklch, deltaE, driftWord,
  toHsl, isNeutral, hueGap, simulateCvd, toGreyscale, CVD_TYPES,
} from '../js/color.js';

// --- parsing -------------------------------------------------------------

test('parseColor reads the forms people actually type', () => {
  assert.deepEqual(parseColor('#1f2d3d'), [31, 45, 61]);
  assert.deepEqual(parseColor('1f2d3d'), [31, 45, 61]);
  assert.deepEqual(parseColor('#FFF'), [255, 255, 255]);
  assert.deepEqual(parseColor('  #1F2D3D  '), [31, 45, 61]);
  assert.deepEqual(parseColor('rgb(31, 45, 61)'), [31, 45, 61]);
  assert.deepEqual(parseColor('rgba(31 45 61 / 0.5)'), [31, 45, 61]);
});

test('parseColor rejects garbage rather than guessing', () => {
  for (const bad of ['', '#12', '#12345', 'blue', 'rgb(a,b,c)', null, undefined, '#1f2d3g']) {
    assert.equal(parseColor(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test('parse/toHex round-trips every channel value', () => {
  for (let v = 0; v <= 255; v += 1) {
    const hex = toHex([v, 255 - v, (v * 7) % 256]);
    assert.deepEqual(parseColor(hex), [v, 255 - v, (v * 7) % 256]);
  }
});

test('toHex clamps out-of-range input instead of emitting broken hex', () => {
  assert.equal(toHex([-20, 300, 127.6]), '#00ff80');
  assert.match(toHex([-1, -1, -1]), /^#[0-9a-f]{6}$/);
});

test('isColor and normalise agree with parseColor', () => {
  assert.equal(isColor('#abc'), true);
  assert.equal(isColor('nope'), false);
  assert.equal(normalise('#ABC'), '#aabbcc');
  assert.throws(() => normalise('nope'), /not a colour/);
});

test('harvest pulls distinct colours out of prose, in order', () => {
  const text = 'brand #1f2d3d and accent 7fabc7, plus rgb(255,255,255) and #1F2D3D again';
  assert.deepEqual(harvest(text), ['#1f2d3d', '#7fabc7', '#ffffff']);
  assert.deepEqual(harvest('nothing here'), []);
});

// --- WCAG ----------------------------------------------------------------

test('contrast matches the values every other checker reports', () => {
  // The anchor: black on white is exactly 21:1 by definition.
  assert.equal(contrast('#000000', '#ffffff'), 21);
  // Spot values verified against the WCAG formula by hand.
  assert.equal(contrast('#1f2d3d', '#ffffff').toFixed(2), '13.99');
  assert.equal(contrast('#7fabc7', '#ffffff').toFixed(2), '2.46');
  // Deep Steel. 4.60, not 4.79 - that figure belongs to #447898, a slightly darker
  // candidate from the same search. Both clear 4.5; only one of them is this colour.
  assert.equal(contrast('#447b9d', '#ffffff').toFixed(2), '4.60');
  assert.equal(contrast('#447898', '#ffffff').toFixed(2), '4.79');
});

test('contrast is symmetric and self-contrast is 1', () => {
  const sample = ['#000000', '#ffffff', '#1f2d3d', '#7fabc7', '#e9a16b'];
  for (const a of sample) {
    assert.equal(contrast(a, a), 1, `${a} against itself`);
    for (const b of sample) {
      assert.equal(contrast(a, b), contrast(b, a), `${a}/${b} should be symmetric`);
    }
  }
});

test('luminance spans the full range and is monotonic in grey', () => {
  assert.equal(luminance('#000000'), 0);
  assert.equal(luminance('#ffffff'), 1);
  let prev = -1;
  for (let v = 0; v <= 255; v += 5) {
    const y = luminance(toHex([v, v, v]));
    assert.ok(y > prev, `luminance should rise at grey ${v}`);
    prev = y;
  }
});

// --- OKLab ---------------------------------------------------------------

test('OKLab puts the achromatic axis at zero chroma', () => {
  for (const grey of ['#000000', '#808080', '#ffffff']) {
    assert.ok(toOklch(grey).C < 1e-6, `${grey} should have no chroma`);
  }
});

test('fromOklch round-trips an in-gamut colour', () => {
  for (const hex of ['#1f2d3d', '#7fabc7', '#447b9d', '#4f9d73', '#a18ac8', '#e9a16b']) {
    const { L, C, H } = toOklch(hex);
    const back = fromOklch(L / 100, C, H);
    assert.ok(deltaE(hex, back) < 0.6, `${hex} -> ${back} drifted ${deltaE(hex, back).toFixed(2)}`);
  }
});

test('fromOklch always lands inside sRGB, across the whole space', () => {
  for (let H = 0; H < 360; H += 15) {
    for (let L = 0; L <= 1.0001; L += 0.1) {
      for (const C of [0, 0.1, 0.25, 0.4]) {
        const hex = fromOklch(L, C, H);
        assert.match(hex, /^#[0-9a-f]{6}$/, `L${L} C${C} H${H} produced ${hex}`);
        const rgb = parseColor(hex);
        assert.ok(rgb.every((v) => v >= 0 && v <= 255), `${hex} out of range`);
      }
    }
  }
});

test('fromOklch preserves lightness order at fixed hue', () => {
  let prev = -1;
  for (let L = 0; L <= 1.0001; L += 0.05) {
    const y = luminance(fromOklch(L, 0.08, 250));
    assert.ok(y >= prev - 1e-9, `lightness ${L} should not darken the result`);
    prev = y;
  }
});

test('deltaE is zero for identical colours and symmetric otherwise', () => {
  assert.equal(deltaE('#1f2d3d', '#1f2d3d'), 0);
  assert.ok(Math.abs(deltaE('#1f2d3d', '#7fabc7') - deltaE('#7fabc7', '#1f2d3d')) < 1e-12);
  // Mist and Fog, 1.07:1 apart, are the pair that motivated this app.
  assert.ok(deltaE('#d7e5f2', '#e9eaec') < 6);
});

test('driftWord covers every band without a gap', () => {
  assert.equal(driftWord(0), 'barely visible');
  assert.equal(driftWord(1.99), 'barely visible');
  assert.equal(driftWord(2), 'noticeable');
  assert.equal(driftWord(5.99), 'noticeable');
  assert.equal(driftWord(6), 'a clear change');
  assert.equal(driftWord(11.99), 'a clear change');
  assert.equal(driftWord(12), 'a different colour');
  assert.equal(driftWord(999), 'a different colour');
});

// --- HSL and hue ---------------------------------------------------------

test('toHsl names the primaries correctly', () => {
  assert.equal(Math.round(toHsl('#ff0000').H), 0);
  assert.equal(Math.round(toHsl('#00ff00').H), 120);
  assert.equal(Math.round(toHsl('#0000ff').H), 240);
  assert.equal(Math.round(toHsl('#808080').S), 0);
});

test('isNeutral separates greys from tinted colours', () => {
  assert.equal(isNeutral('#ffffff'), true);
  assert.equal(isNeutral('#000000'), true);
  assert.equal(isNeutral('#e9eaec'), true);   // Fog: a grey pretending to be a colour
  assert.equal(isNeutral('#d7e5f2'), false);  // Mist: genuinely tinted
  assert.equal(isNeutral('#7fabc7'), false);
});

test('hueGap takes the short way round the wheel', () => {
  assert.equal(hueGap(10, 350), 20);
  assert.equal(hueGap(350, 10), 20);
  assert.equal(hueGap(0, 180), 180);
  assert.equal(hueGap(90, 90), 0);
  assert.ok(hueGap(0, 181) <= 180);
});

// --- colour vision -------------------------------------------------------

test('simulateCvd is a projection: simulating twice changes nothing more', () => {
  for (const type of CVD_TYPES) {
    for (const hex of ['#e9a16b', '#d4b96f', '#4f9d73', '#a18ac8']) {
      const once = simulateCvd(hex, type);
      const twice = simulateCvd(once, type);
      assert.ok(deltaE(once, twice) < 2.5, `${type} on ${hex} drifted on re-simulation`);
    }
  }
});

test('simulateCvd leaves greys alone and rejects an unknown type', () => {
  for (const type of CVD_TYPES) {
    assert.ok(deltaE('#808080', simulateCvd('#808080', type)) < 3, `${type} moved a grey`);
  }
  assert.throws(() => simulateCvd('#ffffff', 'nonsense'), /unknown colour vision type/);
});

test('deuteranopia collapses the orange/gold pair that motivated channel mode', () => {
  const before = deltaE('#e9a16b', '#d4b96f');
  const after = deltaE(simulateCvd('#e9a16b', 'deuteranopia'), simulateCvd('#d4b96f', 'deuteranopia'));
  assert.ok(before < 12, `expected them already close, got ${before.toFixed(1)}`);
  assert.ok(after < before, 'deuteranopia should bring them closer still');
  assert.ok(after < 4, `expected a collapse, got ${after.toFixed(1)}`);
});

test('toGreyscale preserves luminance', () => {
  for (const hex of ['#1f2d3d', '#7fabc7', '#e9a16b', '#4f9d73', '#a18ac8']) {
    const grey = toGreyscale(hex);
    assert.ok(Math.abs(luminance(hex) - luminance(grey)) < 0.004,
      `${hex} -> ${grey} changed luminance`);
    const [r, g, b] = parseColor(grey);
    assert.ok(Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1, `${grey} is not grey`);
  }
});
