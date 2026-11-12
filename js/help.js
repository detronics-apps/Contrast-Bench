// The guide's content and its search. Pure.
//
// Shape copied from the 3DPrintCost Bench guide, which references/how-to-and-onboarding.md
// names as the worked example. Six parts, all data-driven so the guide grows as the
// app grows without touching layout code:
//
//   a. search over everything, with a user-language translator
//   b. step-by-step how-tos
//   c. FAQs
//   d. the process in words
//   e. mental-model tiles
//   f. "features worth knowing" tiles

/* ------------------------------------------------- the user-language translator */

/**
 * Each APP TERM carries the everyday phrases that mean it.
 *
 * A newcomer does not know the app's words, so they search for what they would call
 * the thing ("colour blind", "how much", "photocopy"), not what the screen says
 * ("tritanopia", "allocation", "greyscale"). When an item's text contains the app
 * term, that term's everyday phrases are folded into what the item matches.
 *
 * Maintain this as the app gains vocabulary.
 */
export const SEARCH_ALIASES = {
  contrast: ['readable', 'legible', 'hard to read', 'can you read', 'accessibility', 'a11y',
    'compliance', 'audit', 'wcag', 'aa', 'aaa', 'ratio'],
  'colour vision': ['colour blind', 'color blind', 'colorblind', 'daltonism', 'red green',
    'protanopia', 'deuteranopia', 'tritanopia', 'cvd'],
  greyscale: ['grayscale', 'black and white', 'photocopy', 'mono', 'printed', 'fax'],
  ramp: ['shade', 'tint', 'lighter', 'darker', 'range', 'scale', 'monochrome', 'one colour',
    'steps', 'tones'],
  allocation: ['how much', '60 30 10', 'percentage', 'proportion', 'share', 'balance',
    'website', 'business card', 'manual', 'print', 'pantone', 'cmyk', 'spot colour'],
  emotion: ['mood', 'feeling', 'psychology', 'meaning', 'what does blue mean', 'wheel',
    'communicate', 'message'],
  shift: ['fix', 'suggestion', 'improve', 'what should i change', 'adjust', 'nudge', 'correct'],
  'share link': ['share', 'send', 'url', 'link', 'fragment'],
  privacy: ['data', 'tracking', 'analytics', 'cookies', 'local', 'stored', 'safe'],
  palette: ['save', 'load', 'file', 'switch', 'import', 'export', 'open', 'swatches'],
  categories: ['pillars', 'series', 'tiers', 'markers', 'tags', 'sections', 'chart colours'],
  matrix: ['grid', 'table', 'pairs', 'combinations', 'every pair'],
  level: ['detail', 'simple', 'advanced', 'expert', 'hide', 'show more'],
  eyedropper: ['pick', 'picker', 'from screen', 'sample a colour'],
};

/** Fold an item's text together with the everyday phrases for any app term in it. */
export function searchText(text) {
  const low = String(text == null ? '' : text).toLowerCase();
  let extra = '';
  for (const [term, syns] of Object.entries(SEARCH_ALIASES)) {
    if (low.includes(term)) extra += ` ${syns.join(' ')}`;
  }
  return `${text} ${extra}`;
}

/**
 * Does `text` match every word of the query?
 *
 * AND, not OR: "ramp contrast" narrows to items about both, it does not widen to
 * everything about either. An OR search gets less useful the more you type, which
 * is the opposite of what someone refining a search expects.
 */
