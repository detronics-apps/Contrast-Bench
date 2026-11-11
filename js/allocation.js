// How much of each colour to use, and why the answer changes by medium.
// Pure.
//
// The percentages are of VISIBLE AREA, not of the stylesheet. A colour applied to
// every button in a product can still be 3% of what somebody sees, and that is correct.
//
// 60/30/10 is the familiar version of this and it is a starting ratio, not a rule.
// What it actually encodes is that one colour must clearly dominate, so the accent has
// something quiet to be loud against. Hitting the numbers while the accent appears on
// nine components still loses the hierarchy.

import { roles, ROLE_LABEL } from './palette.js';

export const MEDIA = Object.freeze({
  web: {
    id: 'web',
    label: 'Website',
    note: 'Screen, long exposure, interactive. Percentages are of visible area on a typical page.',
    mix: [
      ['surface', 58, 'Page ground and card fills. The eye needs one large field to rest on; below roughly half the screen an interface feels busy no matter how good the components are.'],
      ['surfaceAlt', 19, 'Section bands, table stripes, input fills, disabled states. Structure you feel without noticing it.'],
      ['ink', 14, 'Body text, headings, icons. High frequency, low area - a seventh of the pixels carrying nearly all of the information.'],
      ['inkSoft', 4, 'Secondary text, captions, metadata, borders. One step down in emphasis, not a different colour family.'],
      ['accent', 5, 'Links, focus rings, primary buttons, active nav, data highlights. Under about 4% it reads as an accident; over about 10% it stops meaning "this one specifically".'],
    ],
    notes: [
      'The accent has to clear 4.5:1 against whatever it sits on. Otherwise it is decoration rather than a signal, and links stop being findable for anyone not looking directly at them.',
      'Dark mode is not an inversion. Surface and ink swap cleanly, but a mid-lightness accent usually has to get lighter to survive on a dark ground, or it sinks into the background it is meant to stand out from.',
      'Two surfaces within 1.3:1 of each other cannot form a visible card edge. If the secondary surface is that close to the primary, the card needs a border, not a fill.',
    ],
  },

  card: {
    id: 'card',
    label: 'Business card',
    note: 'Print, 85 x 55 mm, held in the hand, roughly two seconds of attention. One impression, no second chance.',
    mix: [
      ['ink', 60, 'Flood the card. At this size a single decisive dark field does more work than any arrangement of pale tints, and it makes the object feel considered before a word is read.'],
      ['surface', 27, 'Type, logo and the space around them, reversed out of the dark field.'],
      ['accent', 9, 'The mark, a rule, or one detail. The only place on the card where colour is doing branding rather than legibility work.'],
      ['surfaceAlt', 4, 'Secondary lines - role, qualifications, second address - one step down from the primary type.'],
    ],
    notes: [
      'Specify the accent as a spot colour if the run allows it. A light blue built from four process inks shifts visibly between printers and between runs; a Pantone does not.',
      'A dark flood needs a rich black build, not 100% K - flat key alone prints as a patchy grey-brown across a large area. Expect fingerprints on matt dark stock.',
      'Reversed type fills in below about 8pt. Keep the weight up, open the tracking slightly, and avoid hairline serifs entirely on the dark side.',
      'Leave the near-white tints off the card. At this size a pale tint on white reads as a printing fault rather than a decision.',
      'Dark front, light back is a cheap way to show the identity works in both directions, which is exactly what a client checks for.',
    ],
  },

  manual: {
    id: 'manual',
    label: 'User manual',
    note: 'Print or PDF, sustained reading, consulted under pressure. Assume bad light, a photocopy, and a greyscale printer.',
    mix: [
      ['surface', 72, 'Paper. Margins and interline space are the majority of every page and should stay empty - density is what makes a manual feel unusable.'],
      ['ink', 17, 'Body text, headings, diagram linework. Sustained legibility is the entire job.'],
      ['surfaceAlt', 6, 'Table zebra striping, callout panels, sidebars, figure backgrounds.'],
      ['inkSoft', 3, 'Captions, footnotes, running heads, table rules.'],
      ['accent', 2, 'Wayfinding only: section markers, figure numbers, cross-reference rules. Not for emphasis inside body text.'],
    ],
    notes: [
      'Safety notices are not a branding surface. ISO 3864 and ANSI Z535 fix the colours and formats for danger, warning and caution notices; a brand palette does not override them, and an assessor will check.',
      'Assume it gets photocopied. Anything below roughly a 15% tint disappears by the second generation, taking table stripes and callout panels with it.',
      'Every colour-coded diagram needs a second channel - a label, a pattern, a position, a line style. Someone will print it in greyscale, and someone else will not distinguish the hues.',
      'Ink coverage is a real cost at volume. Large dark fills across hundreds of pages add cost and drying time and can show banding.',
      'Keep body text on the darkest neutral, always. A manual is the one document where nobody will thank you for a stylish mid-grey.',
    ],
  },
});

export const MEDIUM_IDS = Object.keys(MEDIA);

/**
 * The mix for one medium against a real palette.
 *
 * Roles the palette cannot fill are dropped and the remaining shares renormalised,
 * so the percentages always total 100 rather than quietly summing to 81.
 */
export function allocate(colors, mediumId) {
  const medium = MEDIA[mediumId];
  if (!medium) throw new Error(`unknown medium: ${mediumId}`);

  const assigned = roles(colors);
  const present = medium.mix.filter(([role]) => assigned[role]);
  const total = present.reduce((sum, [, share]) => sum + share, 0);
  if (!total) return { medium, rows: [], notes: medium.notes };

  const rows = present.map(([role, share, why]) => ({
    role,
    label: ROLE_LABEL[role],
    color: assigned[role],
    share: (share / total) * 100,
    why,
  }));

  return { medium, rows, notes: medium.notes, dropped: medium.mix
    .filter(([role]) => !assigned[role]).map(([role]) => role) };
}

/** Every medium at once, for the report. */
export const allocateAll = (colors) =>
  MEDIUM_IDS.map((id) => allocate(colors, id));
