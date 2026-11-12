// Chrome, tool routing, rendering.
//
// The frame follows references/interface.md exactly: header, mode bar, tab bar,
// main, sidebar, footer. The mode bar and tabs are children of `.viewport`, which
// is the scrolling column - putting them outside it is what leaves them pinned at
// the top with no spacing under them.

import {
  load, save, saveSoon, state, activePalette, activeColors, shareLink,
  addPalette, removePalette, updatePalette, migrate, replaceState,
} from './state.js';
import { el, clear, toast } from './ui/dom.js';
import { captureFocus, restoreFocus } from './ui/patterns.js';
import { paletteEditor, exportsSection } from './ui/sidebar.js';
import { reportText } from './ui/report.js';
import { legal } from './legal.js';
import * as brand from './ui/tools/brand.js';
import * as ramp from './ui/tools/ramp.js';
import * as channel from './ui/tools/channel.js';
import * as feeling from './ui/tools/feeling.js';

export const APP_VERSION = '0.3.0';

const TOOLS = { brand, ramp, channel, feeling };

const LEVELS = [
  { value: 'simple', label: 'Simple',
    hint: 'The answer: your colours, every pairing, and the verdict.',
    why: 'Just the result - no geometry, no allocation, no theory.' },
  { value: 'advanced', label: 'Advanced',
    hint: 'Adds the reasoning: reach, findings, allocation and what to change.',
    why: 'The result plus why it came out that way.' },
  { value: 'expert', label: 'Expert',
    hint: 'Adds the geometry, the search tools and the full per-colour reading.',
    why: 'Everything, including how the app itself works.' },
];

const dom = {};

// ---------------------------------------------------------------- chrome

function applyTheme() {
  if (state.ui.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', state.ui.theme);
  // One central gate for every explanatory line, present and future.
  document.documentElement.dataset.level = state.ui.level;
}

const THEME_ORDER = ['system', 'light', 'dark'];
const THEME_LABEL = { system: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' };
// Written as escapes on purpose: U+FE0E is invisible, and a literal one is silently
// lost the moment this line is copied through anything that strips it. It asks for
// text presentation, without which some platforms render these as colour emoji.
const THEME_GLYPH = { system: '◐', light: '☀︎', dark: '☾︎' };

const COFFEE_URL = 'https://buymeacoffee.com/detronics';
// Drawn, not typed: an emoji cup arrives with its own browns baked in, which belong
// to no theme this app has. currentColor inherits whatever the button is using.
const COFFEE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" '
  + 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
  + 'stroke-linejoin="round">'
  + '<path d="M6.5 8 H15.5 V13 A4.5 4.5 0 0 1 6.5 13 Z"/>'
  + '<path d="M15.5 9.5 h1.8 a2.6 2.6 0 0 1 0 5.2 h-1.8"/>'
  + '<path d="M4 19.5 Q 11 21.8 18 19.5"/>'
  + '<path d="M9.3 5.2 q -1.4 -1.1 0 -2.2 q 1.4 -1.1 0 -2.2"/>'
  + '<path d="M13.3 5.2 q -1.4 -1.1 0 -2.2 q 1.4 -1.1 0 -2.2"/>'
  + '</svg>';

function buildHeader() {
  const themeBtn = el('button', {
    class: 'btn btn--icon', type: 'button', id: 'theme-toggle',
    on: {
      click: () => {
        state.ui.theme = THEME_ORDER[(THEME_ORDER.indexOf(state.ui.theme) + 1) % 3];
        applyTheme();
        syncTheme(themeBtn);
        save();
      },
    },
  }, [el('span', { class: 'btn__glyph', 'aria-hidden': 'true' })]);
  syncTheme(themeBtn);

  return el('header', { class: 'app-header' }, [
    el('a', {
      class: 'brand brand__home', href: 'https://www.detronics.co.za/',
      target: '_blank', rel: 'noopener noreferrer',
    }, [
      el('img', { class: 'brand__logo', src: 'assets/logo.png', alt: 'Detronics' }),
      el('span', { class: 'brand__sep', 'aria-hidden': 'true' }),
      el('span', { class: 'brand__tool', text: 'Contrast Bench' }),
    ]),
    el('div', { class: 'header-actions' }, [
      el('a', {
        class: 'btn btn--icon', href: COFFEE_URL, target: '_blank', rel: 'noopener noreferrer',
        title: 'Buy me a coffee (opens in a new tab)',
        'aria-label': 'Buy me a coffee (opens in a new tab)',
        html: COFFEE_ICON,
      }),
      themeBtn,
    ]),
  ]);
}

function syncTheme(btn) {
  btn.querySelector('.btn__glyph').textContent = THEME_GLYPH[state.ui.theme];
  btn.title = `${THEME_LABEL[state.ui.theme]}. Click to change - system, light or dark. `
    + 'Set it explicitly before screen-recording.';
  btn.setAttribute('aria-label', THEME_LABEL[state.ui.theme]);
}

/** The level switch gets its own row, above the tabs it governs. */
function buildModeBar() {
  const current = LEVELS.find((l) => l.value === state.ui.level) ?? LEVELS[0];
  return el('div', { class: 'modebar-host' }, [
    el('div', { class: 'modebar', role: 'group', 'aria-label': 'How much detail to show' },
      LEVELS.map((l) => el('button', {
        class: 'chip modebar__chip', type: 'button',
        'aria-pressed': String(l.value === state.ui.level),
        title: l.why,
        text: l.label,
        on: { click: () => set({ level: l.value }) },
      }))),
    el('span', { class: 'modebar__hint', text: current.hint }),
  ]);
}

/** Tabs ordered as the story runs, with the help tab fenced off. */
function buildTabs() {
  const tab = (id, label, title) => el('button', {
    class: 'segmented__btn', type: 'button', role: 'tab',
    'aria-selected': String(state.ui.tool === id),
    title,
    text: label,
    on: { click: () => set({ tool: id, selection: null }) },
  });

  return el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Tools' }, [
    tab('brand', 'Brand', 'Can these colours carry text against each other?'),
    tab('ramp', 'Ramps', 'One colour at a time, against its own shades and the neutrals.'),
    tab('channel', 'Categories', 'Can a viewer tell a set of markers apart?'),
    tab('feeling', 'Emotion', 'What is this colour saying, and what should it be saying?'),
    el('span', { class: 'segmented__sep', 'aria-hidden': 'true' }),
    tab('help', 'How to use', 'Search, how-tos and FAQs.'),
  ]);
}

