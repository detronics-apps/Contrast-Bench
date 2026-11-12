// The help content and its search. Pure.
//
// The point of the alias map is that people do not search with the app's words.
// Somebody typing "colour blind", "daltonism", "can my dad read this" and
// "accessibility" all want the same page, and only one of those strings appears
// in it. Matching the literal word would fail four readers out of five.

/** User language on the left, the app's own terms on the right. */
export const ALIASES = Object.freeze({
  'colour blind': ['colour vision', 'protanopia', 'deuteranopia', 'tritanopia', 'categories'],
  colorblind: ['colour vision', 'protanopia', 'deuteranopia', 'tritanopia', 'categories'],
  'color blind': ['colour vision', 'protanopia', 'deuteranopia', 'tritanopia', 'categories'],
  daltonism: ['colour vision', 'protanopia', 'deuteranopia'],
  'red green': ['protanopia', 'deuteranopia', 'colour vision'],

  accessibility: ['contrast', 'wcag', 'aa', 'aaa'],
  a11y: ['contrast', 'wcag'],
  compliance: ['wcag', 'aa', 'aaa', 'contrast'],
  legal: ['wcag', 'licence', 'privacy'],
  audit: ['wcag', 'contrast', 'criteria'],

  readable: ['contrast', 'body text'],
  legible: ['contrast', 'body text'],
  'hard to read': ['contrast', 'fail', 'body text'],
  'can you read': ['contrast', 'body text'],
  'text colour': ['ramps', 'contrast', 'body text'],
  'font colour': ['ramps', 'contrast', 'body text'],

  greyscale: ['greyscale', 'categories', 'print'],
  grayscale: ['greyscale', 'categories', 'print'],
  'black and white': ['greyscale', 'print'],
  photocopy: ['greyscale', 'print', 'manual'],
  printing: ['allocation', 'print', 'manual', 'business card'],
  cmyk: ['allocation', 'print', 'production'],
  pantone: ['allocation', 'print', 'production'],

  shade: ['ramps', 'lightness'],
  tint: ['ramps', 'lightness'],
  darker: ['ramps', 'lightness', 'shift'],
  lighter: ['ramps', 'lightness', 'shift'],
  range: ['ramps', 'lightness'],
  scale: ['ramps', 'lightness'],
  monochrome: ['ramps', 'one hue'],
  'one colour': ['ramps'],

  mood: ['emotion', 'wheel'],
  feeling: ['emotion', 'wheel'],
  psychology: ['emotion', 'wheel'],
  meaning: ['emotion', 'wheel'],
  'what does blue mean': ['emotion', 'wheel'],

  'how much': ['allocation', 'percentage'],
  '60 30 10': ['allocation', 'percentage'],
  percentage: ['allocation'],
  website: ['allocation', 'web'],
  'business card': ['allocation', 'print'],
  manual: ['allocation', 'print'],

  fix: ['shift', 'suggestion'],
  suggestion: ['shift'],
  improve: ['shift', 'suggestion', 'fix'],
  'what should i change': ['fix', 'shift', 'suggestion'],

  save: ['file', 'share link', 'export'],
  export: ['file', 'share link'],
  share: ['share link', 'fragment'],
  privacy: ['privacy', 'fragment', 'local'],
  data: ['privacy', 'local storage'],
});

