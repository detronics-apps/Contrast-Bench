// Emotion mode: what is this palette saying, and what should it be saying?
//
// Two directions, and the second is the useful one:
//   read    a colour  -> the emotion it conventionally communicates
//   choose  an emotion -> colours that communicate it AND pass contrast

import { el } from '../dom.js';
import { emotionWheel, emotionCard } from '../wheel.js';
import { EMOTION_NAMES, readEmotion, paletteForEmotion, hueForEmotion } from '../../emotion.js';
import { emotionalRegister, geometries } from '../../palette.js';
import { explainEmotion } from '../explain.js';

export const meta = { id: 'feeling', label: 'Emotion', kind: 'any' };

export function render(host, ctx) {
  const { palette, colors, ui, set, level } = ctx;
  const items = palette.colors;
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
  wheelPanel.appendChild(el('div', { class: 'panel__body wheelbody' }, [
    el('div', { class: 'wheelwrap' }, [
      emotionWheel({
        colors,
        selected,
        onSelect: (name) => set({ emotion: name }),
      }),
    ]),
    selectedPane(selected, ctx),
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