function buildFooter() {
  const link = (label, key) => el('button', {
    class: 'linkish', type: 'button', text: label,
    on: { click: () => openModal(legal[key].title, legal[key].body) },
  });
  return el('footer', { class: 'app-footer' }, [
    el('span', { text: 'Everything runs in your browser - nothing is uploaded.' }),
    el('nav', {}, [
      link('Licence & terms', 'licence'),
      link('Imprint & privacy', 'privacy'),
      link('How accurate is this', 'accuracy'),
      el('a', {
        class: 'linkish', href: COFFEE_URL, target: '_blank', rel: 'noopener noreferrer',
        text: 'Buy me a coffee',
      }),
      el('button', { class: 'linkish', type: 'button', text: 'I am new here',
        on: { click: showWelcome } }),
      el('span', { class: 'muted', text: `v${APP_VERSION}` }),
    ]),
  ]);
}

// ---------------------------------------------------------------- modals

/** Three ways out - the x, Escape and the backdrop. One is a trap on a phone. */
function openModal(title, paragraphs) {
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const back = el('div', {
    class: 'modal-backdrop',
    on: { click: (e) => { if (e.target === back) close(); } },
  }, [
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('div', { class: 'modal__head' }, [
        el('h3', { class: 'modal__title', text: title }),
        el('button', {
          class: 'btn btn--icon modal__close', type: 'button',
          'aria-label': 'Close', title: 'Close',
        }, [el('span', { class: 'btn__glyph', 'aria-hidden': 'true', text: '×' })]),
      ]),
      el('div', { class: 'modal__body' }, paragraphs.map((p) => el('p', { text: p }))),
    ]),
  ]);
  back.querySelector('.modal__close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
}

