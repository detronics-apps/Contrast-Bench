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
import { el, clear, toast, download } from './ui/dom.js';
import { captureFocus, restoreFocus } from './ui/patterns.js';
import { paletteEditor, exportsSection } from './ui/sidebar.js';
import { reportText } from './ui/report.js';
import { legal } from './legal.js';
import { searchHelp } from './help.js';
import * as brand from './ui/tools/brand.js';
import * as ramp from './ui/tools/ramp.js';
import * as channel from './ui/tools/channel.js';
import * as feeling from './ui/tools/feeling.js';

export const APP_VERSION = '0.4.0';

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

// ---------------------------------------------------------------- scroll

/*
 * A click must never change where anything is scrolled to.
 *
 * Containers are FOUND, not listed. Naming them works until the next scroller
 * appears, and the one nobody adds to the list is the one that jumps - here the
 * medium chips threw the page to the top because `.viewport` was never captured.
 * Both axes, because the tab bar scrolls sideways.
 */
const captureScroll = () => {
  const saved = [...document.querySelectorAll('*')]
    .filter((n) => n.scrollTop || n.scrollLeft)
    .map((n) => [n, n.scrollTop, n.scrollLeft]);
  return { nodes: saved, pageX: window.scrollX, pageY: window.scrollY };
};

const restoreScroll = (saved) => {
  const apply = () => {
    for (const [n, top, left] of saved.nodes) {
      if (!n.isConnected) continue;   // it was replaced, not merely refilled
      if (top) n.scrollTop = top;
      if (left) n.scrollLeft = left;
    }
    if (saved.pageX || saved.pageY) window.scrollTo(saved.pageX, saved.pageY);
  };
  apply();
  // A container whose new contents are momentarily shorter clamps the offset it
  // is handed, and the clamped value is what sticks. Re-apply after layout.
  requestAnimationFrame(apply);
};

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

const icon = (paths) => '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" '
  + 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
  + `stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;

// Arrow down into a tray, and up out of one. Drawn rather than typed, like the cup.
const SAVE_ICON = icon(['M12 3 v10', 'M8 10 l4 4 4-4', 'M4 17 v3 h16 v-3']);
const LOAD_ICON = icon(['M12 14 V4', 'M8 7 l4-3 4 3', 'M4 17 v3 h16 v-3']);

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
      // The order is the same in every app: save, load, coffee, theme.
      el('button', {
        class: 'btn btn--icon', type: 'button', html: SAVE_ICON,
        title: 'Save all palettes to a file on this device',
        'aria-label': 'Save palettes to a file',
        on: { click: () => ctl.saveFile() },
      }),
      el('button', {
        class: 'btn btn--icon', type: 'button', html: LOAD_ICON,
        title: 'Open a palette file from this device',
        'aria-label': 'Open a palette file',
        on: { click: () => ctl.openFile() },
      }),
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

const KIND_LABEL = { howto: 'How to', faq: 'Question', feature: 'Feature' };

function renderHelp(host) {
  const results = el('div', { class: 'helpresults' });

  const draw = (query) => {
    clear(results);
    const hits = searchHelp(query);

    if (!hits.length) {
      results.appendChild(el('p', { class: 'note',
        text: `Nothing matches "${query}". Try the words you would use yourself - "colour blind", `
          + '"photocopy", "how much", "mood" and "pantone" all find something.' }));
      return;
    }
    if (query.trim()) {
      results.appendChild(el('p', { class: 'note',
        text: `${hits.length} ${hits.length === 1 ? 'topic' : 'topics'} for "${query}".` }));
    }
    for (const { topic } of hits) {
      results.appendChild(el('details', { class: 'faq', open: Boolean(query.trim()) }, [
        el('summary', {}, [
          el('span', { class: 'faq__kind', text: KIND_LABEL[topic.kind] }),
          topic.title,
        ]),
        el('p', { text: topic.body }),
      ]));
    }
  };

  host.appendChild(el('h2', { class: 'sectiontitle', text: 'How to use this' }));
  host.appendChild(el('section', { class: 'panel' }, [
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'help-search', text: 'Search the help' }),
      el('input', {
        type: 'search', class: 'input', id: 'help-search', dataset: { field: 'help-search' },
        placeholder: 'Try "colour blind", "how much", "pantone", "mood"',
        value: state.ui.helpQuery ?? '',
        on: {
          // Searching is not a state change worth re-rendering the page for, so
          // this redraws its own results and never calls render().
          input: (e) => { state.ui.helpQuery = e.target.value; draw(e.target.value); saveSoon(); },
        },
      }),
      el('p', { class: 'field__hint',
        text: 'It searches what you mean, not only what you typed: "daltonism" finds the '
          + 'colour-vision page, "60 30 10" finds allocation.' }),
    ]),
    results,
  ]));
  draw(state.ui.helpQuery ?? '');


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
  saveFile() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    download(blob, 'contrast-bench-palettes.json');
    toast('Saved to your downloads');
  },
  openFile() {
    const input = el('input', {
      type: 'file', accept: 'application/json', hidden: true,
      on: {
        change: async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              ctl.importModel(JSON.parse(await file.text()));
              toast('Palettes loaded');
            } catch {
              toast('That file is not a palette file this app wrote');
            }
          }
          input.remove();
        },
      },
    });
    document.body.appendChild(input);
    input.click();
  },
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
  const scroll = captureScroll();

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
  restoreScroll(scroll);
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
