// "Copy analysis": every measured finding as plain text.
//
// This is the seam between the app and a conversation. The app computes - contrast,
// geometry, separation, allocation are all arithmetic with a right answer. Judgement
// about a specific brand is not, and that belongs in a conversation with the numbers
// already in front of it rather than re-derived badly.

import { summarise, judgeAll } from '../wcag.js';
import { findings, recommendations, headline, scheme, cohesion, emotionalRegister } from '../palette.js';
import { channelFindings, analyse } from '../channel.js';
import { allocateAll } from '../allocation.js';
import { readEmotion } from '../emotion.js';

const f = (n, d = 2) => n.toFixed(d);

export function reportText(palette, { version } = {}) {
  const colors = palette.colors.map((c) => c.hex);
  const lines = [];
  const push = (...xs) => lines.push(...xs);

  push(`# ${palette.name} (${palette.kind})`, '');
  push(`${palette.colors.length} colours, measured by Detronics Contrast Bench${version ? ` v${version}` : ''}.`, '');

  push('## Colours', '');
  for (const c of palette.colors) {
    const r = readEmotion(c.hex);
    push(`- ${c.name} ${c.hex} - ${r.neutral ? 'neutral' : `${r.primary.name}`}`
      + `${r.blend && !r.neutral ? ` / ${r.secondary.name}` : ''}`
      + ` - hue ${f(r.hue, 0)}, saturation ${f(r.saturation, 0)}%, lightness ${f(r.lightness, 0)}%`);
  }
  push('');

  if (palette.kind === 'channel') {
    const a = analyse(palette.colors);
    push('## Separation', '');
    push(`Worst case: ${a.distinguish.worst} of ${palette.colors.length} distinguishable `
      + `(${a.distinguish.worstScenario}).`);
    for (const [k, v] of Object.entries(a.distinguish.counts)) push(`- ${k}: ${v}`);
    push('');
    push('Closest pairs:');
    for (const p of a.pairs.slice(0, 5)) {
      push(`- ${p.a.name} / ${p.b.name}: distance ${f(p.deltaE, 1)}, `
        + `hue gap ${f(p.hueGap, 0)} deg, greyscale ${f(p.greyRatio)}:1 - ${p.verdict}`);
    }
    push('');
    push('## Findings', '');
    for (const x of channelFindings(palette.colors)) {
      push(`### [${x.level}] ${x.title}`, x.body, '');
    }
  } else {
    const s = summarise(colors);
    const sch = scheme(colors);
    const coh = cohesion(colors);
    push('## Contrast', '');
    push(headline(colors));
    push(`- unique pairs: ${s.pairs}`);
    push(`- body-text safe (AA 4.5:1): ${s.bodySafe}`);
    push(`- large text only (3:1): ${s.largeOnly}`);
    push(`- unusable (under 3:1): ${s.unusable}`);
    push(`- AAA (7:1): ${s.aaa}`);
    push('');
    push(`Scheme: ${sch.name}, ${f(sch.span, 0)} degrees of hue spread.`);
    push(`Cohesion: lightness spread ${f(coh.lightness, 1)} (limit ${coh.lightnessLimit}), `
      + `chroma spread ${f(coh.chroma, 3)} (limit ${coh.chromaLimit}) - `
      + `${coh.coherent ? 'reads as one family' : 'does not read as one family'}.`);
    push('');

    const reg = emotionalRegister(colors);
    if (reg) { push('## Register', '', reg.title + '.', reg.body, ''); }

    push('## Worst pairs', '');
    for (const p of judgeAll(colors).sort((a, b) => a.ratio - b.ratio).slice(0, 6)) {
      push(`- ${palette.colors[p.i].name} / ${palette.colors[p.j].name}: `
        + `${f(p.ratio)}:1 (${p.grade})`);
    }
    push('');

    push('## Findings', '');
    for (const x of findings(colors)) { push(`### [${x.level}] ${x.title}`, x.body, ''); }

    push('## Recommended changes', '');
    for (const r of recommendations(colors)) { push(`### ${r.title}`, r.body, ''); }

    push('## Allocation', '');
    for (const a of allocateAll(colors)) {
      push(`### ${a.medium.label}`, a.medium.note, '');
      for (const row of a.rows) {
        push(`- ${Math.round(row.share)}% ${row.label}: ${row.color.hex}`);
      }
      push('');
    }
  }

  push('---');
  push('Contrast ratios follow WCAG 2.1 and are exact. Perceptual distance uses OKLab and the '
    + 'collapse thresholds are working conventions, not a standard. Colour-blindness simulation '
    + 'is the Vienot projection - indicative, not clinical. Emotional associations are documented '
    + 'conventions, not measured effects.');

  return lines.join('\n');
}