function showWelcome() {
  openModal('Contrast Bench in four moves', [
    '1. The palette on the right is yours to edit. Rename a colour, change a hex, paste a list, or load one of the demo palettes from the picker.',
    '2. Brand asks whether a set of colours can carry text against each other. Click any cell in the matrix for the full breakdown and the smallest fix.',
    '3. Ramps takes one colour at a time and builds its own range of shades and tints, measured against black, white and the neutrals - which is what you need when a colour has to work on its own rather than beside the others.',
    '4. Categories asks whether a viewer can tell a set of markers apart, in colour, in greyscale and with colour blindness. Emotion maps hue to what it conventionally communicates, and works backwards from an intent.',
    'Nothing leaves your browser. Share link puts the palette after the # in the URL, which is never sent to a server. Copy analysis puts the measured findings on your clipboard as plain text.',
  ]);
  state.ui.seenWelcome = true;
  save();
}

// ---------------------------------------------------------------- help

function renderHelp(host) {
  const topic = (q, a) => el('details', { class: 'faq' }, [
    el('summary', { text: q }),
    el('p', { text: a }),
  ]);

  host.appendChild(el('h2', { class: 'sectiontitle', text: 'How to use this' }));
  host.appendChild(el('section', { class: 'panel' }, [
    el('h4', { text: 'The four questions this answers' }),
    el('ul', { class: 'bullets' }, [
      el('li', { text: 'Brand - can this colour carry text on that one? Contrast ratios, WCAG levels, and the smallest shift that fixes a failing pair.' }),
      el('li', { text: 'Ramps - does one colour work on its own? Its own shades and tints against black, white and the neutrals, which is the right question when a colour is never shown beside the others.' }),
      el('li', { text: 'Categories - can a viewer tell these apart? Perceptual distance, greyscale, and the three common forms of colour blindness.' }),
      el('li', { text: 'Emotion - what is this colour saying, and which colours say what I want while staying legible?' }),
    ]),
    el('h4', { text: 'Features worth knowing' }),
    el('ul', { class: 'bullets' }, [
      el('li', { text: 'Saved palettes. Keep several side by side and switch between them; each is saved in this browser only.' }),
      el('li', { text: 'Paste hex list. Drop in anything containing hex codes - a stylesheet, an email, a spec - and it pulls the colours out.' }),
      el('li', { text: 'Eyedropper. In Chrome, pick a colour from anywhere on screen.' }),
      el('li', { text: 'Copy analysis. Every measured finding as plain text, ready to paste where the judgement call gets made.' }),
      el('li', { text: 'Share link. The palette rides in the URL fragment, which browsers never transmit to a server.' }),
      el('li', { text: 'Detail levels. Simple shows the answer, Advanced adds the reasoning, Expert adds the geometry and the search tools.' }),
    ]),
    el('h4', { text: 'Questions' }),
    topic('Which mode do I want?',
      'If the colours appear together on one screen, use Brand. If each colour has its own world and is never shown beside the others - one per section, one per episode - use Ramps. Use Categories only when a viewer has to tell markers apart at a glance.'),
    topic('Why does the matrix mirror across the diagonal?',
      'Contrast is symmetric: the ratio between two colours does not depend on which one carries the text. The two halves differ only in which one does, which is why both are drawn.'),
    topic('What counts as large text?',
      '18.66px bold, or 24px regular and up. Large text needs 3:1 rather than 4.5:1.'),
    topic('Why does a pair pass 4.5:1 and still look wrong?',
      'A known limit of the WCAG 2.1 formula: it under-reports how poorly light text on mid-dark backgrounds reads. Treat a marginal pass at 4.6:1 as marginal rather than as a licence.'),
    topic('Why do you say the emotion wheel is not science?',
      'Because it is not. Colour-emotion association is real but learned, culturally specific, and far weaker than confident marketing wheels suggest. It is also indexed on hue alone, while saturation and lightness move the reading at least as much - which is why this wheel has three rings and every reading carries its modifiers.'),
    topic('How do I separate two categories without changing what they mean?',
      'Move lightness, not hue. Hue carries the emotional association; the wheel has no opinion about lightness. Categories mode computes the smallest lightness change that separates a collapsing pair on all three tests.'),
  ]));
}

// ---------------------------------------------------------------- state plumbing

function set(patch) {
  Object.assign(state.ui, patch);
  applyTheme();
  saveSoon();
  render();
}

