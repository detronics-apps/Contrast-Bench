// The palette editor and the exports, in house folding sections.

import { el, select, toast, download, GLYPH } from './dom.js';
import { state, saveSoon } from '../state.js';
import { harvest, normalise, isColor } from '../color.js';

/**
 * A folding section with the house head/body structure.
 *
 * `open` is the INITIAL state only. A choice the reader has made always wins,
 * or the panel folds itself back open on every render - which is what happened:
 * collapsing Palette and then editing a colour sprang it open again, because the
 * caller's default was re-applied each time. The store must be able to say "never
 * set", so an absent key is distinguished from a stored false.
 */
function section(id, title, body, { open = true, summary = null } = {}) {
  const remembered = state.ui.sections ? state.ui.sections[id] : undefined;
  const showing = remembered === undefined ? open : remembered;

  const host = el('section', { class: 'section', dataset: { open: String(showing), section: id } });
  const head = el('button', {
    class: 'section__head', type: 'button',
    'aria-expanded': String(showing),
    on: {
      click: () => {
        const next = host.dataset.open !== 'true';
        host.dataset.open = String(next);
        head.setAttribute('aria-expanded', String(next));
        // Remembered chrome is not a state change: store it without re-rendering.
        if (!state.ui.sections) state.ui.sections = {};
        state.ui.sections[id] = next;
        saveSoon();
      },
    },
  }, [
    el('span', { class: 'section__chevron', 'aria-hidden': 'true', text: GLYPH.chevron }),
    el('span', { class: 'section__title', text: title }),
    summary ? el('span', { class: 'section__summary', text: summary }) : null,
  ]);
  host.append(head, el('div', { class: 'section__body' }, [body]));
  return host;
}

/** Every add has a remove, and every supplied name can be reworded. */
export function paletteEditor(ctx) {
  const { palette, state, ctl } = ctx;

  const swatches = el('div', { class: 'swatches' }, palette.colors.map((c, i) => el('div', {
    class: 'swatch',
  }, [
    el('span', { class: 'swatch__hold' }, [
      el('span', { class: 'swatch__sw', style: { background: c.hex } }),
      el('input', {
        type: 'color', value: c.hex, 'aria-label': `Pick colour for ${c.name}`,
        dataset: { field: `pick-${i}` },
        on: { input: (e) => ctl.editColor(i, { hex: e.target.value }) },
      }),
    ]),
    el('span', { class: 'swatch__fields' }, [
      el('input', {
        type: 'text', class: 'swatch__nm', value: c.name, 'aria-label': 'Name',
        dataset: { field: `name-${i}` },
        on: { change: (e) => ctl.editColor(i, { name: e.target.value || 'Untitled' }) },
      }),
      el('input', {
        type: 'text', class: 'swatch__hx', value: c.hex, 'aria-label': 'Hex value',
        dataset: { field: `hex-${i}` },
        on: {
          change: (e) => {
            if (!isColor(e.target.value)) {
              e.target.value = c.hex;
              toast('Not a colour I can read - try #1f2d3d');
              return;
            }
            ctl.editColor(i, { hex: normalise(e.target.value) });
          },
        },
      }),
    ]),
    el('button', {
      class: 'swatch__kill', type: 'button', title: `Remove ${c.name}`,
      'aria-label': `Remove ${c.name}`, text: GLYPH.times,
      on: { click: () => ctl.removeAt(i) },
    }),
  ])));

  const paste = el('textarea', {
    class: 'paste', rows: 3, dataset: { field: 'paste' },
    placeholder: 'Paste anything containing hex codes - #1f2d3d, 7fabc7, rgb(69,75,82).',
  });

  const pasteRow = el('div', { hidden: true }, [
    paste,
    el('div', { class: 'row', style: { marginTop: 'var(--space-2)' } }, [
      el('button', { class: 'btn', type: 'button', text: 'Replace',
        on: { click: () => applyPaste(paste, ctl, true) } }),
      el('button', { class: 'btn', type: 'button', text: 'Append',
        on: { click: () => applyPaste(paste, ctl, false) } }),
    ]),
  ]);

  const body = el('div', {}, [
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', text: 'Working palette' }),
      select(
        state.palettes.map((p) => ({ value: p.id, label: p.name })),
        state.activeId,
        (id) => ctl.setActive(id),
        { dataset: { field: 'palette-select' } },
      ),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', text: 'Name' }),
      el('input', {
        type: 'text', class: 'input', value: palette.name, 'aria-label': 'Palette name',
        dataset: { field: 'palette-name' },
        on: { change: (e) => ctl.renamePalette(e.target.value || 'Untitled') },
      }),
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'New', title: 'Start an empty palette',
        on: { click: () => ctl.newPalette() } }),
      el('button', { class: 'btn', type: 'button', text: 'Duplicate',
        on: { click: () => ctl.duplicatePalette() } }),
      el('button', { class: 'btn', type: 'button', text: 'Delete',
        on: { click: () => ctl.deletePalette() } }),
    ]),
    swatches,
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Add colour',
        on: { click: () => ctl.addColor({ name: `Colour ${palette.colors.length + 1}`, hex: '#6fa8bf' }) } }),
      el('button', { class: 'btn', type: 'button', text: 'Paste list',
        on: { click: () => { pasteRow.hidden = !pasteRow.hidden; if (!pasteRow.hidden) paste.focus(); } } }),
      window.EyeDropper
        ? el('button', { class: 'btn', type: 'button', text: 'Pick',
          title: 'Pick a colour from anywhere on screen',
          on: { click: () => pickFromScreen(ctl) } })
        : null,
    ]),
    pasteRow,
  ]);

  const pairs = (palette.colors.length * (palette.colors.length - 1)) / 2;
  return section('palette', 'Palette', body, {
    summary: `${palette.colors.length} colours - ${pairs} pairs`,
  });
}

