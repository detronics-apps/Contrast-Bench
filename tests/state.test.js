import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_VERSION, defaults, SEED_BRAND, SEED_CHANNEL,
  migrate, newId, activePalette, activeColors,
  updatePalette, addPalette, removePalette, encodeShare,
} from '../js/state.js';

const fresh = () => structuredClone(defaults);

test('the default model opens on a worked example of each mode', () => {
  assert.equal(defaults.version, MODEL_VERSION);
  assert.equal(defaults.palettes.length, 2);
  assert.equal(defaults.palettes[0].kind, 'brand');
  assert.equal(defaults.palettes[1].kind, 'channel');
  assert.equal(defaults.activeId, SEED_BRAND.id);
  assert.equal(activeColors(defaults).length, 8);
});

test('seeded palettes carry FIXED ids so they cannot double', () => {
  // Two loaders seeding at the same moment with random ids is a known trap.
  assert.equal(SEED_BRAND.id, 'seed-detronics');
  assert.equal(SEED_CHANNEL.id, 'seed-families');
  assert.notEqual(newId(), newId());
});

test('migrate handles nothing, rubbish and the current shape', () => {
  for (const input of [null, undefined, 0, 'nope', [], { nonsense: true }]) {
    const m = migrate(input);
    assert.equal(m.version, MODEL_VERSION);
    assert.ok(m.palettes.length >= 1, `${JSON.stringify(input)} produced no palettes`);
    assert.ok(m.palettes.some((p) => p.id === m.activeId), 'activeId must point at a palette');
  }
  const current = fresh();
  assert.deepEqual(migrate(current), current);
});

test('migrate lifts a v1 model without losing its colours', () => {
  const v1 = { colors: ['#1f2d3d', '#7fabc7', '#ffffff'], ui: { level: 'expert' } };
  const m = migrate(v1);
  assert.equal(m.version, MODEL_VERSION);
  assert.equal(m.palettes.length, 1);
  assert.deepEqual(m.palettes[0].colors.map((c) => c.hex), ['#1f2d3d', '#7fabc7', '#ffffff']);
  assert.equal(m.ui.level, 'expert', 'a kept ui value must survive');
  assert.equal(m.ui.medium, defaults.ui.medium, 'an absent ui value must fall back');
});

test('an undefined in an old model never overwrites a default', () => {
  // The trap: {...defaults, ...incoming} where incoming.target is undefined.
  const m = migrate({ version: 2, palettes: [SEED_BRAND], activeId: SEED_BRAND.id,
    ui: { target: undefined, level: 'advanced' } });
  assert.equal(m.ui.target, defaults.ui.target, 'target must keep its default');
  assert.equal(m.ui.level, 'advanced');
});

test('migrate repairs an activeId that points nowhere', () => {
  const m = migrate({ version: 2, palettes: [SEED_CHANNEL], activeId: 'gone' });
  assert.equal(m.activeId, SEED_CHANNEL.id);
});

test('migrate normalises loose palette entries', () => {
  const m = migrate({
    version: 2,
    palettes: [{ colors: ['#1f2d3d', { hex: '#7fabc7' }, { name: 'X' }] }],
    activeId: 'missing',
  });
  const p = m.palettes[0];
  assert.ok(p.id && p.name && p.kind);
  assert.equal(p.colors.length, 2, 'an entry with no hex is dropped');
  assert.ok(p.colors.every((c) => c.name && c.hex));
});

test('edits return a new model and never mutate the old one', () => {
  const before = fresh();
  const snapshot = JSON.stringify(before);

  const renamed = updatePalette(before, before.activeId, (p) => ({ ...p, name: 'Renamed' }));
  assert.equal(JSON.stringify(before), snapshot, 'updatePalette mutated the input');
  assert.equal(activePalette(renamed).name, 'Renamed');

  const added = addPalette(before, { name: 'New', colors: [{ name: 'a', hex: '#123456' }] });
  assert.equal(JSON.stringify(before), snapshot, 'addPalette mutated the input');
  assert.equal(added.palettes.length, before.palettes.length + 1);
  assert.equal(activePalette(added).name, 'New', 'a new palette becomes active');

  const removed = removePalette(before, before.activeId);
  assert.equal(JSON.stringify(before), snapshot, 'removePalette mutated the input');
  assert.equal(removed.palettes.length, before.palettes.length - 1);
  assert.ok(removed.palettes.some((p) => p.id === removed.activeId));
});

test('updatePalette on a missing id changes nothing', () => {
  const before = fresh();
  const after = updatePalette(before, 'not-here', (p) => ({ ...p, name: 'nope' }));
  assert.deepEqual(after, before);
});

test('the last palette cannot be removed', () => {
  let s = fresh();
  s = removePalette(s, s.palettes[1].id);
  assert.equal(s.palettes.length, 1);
  s = removePalette(s, s.palettes[0].id);
  assert.equal(s.palettes.length, 1, 'removing the last one must be refused');
});

test('a share link carries one palette, not the whole library', () => {
  const s = fresh();
  const shared = encodeShare(s);
  assert.equal(shared.palettes.length, 1);
  assert.equal(shared.palettes[0].id, s.activeId);
  assert.equal(shared.version, MODEL_VERSION);
  // And nothing device-specific rides along.
  assert.equal(shared.ui.theme, undefined, 'theme is a fact about the device, not the work');
  assert.equal(shared.ui.sections, undefined, 'panel state is not worth sharing');
  assert.equal(shared.ui.seenWelcome, undefined);
});

test('a share link survives a round trip through JSON and migrate', () => {
  const s = fresh();
  const trip = migrate(JSON.parse(JSON.stringify(encodeShare(s))));
  assert.deepEqual(
    activePalette(trip).colors,
    activePalette(s).colors,
    'the colours must come back identical',
  );
  assert.equal(trip.version, MODEL_VERSION);
});

test('every seeded colour is a readable hex', () => {
  for (const p of defaults.palettes) {
    for (const c of p.colors) {
      assert.match(c.hex, /^#[0-9a-f]{6}$/, `${p.name}/${c.name} is not a plain hex`);
      assert.ok(c.name.length > 0);
    }
  }
});
