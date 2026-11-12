// Brand mode: can these colours carry text against each other?

import { el, chips } from '../dom.js';
import { statTiles, findingsList, matrix, matrixLegend, rankedList, reachList, inspector, needColours } from '../views.js';
import { judgeAll, summarise, reach } from '../../wcag.js';
import { findings, recommendations, headline, roles, ROLE_LABEL } from '../../palette.js';
import { suggestions } from '../../suggest.js';
import { allocate } from '../../allocation.js';
import { MEDIA, MEDIUM_IDS } from '../../allocation.js';
import { explainContrast, explainShift } from '../explain.js';

export const meta = { id: 'brand', label: 'Brand', kind: 'brand' };

export function render(host, ctx) {
  const { palette, colors, ui, set, level } = ctx;
  const items = palette.colors;
  const gap = needColours(ctx, 2, 'The pairing matrix');
  if (gap) { host.appendChild(gap); return; }

  const s = summarise(colors);
  const pairs = judgeAll(colors);

  host.appendChild(el('p', { class: 'headline', text: headline(colors) }));

  host.appendChild(statTiles([
    { label: 'Unique pairs', value: s.pairs, tone: 'neutral', fraction: 1 },
    { label: 'Body-text safe', value: s.bodySafe, tone: 'ok', fraction: s.bodySafe / (s.pairs || 1), sub: 'AA 4.5:1' },
    { label: 'Large text only', value: s.largeOnly, tone: 'warn', fraction: s.largeOnly / (s.pairs || 1), sub: '3:1' },
    { label: 'Unusable', value: s.unusable, tone: 'danger', fraction: s.unusable / (s.pairs || 1), sub: 'under 3:1' },
    { label: 'AAA grade', value: s.aaa, tone: 'ok', fraction: s.aaa / (s.pairs || 1), sub: '7:1' },
  ]));

  // --- pairing analysis
  const view = ui.view ?? 'matrix';
  const panel = el('section', { class: 'panel panel--flush' });
  panel.appendChild(el('div', { class: 'panel__head' }, [
    el('div', {}, [
      el('p', { class: 'eyebrow', text: 'Pairing analysis' }),
      el('p', { class: 'note', text: view === 'matrix'
        ? 'Rows are text, columns are background. Click any cell for the full breakdown.'
        : 'Every unique pair ranked by contrast, strongest first.' }),
    ]),
    chips([
      { value: 'matrix', label: 'Matrix' },
      { value: 'list', label: `Ranked list` },
    ], view, (v) => set({ view: v })),
  ]));

  const pick = (fg, bg) => set({ selection: { fg, bg } });

  if (view === 'matrix') {
    panel.appendChild(el('div', { class: 'panel__body' }, [
      matrix(items, { selected: ui.selection, onSelect: pick }),
    ]));
    panel.appendChild(matrixLegend());
  } else {
    const filter = ui.filter ?? 'all';
    panel.appendChild(el('div', { class: 'panel__body' }, [
      chips([
        { value: 'all', label: `All ${pairs.length}` },
        { value: 'pass', label: 'Passing AA' },
        { value: 'near', label: 'Large only' },
        { value: 'fail', label: 'Failing' },
      ], filter, (v) => set({ filter: v })),
      rankedList(items, pairs, { selected: ui.selection, onSelect: pick, filter }),
    ]));
  }
  host.appendChild(panel);

  // The teaching panel, worked through with the pair currently selected.
  const sel = ui.selection && items[ui.selection.fg] && items[ui.selection.bg]
    ? ui.selection : { fg: Math.min(2, items.length - 1), bg: Math.min(1, items.length - 1) };
  if (items[sel.fg] && items[sel.bg] && sel.fg !== sel.bg) {
    host.appendChild(explainContrast(items[sel.fg], items[sel.bg]));
    if (level !== 'simple') host.appendChild(explainShift(items[sel.fg], items[sel.bg]));
  }

  if (level === 'simple') return;

  // --- per-colour reach
  host.appendChild(section('Per-colour reach',
    'How many other palette colours each one can legally sit against as body text.',
    reachList(reach(colors), items.map((c) => c.name))));

  // --- findings
  host.appendChild(section('What the shape of this palette says',
    'Measured from the geometry, worst first. Each colour also carries what it communicates.',
    findingsList(findings(colors))));

  // --- allocation
  const medium = ui.medium ?? 'web';
  const alloc = allocate(colors, medium);
  const bar = el('div', { class: 'allocbar' }, alloc.rows.map((r) => el('div', {
    style: { width: `${r.share}%`, background: r.color.hex,
      color: r.color.onWhite >= 3 ? '#ffffff' : '#131a21' },
    title: `${r.label} - ${Math.round(r.share)}%`,
    text: r.share >= 7 ? `${Math.round(r.share)}%` : '',
  })));

  const atable = el('table', { class: 'alloc' });
  atable.appendChild(el('thead', {}, [el('tr', {}, ['Share', 'Role', 'Colour', 'What it does there']
    .map((h) => el('th', { text: h })))]));
  atable.appendChild(el('tbody', {}, alloc.rows.map((r) => el('tr', {}, [
    el('td', { class: 'alloc__pc', text: `${Math.round(r.share)}%` }),
    el('td', { class: 'alloc__role' }, [el('b', { text: r.label })]),
    el('td', { class: 'alloc__role' }, [
      el('span', { class: 'alloc__sw', style: { background: r.color.hex } }),
      nameFor(items, r.color.hex),
      el('br'),
      el('code', { text: r.color.hex }),
    ]),
    el('td', { class: 'alloc__why', text: r.why }),
  ]))));

  const allocPanel = el('section', { class: 'panel panel--flush' });
  allocPanel.appendChild(el('div', { class: 'panel__head' }, [
    el('div', {}, [
      el('p', { class: 'eyebrow', text: 'Allocation' }),
      el('p', { class: 'note', text: alloc.medium.note }),
    ]),
    chips(MEDIUM_IDS.map((id) => ({ value: id, label: MEDIA[id].label })),
      medium, (v) => set({ medium: v })),
  ]));
  allocPanel.appendChild(el('div', { class: 'panel__body' }, [
    bar,
    el('div', { class: 'scroller' }, [atable]),
    el('ul', { class: 'mediumnotes' }, alloc.notes.map((n) => el('li', { text: n }))),
  ]));
  host.appendChild(el('h2', { class: 'sectiontitle', text: 'Allocation' }));
  host.appendChild(allocPanel);

  // --- recommendations
  const recs = recommendations(colors);
  const recHost = el('div', {});
  if (!recs.length) {
    recHost.appendChild(el('p', { class: 'note is-ok',
      text: 'Nothing structural to fix - no redundant pairs, no lightness voids, and the functional colours are covered.' }));
  }
  for (const r of recs) {
    const act = el('span', { class: 'reco__act' });
    if (r.add) {
      act.appendChild(el('button', { class: 'btn btn--primary', type: 'button', text: 'Add',
        on: { click: () => ctx.addColor(r.add) } }));
    }
    if (r.addAll) {
      act.appendChild(el('button', { class: 'btn btn--primary', type: 'button',
        text: `Add all ${r.addAll.length}`, on: { click: () => ctx.addColors(r.addAll) } }));
    }
    if (r.remove) {
      act.appendChild(el('button', { class: 'btn', type: 'button', text: 'Remove',
        on: { click: () => ctx.removeColor(r.remove) } }));
    }
    recHost.appendChild(el('div', { class: 'reco' }, [
      el('span', { class: 'reco__sw' }, r.swatches.map((h) => el('i', { style: { background: h } }))),
      el('div', {}, [
        el('h4', { text: r.title }),
        el('p', { text: r.body }),
      ]),
      act,
    ]));
  }
  host.appendChild(section('What to change',
    'Ranked by how much each fixes. Adding or removing re-measures everything.', recHost));
}

