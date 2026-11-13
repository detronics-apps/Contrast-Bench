# Skill sync

Built on `detronics-app` **r10**.

## Adopted

- No build step, no dependencies, no network after load
- Pure modules under `js/`, one test file each; UI modules have none
- Tokens for every colour; `css/tokens.css` copied unchanged
- Nothing leaves the browser: localStorage, URL fragment, local files
- LICENSE plus Licence & terms and Imprint & privacy over a pure `js/legal.js`, with a test tying the
  on-screen licence to the LICENSE file and to the README
- Logo links to detronics.co.za, Buy Me a Coffee as an inline SVG cup rather than the emoji, theme
  toggle, version string in the footer
- `data-field` on every control, with `captureFocus` / `restoreFocus` around every render
- Detail levels Simple / Advanced / Expert on their own mode bar above the tabs
- Mode bar, then tabs, with a `segmented__sep` fencing off the help tab
- First-run welcome on a stored flag, never over a share link, re-openable from the footer
- "How to use" tab with FAQs and feature tiles
- Every add has a remove; supplied names are editable
- The model carries a version and a migration from the first commit; every edit returns a new model
- Seeded examples use fixed ids so they cannot double
- Checked at 375 and 1440; 44px touch targets; 16px inputs on narrow; no horizontal page scroll
- `FEATURES.md`, `BACKLOG.md` and `STORY.md` from the first commit

## Skipped, with reasons

- **Interactive mode** — fails the four tests in `references/interactive-mode.md`. No single drawing
  is the subject and nothing in it is dragged. Recorded so it is not proposed again.
- **Achievements, hints, quiz questions** — the audience is doing a job, not learning a subject.
- **Transport, recorder, time graphs** — nothing in this app runs.
- **E-series** — electronics only.
- **`capDiagramScale`** — there is no content-sized diagram to magnify; the wheel is width-driven
  with an explicit `max-width`.

## Deviations worth knowing

- **`.viewport__stage` overridden to `display: block`.** The scaffold's stage is a flex box built to
  centre one diagram. This app stacks document-style sections, and as a flex container the stage
  laid them out in a row: panels squeezed to 336px and sections pushed off the left edge. The
  override is in `css/app.css` with the reason beside it. Worth folding back into the skill as a
  second stage variant.
- **`.claude/launch.json` uses `npx serve`, not `python`.** The scaffold assumes Python is on PATH
  and it is not on this machine.
- **`js/units.js`, `js/eseries.js` and `js/format.js` deleted.** The scaffold vendors all three.
  Nothing in a colour app parses engineering notation or snaps to a preferred-value series, and the
  formatter was unused too. Dead code in a repo somebody else reads is a cost, so they went, along
  with their 30 tests. Re-copy from the skill if a later feature needs one.

## Pitfall audit (pitfalls.md, read 2026-11-13)

Checked this app against all 26. Three were live and are fixed; the rest either do
not apply or were already right.

**Were live, now fixed**

- **14 / 21 - a caller's default overriding remembered UI state.** Collapsing a
  sidebar section and then editing anything sprang it back open: `open` was being
  re-applied on every render and the reader's choice was never stored. Measured
  before the fix (`afterClosing: false` then `afterARender: "true"`). Sections now
  read `state.ui.sections[id]`, treat an absent key as "never set" so a stored
  `false` survives, and save without re-rendering.
- **25 - literal non-ASCII in source.** The theme glyph line had been rewritten
  into literal characters at some point, including the invisible U+FE0E variation
  selector - exactly the fragility the pitfall describes, one rewrite from being
  lost. All glyphs now come from `GLYPH`/`ch()` in `js/ui/dom.js`, built from code
  points, and no file of mine carries a literal non-ASCII character.
  *Deviation:* the skill asks for `\uXXXX` escapes. The editor tooling here decodes
  those back into literals on write, so `String.fromCharCode` buys the same
  guarantee and nothing can normalise it away.
- **7 / 4 - SVG text outside the viewBox.** Wheel labels were clipped at both
  sides; the viewBox is now wider than the wheel and a `getBBox` check confirms
  nothing overhangs.

**Checked and already right**

- 2 flex children shrinking (`.viewport > *` is `flex: 0 0 auto`, from the house layout)
- 8 state migrations (versioned model, migration, `pick()` drops undefined, tested)
- 9 raw floats in prose (tests reject `\d+\.\d{4,}` in every findings string)
- 23 seeded examples doubling (fixed ids, tested)
- 24 a list inside children (the scaffold's `append()` flattens)

**Not applicable**

- 3 canvas magnification, 5 lead gaps, 6 arrowheads, 10 label collision by
  construction (the wheel staggers colliding plot labels), 11 absolute epsilon,
  12 axis rounding, 13 build-time flags, 17 NaN defaulting chains, 18-20 drawn
  geometry invariants - this app draws no mechanism.

**Skipped, with the reason**

- **26 - a source-level test for calls to names that are never imported.** Written
  and then removed: it produced 20 false positives on this codebase because the
  detector cannot see object-literal method shorthand (`setActive(id) {` inside
  the `ctl` object) or hex codes inside strings. Making it accurate needs a real
  parser. A test with 20 false alarms is turned off within a week, which is worse
  than not having one, so this app relies on the runtime error banner and the
  browser pass that drives every tab instead.