function applyPaste(textarea, ctl, replace) {
  const found = harvest(textarea.value);
  if (found.length < (replace ? 2 : 1)) {
    toast(replace ? 'Need at least two colours' : 'No colours found in that text');
    return;
  }
  ctl.setColors(found.map((hex, i) => ({ name: `Colour ${i + 1}`, hex })), replace);
  textarea.value = '';
  toast(`${found.length} colours ${replace ? 'loaded' : 'added'}`);
}

async function pickFromScreen(ctl) {
  try {
    const res = await new window.EyeDropper().open();
    ctl.addColor({ name: 'Picked', hex: normalise(res.sRGBHex) });
  } catch { /* dismissed */ }
}

/** Share, save and print. The last section of the sidebar, never the footer. */
export function exportsSection(ctx) {
  const { state, palette, ctl } = ctx;

  const fileInput = el('input', {
    type: 'file', accept: 'application/json', hidden: true,
    on: {
      change: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          ctl.importModel(JSON.parse(await file.text()));
          toast('Palette file loaded');
        } catch {
          toast('That file is not a palette this app wrote');
        }
        e.target.value = '';
      },
    },
  });

  const body = el('div', {}, [
    el('button', { class: 'btn btn--primary', type: 'button', text: 'Copy share link',
      on: { click: () => ctl.copyShareLink() } }),
    el('p', { class: 'note', text: 'The palette rides after the # in the URL, which browsers '
      + 'never send to a server.' }),
    el('div', { class: 'row', style: { marginTop: 'var(--space-3)' } }, [
      el('button', { class: 'btn', type: 'button', text: 'Save file',
        on: {
          click: () => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
            download(blob, `${palette.name.replace(/[^\w-]+/g, '-').toLowerCase()}.json`);
          },
        } }),
      el('button', { class: 'btn', type: 'button', text: 'Open file',
        on: { click: () => fileInput.click() } }),
    ]),
    el('div', { class: 'row', style: { marginTop: 'var(--space-2)' } }, [
      el('button', { class: 'btn', type: 'button', text: 'Copy analysis',
        title: 'Every measured finding as plain text',
        on: { click: () => ctl.copyAnalysis() } }),
      el('button', { class: 'btn', type: 'button', text: 'Print',
        on: { click: () => window.print() } }),
    ]),
    fileInput,
  ]);

  return section('exports', 'Share and save', body, { open: false });
}
