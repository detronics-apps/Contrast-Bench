// Shared renderers: the pieces more than one tool draws.

import { el } from './dom.js';
import { contrast, luminance } from '../color.js';
import { judge, grade, GRADE_LABEL, GRADE_TEXT, CRITERIA } from '../wcag.js';

/** Stat tiles across the top of a tool. */
export function statTiles(tiles) {
  return el('div', { class: 'tiles' }, tiles.map((t) => el('div', {
    class: 'tile', dataset: { tone: t.tone || 'neutral' },
  }, [
    el('span', { class: 'tile__k', text: t.label }),
    el('span', { class: 'tile__v', text: String(t.value) }),
    el('div', { class: 'tile__meter' }, [
      el('i', { style: { width: `${Math.round((t.fraction ?? 0) * 100)}%` } }),
    ]),
    t.sub ? el('span', { class: 'tile__sub', text: t.sub }) : null,
  ])));
}

/** A row of swatches, used inside findings. */
export const swatchRun = (hexes) => el('span', { class: 'swatchrun' },
  hexes.map((h) => el('i', { class: 'swatchrun__i', style: { background: h }, title: h })));

/** The findings list. `items` come straight from a domain module. */
export function findingsList(items) {
  if (!items.length) {
    return el('p', { class: 'muted', text: 'Nothing to report for this palette.' });
  }
  return el('div', { class: 'findings' }, items.map((f) => el('div', {
    class: 'finding', dataset: { level: f.level },
  }, [
    el('span', { class: 'finding__tag', text: f.tag }),
    el('div', {}, [
      el('h4', { class: 'finding__title', text: f.title }),
      el('p', { class: 'finding__body' }, [
        f.body,
        f.swatches && f.swatches.length ? swatchRun(f.swatches) : null,
      ]),
    ]),
  ])));
}

/**
 * The pairing matrix. Rows are text, columns are background, and each cell renders
 * the actual pairing - so the grid IS the preview, not a table of numbers beside one.
 */
export function matrix(colors, { selected, onSelect }) {
  const table = el('table', { class: 'matrix' });

  const head = el('tr', {}, [
    el('th', { class: 'matrix__corner' }, [el('span', { text: 'Text down / background across' })]),
    ...colors.map((c) => el('th', { class: 'matrix__colhead' }, [
      el('span', { class: 'matrix__dot', style: { background: c.hex } }),
      el('span', {}, [
        el('span', { class: 'matrix__nm', text: c.name }),
        el('br'),
        el('span', { class: 'matrix__hx', text: c.hex }),
      ]),
    ])),
  ]);
  table.appendChild(el('thead', {}, [head]));

  const body = el('tbody');
  colors.forEach((fg, fi) => {
    const row = el('tr', {}, [
      el('th', { class: 'matrix__rowhead' }, [
        el('span', { class: 'matrix__dot', style: { background: fg.hex } }),
        el('span', {}, [
          el('span', { class: 'matrix__nm', text: fg.name }),
          el('br'),
          el('span', { class: 'matrix__hx', text: fg.hex }),
        ]),
      ]),
    ]);

    colors.forEach((bg, bi) => {
      const j = judge(fg.hex, bg.hex);
      const g = j.same ? 'same' : j.grade;
      const isSel = selected && selected.fg === fi && selected.bg === bi;

      const cell = el('button', {
        class: 'cell',
        type: 'button',
        disabled: j.same,
        dataset: { grade: g, field: `cell-${fi}-${bi}` },
        'aria-pressed': String(Boolean(isSel)),
        'aria-label': `${fg.name} on ${bg.name}, ${j.ratio.toFixed(2)} to 1, ${GRADE_TEXT[g]}`,
        style: { background: bg.hex, color: fg.hex },
        on: j.same ? {} : { click: () => onSelect(fi, bi) },
      }, [
        el('span', { class: 'cell__aa', text: 'Aa' }),
        el('span', { class: 'cell__rt', text: j.same ? '-' : j.ratio.toFixed(2) }),
        el('span', { class: 'cell__stripe', text: GRADE_LABEL[g] }),
      ]);
      row.appendChild(el('td', {}, [cell]));
    });
    body.appendChild(row);
  });
  table.appendChild(body);

  return el('div', { class: 'scroller' }, [table]);
}

