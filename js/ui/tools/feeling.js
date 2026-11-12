// Emotion mode: what is this palette saying, and what should it be saying?
//
// Two directions, and the second is the useful one:
//   read    a colour  -> the emotion it conventionally communicates
//   choose  an emotion -> colours that communicate it AND pass contrast

import { el } from '../dom.js';
import { emotionWheel, emotionCard } from '../wheel.js';
import { EMOTION_NAMES, readEmotion, paletteForEmotion, hueForEmotion } from '../../emotion.js';
import { emotionalRegister, geometries } from '../../palette.js';
import { needColours } from '../views.js';
import { explainEmotion } from '../explain.js';

export const meta = { id: 'feeling', label: 'Emotion', kind: 'any' };

export function render(host, ctx) {
  const { palette, colors, ui, set, level } = ctx;
  const items = palette.colors;

  const gap = needColours(ctx, 1, 'The wheel');
  if (gap) { host.appendChild(gap); return; }
  const selected = ui.emotion && EMOTION_NAMES.includes(ui.emotion) ? ui.emotion : 'Loyalty';

  const register = emotionalRegister(colors);
  host.appendChild(el('p', { class: 'headline', text: register
    ? register.title + '. ' + 'Hue around the wheel, saturation towards the rim - your colours are plotted on it.'
    : 'This palette is entirely neutral, so there is no hue to read.' }));

  // --- the wheel
  const wheelPanel = el('section', { class: 'panel panel--flush' });
  wheelPanel.appendChild(el('div', { class: 'panel__head' }, [
    el('div', {}, [
      el('p', { class: 'eyebrow', text: 'The wheel' }),
      el('p', { class: 'note', text: 'Click a segment to see what it takes to communicate that, '
        + 'and which of those colours can actually carry text.' }),
    ]),
  ]));
  const picked = Number.isInteger(ui.wheelColour) && items[ui.wheelColour]
    ? ui.wheelColour : null;

  wheelPanel.appendChild(el('div', { class: 'panel__body wheelbody' }, [
    el('div', { class: 'wheelwrap' }, [
      emotionWheel({
        colors: items,
        selected,
        pickedIndex: picked,
        onSelect: (name) => set({ emotion: name, wheelColour: null }),
        onPick: (i) => set({ wheelColour: i === picked ? null : i }),
      }),
      el('p', { class: 'note', text: 'Angle is hue and distance from the centre is saturation - '
        + 'nothing else. Lightness is not a direction on this wheel; it is what you see in each '
        + 'dot. Click a dot for that colour, or a segment for the emotion.' }),
    ]),
    picked === null
      ? selectedPane(selected, ctx)
      : pickedPane(items[picked], picked, ctx),
  ]));
  host.appendChild(wheelPanel);

  // --- what the palette says
  if (register) {
    host.appendChild(el('h2', { class: 'sectiontitle', text: 'What this palette communicates' }));
    host.appendChild(el('section', { class: 'panel panel--flush' }, [
      el('div', { class: 'panel__body' }, [
        el('p', { class: 'registerline', text: register.body }),
      ]),
    ]));
  }

  const lead = geometries(colors).filter((g) => !g.neutral)
    .sort((a, b) => b.C - a.C)[0];
  if (lead) host.appendChild(explainEmotion(lead.emotion));

  if (level === 'simple') return;

  // --- per colour
  host.appendChild(el('h2', { class: 'sectiontitle', text: 'Colour by colour' }));
  host.appendChild(el('div', { class: 'emogrid' },
    items.map((c) => {
      const card = emotionCard(readEmotion(c.hex));
      card.querySelector('.emo__hex').textContent = `${c.name} - ${c.hex}`;
      return card;
    })));
}

/** The panel beside the wheel when a plotted dot is the thing being inspected. */
function pickedPane(colour, index, ctx) {
  const reading = readEmotion(colour.hex);

  return el('div', { class: 'wheelside' }, [
    el('div', { class: 'row', style: { alignItems: 'center', marginBottom: 'var(--space-3)' } }, [
      el('h3', { class: 'wheelside__h', text: colour.name }),
      el('button', {
        class: 'btn btn--small', type: 'button', text: 'Back to the wheel',
        title: 'Show the selected emotion again instead of this colour',
        on: { click: () => ctx.set({ wheelColour: null }) },
      }),
    ]),
    el('div', { class: 'pick' }, [
      el('span', { class: 'pick__sw', style: { background: colour.hex } }),
      el('span', {}, [
        el('code', { text: colour.hex }),
        el('br'),
        el('small', { text: reading.neutral
          ? 'Neutral - too little colour for hue to mean anything'
          : `hue ${reading.hue.toFixed(0)}, saturation ${reading.saturation.toFixed(0)}%, `
            + `lightness ${reading.lightness.toFixed(0)}%` }),
      ]),
      el('button', { class: 'btn btn--small', type: 'button', text: 'Copy',
        on: { click: () => ctx.copy(colour.hex) } }),
    ]),
    el('p', { class: 'wheelside__p', text: reading.blend
      ? `Sits between ${reading.primary.name} and ${reading.secondary.name}, nearer `
        + `${reading.primary.name} - ${Math.round(reading.near[0].weight * 100)}% of the way onto it.`
      : `Sits squarely on ${reading.primary.name}.` }),
    el('div', { class: 'emo__words' },
      reading.primary.words.map((w) => el('span', { class: 'emo__word', text: w }))),
    el('p', { class: 'wheelside__p', text: reading.primary.signal }),
    el('p', { class: 'wheelside__p is-warn', text: reading.primary.caution }),

    el('h4', { class: 'wheelside__sub', text: 'What its own saturation and lightness do' }),
    ...reading.modifiers.map((m) => el('p', { class: 'wheelside__p', text: m.text })),

    el('button', {
      class: 'btn', type: 'button', text: `Show the ${reading.primary.name} range`,
      title: 'Switch the panel to this emotion and its usable colours',
      on: { click: () => ctx.set({ emotion: reading.primary.name, wheelColour: null }) },
    }),
    el('p', { class: 'caveat', text: reading.caveat }),
  ]);
}

