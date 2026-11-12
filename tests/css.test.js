import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/*
 * A stylesheet with one unclosed rule swallows everything after it, silently.
 *
 * That is exactly what happened: a line-numbered delete ate the closing brace of
 * a media query, and every rule below it - the whole guide - stopped applying.
 * Nothing failed, nothing logged; the page just rendered as unstyled text. This
 * test is the cheapest possible guard against repeating it.
 */
const CSS_DIR = new URL('../css/', import.meta.url);

function depthReport(source) {
  let depth = 0;
  let line = 1;
  let openedAt = null;
  let stray = null;
  for (const ch of source) {
    if (ch === '\n') line += 1;
    if (ch === '{') { if (depth === 0) openedAt = line; depth += 1; }
    if (ch === '}') { depth -= 1; if (depth < 0 && stray === null) { stray = line; depth = 0; } }
  }
  return { depth, openedAt, stray };
}

test('every stylesheet has balanced braces', () => {
  const files = readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'));
  assert.ok(files.length >= 5, 'expected the full set of stylesheets');

  for (const file of files) {
    const { depth, openedAt, stray } = depthReport(readFileSync(new URL(file, CSS_DIR), 'utf8'));
    assert.equal(stray, null, `${file}: stray closing brace at line ${stray}`);
    assert.equal(depth, 0,
      `${file}: ${depth} rule(s) left open - the last one starts at line ${openedAt}, `
      + 'and every rule after it is being swallowed');
  }
});

test('the classes the guide renders are all defined somewhere', () => {
  const all = readdirSync(CSS_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(new URL(f, CSS_DIR), 'utf8'))
    .join('\n');

  // Each of these is emitted by js/main.js renderHelp or js/ui/views.js statTile.
  const needed = [
    'summary-grid', 'stat', 'stat__label', 'stat__value', 'stat__hint',
    'howto-steps', 'faq', 'faq__q', 'faq__a',
    'guide__h', 'guide__lane', 'guide__step', 'guide__step-num', 'guide__step-text',
  ];
  const missing = needed.filter((c) => !all.includes(`.${c}`));
  assert.deepEqual(missing, [], `classes rendered but never styled: ${missing.join(', ')}`);
});