export const ctl = {
  setActive(id) { state.activeId = id; state.ui.selection = null; save(); render(); },
  renamePalette(name) {
    replaceState(updatePalette(state, state.activeId, (p) => ({ ...p, name })));
    saveSoon(); render();
  },
  duplicatePalette() {
    const p = activePalette();
    replaceState(addPalette(state, { name: `${p.name} copy`, kind: p.kind, colors: p.colors }));
    save(); render();
  },
  deletePalette() {
    if (state.palettes.length <= 1) { toast('Keep at least one palette'); return; }
    replaceState(removePalette(state, state.activeId));
    save(); render();
  },
  newPalette() {
    replaceState(addPalette(state, {
      name: 'New palette', kind: 'brand',
      colors: [{ name: 'Ink', hex: '#1f2d3d' }, { name: 'Paper', hex: '#ffffff' }],
    }));
    save(); render();
  },
  editColor(i, patch) {
    replaceState(updatePalette(state, state.activeId, (p) => ({
      ...p, colors: p.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    })));
    saveSoon(); render();
  },
  addColor(color) { ctl.addColors([color]); },
  addColors(list) {
    replaceState(updatePalette(state, state.activeId,
      (p) => ({ ...p, colors: [...p.colors, ...list] })));
    save(); render();
    toast(list.length === 1 ? `${list[0].hex} added` : `${list.length} colours added`);
  },
  removeAt(i) {
    const p = activePalette();
    if (p.colors.length <= 2) { toast('Two colours minimum'); return; }
    replaceState(updatePalette(state, state.activeId,
      (q) => ({ ...q, colors: q.colors.filter((_, j) => j !== i) })));
    state.ui.selection = null;
    save(); render();
  },
  removeColor(hex) {
    const i = activePalette().colors.findIndex((c) => c.hex.toLowerCase() === hex.toLowerCase());
    if (i > -1) ctl.removeAt(i);
  },
  setColors(list, replace) {
    replaceState(updatePalette(state, state.activeId,
      (p) => ({ ...p, colors: replace ? list : [...p.colors, ...list] })));
    state.ui.selection = null;
    save(); render();
  },
  setKind(kind) {
    replaceState(updatePalette(state, state.activeId, (p) => ({ ...p, kind })));
    save(); render();
  },
  importModel(raw) { replaceState(migrate(raw)); save(); render(); },
  copyShareLink() { copy(shareLink(), 'Share link copied'); },
  copyAnalysis() {
    copy(reportText(activePalette(), { version: APP_VERSION }), 'Analysis copied as text');
  },
};

function copy(text, message) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast(message ?? `${text} copied`),
      () => toast('Could not reach the clipboard'),
    );
  } else {
    toast('Clipboard not available in this browser');
  }
}

// ---------------------------------------------------------------- render

export function render() {
  const snapshot = captureFocus();

  clear(dom.viewport);
  clear(dom.sidebar);

  dom.viewport.append(buildModeBar(), buildTabs());

  const palette = activePalette();
  const ctx = {
    palette,
    colors: activeColors(),
    state,
    ui: state.ui,
    level: state.ui.level,
    set,
    ctl,
    copy: (hex) => copy(hex, `${hex} copied`),
    addColor: ctl.addColor,
    addColors: ctl.addColors,
    removeColor: ctl.removeColor,
  };

  if (state.ui.tool === 'help') {
    renderHelp(dom.viewport);
  } else {
    const tool = TOOLS[state.ui.tool] ?? TOOLS.brand;
    try {
      tool.render(dom.viewport, ctx);
    } catch (err) {
      dom.viewport.appendChild(el('div', { class: 'banner banner--error' }, [
        el('span', { class: 'banner__icon', text: '!' }),
        el('div', { class: 'banner__body' }, [
          el('b', { text: 'That view could not be drawn. ' }),
          String(err && err.message ? err.message : err),
        ]),
      ]));
    }
    dom.sidebar.appendChild(paletteEditor(ctx));
    try {
      tool.renderAside?.(dom.sidebar, ctx);
    } catch { /* an aside is never worth losing the page for */ }
  }

  dom.sidebar.appendChild(exportsSection(ctx));
  restoreFocus(snapshot);
}

function init() {
  load();
  applyTheme();

  dom.viewport = el('section', { class: 'viewport' });
  dom.sidebar = el('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': 'Palette and exports' });

  document.body.append(
    buildHeader(),
    el('main', { class: 'app-main' }, [dom.viewport, dom.sidebar]),
    buildFooter(),
  );

  render();

  if (!state.ui.seenWelcome && !state.ui.fromShare) showWelcome();
  save();
}

init();
