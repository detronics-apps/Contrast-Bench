// The palette editor and the exports. Shared by every tool.

import { el, select, toast, download } from './dom.js';
import { harvest, normalise, isColor } from '../color.js';

/**
 * Every add has a remove, and every supplied name can be reworded.
 * `ctx` supplies the palette plus the mutation callbacks.
 */
export function paletteEditor(ctx) {
  const { palette, state, ctl } = ctx;

  const chipsHost = el('div', { class: 'chips' }, palette.colors.map((c, i) => el('div', {
    class: 'chip2',
  }, [
    el('span', { class: 'chip2__hold' }, [
      el('span', { class: 'chip2__sw', style: { background: c.hex } }),
      el('input', {
        type: 'color', value: c.hex, 'aria-label': `Pick colour for ${c.name}`,
        dataset: { field: `pick-${i}` },
        on: { input: (e) => ctl.editColor(i, { hex: e.target.value }) },
      }),
    ]),
    el('span', { class: 'chip2__fields' }, [
      el('input', {
        type: 'text', class: 'chip2__nm', value: c.name, 'aria-label': 'Name',
        dataset: { field: `name-${i}` },
        on: { change: (e) => ctl.editColor(i, { name: e.target.value || 'Untitled' }) },
      }),
      el('input', {
        type: 'text', class: 'chip2__hx', value: c.hex, 'aria-label': 'Hex value',
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
      class: 'chip2__kill', type: 'button', title: `Remove ${c.name}`,
      'aria-label': `Remove ${c.name}`, text: 'x',
      on: { click: () => ctl.removeAt(i) },
    }),
  ])));

  const paste = el('textarea', {
    class: 'paste', rows: 3, dataset: { field: 'paste' },
    placeholder: 'Paste anything containing hex codes - #1f2d3d, 7fabc7, rgb(69,75,82).',
  });

  const pasteRow = el('div', { class: 'pasterow', hidden: true }, [
    paste,
    el('div', { class: 'pasterow__acts' }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Replace',
        on: { click: () => applyPaste(paste, ctl, true) } }),
      el('button', { class: 'btn', type: 'button', text: 'Append',
        on: { click: () => applyPaste(paste, ctl, false) } }),
      el('button', { class: 'btn', type: 'button', text: 'Cancel',
        on: { click: () => { pasteRow.hidden = true; } } }),
    ]),
  ]);

  const tools = el('div', { class: 'tools' }, [
    el('button', { class: 'btn', type: 'button', text: '+ Add colour',
      on: { click: () => ctl.addColor({ name: `Colour ${palette.colors.length + 1}`, hex: '#7fabc7' }) } }),
    el('button', { class: 'btn', type: 'button', text: 'Paste hex list',
      on: { click: () => { pasteRow.hidden = !pasteRow.hidden; if (!pasteRow.hidden) paste.focus(); } } }),
    window.EyeDropper
      ? el('button', { class: 'btn', type: 'button', text: 'Eyedropper',
        on: { click: () => pickFromScreen(ctl) } })
      : null,
  ]);

  return el('section', { class: 'panel' }, [
    el('div', { class: 'panel__head' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Palette' }),
        el('p', { class: 'note',
          text: `${palette.colors.length} colours - ${(palette.colors.length * (palette.colors.length - 1)) / 2} unique pairs` }),
      ]),
    ]),
    el('div', { class: 'panel__body' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', text: 'Working palette' }),
        select(
          state.palettes.map((p) => ({ value: p.id, label: `${p.name} (${p.kind})` })),
          state.activeId,
          (id) => ctl.setActive(id),
          { dataset: { field: 'palette-select' } },
        ),
      ]),
      el('div', { class: 'tools' }, [
        el('input', {
          type: 'text', class: 'input', value: palette.name, 'aria-label': 'Palette name',
          dataset: { field: 'palette-name' },
          on: { change: (e) => ctl.renamePalette(e.target.value || 'Untitled') },
        }),
        el('button', { class: 'btn', type: 'button', text: 'Duplicate',
          on: { click: () => ctl.duplicatePalette() } }),
        el('button', { class: 'btn', type: 'button', text: 'Delete',
          on: { click: () => ctl.deletePalette() } }),
      ]),
      chipsHost,
      tools,
      pasteRow,
    ]),
  ]);
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

/** Share link, JSON save/load and print. The last section of the sidebar, never the footer. */
export function exports_(ctx) {
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

  return el('section', { class: 'panel' }, [
    el('div', { class: 'panel__head' }, [el('div', {}, [
      el('p', { class: 'eyebrow', text: 'Share and save' }),
      el('p', { class: 'note', text: 'A share link puts the palette after the #, which browsers '
        + 'never send to a server.' }),
    ])]),
    el('div', { class: 'panel__body' }, [
      el('div', { class: 'tools' }, [
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Copy share link',
          on: { click: () => ctl.copyShareLink() } }),
        el('button', { class: 'btn', type: 'button', text: 'Save file',
          on: {
            click: () => {
              const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
              download(blob, `${palette.name.replace(/[^\w-]+/g, '-').toLowerCase()}.json`);
            },
          } }),
        el('button', { class: 'btn', type: 'button', text: 'Open file',
          on: { click: () => fileInput.click() } }),
        el('button', { class: 'btn', type: 'button', text: 'Copy analysis',
          on: { click: () => ctl.copyAnalysis() } }),
        el('button', { class: 'btn', type: 'button', text: 'Print',
          on: { click: () => window.print() } }),
      ]),
      el('p', { class: 'note', text: 'Copy analysis puts the measured findings on the clipboard as '
        + 'plain text - paste it anywhere you want the judgement call discussed.' }),
      fileInput,
    ]),
  ]);
}
