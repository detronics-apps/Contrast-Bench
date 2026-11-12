// Channel mode: can a viewer tell these categories apart?

import { el, chips } from '../dom.js';
import { statTiles, findingsList, swatchRun } from '../views.js';
import {
  analyse, channelFindings, findSeparableColour, COLLAPSE_DE, GREY_RATIO, LARGE_TEXT,
} from '../../channel.js';
import { separateByLightness } from '../../emotion.js';
import { simulateCvd, toGreyscale, CVD_TYPES } from '../../color.js';
import { explainSeparation } from '../explain.js';

export const meta = { id: 'channel', label: 'Channel', kind: 'channel' };

export function render(host, ctx) {
  const { palette, ui, set, level } = ctx;
  const entries = palette.colors;

  if (entries.length < 2) {
    host.appendChild(el('p', { class: 'note', text: 'Add at least two colours to compare.' }));
    return;
  }

  const a = analyse(entries);
  const d = a.distinguish;

  host.appendChild(el('p', { class: 'headline',
    text: `${entries.length} categories - ${d.worst} distinguishable in the worst case `
      + `(${d.worstScenario}). Contrast asks whether a colour can carry text; this asks whether `
      + 'a viewer can tell two of them apart.' }));

  host.appendChild(statTiles([
    { label: 'Categories', value: entries.length, tone: 'neutral', fraction: 1 },
    { label: 'Worst case', value: d.worst, tone: d.worst < entries.length ? 'danger' : 'ok',
      fraction: d.worst / entries.length, sub: d.worstScenario },
    { label: 'Collapsing pairs', value: a.collapsing.length, tone: a.collapsing.length ? 'danger' : 'ok',
      fraction: a.collapsing.length / (a.pairs.length || 1), sub: `under dE ${COLLAPSE_DE}` },
    { label: 'Greyscale merges', value: a.greyCollapses.length, tone: a.greyCollapses.length ? 'danger' : 'ok',
      fraction: a.greyCollapses.length / (entries.length || 1), sub: `under ${GREY_RATIO}:1` },
    { label: 'Type fails', value: a.illegible.length, tone: a.illegible.length ? 'warn' : 'ok',
      fraction: a.illegible.length / entries.length, sub: `under ${LARGE_TEXT}:1` },
  ]));

  // --- how many each viewer sees
  host.appendChild(section('What each viewer sees',
    'Counted per viewer, never pooled. A reader is one person in one situation, so merging the '
    + 'scenarios would chain unrelated collapses together and report a worse number than anyone '
    + 'actually experiences.',
    el('div', { class: 'scenarios' }, Object.entries(d.counts).map(([name, count]) => el('div', {
      class: 'scenario', dataset: { bad: String(count < entries.length) },
    }, [
      el('span', { class: 'scenario__n', text: `${count} / ${entries.length}` }),
      el('span', { class: 'scenario__k', text: name }),
      el('div', { class: 'scenario__sw' }, entries.map((e) => el('i', {
        style: { background: name === 'colour' ? e.hex
          : name === 'greyscale' ? toGreyscale(e.hex)
          : simulateCvd(e.hex, name) },
        title: e.name,
      }))),
    ])))));

  // --- pairwise
  const tbl = el('table', { class: 'list' });
  tbl.appendChild(el('thead', {}, [el('tr', {}, ['Pair', 'Categories', 'Distance', 'Hue gap', 'Greyscale', 'Verdict']
    .map((h) => el('th', { text: h })))]));
  tbl.appendChild(el('tbody', {}, a.pairs.map((p) => el('tr', {}, [
    el('td', {}, [el('div', { class: 'pairprev', style: { background: p.a.hex } }, [
      el('span', { style: { background: p.b.hex, width: '50%', height: '100%', display: 'block',
        marginLeft: 'auto' } }),
    ])]),
    el('td', { class: 'hexcell' }, [
      el('b', { text: `${p.a.name} / ${p.b.name}` }),
      `${p.a.hex} / ${p.b.hex}`,
    ]),
    el('td', { class: 'ratiocell', text: p.deltaE.toFixed(1) }),
    el('td', { class: 'ratiocell', text: `${p.hueGap.toFixed(0)}deg` }),
    el('td', { class: 'ratiocell', text: `${p.greyRatio.toFixed(2)}:1` }),
    el('td', {}, [el('span', { class: 'badge', dataset: { verdict: p.verdict }, text: p.verdict })]),
  ]))));
  host.appendChild(section('Every pair, closest first',
    `Perceptual distance in OKLab. Under ${COLLAPSE_DE} is one marker, not two.`,
    el('div', { class: 'scroller' }, [tbl])));

  host.appendChild(section('What this means',
    null, findingsList(channelFindings(entries))));

  const explain = explainSeparation(entries);
  if (explain) host.appendChild(explain);

  if (level === 'simple') return;

  // --- the fix: keep the hue, move the lightness
  const fixes = el('div', {});
  if (!a.collapsing.length) {
    fixes.appendChild(el('p', { class: 'note is-ok',
      text: 'No pair is collapsing, so nothing needs separating.' }));
  }
  for (const p of a.collapsing) {
    const keepA = separateByLightness(p.a.hex, p.b.hex, { keep: 'a' });
    const keepB = separateByLightness(p.a.hex, p.b.hex, { keep: 'b' });
    const row = (fix, movedName, keptName) => {
      if (!fix) {
        return el('p', { class: 'note',
          text: `Holding ${keptName}'s hue, no lightness for ${movedName} separates them. These two `
            + 'need a different distinction entirely, not a different shade.' });
      }
      return el('button', {
        class: 'fix', type: 'button', title: `Copy ${fix.hex}`,
        on: { click: () => ctx.copy(fix.hex) },
      }, [
        el('span', { class: 'fix__sw', style: { background: fix.hex } }),
        el('span', { class: 'fix__what' }, [
          `Keep ${keptName}, move ${movedName}`,
          el('b', { text: ` ${fix.hex}` }),
          el('small', { text: `lightness ${fix.lightness.toFixed(0)} (${fix.move.toFixed(0)} points) `
            + `- hue unchanged - dE ${fix.deltaE.toFixed(1)}, greyscale ${fix.grey.toFixed(2)}:1, `
            + `worst colour-blind ${fix.cvd.toFixed(1)}` }),
        ]),
        el('span', { class: 'fix__got' }, ['OK', el('small', { text: 'ALL 3' })]),
      ]);
    };
    fixes.appendChild(el('div', { class: 'fixgroup' }, [
      el('h4', { text: `${p.a.name} and ${p.b.name}` }),
      el('p', { class: 'note', text: 'Hue carries the emotion, so it stays. Lightness carries the '
        + 'separation, and the wheel has no opinion about lightness.' }),
      swatchRun([p.a.hex, p.b.hex]),
      row(keepA, p.b.name, p.a.name),
      row(keepB, p.a.name, p.b.name),
    ]));
  }
  host.appendChild(section('Separate them without losing the meaning', null, fixes));

  if (level !== 'expert') return;

  // --- a genuinely new colour, if one is wanted
  const keep = entries.slice(0, -1);
  const cands = findSeparableColour(keep, { limit: 6 });
  const candHost = el('div', {});
  if (!cands.length) {
    candHost.appendChild(el('p', { class: 'note',
      text: 'No colour at this chroma separates from all the others on every test. The set needs '
        + 'restructuring rather than retinting - usually that means fewer categories.' }));
  } else {
    candHost.appendChild(el('div', { class: 'cands' }, cands.map((c) => el('button', {
      class: 'cand', type: 'button', title: `Copy ${c.hex}`,
      on: { click: () => ctx.copy(c.hex) },
    }, [
      el('span', { class: 'cand__sw', style: { background: c.hex } }),
      el('span', { class: 'cand__hex', text: c.hex }),
      el('small', { text: `dE ${c.worstDe.toFixed(0)} - grey ${c.worstGrey.toFixed(2)} - `
        + `cvd ${c.worstCvd.toFixed(0)}` }),
    ]))));
  }
  host.appendChild(section(`Replacements for ${entries[entries.length - 1].name}`,
    'Every candidate clears all four constraints against the other categories: perceptual distance, '
    + 'greyscale separation, colour-blind separation, and enough contrast for display type.',
    candHost));
}

