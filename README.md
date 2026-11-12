# Detronics Contrast Bench

A browser tool for judging colours three ways: whether they can carry text, whether a viewer can
tell them apart, and what they are likely to communicate.

**Live:** https://detronics-apps.github.io/ContrastBench/

## What it does

Most contrast checkers compare two colours and print a number. This one asks the three questions a
palette actually has to survive.

**Brand — can this colour carry text on that one?**
Every colour measured against every other under WCAG 2.1: a pairing matrix where each cell renders
the real combination, the five conformance criteria per pair, per-colour reach, and the smallest
lightness shift that fixes a failing pair while holding its hue. Plus the geometry — lightness
voids, crowding, redundant pairs, hue spread — and allocation percentages for a website, a business
card and a user manual.

**Channel — can a viewer tell these apart?**
For content pillars, chart series, status tiers, map regions. Contrast does not answer this: two
colours can both be perfectly legible and still be the same colour to the reader. Checks perceptual
distance, greyscale collapse, and the three common forms of colour blindness — then reports how many
categories each kind of viewer can actually distinguish, counted per viewer rather than pooled.

**Emotion — what is this saying, and what should it be saying?**
The twelve-anchor wheel, with your palette plotted on it. Works backwards too: pick what you want to
communicate and it shows the usable range for that hue, flagging which swatches can carry text on
light grounds, which on dark, and which are fills only.

The three connect. If two categories collapse but each was chosen for its meaning, the app finds the
smallest **lightness** change that separates them — because hue carries the emotion and the wheel has
no opinion about lightness.

## Running it

```bash
npx serve -l 8847 .
```

Any static server works; there is nothing to build.

## Tests

```bash
npm test
```

Node's built-in runner, nothing to install. Every pure module under `js/` has a matching
`tests/<name>.test.js`; UI modules have none by design.

## Deploying

Push to `main`, then **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
`.nojekyll` is already present. Every push republishes in about a minute. The footer carries a
version string — read it before investigating a bug, in case Pages is still serving the old build.

## Code layout

```
index.html           the shell; everything else is built by JS
css/tokens.css       the palette as light/dark custom properties
css/app.css          this app's components
js/color.js          sRGB, WCAG luminance, OKLab/OKLCh, gamut mapping, CVD simulation
js/wcag.js           conformance thresholds, grading, palette summary, reach
js/suggest.js        minimal-shift fixes
js/palette.js        geometry, roles, findings, recommendations
js/channel.js        category separation, per-viewer distinguishability
js/emotion.js        the wheel, the inversion, separate-by-lightness
js/allocation.js     per-medium share of visible area
js/legal.js          licence, privacy and accuracy text
js/state.js          versioned model, named palettes, migration, sharing
js/ui/               DOM only - nothing above this line touches the browser
tests/               one file per pure module
```

Everything under `js/` except `js/ui/` is pure: no DOM, no globals, no `window`. That is what lets
the arithmetic be tested without a browser.

## Privacy

Nothing leaves your browser. There is no server, no analytics, no cookies and no third-party
scripts. Palettes are kept in this browser's local storage on this device only. A share link encodes
the palette in the URL **fragment** — the part after the `#` — which browsers never transmit to a web
server. Saving writes a file to your own disk.

## Accuracy

**Exact:** contrast ratios. The WCAG 2.1 definition is arithmetic, and black on white returns 21.00
to the digit. Figures here match any other conforming checker.

**A known limit of that formula**, worth carrying: it under-reports how poorly light text on
mid-dark backgrounds reads. Treat a marginal pass at 4.6:1 as marginal, not as a licence.

**Modelled:** perceptual distance uses OKLab, which is a good model of how different two colours look
but still a model. The thresholds separating "collapses" from "distinct" are working conventions
chosen so the tool is useful, not thresholds from a standard.

**Indicative:** colour-blindness simulation uses the Viénot single-plane projection. It models the
three common dichromacies, not anomalous trichromacy, and real severity varies between people. It is
good enough to catch a pair that collapses; it is not a clinical result.

**Convention, not measurement:** the emotional associations and the allocation percentages. Colour
emotion is real but learned, culturally specific, and far weaker than confident marketing wheels
suggest — and it is moved at least as much by saturation and lightness as by hue, which is why every
reading here carries its modifiers and why the wheel has three rings rather than one.

## Licence

MIT. See [LICENSE](LICENSE).
