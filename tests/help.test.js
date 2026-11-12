import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIASES, TOPICS, expand, searchHelp } from '../js/help.js';

const top = (q) => searchHelp(q)[0]?.topic.id;

test('every topic is complete and uniquely identified', () => {
  const ids = new Set();
  for (const t of TOPICS) {
    assert.ok(t.id && t.title && t.body, `${t.id} is incomplete`);
    assert.ok(['howto', 'faq', 'feature'].includes(t.kind), `${t.id} has an odd kind`);
    assert.ok(Array.isArray(t.terms) && t.terms.length >= 3, `${t.id} needs search terms`);
    assert.ok(t.body.length > 80, `${t.id} body is a stub`);
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
  }
});

test('an empty search returns everything rather than nothing', () => {
  for (const q of ['', '   ', null, undefined]) {
    assert.equal(searchHelp(q).length, TOPICS.length, `"${q}" should return all topics`);
  }
});

test('the search finds words that are actually in the text', () => {
  assert.equal(top('matrix'), 'read-matrix');
  assert.equal(top('allocation'), 'allocation');
  assert.equal(top('share link'), 'share');
});

// This is the whole point: people do not search with the app's words.
test('user language reaches the right topic without sharing a word with it', () => {
  const expected = {
    'colour blind': 'cvd',
    colorblind: 'cvd',
    daltonism: 'cvd',
    'red green': 'cvd',
    photocopy: 'cvd',
    'hard to read': 'read-matrix',
    pantone: 'allocation',
    cmyk: 'allocation',
    '60 30 10': 'allocation',
    'how much': 'allocation',
    psychology: 'emotion-science',
    mood: 'emotion-science',
    monochrome: 'ramp-steps',
    tint: 'ramp-steps',
    'what should i change': 'fix-a-pair',
  };
  for (const [query, id] of Object.entries(expected)) {
    const hit = searchHelp(query);
    assert.ok(hit.length, `"${query}" found nothing`);
    assert.equal(hit[0].topic.id, id, `"${query}" should reach ${id}, got ${hit[0].topic.id}`);
  }

  // Some words legitimately have more than one right answer. "accessibility"
  // belongs to the whole contrast story, so assert the neighbourhood rather than
  // forcing a ranking between topics that are equally correct.
  for (const query of ['accessibility', 'a11y', 'compliance']) {
    const ids = searchHelp(query).slice(0, 3).map((h) => h.topic.id);
    assert.ok(ids.some((id) => ['read-matrix', 'marginal', 'large-text'].includes(id)),
      `"${query}" should surface a contrast topic, got ${ids.join(', ')}`);
  }
});

test('expand pulls in the app terms a phrase implies', () => {
  const terms = expand('colour blind');
  assert.ok(terms.includes('protanopia'), 'should reach the app term');
  assert.ok(terms.includes('deuteranopia'));
  assert.ok(terms.includes('colour vision'));
  // And the original words survive, so literal matches still work.
  assert.ok(terms.includes('colour blind'));
});

test('a phrase is matched as one idea, not as its separate words', () => {
  // "colour blind" must not be read as "colour" + "blind".
  const phrase = expand('colour blind');
  assert.ok(phrase.includes('protanopia'));
  // "colour" alone is not an alias key and must not drag the CVD terms in.
  assert.ok(!expand('colour').includes('protanopia'));
});

test('expand is case and punctuation insensitive', () => {
  for (const q of ['Colour Blind', 'COLOUR-BLIND', '  colour blind!  ']) {
    assert.ok(expand(q).includes('protanopia'), `"${q}" should expand`);
  }
});

test('a query with no match returns nothing rather than everything', () => {
  assert.deepEqual(searchHelp('xyzzy quux'), []);
});

test('results are ranked, best first, and deterministic', () => {
  const hits = searchHelp('contrast');
  assert.ok(hits.length > 1);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1].score >= hits[i].score, 'results must be sorted by score');
  }
  assert.deepEqual(searchHelp('contrast').map((h) => h.topic.id),
    searchHelp('contrast').map((h) => h.topic.id), 'the same query must give the same order');
});

test('every alias target is a real word somewhere in the help', () => {
  // An alias pointing at a term no topic carries is a dead end the user never sees.
  const haystack = TOPICS.map((t) => `${t.title} ${t.body} ${t.terms.join(' ')}`)
    .join(' ').toLowerCase();
  const missing = [];
  for (const [alias, targets] of Object.entries(ALIASES)) {
    for (const t of targets) {
      if (!haystack.includes(t.toLowerCase())) missing.push(`${alias} -> ${t}`);
    }
  }
  assert.deepEqual(missing, [], `aliases pointing nowhere: ${missing.join('; ')}`);
});

test('every alias actually returns a result', () => {
  for (const alias of Object.keys(ALIASES)) {
    assert.ok(searchHelp(alias).length > 0, `"${alias}" is an alias that finds nothing`);
  }
});
