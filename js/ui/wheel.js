// The emotion wheel, drawn as SVG.
//
// Orientation matches the familiar marketing wheel: hue 60 (yellow) at the top,
// hue increasing clockwise. Everything inside the SVG uses literal colours or
// `currentColor` - never var(--) - so the export is honest without post-processing.

import { svg, el } from './dom.js';
import { EMOTIONS } from '../emotion.js';
import { toHsl, toOklch, isNeutral } from '../color.js';

const CX = 200, CY = 200;
const R_OUT = 148, R_IN = 42, R_LABEL = 172;
const TOP_HUE = 60;

/** Screen point for a hue at a radius. Hue 60 is at the top; hue increases clockwise. */
function point(hue, radius) {
  const t = ((hue - TOP_HUE) * Math.PI) / 180;
  return [CX + radius * Math.sin(t), CY - radius * Math.cos(t)];
}

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
 * @param {object} opts
 *   colors      palette hexes to plot on the wheel
 *   selected    emotion name to highlight, or null
 *   onSelect    called with an emotion name when a sector is clicked
 *   showPlots   plot the palette (false for a plain reference wheel)
 */
export function emotionWheel({ colors = [], selected = null, onSelect = null, showPlots = true } = {}) {
  const root = svg('svg', {
    viewBox: '0 0 400 400',
    class: 'wheel',
    role: 'img',
    'aria-label': 'Emotion wheel: hue around the circle, saturation towards the edge',
  });

  // Rings of increasing saturation, so the wheel shows that a hue's reading
  // changes with how saturated it is - the thing a flat wheel hides.
  const BANDS = [
    { rIn: R_IN, rOut: 78, sat: 28, light: 78 },
    { rIn: 78, rOut: 113, sat: 52, light: 62 },
    { rIn: 113, rOut: R_OUT, sat: 78, light: 50 },
  ];

  for (const e of EMOTIONS) {
    const from = e.hue - 15;
    const to = e.hue + 15;
    const isSel = selected === e.name;

    const group = svg('g', {
      class: `wheel__sector${isSel ? ' is-selected' : ''}`,
      role: onSelect ? 'button' : null,
      tabindex: onSelect ? '0' : null,
      'aria-label': `${e.name}: ${e.words.join(', ')}`,
      'aria-pressed': onSelect ? String(isSel) : null,
    });

    for (const b of BANDS) {
      group.appendChild(svg('path', {
        d: sectorPath(from, to, b.rIn, b.rOut),
        fill: `hsl(${e.hue} ${b.sat}% ${b.light}%)`,
        stroke: 'none',
      }));
    }

    // The selection outline sits on top of all three bands.
    group.appendChild(svg('path', {
      d: sectorPath(from, to, R_IN, R_OUT),
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

  // Labels, upright rather than rotated: a wheel whose words are upside down at the
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
      'font-size': 12,
      'font-weight': selected === e.name ? 700 : 500,
      text: e.name,
    }));
  }

  // The neutral core: colours with no hue belong here, not on the rim.
  root.appendChild(svg('circle', {
    cx: CX, cy: CY, r: R_IN,
    fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.3,
    'stroke-dasharray': '4 4', 'stroke-width': 1,
  }));
  root.appendChild(svg('text', {
    x: CX, y: CY, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    fill: 'currentColor', 'font-size': 10, 'fill-opacity': 0.55, text: 'neutral',
  }));

  if (showPlots && colors.length) {
    const maxC = Math.max(0.09, ...colors.map((c) => toOklch(c).C));
    colors.forEach((hex, i) => {
      let px, py;
      if (isNeutral(hex)) {
        // Spread the neutrals around the core so they do not stack on one point.
        const a = (i / colors.length) * Math.PI * 2;
        px = CX + Math.cos(a) * (R_IN * 0.55);
        py = CY + Math.sin(a) * (R_IN * 0.55);
      } else {
        const { H } = toHsl(hex);
        const radius = R_IN + (toOklch(hex).C / maxC) * (R_OUT - R_IN);
        [px, py] = point(H, Math.min(radius, R_OUT - 6));
      }
      const g = svg('g', { class: 'wheel__plot' });
      g.appendChild(svg('circle', {
        cx: px, cy: py, r: 11, fill: hex,
        stroke: 'currentColor', 'stroke-width': 2.5,
      }));
      g.appendChild(svg('title', { text: hex }));
      root.appendChild(g);
    });
  }

  return root;
}

/** A compact legend row for one emotion. */
export function emotionCard(reading) {
  const { primary, secondary, blend, modifiers, caveat, hex } = reading;
  return el('div', { class: 'emo' }, [
    el('div', { class: 'emo__band', style: { background: hex } }, [
      el('span', { class: 'emo__hex', text: hex }),
    ]),
    el('div', { class: 'emo__body' }, [
      el('h4', {
        class: 'emo__name',
        text: blend ? `${primary.name} / ${secondary.name}` : primary.name,
      }),
      el('p', { class: 'emo__family', text: reading.neutral
        ? 'Neutral - no hue to read'
        : `${primary.family} - hue ${reading.hue.toFixed(0)}, ${reading.saturation.toFixed(0)}% saturation` }),
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
