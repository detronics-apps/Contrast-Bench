// The emotion wheel, drawn as SVG.
//
// Orientation matches the familiar marketing wheel: hue 60 (yellow) at the top,
// hue increasing clockwise. Everything inside the SVG uses literal colours or
// `currentColor` - never var(--) - so the export is honest without post-processing.
//
// THE RADIAL AXIS IS SATURATION, and only saturation.
//
// It used to be inconsistent and it showed: the background rings varied saturation
// AND lightness together while the plotted dots were placed by chroma, so a light
// colour landed on a dark ring and a darker one landed near the pale centre. The
// dots looked wrongly placed because they measured a different thing from the rings
// behind them. Now the rings hold lightness constant and vary saturation alone, and
// a dot's distance from the centre is its own saturation - so a dot sits on the ring
// that matches it. Lightness is carried by the dot's own fill, which is the colour
// itself, and stated in the panel beside the wheel.

import { svg, el } from './dom.js';
import { EMOTIONS } from '../emotion.js';
import { toHsl, isNeutral } from '../color.js';

const CX = 200, CY = 200;
const R_OUT = 148, R_IN = 42, R_LABEL = 174;
const TOP_HUE = 60;

/*
 * The viewBox is wider than the wheel, and deliberately so.
 *
 * Labels sit at x = CX +/- R_LABEL*sin(theta), which puts the two at the horizontal
 * extremes near x = 32 and x = 368. Anchored outward, a word like "Excitement" then
 * runs past both edges of a 0..400 box and was clipped mid-word. The text needs
 * room, and the honest place to give it is the box rather than by shrinking the
 * wheel or truncating the words. Vertically nothing overhangs, so only the sides.
 */
const PAD_X = 108;
const VIEW = [-PAD_X, 0, 400 + PAD_X * 2, 400].join(' ');

/** Lightness is held constant so the rings mean saturation and nothing else. */
const RING_LIGHT = 58;
const BANDS = [
  { from: 0, to: 25 }, { from: 25, to: 50 }, { from: 50, to: 75 }, { from: 75, to: 100 },
];

/** Screen point for a hue at a radius. Hue 60 is at the top; hue increases clockwise. */
function point(hue, radius) {
  const t = ((hue - TOP_HUE) * Math.PI) / 180;
  return [CX + radius * Math.sin(t), CY - radius * Math.cos(t)];
}

/** Saturation 0-100 to distance from the centre. The one radial meaning. */
const radiusFor = (s) => R_IN + (Math.max(0, Math.min(100, s)) / 100) * (R_OUT - R_IN);

/** Annular sector between two hues. */
function sectorPath(hueFrom, hueTo, rIn, rOut) {
  const [x1, y1] = point(hueFrom, rOut);
  const [x2, y2] = point(hueTo, rOut);
  const [x3, y3] = point(hueTo, rIn);
  const [x4, y4] = point(hueFrom, rIn);
  const large = Math.abs(hueTo - hueFrom) > 180 ? 1 : 0;
  return `M${x1} ${y1} A${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2} `
    + `L${x3} ${y3} A${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z`;
}

/**
 * Draw the wheel.
 *
 * colors       [{name, hex}] to plot, or bare hexes
 * selected     emotion name to highlight, or null
 * pickedIndex  index of the plotted colour being inspected
 * onSelect     called with an emotion name when a sector is clicked
 * onPick       called with a colour index when a plotted dot is clicked
 */
