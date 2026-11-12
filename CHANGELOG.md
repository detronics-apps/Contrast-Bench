# Changelog

## 0.3.0

**Restyled to the house.** `css/components.css` and `css/layout.css` are now copied verbatim from
Bench-Calculator rather than hand-written, and `css/app.css` holds only components this app alone
needs. The chips are pills again, the tab bar is a real `.segmented` with a raised active chip,
buttons use `--radius` and `--accent-strong`, body type is 14px/1.5, and the mode bar and tabs live
inside `.viewport` where the column's own `gap` spaces them.

**Ramps, a new mode.** One colour at a time, against its own shades and tints and the neutrals.
This is the right question for a palette whose colours never appear together - judging those
against each other invents a conflict that does not exist on screen.

**Demo palettes, not real ones.** The app ships two demonstration palettes built to fail
instructively. Nobody's actual brand is published with the tool.

**Per-viewer distinguishability.** Category counts are no longer pooled across viewers.

## 0.2.0

Brand, Categories and Emotion modes. Nine pure modules, tests before UI.