/** The legend under the matrix. */
export const matrixLegend = () => el('div', { class: 'legend' }, [
  ['aaa', 'AAA - 7:1, passes everything'],
  ['aa', 'AA - 4.5:1, body text safe'],
  ['aaLarge', 'AA Large only - 3:1, headings and UI edges'],
  ['fail', 'Fail - under 3:1, decorative use only'],
].map(([g, label]) => el('span', { class: 'legend__item' }, [
  el('i', { class: 'legend__chip', dataset: { grade: g } }),
  label,
])));

/** Every unique pair, ranked. The list view of the same data the matrix shows. */
export function rankedList(colors, pairs, { selected, onSelect, filter }) {
  const keep = pairs.filter((p) => (
    filter === 'all' ? true
      : filter === 'pass' ? (p.grade === 'aa' || p.grade === 'aaa')
      : filter === 'near' ? p.grade === 'aaLarge'
      : p.grade === 'fail'
  ));

  const table = el('table', { class: 'list' });
  table.appendChild(el('thead', {}, [el('tr', {}, [
    'Pair', 'Colours', 'Ratio', 'Grade', 'Body', 'Large', 'UI', 'AAA',
  ].map((h, i) => el('th', { text: h, style: i === 2 ? { textAlign: 'right' } : {} })))]));

  const body = el('tbody');
  if (!keep.length) {
    body.appendChild(el('tr', {}, [el('td', {
      colspan: 8, class: 'muted', text: 'No pairs in this band - nothing to fix here.',
    })]));
  }

  for (const p of keep) {
    // Show the more legible orientation: the darker colour carries the text.
    const aDark = luminance(colors[p.i].hex) < luminance(colors[p.j].hex);
    const fg = aDark ? colors[p.i] : colors[p.j];
    const bg = aDark ? colors[p.j] : colors[p.i];
    const fi = aDark ? p.i : p.j;
    const bi = aDark ? p.j : p.i;
    const isSel = selected && selected.fg === fi && selected.bg === bi;

    const mark = (ok) => el('td', {}, [el('span', {
      class: 'mark', dataset: { ok: ok ? '1' : '0' }, text: ok ? 'Y' : 'N',
    })]);

    body.appendChild(el('tr', {
      'aria-selected': String(Boolean(isSel)),
      on: { click: () => onSelect(fi, bi) },
    }, [
      el('td', {}, [el('div', {
        class: 'pairprev', style: { background: bg.hex, color: fg.hex }, text: 'Aa',
      })]),
      el('td', { class: 'hexcell' }, [
        el('b', { text: `${fg.name} on ${bg.name}` }),
        `${fg.hex} / ${bg.hex}`,
      ]),
      el('td', { class: 'ratiocell', text: p.ratio.toFixed(2) }),
      el('td', {}, [el('span', { class: 'badge', dataset: { grade: p.grade }, text: GRADE_LABEL[p.grade] })]),
      mark(p.ratio >= 4.5),
      mark(p.ratio >= 3),
      mark(p.ratio >= 3),
      mark(p.ratio >= 7),
    ]));
  }
  table.appendChild(body);
  return el('div', { class: 'scroller' }, [table]);
}

/** Per-colour reach: how many others each can sit against as body text. */
export function reachList(rows, names) {
  return el('div', { class: 'reach' }, [...rows]
    .sort((a, b) => b.bodySafe - a.bodySafe)
    .map((row) => el('div', { class: 'reach__row' }, [
      el('div', { class: 'reach__id' }, [
        el('span', { class: 'reach__dot', style: { background: row.hex } }),
        el('span', {}, [
          el('span', { class: 'reach__nm', text: names[row.i] ?? row.hex }),
          el('br'),
          el('span', { class: 'reach__hx', text: row.hex }),
        ]),
      ]),
      el('div', { class: 'reach__bar' }, row.others.map((o) => el('i', {
        dataset: { grade: o.grade },
        title: `${names[o.j] ?? o.other} - ${o.ratio.toFixed(2)}:1`,
      }))),
      el('div', { class: 'reach__n' }, [
        el('b', { text: String(row.bodySafe) }), ` / ${row.total} at AA`,
      ]),
    ])));
}

