import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEARCH_ALIASES, HOWTOS, FAQS, IDEAS, FEATURES, PROCESS,
  searchText, guideMatches, filterHowtos, filterFaqs, filterIdeas, filterFeatures, countMatches,
} from '../js/help.js';

test('every how-to is complete and uniquely identified', () => {
  const ids = new Set();
  for (const h of HOWTOS) {
    assert.ok(h.id && h.title && h.category, `${h.id} is incomplete`);
    assert.ok(h.steps.length >= 3, `${h.id} needs real steps`);
    for (const s of h.steps) assert.ok(s.length > 20, `${h.id} has a stub step`);
    assert.ok(!ids.has(h.id), `duplicate id ${h.id}`);
    ids.add(h.id);
  }
});

test('steps name a tab or a control, so there is no ambiguity', () => {
  const places = ['Brand', 'Ramps', 'Categories', 'Emotion', 'sidebar', 'Palette', 'header',
    'Share and save', 'wheel', 'matrix', 'cell', 'card'];
  for (const h of HOWTOS) {
    const text = h.steps.join(' ');
    assert.ok(places.some((p) => text.includes(p)),
      `${h.id} never says where to go: ${h.steps[0]}`);
  }
});

test('every FAQ and tile carries real content', () => {
  for (const f of FAQS) {
    assert.ok(f.q.endsWith('?'), `"${f.q}" should be a question`);
    assert.ok(f.a.length > 80, `"${f.q}" has a stub answer`);
  }
  for (const i of IDEAS) {
    assert.ok(i.label && i.value && i.hint.length > 60, `idea "${i.label}" is thin`);
  }
  for (const f of FEATURES) {
    assert.ok(f.label && f.hint.length > 60, `feature "${f.label}" is thin`);
    assert.match(f.where, /->|Sidebar|Brand|Ramps|Categories|Emotion/,
      `feature "${f.label}" must say where it lives`);
  }
  for (const p of PROCESS) {
    assert.ok(Number.isInteger(p.n) && p.title && p.body.length > 60, `step ${p.n} is thin`);
  }
});

// --- the search shape the skill specifies -------------------------------

test('aliases are keyed by APP TERM, holding the everyday phrases', () => {
  // The direction matters: searchText folds a term's phrases into any item that
  // mentions the term, so the key must be the word the app uses.
  for (const [term, phrases] of Object.entries(SEARCH_ALIASES)) {
    assert.ok(Array.isArray(phrases) && phrases.length >= 3, `${term} needs more phrases`);
    for (const p of phrases) assert.equal(typeof p, 'string');
  }
});

test('searchText folds an app term\'s everyday phrases into the text', () => {
  const folded = searchText('This is about contrast and the matrix.');
  assert.match(folded, /readable/);
  assert.match(folded, /accessibility/);
  assert.match(folded, /grid/);
  // A text with no app term in it gains nothing.
  assert.ok(!searchText('plain words only').includes('readable'));
});

test('every query word must appear - AND, not OR', () => {
  // The whole point: adding a word narrows. An OR search gets worse as you type.
  assert.equal(guideMatches('contrast and ramps', 'contrast ramps'), true);
  assert.equal(guideMatches('contrast only', 'contrast ramps'), false);
  assert.equal(guideMatches('ramps only', 'contrast ramps'), false);

  const broad = filterHowtos('ramp').length;
  const narrow = filterHowtos('ramp compare').length;
  assert.ok(narrow <= broad, 'a second word must not widen the result');
  assert.ok(narrow >= 1, 'and it should still find the right one');
});

test('an empty query matches everything', () => {
  for (const q of ['', '   ', null, undefined]) {
    assert.equal(guideMatches('anything at all', q), true);
    assert.equal(filterHowtos(q).length, HOWTOS.length);
    assert.equal(filterFaqs(q).length, FAQS.length);
  }
});

// This is why the alias map exists: people do not use the app's words.
test('user language finds the right entries without sharing a word with them', () => {
  const expect = (query, where, mustMention) => {
    const hits = where(query);
    assert.ok(hits.length > 0, `"${query}" found nothing`);
    const text = JSON.stringify(hits).toLowerCase();
    assert.ok(text.includes(mustMention),
      `"${query}" should reach something about ${mustMention}`);
  };

  expect('colour blind', filterFaqs, 'colour vision');
  expect('daltonism', filterFaqs, 'colour vision');
  expect('photocopy', filterFaqs, 'greyscale');
  expect('a11y', filterFaqs, 'contrast');
  expect('how much', filterFaqs, 'allocation');
  expect('mood', filterFaqs, 'emotion');
  expect('60 30 10', filterFaqs, 'allocation');
  expect('monochrome', filterHowtos, 'ramp');
  expect('pick', filterFeatures, 'eyedropper');
});

test('a query that means nothing here finds nothing', () => {
  assert.equal(countMatches('xyzzy'), 0);
  assert.equal(filterHowtos('xyzzy').length, 0);
  assert.equal(filterFaqs('xyzzy').length, 0);
});

test('the same search filters every part of the guide at once', () => {
  const q = 'contrast';
  const total = filterHowtos(q).length + filterFaqs(q).length
    + filterIdeas(q).length + filterFeatures(q).length;
  assert.equal(countMatches(q), total);
  assert.ok(total > 0);
});

test('search is case and punctuation tolerant', () => {
  for (const q of ['Colour Blind', 'COLOUR BLIND', 'colour  blind']) {
    assert.ok(filterFaqs(q).length > 0, `"${q}" should find something`);
  }
});

test('every alias phrase actually finds something', () => {
  // An alias that resolves to nothing is a dead end the reader never sees.
  const dead = [];
  for (const phrases of Object.values(SEARCH_ALIASES)) {
    for (const p of phrases) if (countMatches(p) === 0) dead.push(p);
  }
  assert.deepEqual(dead, [], `alias phrases that find nothing: ${dead.join(', ')}`);
});

test('every feature tile names something the app really has', () => {
  // The rule is that each new feature gets a tile; this catches a tile for a
  // feature that was removed, which is the same drift in the other direction.
  const tabs = ['Brand', 'Ramps', 'Categories', 'Emotion', 'Sidebar'];
  for (const f of FEATURES) {
    assert.ok(tabs.some((t) => f.where.includes(t)),
      `"${f.label}" points at ${f.where}, which is not a place in this app`);
  }
});