export function renderAside(host, ctx) {
  const entries = ctx.palette.colors;
  if (entries.length < 2) return;
  const a = analyse(entries);

  const ladder = el('div', { class: 'greyladder' }, a.grey.map((g) => el('div', {
    class: 'greyladder__row',
  }, [
    el('span', { class: 'greyladder__sw', style: { background: g.hex } }),
    el('span', { class: 'greyladder__sw', style: { background: g.grey } }),
    el('span', { class: 'greyladder__nm' }, [
      el('b', { text: g.name }),
      el('br'),
      el('small', { text: g.stepToNext
        ? `${g.stepToNext.toFixed(2)}:1 to ${g.nextName}`
        : 'lightest' }),
    ]),
  ])));

  host.appendChild(el('section', { class: 'panel panel--flush' }, [
    el('div', { class: 'panel__head' }, [el('div', {}, [
      el('p', { class: 'eyebrow', text: 'Without colour' }),
      el('p', { class: 'note', text: 'Printed, photocopied, or seen with severe colour blindness.' }),
    ])]),
    el('div', { class: 'panel__body' }, [ladder]),
  ]));

  for (const c of a.cvd) {
    host.appendChild(el('section', { class: 'panel panel--flush' }, [
      el('div', { class: 'panel__head' }, [el('div', {}, [
        el('p', { class: 'eyebrow', text: c.type }),
        el('p', { class: 'note', text: c.collapses
          ? `${c.a.name} and ${c.b.name} merge - distance ${c.deltaE.toFixed(1)}.`
          : `Closest pair still ${c.deltaE.toFixed(1)} apart. Readable.` }),
      ])]),
      el('div', { class: 'panel__body' }, [
        el('div', { class: 'cvdrow' }, c.swatches.map((s) => el('span', {
          class: 'cvdrow__sw', style: { background: s.sim }, title: `${s.name} (${s.hex})`,
        }))),
      ]),
    ]));
  }
}

function section(title, note, body) {
  return el('div', {}, [
    el('h2', { class: 'sectiontitle', text: title }),
    el('section', { class: 'panel panel--flush' }, [
      note ? el('div', { class: 'panel__head' }, [el('p', { class: 'note', text: note })]) : null,
      el('div', { class: 'panel__body' }, [body]),
    ]),
  ]);
}

export { CVD_TYPES };