/** The inspector: one pair, in full. */
export function inspector(fg, bg, { target, suggestions, onCopy, onSwap, onTarget }) {
  const j = judge(fg.hex, bg.hex);

  const preview = el('div', {
    class: 'preview', style: { background: bg.hex, color: fg.hex },
  }, [
    el('p', { class: 'preview__big', text: 'Detronics' }),
    el('p', { class: 'preview__body', text: 'Body copy at 16px. This is the size most interface text is set at, and the size the 4.5:1 rule was written for.' }),
    el('p', { class: 'preview__small', text: 'Caption and helper text, 13px - the first thing to break.' }),
    el('div', { class: 'preview__ui' }, [
      el('span', { class: 'preview__box' }),
      el('span', { class: 'preview__line' }),
    ]),
  ]);

  const crit = el('table', { class: 'crit' });
  crit.appendChild(el('thead', {}, [el('tr', {}, ['Use', 'Needs', 'Result']
    .map((h) => el('th', { text: h })))]));
  const cbody = el('tbody');
  for (const c of j.criteria) {
    cbody.appendChild(el('tr', {}, [
      el('td', {}, [c.label, el('small', { text: `${c.note} (SC ${c.sc})` })]),
      el('td', { class: 'crit__req', text: `${c.req.toFixed(1)}:1` }),
      el('td', {}, [el('span', {
        class: 'crit__verdict', dataset: { ok: c.pass ? '1' : '0' }, text: c.pass ? 'PASS' : 'FAIL',
      })]),
    ]));
  }
  cbody.appendChild(el('tr', {}, [
    el('td', {}, ['Relative luminance', el('small', { text: `${fg.name} vs ${bg.name}` })]),
    el('td', { class: 'crit__req', colspan: 2, style: { textAlign: 'right' },
      text: `${luminance(fg.hex).toFixed(4)} / ${luminance(bg.hex).toFixed(4)}` }),
  ]));
  crit.appendChild(cbody);

  const fixes = el('div', { class: 'fixes' });
  if (j.ratio >= target) {
    fixes.appendChild(el('p', { class: 'note is-ok',
      text: `Already clears ${target}:1 with ${(j.ratio - target).toFixed(2)} to spare. `
        + 'Switch the target above to test a stricter level.' }));
  } else if (!suggestions.length) {
    fixes.appendChild(el('p', { class: 'note',
      text: `No lightness shift reaches ${target}:1 while holding both hues. This pair needs a `
        + 'different colour, not an adjustment - or reserve it for decoration, where no ratio applies.' }));
  } else {
    for (const s of suggestions.slice(0, 4)) {
      const isText = s.role === 'text';
      const pvBg = isText ? bg.hex : s.hex;
      const pvFg = isText ? s.hex : fg.hex;
      fixes.appendChild(el('button', {
        class: 'fix', type: 'button', title: `Copy ${s.hex}`,
        on: { click: () => onCopy(s.hex) },
      }, [
        el('span', { class: 'fix__sw', style: { background: pvBg, color: pvFg }, text: 'Aa' }),
        el('span', { class: 'fix__what' }, [
          `${s.verb} the ${s.role} - ${isText ? fg.name : bg.name}`,
          el('b', { text: ` ${s.hex}` }),
          el('small', { text: `drift ${s.drift.toFixed(1)} - ${s.word} - L ${s.deltaL > 0 ? '+' : ''}${s.deltaL.toFixed(1)}` }),
        ]),
        el('span', { class: 'fix__got' }, [
          s.ratio.toFixed(2), el('small', { text: 'RATIO' }),
        ]),
      ]));
    }
  }

  return el('div', {}, [
    el('div', { class: 'panel__head' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Inspector' }),
        el('p', { class: 'note', text: `${fg.name} on ${bg.name}` }),
      ]),
      el('button', { class: 'btn', type: 'button', text: 'Swap', on: { click: onSwap } }),
    ]),
    preview,
    el('div', { class: 'score' }, [
      el('span', { class: 'score__num', text: j.ratio.toFixed(2) }),
      el('span', { class: 'score__of', text: ': 1' }),
      el('span', { class: 'badge', dataset: { grade: j.grade }, text: GRADE_TEXT[j.grade],
        style: { marginLeft: 'auto' } }),
    ]),
    el('div', { class: 'panel__body' }, [
      crit,
      el('div', { class: 'subhead' }, [
        el('span', { text: 'Shift suggestions' }),
        el('span', { class: 'targets' }, [3, 4.5, 7].map((t) => el('button', {
          class: 'targets__btn', type: 'button',
          'aria-pressed': String(t === target),
          text: `${t}:1`,
          on: { click: () => onTarget(t) },
        }))),
      ]),
      fixes,
    ]),
  ]);
}

export { grade, contrast, CRITERIA };
