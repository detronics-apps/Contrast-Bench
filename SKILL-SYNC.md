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
