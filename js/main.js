// Chrome, tool routing, rendering.

import {
  load, save, saveSoon, state, activePalette, activeColors, shareLink,
  addPalette, removePalette, updatePalette, migrate, replaceState,
} from './state.js';
import { el, clear, chips, toast } from './ui/dom.js';
import { captureFocus, restoreFocus } from './ui/patterns.js';
import { paletteEditor, exports_ } from './ui/sidebar.js';
import { reportText } from './ui/report.js';
import { legal } from './legal.js';
import * as brand from './ui/tools/brand.js';
import * as channel from './ui/tools/channel.js';
import * as feeling from './ui/tools/feeling.js';

export const APP_VERSION = '0.2.0';

const TOOLS = { brand, channel, feeling };
const LEVELS = [
  { value: 'simple', label: 'Simple', note: 'The answer: your palette, every pairing, and the verdict.' },
  { value: 'advanced', label: 'Advanced', note: 'Adds reach, findings, allocation and the changes worth making.' },
  { value: 'expert', label: 'Expert', note: 'Adds the geometry, the replacement search and the full per-colour reading.' },
];

const dom = {};

// ---------------------------------------------------------------- chrome

function applyTheme() {
  if (state.ui.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', state.ui.theme);
}

const coffeeCup = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of [
    'M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z',
    'M16 11h2a2.5 2.5 0 0 1 0 5h-2',
    'M7 3v2M10 3v2M13 3v2',
  ]) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linecap', 'round');
    svg.appendChild(p);
  }
  return svg;
};

function buildHeader() {
  return el('header', { class: 'app-header' }, [
    el('a', { class: 'brand', href: 'https://detronics.co.za', target: '_blank', rel: 'noopener' }, [
      el('img', { class: 'brand__logo', src: 'assets/logo.png', alt: 'Detronics' }),
      el('span', { class: 'brand__sep', 'aria-hidden': 'true' }),
      el('span', { class: 'brand__tool', text: 'Contrast Bench' }),
    ]),
    el('div', { class: 'header-actions' }, [
      el('a', {
        class: 'btn-icon', href: 'https://buymeacoffee.com/detronics',
        target: '_blank', rel: 'noopener', 'aria-label': 'Buy me a coffee', title: 'Buy me a coffee',
      }, [coffeeCup()]),
      el('button', {
        class: 'btn', type: 'button', id: 'theme-toggle',
        text: state.ui.theme === 'system' ? 'Theme' : state.ui.theme === 'light' ? 'Light' : 'Dark',
        'aria-label': 'Change theme',
        on: {
          click: () => {
            const order = ['system', 'light', 'dark'];
            state.ui.theme = order[(order.indexOf(state.ui.theme) + 1) % order.length];
            applyTheme();
            save();
            render();
          },
        },
      }),
    ]),
  ]);
}

function buildModeBar() {
  const level = LEVELS.find((l) => l.value === state.ui.level) ?? LEVELS[0];
  return el('div', { class: 'modebar' }, [
    chips(LEVELS, state.ui.level, (v) => set({ level: v })),
    el('span', { class: 'modebar__note', text: level.note }),
  ]);
}

function buildTabs() {
  const palette = activePalette();
  const tabs = Object.values(TOOLS).map((t) => ({
    value: t.meta.id,
    label: t.meta.label,
    title: t.meta.kind === 'any' ? 'Works on any palette'
      : `Best suited to a ${t.meta.kind} palette`,
  }));
  return el('div', { class: 'tabsrow' }, [
    chips(tabs, state.ui.tool, (v) => set({ tool: v, selection: null })),
    el('span', { class: 'segmented__sep' }),
    el('button', { class: 'chip', type: 'button', text: 'How to use',
      'aria-pressed': String(state.ui.tool === 'help'),
      on: { click: () => set({ tool: 'help' }) } }),
    palette.kind !== TOOLS[state.ui.tool]?.meta.kind
      && TOOLS[state.ui.tool]?.meta.kind !== 'any' && state.ui.tool !== 'help'
      ? el('span', { class: 'tabsrow__hint',
        text: `This palette is marked "${palette.kind}". The analysis still runs.` })
      : null,
  ]);
}

function buildFooter() {
  const link = (label, key) => el('button', {
    class: 'linkbtn', type: 'button', text: label,
    on: { click: () => openModal(legal[key].title, legal[key].body) },
  });
  return el('footer', { class: 'app-footer' }, [
    el('span', { text: 'All processing runs locally in your browser - nothing is uploaded.' }),
    el('nav', { class: 'footer-nav' }, [
      link('Licence & terms', 'licence'),
      link('Imprint & privacy', 'privacy'),
      link('How accurate is this', 'accuracy'),
      el('a', { class: 'linkbtn', href: 'https://buymeacoffee.com/detronics',
        target: '_blank', rel: 'noopener', text: 'Buy me a coffee' }),
      el('button', { class: 'linkbtn', type: 'button', text: 'I am new here',
        on: { click: showWelcome } }),
      el('span', { class: 'muted', text: `v${APP_VERSION}` }),
    ]),
  ]);
}

// ---------------------------------------------------------------- modals

function openModal(title, paragraphs) {
  const back = el('div', { class: 'modalback', on: { click: (e) => {
    if (e.target === back) back.remove();
  } } }, [
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('div', { class: 'modal__head' }, [
        el('h3', { text: title }),
        el('button', { class: 'modal__x', type: 'button', 'aria-label': 'Close', text: 'x',
          on: { click: () => back.remove() } }),
      ]),
      el('div', { class: 'modal__body' }, paragraphs.map((p) => el('p', { text: p }))),
    ]),
  ]);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { back.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(back);
}