/** The panel beside the wheel: the chosen emotion, and usable colours for it. */
function selectedPane(name, ctx) {
  const anchor = hueForEmotion(name);
  const built = paletteForEmotion(name);

  const swatches = el('div', { class: 'ramp' }, built.swatches.map((s) => el('button', {
    class: 'ramp__sw', type: 'button',
    style: { background: s.hex },
    title: `${s.hex} - ${s.usableAs} (${s.onWhite.toFixed(2)}:1 on white)`,
    on: { click: () => ctx.copy(s.hex) },
  }, [
    el('span', { class: 'ramp__tag', dataset: { use: s.usableAs.replace(/ /g, '-') },
      text: s.usableAs === 'text on light' ? 'T' : s.usableAs === 'text on dark' ? 'D' : '' }),
  ])));

  const pick = (label, swatch) => (swatch
    ? el('div', { class: 'pick' }, [
      el('span', { class: 'pick__sw', style: { background: swatch.hex } }),
      el('span', {}, [
        el('b', { text: label }),
        el('br'),
        el('code', { text: swatch.hex }),
        el('small', { text: ` ${swatch.onWhite.toFixed(2)}:1 on white, `
          + `${swatch.onDark.toFixed(2)}:1 on Ink Navy` }),
      ]),
      el('button', { class: 'btn', type: 'button', text: 'Add',
        on: { click: () => ctx.addColor({ name, hex: swatch.hex }) } }),
    ])
    : el('p', { class: 'note', text: `No swatch in this hue can carry body text ${label.toLowerCase()}.` }));

  return el('div', { class: 'wheelside' }, [
    el('h3', { class: 'wheelside__h', text: anchor.name }),
    el('p', { class: 'wheelside__fam',
      text: `${anchor.family} - hue ${anchor.from} to ${anchor.to} degrees` }),
    el('div', { class: 'emo__words' },
      anchor.words.map((w) => el('span', { class: 'emo__word', text: w }))),
    el('p', { class: 'wheelside__p', text: anchor.signal }),
    el('p', { class: 'wheelside__p is-warn', text: anchor.caution }),
    el('p', { class: 'wheelside__p muted', text: `Common in: ${anchor.fit}` }),

    el('h4', { class: 'wheelside__sub', text: 'The usable range' }),
    el('p', { class: 'note', text: 'Same hue, every lightness. T carries text on light grounds, '
      + 'D carries text on dark ones, the rest are fills. Click to copy.' }),
    swatches,
    pick('Best on light', built.bestOnLight),
    pick('Best on dark', built.bestOnDark),

    el('p', { class: 'caveat', text: 'Conventional association, not a measured effect. Culturally '
      + 'specific, and moved at least as much by saturation and lightness as by hue - which is why '
      + 'the wheel above has three rings rather than one.' }),
  ]);
}

export function renderAside(host, ctx) {
  const { colors } = ctx;
  const chromatic = geometries(colors).filter((g) => !g.neutral);
  if (!chromatic.length) return;

  host.appendChild(el('section', { class: 'panel panel--flush' }, [
    el('div', { class: 'panel__head' }, [el('div', {}, [
      el('p', { class: 'eyebrow', text: 'Where your colours sit' }),
      el('p', { class: 'note', text: 'Nearest anchor, and how strongly it applies.' }),
    ])]),
    el('div', { class: 'panel__body' }, [
      el('div', { class: 'sits' }, chromatic.map((g) => {
        const r = g.emotion;
        return el('div', { class: 'sits__row' }, [
          el('span', { class: 'sits__sw', style: { background: g.hex } }),
          el('span', { class: 'sits__nm' }, [
            el('b', { text: r.blend ? `${r.primary.name} / ${r.secondary.name}` : r.primary.name }),
            el('br'),
            el('small', { text: `${g.hex} - ${g.hslH.toFixed(0)} degrees` }),
          ]),
          el('span', { class: 'sits__w', text: `${Math.round(r.near[0].weight * 100)}%` }),
        ]);
      })),
    ]),
  ]));
}