/** The sidebar half of this tool: the inspector. */
export function renderAside(host, ctx) {
  const { palette, ui, set, copy } = ctx;
  const items = palette.colors;
  const sel = ui.selection && items[ui.selection.fg] && items[ui.selection.bg]
    ? ui.selection
    : { fg: Math.min(2, items.length - 1), bg: Math.min(1, items.length - 1) };

  const fg = items[sel.fg];
  const bg = items[sel.bg];
  if (!fg || !bg || fg === bg) return;

  const target = ui.target ?? 4.5;
  host.appendChild(el('section', { class: 'panel panel--flush' }, [
    inspector(fg, bg, {
      target,
      suggestions: suggestions(fg.hex, bg.hex, target),
      onCopy: copy,
      onSwap: () => set({ selection: { fg: sel.bg, bg: sel.fg } }),
      onTarget: (t) => set({ target: t }),
    }),
  ]));
}

function section(title, note, body) {
  return el('div', {}, [
    el('h2', { class: 'sectiontitle', text: title }),
    el('section', { class: 'panel panel--flush' }, [
      note ? el('div', { class: 'panel__head' }, [
        el('p', { class: 'note', text: note })]) : null,
      el('div', { class: 'panel__body' }, [body]),
    ]),
  ]);
}

const nameFor = (items, hex) =>
  items.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;

export { ROLE_LABEL, roles };