export function guideMatches(text, q) {
  if (!q || !q.trim()) return true;
  const hay = searchText(text).toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/* ------------------------------------------------------------ b. the how-tos */

/** Pick an action, get the steps. Short, imperative, and they name the tab. */
export const HOWTOS = [
  { id: 'start', title: 'Get a first answer', category: 'Starting', steps: [
    'The app opens on a demo palette, so there is something to read straight away.',
    'Open the Brand tab. Every colour is measured against every other.',
    'Click any cell in the matrix. The sidebar shows the five WCAG criteria for that pair.',
    'If it fails, the same panel offers the smallest change that fixes it.',
  ] },
  { id: 'own-colours', title: 'Put your own colours in', category: 'Starting', steps: [
    'Open the Palette section in the sidebar.',
    'Edit a hex directly, or click a swatch to use the colour picker.',
    'Use "Paste list" to drop in anything containing hex codes - a stylesheet, an email, a spec.',
    'Use "Add colour" and "Remove" to get to the set you want. You can empty it completely.',
  ] },
  { id: 'fix-pair', title: 'Fix a pair that fails', category: 'Contrast', steps: [
    'In the Brand tab, click the failing cell.',
    'Choose a target in the sidebar: 3:1 for large text, 4.5:1 for body text, 7:1 for AAA.',
    'Each suggestion moves lightness only, holding hue and chroma, so it stays the same colour.',
    'Read the drift figure: under 2 is barely visible, over 12 is a different colour.',
    'Click a suggestion to copy its hex.',
  ] },
  { id: 'one-colour', title: 'Check one colour on its own', category: 'Ramps', steps: [
    'Open the Ramps tab. Each colour gets its own card.',
    'The strip shows that colour across its whole range, with the one you chose outlined.',
    'T marks a step that carries text on light grounds, D on dark, TD on either.',
    'The findings name the exact hex to use for text, in the same hue.',
  ] },
  { id: 'ramp-matrix', title: 'Compare the shades of one colour', category: 'Ramps', steps: [
    'Open the Ramps tab and find the colour you want.',
    'Click "Compare in Brand" on its card.',
    'The steps become a palette of their own and the pairing matrix opens.',
    'Your original palette is kept - this adds a new one rather than replacing it.',
  ] },
  { id: 'tell-apart', title: 'Check people can tell your categories apart', category: 'Categories', steps: [
    'Open the Categories tab with the set of markers loaded.',
    'Read the worst-case count at the top: how many a viewer can distinguish.',
    'The scenario rows show colour, greyscale and each form of colour blindness separately.',
    'Where two collapse, the fix below moves lightness only, so the meaning survives.',
  ] },
  { id: 'choose-by-feel', title: 'Choose a colour by what it should say', category: 'Emotion', steps: [
    'Open the Emotion tab.',
    'Click the segment of the wheel for what you want to communicate.',
    'The panel shows that hue across every lightness, marked for what each step can carry.',
    'Click "Add" beside the best light-ground or dark-ground value to put it in the palette.',
  ] },
  { id: 'inspect-dot', title: 'See where one of your colours sits', category: 'Emotion', steps: [
    'Open the Emotion tab. Your colours are plotted on the wheel by name.',
    'Click a dot to read that colour: its hue, saturation, lightness and what it signals.',
    'Click "Back to the wheel" to return to the emotion you had selected.',
  ] },
  { id: 'allocation', title: 'Work out how much of each colour to use', category: 'Contrast', steps: [
    'Open the Brand tab at Advanced or Expert.',
    'Scroll to Allocation and pick a medium: website, business card or user manual.',
    'The bar shows the share of visible area each role should take, and the table says why.',
    'Read the production notes under it - they cover pantone and cmyk, reversed type and photocopies.',
  ] },
  { id: 'share', title: 'Send a palette to somebody', category: 'Sharing', steps: [
    'Open "Share and save" at the foot of the sidebar.',
    'Click "Copy share link". The palette rides in the URL after the #.',
    'That fragment is never sent to a web server, so the colours stay between you and them.',
  ] },
  { id: 'save-file', title: 'Keep a palette between devices', category: 'Sharing', steps: [
    'Click the save icon in the header to write every palette to a JSON file.',
    'Keep that file wherever you keep your brand assets.',
    'Click the open icon on any device to load it back.',
  ] },
  { id: 'hand-over', title: 'Hand the findings to somebody else', category: 'Sharing', steps: [
    'Open "Share and save" in the sidebar.',
    'Click "Copy analysis". Every measured finding goes to the clipboard as plain text.',
    'Paste it wherever the judgement call gets made - an email, a brief, a conversation.',
  ] },
];

/* ---------------------------------------------------------------- c. the FAQs */

export const FAQS = [
  { q: 'Which tab do I want?',
    a: 'If the colours appear together on one screen, use Brand. If each colour has its own '
      + 'world and is never shown beside the others - one per section, one per episode - use '
      + 'Ramps. Use Categories only when a viewer has to tell markers apart at a glance. '
      + 'Emotion is for deciding what a colour should be in the first place.' },
  { q: 'Why does the matrix mirror across the diagonal?',
    a: 'Contrast is symmetric: the ratio between two colours does not depend on which one '
      + 'carries the text. The two halves differ only in which one does, which is why both are '
      + 'drawn - you are seeing the same ratio as light-on-dark and dark-on-light.' },
  { q: 'What counts as large text?',
    a: '18.66px bold, or 24px regular and up. Large text needs 3:1 rather than 4.5:1. Anything '
      + 'smaller is body text, whatever it looks like.' },
  { q: 'It passes 4.5:1 and still looks wrong. Why?',
    a: 'A known limit of the WCAG 2.1 formula: it under-reports how poorly light text on '
      + 'mid-dark backgrounds reads. Treat a marginal pass at 4.6:1 as marginal rather than as '
      + 'a licence. The ratio is exact; what it predicts about legibility is not.' },
  { q: 'How much of each colour should I use?',
    a: 'The Allocation panel in Brand gives a share of visible area per role for a website, a '
      + 'business card and a user manual. 60 30 10 is a starting ratio rather than a rule - what '
      + 'it encodes is that one colour must clearly dominate so the accent has something quiet '
      + 'to be loud against. The production notes cover pantone and cmyk, spot colour, reversed '
      + 'type and what survives a photocopy.' },
  { q: 'Will people with colour vision deficiency tell these apart?',
    a: 'Categories mode simulates the three common forms of colour vision deficiency and '
      + 'reports how many markers each kind of viewer can distinguish. Greyscale is checked '
      + 'too. It is the Vienot projection - indicative and not clinical, but good enough to '
      + 'catch a pair that collapses.' },
  { q: 'Why can five colours only count as three?',
    a: 'Two different hues at the same lightness are identical in greyscale, and several hue '
      + 'pairs merge under common colour blindness. The counts are reported per viewer rather '
      + 'than pooled, so you can see which situation is the limiting one.' },
  { q: 'How do I separate two colours without changing what they mean?',
    a: 'Move lightness, not hue. Hue carries the emotional association; the wheel has no '
      + 'opinion about lightness. Categories mode computes the smallest lightness change that '
      + 'separates a collapsing pair on all three tests, leaving the hue untouched.' },
  { q: 'Is the emotion wheel science?',
    a: 'No, and the app says so wherever it shows one. Colour-emotion association is real but '
      + 'learned, culturally specific, and far weaker than confident marketing wheels suggest. '
      + 'It is also indexed on hue alone, while saturation and lightness move the reading at '
      + 'least as much - which is why this wheel has rings and every reading carries modifiers.' },
  { q: 'Why is a light colour plotted near the middle of the wheel?',
    a: 'Distance from the centre is saturation and nothing else. Lightness is not a direction '
      + 'on the wheel; it is what you see in the dot itself. A pale but strongly tinted colour '
      + 'sits far out, and a dark muted one sits close in.' },
  { q: 'What is a shift suggestion?',
    a: 'When a pair fails, the app offers the smallest shift that fixes it: a change of '
      + 'lightness only, holding hue and chroma, so the corrected colour still reads as the '
      + 'same brand colour. Each one shows the drift from the original so you can judge how '
      + 'far it travelled before you adjust anything.' },
  { q: 'Where do my palettes live?',
    a: 'In this browser, on this device, in local storage. Clearing site data removes them. '
      + 'Use the save icon in the header to write a file you keep yourself.' },
  { q: 'Does anything leave my browser?',
    a: 'No. On privacy there is nothing to configure: no server, no analytics, no tracking, no cookies and no third-party scripts, so nothing is stored anywhere but here and it is safe to put a client palette in. A share '
      + 'link puts the palette in the URL fragment - the part after the # - which browsers '
      + 'never transmit. Whoever you send the link to can of course read it.' },
  { q: 'Can I empty a palette completely?',
    a: 'Yes. Remove every colour if you want to start fresh. The comparisons that need a pair '
      + 'say so and wait; Ramps and Emotion still work on a single colour.' },
  { q: 'What do the detail levels change?',
    a: 'Simple shows the answer, Advanced adds the reasoning, Expert adds the geometry and the '
      + 'search tools. A level only hides - it never changes a value or a verdict.' },
];

/* -------------------------------------------------------- d. the process in words */

export const PROCESS = [
  { n: 1, title: 'Bring the colours in',
    body: 'Type them, paste a list of hex codes, pick from the screen, or open a saved file. '
      + 'The app opens on a demo palette so there is always something to read.' },
  { n: 2, title: 'Ask the question that fits',
    body: 'Brand for colours that share a screen, Ramps for a colour that stands alone, '
      + 'Categories for markers a viewer must tell apart, Emotion for what a colour says. '
      + 'The same palette answers all four differently.' },
  { n: 3, title: 'Read what fails, and why',
    body: 'Every finding is worst-first and says what it measured. Nothing is a verdict on '
      + 'your taste; it is arithmetic about what a reader can see.' },
  { n: 4, title: 'Take the smallest fix',
    body: 'Suggestions move lightness and hold hue, so a correction stays recognisably your '
      + 'colour. The drift figure says how far it travelled.' },
  { n: 5, title: 'Hand it on',
    body: 'A share link for a person, a file for another device, Copy analysis for a '
      + 'conversation where the judgement call gets made.' },
];

/* ------------------------------------------------------ e. mental-model tiles */

export const IDEAS = [
  { label: 'Contrast is symmetric', value: 'Which one is text does not matter',
    hint: 'The ratio between two colours is one number. Swapping which carries the type does '
      + 'not change it - which is why the matrix mirrors, and why a palette of n colours has '
      + 'n(n-1)/2 pairs rather than n squared.' },
  { label: 'Hue carries meaning', value: 'Lightness carries separation',
    hint: 'Change hue and you change what a colour says. Change lightness and you only change '
      + 'whether it can be read or told apart. When those two needs conflict, move lightness.' },
  { label: 'Legible is not distinguishable', value: 'Two different questions',
    hint: 'Two colours can both be perfectly readable and still be the same colour to the '
      + 'viewer. Contrast answers the first; perceptual distance, greyscale and colour vision '
      + 'answer the second.' },
  { label: 'The mid-tone is the useful one', value: 'Usually the one missing',
    hint: 'The band where a colour is dark enough for text on white and light enough for white '
      + 'type on it. Most brand palettes skip it, which is why their accent can only be a fill.' },
];

/* ------------------------------------------------ f. features worth knowing */

export const FEATURES = [
  { label: 'Compare in Brand', where: 'Ramps -> any colour card',
    hint: 'Turns one colour\'s steps into a palette of their own and opens the pairing matrix, '
      + 'so you can see which shades of a single hue work against each other. Your current '
      + 'palette is kept.' },
  { label: 'It uses your ramp', where: 'Ramps',
    hint: 'If a palette is four or more colours sharing a hue across a wide lightness range, '
      + 'the app recognises it and measures your steps rather than inventing its own. A '
      + 'hand-built ramp beats a generated one.' },
  { label: 'Click a dot on the wheel', where: 'Emotion -> the wheel',
    hint: 'Your colours are plotted by name. Clicking one reads that colour rather than the '
      + 'emotion segment behind it - hue, saturation, lightness, and what it signals.' },
  { label: 'Per-viewer counts', where: 'Categories',
    hint: 'Distinguishability is counted per viewer and never pooled. Pooling chains unrelated '
      + 'collapses together and reports a worse number than any real reader experiences.' },
  { label: 'Copy analysis', where: 'Sidebar -> Share and save',
    hint: 'Every measured finding as plain text. The app computes; the judgement about a '
      + 'specific brand is a conversation, and this is the seam between them.' },
  { label: 'Paste anything', where: 'Sidebar -> Palette -> Paste list',
    hint: 'Drop in a stylesheet, an email or a spec and the hex codes are pulled out. It reads '
      + '#abc, #aabbcc, bare six-digit codes and rgb() alike.' },
  { label: 'Eyedropper', where: 'Sidebar -> Palette -> Pick',
    hint: 'In Chrome, take a colour from anywhere on screen - another app, a photo, a website.' },
  { label: 'Share without a server', where: 'Sidebar -> Share and save',
    hint: 'The palette rides in the URL fragment, after the #. Browsers never transmit that '
      + 'part, so the colours reach the recipient without passing through anyone else.' },
  { label: 'Empty is allowed', where: 'Sidebar -> Palette',
    hint: 'Remove every colour to start fresh. The comparisons that need a pair say so and '
      + 'wait, rather than a floor stopping you at two colours you did not want.' },
  { label: 'How this works panels', where: 'Brand, Categories, Emotion',
    hint: 'Each carries the formula worked through with the values currently on screen, not a '
      + 'generic example - so you can check the number rather than take it.' },
];

/* ----------------------------------------------------------------- filtering */

export const filterHowtos = (q) =>
  HOWTOS.filter((h) => guideMatches(`${h.title} ${h.category} ${h.steps.join(' ')}`, q));

export const filterFaqs = (q) => FAQS.filter((f) => guideMatches(`${f.q} ${f.a}`, q));

export const filterFeatures = (q) =>
  FEATURES.filter((f) => guideMatches(`${f.label} ${f.where} ${f.hint}`, q));

export const filterIdeas = (q) =>
  IDEAS.filter((i) => guideMatches(`${i.label} ${i.value} ${i.hint}`, q));

/** How many things a query finds, across every part of the guide. */
export function countMatches(q) {
  return filterHowtos(q).length + filterFaqs(q).length
    + filterFeatures(q).length + filterIdeas(q).length;
}
