import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEDIA, MEDIUM_IDS, allocate, allocateAll } from '../js/allocation.js';
import { ROLE_LABEL } from '../js/palette.js';
import { legal, LICENCE_ID, LICENCE_HOLDER, LEGAL_SECTIONS } from '../js/legal.js';

const BRAND = ['#000000', '#ffffff', '#1f2d3d', '#454b52', '#7fabc7', '#d7e5f2', '#e9eaec', '#cdd1d2'];
const TINY = ['#1f2d3d', '#ffffff'];

test('every medium is complete and uses only known roles', () => {
  assert.equal(MEDIUM_IDS.length, 3);
  for (const id of MEDIUM_IDS) {
    const m = MEDIA[id];
    assert.equal(m.id, id);
    assert.ok(m.label && m.note);
    assert.ok(m.notes.length >= 3, `${id} needs production notes`);
    assert.ok(m.mix.length >= 3);
    for (const [role, share, why] of m.mix) {
      assert.ok(ROLE_LABEL[role], `${id} references unknown role ${role}`);
      assert.ok(share > 0 && share <= 100);
      assert.ok(why.length > 30, `${id}/${role} needs a real reason`);
    }
    const roles = m.mix.map(([r]) => r);
    assert.equal(new Set(roles).size, roles.length, `${id} lists a role twice`);
  }
});

test('shares always total 100, whatever the palette can fill', () => {
  for (const palette of [BRAND, TINY]) {
    for (const id of MEDIUM_IDS) {
      const { rows } = allocate(palette, id);
      const total = rows.reduce((s, r) => s + r.share, 0);
      assert.ok(Math.abs(total - 100) < 1e-9,
        `${id} on ${palette.length} colours totalled ${total.toFixed(2)}`);
    }
  }
});

test('a role the palette cannot fill is dropped and reported', () => {
  const { rows, dropped } = allocate(TINY, 'web');
  const used = rows.map((r) => r.role);
  assert.ok(!used.includes('accent'), 'two neutrals have no accent');
  assert.ok(dropped.includes('accent'), 'the dropped role must be named');
  for (const r of rows) assert.ok(r.color, 'every surviving row needs a colour');
});

test('allocation never gives one colour two roles', () => {
  for (const id of MEDIUM_IDS) {
    const { rows } = allocate(BRAND, id);
    const hexes = rows.map((r) => r.color.hex);
    assert.equal(new Set(hexes).size, hexes.length, `${id} reused a colour`);
  }
});

test('the business card inverts the website, deliberately', () => {
  const web = allocate(BRAND, 'web').rows;
  const card = allocate(BRAND, 'card').rows;
  const shareOf = (rows, role) => rows.find((r) => r.role === role)?.share ?? 0;
  assert.ok(shareOf(web, 'surface') > shareOf(web, 'ink'), 'a page is mostly surface');
  assert.ok(shareOf(card, 'ink') > shareOf(card, 'surface'), 'a card is mostly ink');
});

test('the manual is the most restrained use of colour', () => {
  const accentShare = (id) => allocate(BRAND, id).rows.find((r) => r.role === 'accent')?.share ?? 0;
  assert.ok(accentShare('manual') < accentShare('web'));
  assert.ok(accentShare('manual') < accentShare('card'));
});

test('allocate rejects an unknown medium rather than guessing', () => {
  assert.throws(() => allocate(BRAND, 'billboard'), /unknown medium/);
});

test('allocateAll covers every medium once', () => {
  const all = allocateAll(BRAND);
  assert.equal(all.length, MEDIUM_IDS.length);
  assert.deepEqual(all.map((a) => a.medium.id).sort(), [...MEDIUM_IDS].sort());
});

// --- legal ---------------------------------------------------------------

test('the licence named on screen is the licence in the repo', () => {
  const file = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
  assert.match(file, /MIT License/, 'LICENSE must be the MIT text');
  assert.equal(LICENCE_ID, 'MIT');
  assert.ok(file.includes(LICENCE_HOLDER), `LICENSE must name ${LICENCE_HOLDER}`);
  assert.ok(legal.licence.body.join(' ').includes(LICENCE_ID),
    'the on-screen text must name the same licence');
});

test('the README agrees with both', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /MIT/, 'the README licence section must say MIT too');
});

test('every legal section has a title and real body text', () => {
  assert.ok(LEGAL_SECTIONS.includes('licence'));
  assert.ok(LEGAL_SECTIONS.includes('privacy'));
  assert.ok(LEGAL_SECTIONS.includes('accuracy'));
  for (const key of LEGAL_SECTIONS) {
    assert.ok(legal[key].title, `${key} has no title`);
    assert.ok(legal[key].body.length >= 2, `${key} needs more than one line`);
    for (const para of legal[key].body) assert.ok(para.length > 40, `${key} has a stub paragraph`);
  }
});

test('the privacy text states the three things that are actually true', () => {
  const text = legal.privacy.body.join(' ');
  assert.match(text, /local storage/i, 'must say where palettes live');
  assert.match(text, /fragment/i, 'must explain the share link');
  assert.match(text, /no analytics|no server|nothing is ever sent|never sent/i,
    'must state nothing leaves the browser');
});

test('the accuracy note admits the formula limit rather than hiding it', () => {
  const text = legal.accuracy.body.join(' ');
  assert.match(text, /under-reports/, 'the WCAG light-on-dark limit must be stated');
  assert.match(text, /not a clinical result|not a standard|convention/i,
    'the modelled parts must be labelled as modelled');
});