/** Everything searchable, in the order it is shown when nothing is searched. */
export const TOPICS = Object.freeze([
  {
    id: 'which-mode', kind: 'howto', title: 'Which mode do I want?',
    terms: ['brand', 'ramps', 'categories', 'emotion', 'choose', 'start'],
    body: 'If the colours appear together on one screen, use Brand. If each colour has its own '
      + 'world and is never shown beside the others - one per section, one per episode - use Ramps. '
      + 'Use Categories only when a viewer has to tell markers apart at a glance. Emotion is for '
      + 'deciding what a colour should be in the first place.',
  },
  {
    id: 'read-matrix', kind: 'howto', title: 'Reading the matrix',
    terms: ['brand', 'matrix', 'grid', 'contrast', 'aa', 'aaa', 'fail', 'pairs'],
    body: 'Rows are text, columns are background, and each cell renders the real combination so the '
      + 'grid is the preview. The stripe gives the best WCAG level that pair reaches. Click any cell '
      + 'for the five criteria and the smallest fix. The grid mirrors across the diagonal because '
      + 'contrast is symmetric.',
  },
  {
    id: 'fix-a-pair', kind: 'howto', title: 'Fixing a pair that fails',
    terms: ['shift', 'suggestion', 'fix', 'fail', 'drift', 'lightness', 'criteria'],
    body: 'Click the failing cell, then pick a target - 3:1, 4.5:1 or 7:1. The suggestions move '
      + 'lightness only, holding hue and chroma, so the result still reads as the same brand colour. '
      + 'Drift says how far it travelled: under 2 is barely visible, over 12 is a different colour.',
  },
  {
    id: 'ramp-steps', kind: 'howto', title: 'Using your own ramp',
    terms: ['ramps', 'steps', 'monochrome', 'shade', 'tint', 'one hue'],
    body: 'If a palette is four or more colours sharing a hue across a wide lightness range, the app '
      + 'recognises it as a ramp and measures your steps rather than inventing its own. It names the '
      + 'step to use for text on light grounds and on dark ones, and marks the brand step.',
  },
  {
    id: 'cvd', kind: 'faq', title: 'Will colour-blind viewers tell these apart?',
    terms: ['colour vision', 'protanopia', 'deuteranopia', 'tritanopia', 'categories', 'greyscale', 'photocopy', 'print'],
    body: 'Categories mode simulates the three common forms and reports how many markers each kind '
      + 'of viewer can distinguish, counted per viewer rather than pooled. Greyscale is checked too, '
      + 'because two different hues at the same lightness are identical without colour - the most '
      + 'common way a category palette fails.',
  },
  {
    id: 'large-text', kind: 'faq', title: 'What counts as large text?',
    terms: ['large', 'heading', 'body text', 'wcag', 'aa', 'criteria', '3:1', '4.5:1'],
    body: '18.66px bold, or 24px regular and up. Large text needs 3:1 rather than 4.5:1. Below that '
      + 'it is body text, whatever it looks like.',
  },
  {
    id: 'marginal', kind: 'faq', title: 'It passes 4.5:1 and still looks wrong',
    terms: ['contrast', 'wcag', 'marginal', 'limit', 'accuracy', 'light on dark'],
    body: 'A known limit of the WCAG 2.1 formula: it under-reports how poorly light text on mid-dark '
      + 'backgrounds reads. Treat a marginal pass at 4.6:1 as marginal rather than as a licence.',
  },
  {
    id: 'emotion-science', kind: 'faq', title: 'Is the emotion wheel science?',
    terms: ['emotion', 'wheel', 'psychology', 'meaning', 'mood', 'convention'],
    body: 'No, and the app says so everywhere it shows one. Colour-emotion association is real but '
      + 'learned, culturally specific, and far weaker than confident marketing wheels suggest. It is '
      + 'also indexed on hue alone, while saturation and lightness move the reading at least as much '
      + '- which is why this wheel has three rings and every reading carries its modifiers.',
  },
  {
    id: 'keep-meaning', kind: 'faq', title: 'Separating two colours without changing what they mean',
    terms: ['categories', 'collapse', 'lightness', 'hue', 'emotion', 'separate'],
    body: 'Move lightness, not hue. Hue carries the emotional association; the wheel has no opinion '
      + 'about lightness. Categories mode computes the smallest lightness change that separates a '
      + 'collapsing pair on all three tests.',
  },
  {
    id: 'allocation', kind: 'feature', title: 'How much of each colour to use',
    terms: ['allocation', 'percentage', '60 30 10', 'website', 'business card', 'manual', 'print', 'production'],
    body: 'Share of visible area per role, for a website, a business card and a user manual, each '
      + 'with its production notes. The card deliberately inverts the website. 60/30/10 is a starting '
      + 'ratio, not a rule - what it encodes is that one colour must clearly dominate.',
  },
  {
    id: 'palettes', kind: 'feature', title: 'Saved palettes and files',
    terms: ['save', 'load', 'file', 'palette', 'switch', 'export'],
    body: 'Keep several palettes side by side and switch between them; each is saved in this browser '
      + 'only. Save and Open in the header write and read a plain JSON file on your own device.',
  },
  {
    id: 'share', kind: 'feature', title: 'Share link and privacy',
    terms: ['share link', 'fragment', 'privacy', 'local storage', 'url', 'data'],
    body: 'A share link encodes the palette in the URL fragment - the part after the # - which '
      + 'browsers never transmit to a server. Nothing else leaves your browser: no analytics, no '
      + 'cookies, no third-party scripts. Palettes live in local storage on this device.',
  },
  {
    id: 'copy-analysis', kind: 'feature', title: 'Copy analysis',
    terms: ['copy', 'analysis', 'report', 'text', 'paste', 'export'],
    body: 'Puts every measured finding on the clipboard as plain text. The app computes; the '
      + 'judgement call about a specific brand is a conversation, and this is the seam between them.',
  },
  {
    id: 'paste-hex', kind: 'feature', title: 'Paste a hex list, or pick from screen',
    terms: ['paste', 'hex', 'import', 'eyedropper', 'pick', 'stylesheet'],
    body: 'Paste anything containing hex codes - a stylesheet, an email, a spec - and the colours are '
      + 'pulled out. In Chrome, Pick takes a colour from anywhere on screen.',
  },
  {
    id: 'levels', kind: 'feature', title: 'Simple, Advanced and Expert',
    terms: ['level', 'detail', 'simple', 'advanced', 'expert', 'hide'],
    body: 'Simple shows the answer, Advanced adds the reasoning, Expert adds the geometry and the '
      + 'search tools. A level only hides; it never changes a value.',
  },
]);

const norm = (s) => (s == null ? '' : String(s)).toLowerCase().replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Expand a query into the app's own vocabulary.
 *
 * Phrases are matched before words, so "colour blind" resolves as one idea rather
 * than as "colour" plus "blind".
 */
export function expand(query) {
  const q = norm(query);
  if (!q) return [];
  const terms = new Set([q, ...q.split(' ')]);

  for (const [alias, targets] of Object.entries(ALIASES)) {
    if (q.includes(alias)) for (const t of targets) terms.add(norm(t));
  }
  // A single word that is itself an alias key.
  for (const word of q.split(' ')) {
    if (ALIASES[word]) for (const t of ALIASES[word]) terms.add(norm(t));
  }
  return [...terms].filter(Boolean);
}

/** Search the help. Returns every topic when the query is empty. */
export function searchHelp(query, topics = TOPICS) {
  const terms = expand(query);
  if (!terms.length) return topics.map((t) => ({ topic: t, score: 0 }));

  const scored = topics.map((topic) => {
    const title = norm(topic.title);
    const body = norm(topic.body);
    const tags = topic.terms.map(norm);
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 6;
      if (tags.some((t) => t === term)) score += 5;
      if (tags.some((t) => t.includes(term))) score += 3;
      if (body.includes(term)) score += 1;
    }
    return { topic, score };
  });

  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score
    || a.topic.title.localeCompare(b.topic.title));
}