function showWelcome() {
  openModal('Contrast Bench in four moves', [
    '1. The palette on the right is yours to edit. Rename a colour, change a hex, paste a list, or drop in one of the saved palettes from the picker.',
    '2. Brand asks whether these colours can carry text against each other. Click any cell in the matrix for the full breakdown and the smallest fix.',
    '3. Channel asks a different question: can a viewer tell these categories apart - in colour, in greyscale, and with colour blindness. Use it for content pillars, chart series, status tiers.',
    '4. Emotion maps hue to what it conventionally communicates, and works backwards: pick what you want to say and it shows which colours say it AND pass contrast.',
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
    el('div', { class: 'panel__body' }, [
      el('h4', { text: 'The three questions this answers' }),
      el('ul', { class: 'bullets' }, [
        el('li', { text: 'Brand - can this colour carry text on that one? Contrast ratios, WCAG levels, and the smallest shift that fixes a failing pair.' }),
        el('li', { text: 'Channel - can a viewer tell these apart? Perceptual distance, greyscale, and the three common forms of colour blindness.' }),
        el('li', { text: 'Emotion - what is this colour saying, and which colours say what I want AND stay legible?' }),
      ]),
      el('h4', { text: 'Features worth knowing' }),
      el('ul', { class: 'bullets' }, [
        el('li', { text: 'Saved palettes. Keep a brand set and a channel set side by side and switch between them; each is saved on this device.' }),
        el('li', { text: 'Paste hex list. Drop in anything containing hex codes - a stylesheet, an email, a spec - and it pulls the colours out.' }),
        el('li', { text: 'Eyedropper. In Chrome, pick a colour from anywhere on screen.' }),
        el('li', { text: 'Copy analysis. Every measured finding as plain text, ready to paste into a conversation where the judgement call gets made.' }),
        el('li', { text: 'Share link. The palette rides in the URL fragment, which browsers never transmit to a server.' }),
        el('li', { text: 'Detail levels. Simple shows the answer. Advanced adds the reasoning. Expert adds the geometry and the search tools.' }),
      ]),
      el('h4', { text: 'Questions' }),
      topic('Why does the matrix mirror across the diagonal?',
        'Contrast is symmetric: the ratio between two colours does not depend on which one is the text. The two halves differ only in which colour carries the type, which is why both are drawn.'),
      topic('What counts as large text?',
        '18.66px bold, or 24px regular and up. Large text needs 3:1 rather than 4.5:1.'),
      topic('Why does a pair pass 4.5:1 and still look wrong?',
        'A known limit of the WCAG 2.1 formula: it under-reports how poorly light text on mid-dark backgrounds reads. Treat a marginal pass at 4.6:1 as marginal rather than as a licence.'),
      topic('Why do you say the emotion wheel is not science?',
        'Because it is not. Colour-emotion association is real but learned, culturally specific, and far weaker than confident marketing wheels suggest. It is also indexed on hue alone, while saturation and lightness move the reading at least as much - which is why this wheel has three rings and every reading carries its modifiers.'),
      topic('Why can my five categories only show as three?',
        'Two different hues at the same lightness are identical in greyscale, and several hue pairs merge under common colour blindness. The counts are reported per viewer rather than pooled, so you can see which situation is the limiting one.'),
      topic('How do I separate two categories without changing what they mean?',
        'Move lightness, not hue. Hue carries the emotional association; the wheel has no opinion about lightness. Channel mode computes the smallest lightness change that separates a collapsing pair on all three tests.'),
    ]),
  ]));
}

// ---------------------------------------------------------------- state plumbing

function set(patch) {
  Object.assign(state.ui, patch);
  saveSoon();
  render();
}

const ctl = {
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
  editColor(i, patch) {
    replaceState(updatePalette(state, state.activeId, (p) => {
      const colors = p.colors.map((c, j) => (j === i ? { ...c, ...patch } : c));
      return { ...p, colors };
    }));
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
    const p = activePalette();
    const i = p.colors.findIndex((c) => c.hex.toLowerCase() === hex.toLowerCase());
    if (i > -1) ctl.removeAt(i);
  },
  setColors(list, replace) {
    replaceState(updatePalette(state, state.activeId,
      (p) => ({ ...p, colors: replace ? list : [...p.colors, ...list] })));
    state.ui.selection = null;
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

  clear(dom.chrome).append(buildModeBar(), buildTabs());
  clear(dom.stage);
  clear(dom.sidebar);

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
    renderHelp(dom.stage);
  } else {
    const tool = TOOLS[state.ui.tool] ?? TOOLS.brand;
    try {
      tool.render(dom.stage, ctx);
    } catch (err) {
      dom.stage.appendChild(el('div', { class: 'banner banner--danger' }, [
        el('b', { text: 'That view could not be drawn. ' }),
        String(err && err.message ? err.message : err),
      ]));
    }
    dom.sidebar.appendChild(paletteEditor(ctx));
    try {
      tool.renderAside?.(dom.sidebar, ctx);
    } catch { /* an aside is never worth losing the page for */ }
  }

  dom.sidebar.appendChild(exports_(ctx));
  restoreFocus(snapshot);
}

function init() {
  load();
  applyTheme();

  dom.chrome = el('div', { class: 'chrome' });
  dom.stage = el('div', { class: 'viewport__stage', id: 'stage' });
  dom.sidebar = el('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': 'Palette and exports' });

  document.body.append(
    buildHeader(),
    dom.chrome,
    el('main', { class: 'app-main' }, [
      el('section', { class: 'viewport' }, [dom.stage]),
      dom.sidebar,
    ]),
    buildFooter(),
  );

  render();

  // Shown once, on a stored flag, and never over a share link.
  if (!state.ui.seenWelcome && !state.ui.fromShare) showWelcome();
  save();
}

init();
