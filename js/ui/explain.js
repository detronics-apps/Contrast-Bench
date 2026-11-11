// "How this works": the idea, the formula, and that formula worked through with
// whatever is on screen right now.

import { el } from './dom.js';
import { parseColor, linearise, luminance, contrast, toOklch, deltaE, toGreyscale } from '../color.js';

const f = (n, d = 4) => n.toFixed(d);

function panel(title, idea, formula, worked, note) {
  return el('details', { class: 'explain' }, [
    el('summary', { text: `How this works: ${title}` }),
    el('div', { class: 'explain__body' }, [
      el('p', { class: 'explain__idea', text: idea }),
      el('pre', { class: 'explain__formula', text: formula }),
      el('div', { class: 'explain__worked' }, worked),
      note ? el('p', { class: 'explain__note', text: note }) : null,
    ]),
  ]);
}

const line = (label, value) => el('div', { class: 'explain__row' }, [
  el('span', { class: 'explain__k', text: label }),
  el('span', { class: 'explain__v', text: value }),
]);

/** The contrast ratio, computed for the pair currently selected. */
export function explainContrast(fg, bg) {
  const chans = ['R', 'G', 'B'];
  const fgRgb = parseColor(fg.hex);
  const bgRgb = parseColor(bg.hex);
  const lf = luminance(fg.hex);
  const lb = luminance(bg.hex);
  const hi = Math.max(lf, lb);
  const lo = Math.min(lf, lb);
  const ratio = contrast(fg.hex, bg.hex);

  return panel(
    'the contrast ratio',
    'Contrast is not about how different two colours look. It is about how much light each one '
      + 'sends to the eye. Each channel is straightened out of the curve screens encode with, '
      + 'weighted by how sensitive we are to it (green most, blue least), and the two brightnesses '
      + 'are compared as a ratio.',
    'linear(c)  = c/255 <= 0.03928 ? c/3892 : ((c/255 + 0.055) / 1.055) ^ 2.4\n'
      + 'L         = 0.2126*R + 0.7152*G + 0.0722*B\n'
      + 'ratio     = (L_lighter + 0.05) / (L_darker + 0.05)',
    [
      line(`${fg.name} ${fg.hex}`,
        chans.map((c, i) => `${c} ${fgRgb[i]} -> ${f(linearise(fgRgb[i]), 4)}`).join('   ')),
      line('its luminance', f(lf)),
      line(`${bg.name} ${bg.hex}`,
        chans.map((c, i) => `${c} ${bgRgb[i]} -> ${f(linearise(bgRgb[i]), 4)}`).join('   ')),
      line('its luminance', f(lb)),
      line('ratio', `(${f(hi)} + 0.05) / (${f(lo)} + 0.05)  =  ${ratio.toFixed(2)}:1`),
    ],
    'The 0.05 is a flare allowance: it stands in for the light a real screen reflects, which is why '
      + 'the scale tops out at 21 rather than running to infinity against black.',
  );
}

/** Why a suggestion moves lightness and nothing else. */
export function explainShift(fg, bg) {
  const a = toOklch(fg.hex);
  return panel(
    'the shift suggestions',
    'A fix has to be adoptable, not just correct. Moving a colour in OKLCh lets lightness change '
      + 'while hue and chroma stay put, so the result still reads as the same brand colour rather '
      + 'than a new one.',
    'OKLCh  = (L lightness, C chroma, H hue)\n'
      + 'hold C and H, walk L in small steps away from the original\n'
      + 'stop at the FIRST L where ratio >= target',
    [
      line(`${fg.name} in OKLCh`, `L ${a.L.toFixed(1)}   C ${a.C.toFixed(3)}   H ${a.H.toFixed(0)} deg`),
      line('held constant', 'C and H - the parts that make it this colour'),
      line('drift', 'measured in OKLab: under 2 barely visible, over 12 a different colour'),
    ],
    'Stepping rather than halving the interval, because contrast is not monotonic in lightness: a '
      + 'mid-tone moving towards the other colour gets worse before it gets better, and a binary '
      + 'search would find the far crossing or miss it entirely.',
  );
}

/** Why two legible colours can still be the same marker. */
export function explainSeparation(entries) {
  if (entries.length < 2) return null;
  const [a, b] = entries;
  const d = deltaE(a.hex, b.hex);
  const grey = contrast(toGreyscale(a.hex), toGreyscale(b.hex));
  return panel(
    'telling categories apart',
    'Contrast asks whether a colour can carry text. It cannot tell you whether a viewer knows which '
      + 'category they are looking at. Two colours can both be perfectly legible and still be the '
      + 'same colour to the reader - so this is measured three ways, because three different '
      + 'readers fail differently.',
    'distance  = euclidean distance in OKLab, x100   (under 12 is one marker)\n'
      + 'greyscale = contrast ratio of the two luminances  (under 1.2:1 is one marker)\n'
      + 'colour blind = simulate both, then measure the distance again',
    [
      line(`${a.name} vs ${b.name}`, `distance ${d.toFixed(1)}`),
      line('without colour', `${toGreyscale(a.hex)} vs ${toGreyscale(b.hex)}  =  ${grey.toFixed(2)}:1`),
      line('counted', 'per viewer, never pooled - one person is in one situation at a time'),
    ],
    'Different hues at the same lightness are identical in greyscale. That is the most common way a '
      + 'category palette fails, and no contrast checker will ever mention it.',
  );
}

/** What the wheel is and is not. */
export function explainEmotion(reading) {
  return panel(
    'the emotion reading',
    'Hue carries a learned association. Saturation and lightness change how strongly that '
      + 'association comes through - often more than the hue itself does - which is why this wheel '
      + 'has three rings and every reading comes with its modifiers.',
    'nearest anchor  = smallest angle to one of twelve hues, 30 degrees apart\n'
      + 'weight          = 1 - (gap / 30)\n'
      + 'then modified by saturation and lightness, separately',
    [
      line(reading.hex, `hue ${reading.hue.toFixed(0)} deg, saturation ${reading.saturation.toFixed(0)}%, `
        + `lightness ${reading.lightness.toFixed(0)}%`),
      line('nearest', `${reading.primary.name} (${Math.round(reading.near[0].weight * 100)}%)`
        + `, then ${reading.secondary.name}`),
      ...reading.modifiers.map((m) => line(m.axis, m.text)),
    ],
    'Convention, not measurement. These associations are learned and culturally specific, and the '
      + 'confident versions of this wheel overstate how reliably they transfer.',
  );
}