export function emotionWheel({
  colors = [], selected = null, pickedIndex = null,
  onSelect = null, onPick = null, showPlots = true,
} = {}) {
  const root = svg('svg', {
    viewBox: VIEW,
    class: 'wheel',
    role: 'img',
    'aria-label': 'Emotion wheel: hue around the circle, saturation towards the edge',
  });

  for (const e of EMOTIONS) {
    const isSel = selected === e.name;
    const group = svg('g', {
      class: `wheel__sector${isSel ? ' is-selected' : ''}`,
      role: onSelect ? 'button' : null,
      tabindex: onSelect ? '0' : null,
      'aria-label': `${e.name}: ${e.words.join(', ')}`,
      'aria-pressed': onSelect ? String(isSel) : null,
    });

    for (const b of BANDS) {
      const mid = (b.from + b.to) / 2;
      group.appendChild(svg('path', {
        d: sectorPath(e.hue - 15, e.hue + 15, radiusFor(b.from), radiusFor(b.to)),
        fill: `hsl(${e.hue} ${mid}% ${RING_LIGHT}%)`,
        stroke: 'none',
      }));
    }

    group.appendChild(svg('path', {
      d: sectorPath(e.hue - 15, e.hue + 15, R_IN, R_OUT),
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': isSel ? 3 : 0.75,
      'stroke-opacity': isSel ? 1 : 0.25,
    }));

    if (onSelect) {
      const fire = () => onSelect(e.name);
      group.addEventListener('click', fire);
      group.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fire(); }
      });
      group.style.cursor = 'pointer';
    }
    root.appendChild(group);
  }

  // Labels upright rather than rotated: a wheel whose words are upside down at the
  // bottom is a graphic, not a control.
  for (const e of EMOTIONS) {
    const [lx, ly] = point(e.hue, R_LABEL);
    const anchor = Math.abs(lx - CX) < 12 ? 'middle' : lx > CX ? 'start' : 'end';
    root.appendChild(svg('text', {
      x: lx, y: ly,
      'text-anchor': anchor,
      'dominant-baseline': 'middle',
      class: `wheel__label${selected === e.name ? ' is-selected' : ''}`,
      fill: 'currentColor',
      'font-size': 13,
      'font-weight': selected === e.name ? 700 : 500,
      text: e.name,
    }));
  }

  root.appendChild(svg('circle', {
    cx: CX, cy: CY, r: R_IN,
    fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.3,
    'stroke-dasharray': '4 4', 'stroke-width': 1,
  }));
  root.appendChild(svg('text', {
    x: CX, y: CY, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    fill: 'currentColor', 'font-size': 11, 'fill-opacity': 0.55, text: 'neutral',
  }));

  if (showPlots && colors.length) {
    // Place every dot first, then the labels, so collisions can be seen before any
    // text is drawn. Two colours that share a hue and a saturation and differ only
    // in lightness land on the same point - correctly, since lightness is not a
    // direction here - and their names would print on top of each other.
    const placed = colors.map((c, i) => {
      const hex = typeof c === 'string' ? c : c.hex;
      const hsl = toHsl(hex);
      const neutral = isNeutral(hex);
      let px;
      let py;
      if (neutral) {
        const a = (i / colors.length) * Math.PI * 2;
        px = CX + Math.cos(a) * (R_IN * 0.55);
        py = CY + Math.sin(a) * (R_IN * 0.55);
      } else {
        [px, py] = point(hsl.H, radiusFor(hsl.S));
      }
      return { i, hex, name: typeof c === 'string' ? hex : (c.name || hex), px, py };
    });

    // Each label steps further out than any earlier one it would have collided with.
    const LANE = 15;
    for (const p of placed) {
      p.lane = placed
        .filter((q) => q.i < p.i && Math.hypot(q.px - p.px, q.py - p.py) < 30)
        .reduce((max, q) => Math.max(max, q.lane + 1), 0);
    }

    placed.forEach(({ i, hex, name, px, py, lane }) => {
      const isPicked = pickedIndex === i;
      const g = svg('g', {
        class: `wheel__plot${isPicked ? ' is-picked' : ''}`,
        role: onPick ? 'button' : null,
        tabindex: onPick ? '0' : null,
        'aria-label': `${name}, ${hex}`,
        'aria-pressed': onPick ? String(isPicked) : null,
      });

      g.appendChild(svg('circle', {
        cx: px, cy: py, r: isPicked ? 15 : 12,
        fill: hex,
        stroke: 'currentColor',
        'stroke-width': isPicked ? 4 : 2.5,
      }));

      // The name, not the code. Pushed outward from the centre so it clears the
      // dot, with a halo behind it so it reads over any hue.
      const away = Math.hypot(px - CX, py - CY) || 1;
      const lx = px + ((px - CX) / away) * 21;
      const ly = py + ((py - CY) / away) * 21;
      const anchor = lx > CX + 4 ? 'start' : lx < CX - 4 ? 'end' : 'middle';
      for (const halo of [true, false]) {
        g.appendChild(svg('text', {
          x: lx, y: ly,
          'text-anchor': anchor,
          'dominant-baseline': 'middle',
          class: `wheel__plotname${halo ? ' wheel__plotname--halo' : ''}`,
          'font-size': 11,
          'font-weight': isPicked ? 700 : 600,
          'stroke-width': halo ? 3.5 : 0,
          'stroke-linejoin': 'round',
          'paint-order': 'stroke',
          text: name,
        }));
      }

      g.appendChild(svg('title', { text: `${name} - ${hex}` }));

      if (onPick) {
        const fire = (ev) => { ev.stopPropagation(); onPick(i); };
        g.addEventListener('click', fire);
        g.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fire(ev); }
        });
        g.style.cursor = 'pointer';
      }
      root.appendChild(g);
    });
  }

  return root;
}

/** A compact card for one colour's reading. */
export function emotionCard(reading, label = null) {
  const { primary, secondary, blend, modifiers, caveat, hex } = reading;
  return el('div', { class: 'emo' }, [
    el('div', { class: 'emo__band', style: { background: hex } }, [
      el('span', { class: 'emo__hex', text: label ? `${label} - ${hex}` : hex }),
    ]),
    el('div', { class: 'emo__body' }, [
      el('h4', {
        class: 'emo__name',
        text: blend ? `${primary.name} / ${secondary.name}` : primary.name,
      }),
      el('p', { class: 'emo__family', text: reading.neutral
        ? 'Neutral - no hue to read'
        : `${primary.family} - hue ${reading.hue.toFixed(0)}, `
          + `${reading.saturation.toFixed(0)}% saturation, `
          + `${reading.lightness.toFixed(0)}% lightness` }),
      el('div', { class: 'emo__words' },
        primary.words.map((w) => el('span', { class: 'emo__word', text: w }))),
      el('dl', { class: 'emo__dl' }, [
        el('dt', { text: 'Signals' }), el('dd', { text: primary.signal }),
        el('dt', { text: 'Watch out' }), el('dd', { class: 'is-warn', text: primary.caution }),
        el('dt', { text: 'In this palette' }),
        el('dd', { text: modifiers.map((m) => m.text).join(' ') }),
        el('dt', { text: 'Common in' }), el('dd', { text: primary.fit }),
      ]),
      el('p', { class: 'emo__caveat', text: caveat }),
    ]),
  ]);
}
