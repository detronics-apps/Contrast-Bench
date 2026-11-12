// Ramps: one colour at a time, against its own shades and the neutrals.
//
// This is the mode for a palette whose colours never appear together - one hue per
// section, per episode, per product line. Judging those against each other invents
// a conflict that does not exist on screen; what matters is whether each one works
// in its own world.

import { el, chips } from '../dom.js';
import { findingsList, swatchRun } from '../views.js';
import { analyseRamp, rampFindings, DEFAULT_NEUTRALS, USE } from '../../ramp.js';
import { GRADE_LABEL } from '../../wcag.js';
import { readEmotion } from '../../emotion.js';

export const meta = { id: 'ramp', label: 'Ramps', kind: 'any' };

const f = (n, d = 2) => n.toFixed(d);

export function render(host, ctx) {
  const { palette, ui, set, level } = ctx;
  const items = palette.colors;

  host.appendChild(el('p', { class: 'headline',
    text: 'Each colour measured on its own, across its own range of shades and tints, against '
      + 'black, white and the neutrals. Nothing here compares one colour with another - this is '
      + 'the question to ask when a colour has a world of its own.' }));

  const which = ui.rampPick ?? 'all';
  host.appendChild(el('div', { class: 'panel panel--flush' }, [
    el('div', { class: 'panel__head' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Which colour' }),
        el('p', { class: 'note', text: 'One at a time, or all of them stacked.' }),
      ]),
      chips([{ value: 'all', label: 'All' },
        ...items.map((c, i) => ({ value: String(i), label: c.name }))],
      which, (v) => set({ rampPick: v })),
    ]),
  ]));

  const shown = which === 'all' ? items.map((c, i) => [c, i])
    : [[items[Number(which)] ?? items[0], Number(which) || 0]];

  for (const [colour] of shown) {
    if (colour) host.appendChild(rampCard(colour, ctx, level));
  }
}

function rampCard(colour, ctx, level) {
  const a = analyseRamp(colour.hex);
  const seed = a.seedStep;
  const reading = readEmotion(colour.hex);

  const strip = el('div', { class: 'ramprow' }, a.ramp.map((s) => el('button', {
    class: 'ramprow__sw', type: 'button',
    style: {
      background: s.hex,
      outline: s.isSeed ? '2px solid var(--text)' : 'none',
      outlineOffset: s.isSeed ? '1px' : '0',
    },
    title: `${s.hex} - lightness ${f(s.lightness, 0)} - ${s.use}`
      + ` - ${f(s.onWhite)}:1 on white, ${f(s.onBlack)}:1 on black`
      + (s.isSeed ? ' - this is the colour you chose' : ''),
    on: { click: () => ctx.copy(s.hex) },
  }, [
    el('span', {
      class: 'ramprow__tag',
      style: {
        background: s.use === USE.fill ? 'transparent' : 'var(--text)',
        color: 'var(--bg)',
      },
      text: s.use === USE.bothText ? 'TD' : s.use === USE.textOnLight ? 'T'
        : s.use === USE.textOnDark ? 'D' : '',
    }),
  ])));

  // Steps down the side, neutrals across: does this shade carry text on that ground?
  const grid = el('table', { class: 'list' });
  grid.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', { text: 'Shade' }),
    el('th', { text: 'Lightness' }),
    ...a.neutrals.map((n) => el('th', { text: n.name })),
  ])]));
  grid.appendChild(el('tbody', {}, a.grid.map((row) => el('tr', {}, [
    el('td', {}, [
      el('span', { class: 'alloc__sw', style: { background: row.step.hex } }),
      el('code', { text: row.step.hex }),
      row.step.isSeed ? el('b', { text: '  chosen' }) : null,
    ]),
    el('td', { class: 'ratiocell', text: f(row.step.lightness, 0) }),
    ...row.pairs.map((p) => el('td', {}, [
      el('span', {
        class: 'badge', dataset: { grade: p.grade },
        title: `${f(p.ratio)}:1`,
        text: p.grade === 'fail' ? f(p.ratio, 1) : GRADE_LABEL[p.grade],
      }),
    ])),
  ]))));

  return el('section', { class: 'panel panel--flush' }, [
    el('div', { class: 'panel__head' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow', text: colour.name }),
        el('p', { class: 'note',
          text: `${colour.hex} - ${reading.neutral ? 'neutral' : reading.primary.name.toLowerCase()}`
            + ` - the chosen swatch is ${seed.use}` }),
      ]),
      el('div', { class: 'row' }, [
        a.forLight ? el('button', {
          class: 'btn btn--small', type: 'button',
          title: `${a.forLight.hex} - ${f(a.forLight.onWhite)}:1 on white`,
          text: `Copy light-ground ${a.forLight.hex}`,
          on: { click: () => ctx.copy(a.forLight.hex) },
        }) : null,
        a.forDark ? el('button', {
          class: 'btn btn--small', type: 'button',
          title: `${a.forDark.hex} - ${f(a.forDark.onBlack)}:1 on black`,
          text: `Copy dark-ground ${a.forDark.hex}`,
          on: { click: () => ctx.copy(a.forDark.hex) },
        }) : null,
      ]),
    ]),
    el('div', { class: 'panel__body' }, [
      strip,
      el('p', { class: 'note',
        text: 'T carries text on light grounds, D on dark, TD on either, and an untagged step is '
          + 'a fill. The outlined step is the colour you chose. Click any step to copy it.' }),
      findingsList(rampFindings(colour.hex, colour.name)),
      level === 'simple' ? null : el('div', { class: 'scroller' }, [grid]),
    ]),
  ]);
}

export function renderAside(host, ctx) {
  const { palette, ui } = ctx;
  const which = ui.rampPick ?? 'all';
  const colour = which === 'all' ? palette.colors[0] : palette.colors[Number(which)];
  if (!colour) return;

  const a = analyseRamp(colour.hex);

  host.appendChild(el('section', { class: 'section', dataset: { open: 'true' } }, [
    el('div', { class: 'section__head' }, [
      el('span', { class: 'section__title', text: 'Grounds it is measured on' }),
    ]),
    el('div', { class: 'section__body' }, [
      el('p', { class: 'note', text: 'A ramp is judged against these, not against the other '
        + 'colours in the palette.' }),
      el('div', { class: 'greyladder' }, DEFAULT_NEUTRALS.map((n) => el('div', {
        class: 'greyladder__row',
      }, [
        el('span', { class: 'greyladder__sw', style: { background: n.hex } }),
        el('span', { class: 'greyladder__sw', style: { background: colour.hex } }),
        el('span', { class: 'greyladder__nm' }, [
          el('b', { text: n.name }),
          el('br'),
          el('small', { text: a.unreachable.some((u) => u.hex === n.hex)
            ? 'no shade reaches it' : 'reachable' }),
        ]),
      ]))),
    ]),
  ]));
}

export { swatchRun };
