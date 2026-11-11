# Backlog

What is to come, and what was deliberately left out.

## Agreed, not yet built

### Image drop: extract a palette from a screenshot

Drag an image in; quantise it to its dominant colours. Not AI, roughly 50 lines of canvas work.
Motivated by analysing a channel palette that only existed as a PNG.

Tasks: file and drag input, downscale to a thumbnail, median-cut or k-means, dedupe near-identical
swatches, let the user drop the ones they do not want before they land in the palette.

### SVG and PNG export of the matrix and the wheel

Needed for slides and for video. The wheel already contains no `var(--)` so it is export-ready; the
matrix needs its tokens inlined first, and the export must assert the serialised SVG is token-free.

### Print sheet

`css/print.css` is still the scaffold's. It must print the palette as well as the verdict: a sheet
showing an answer without its inputs is one nobody can check.

## Considered and left out, with reasons

**A Claude skill wrapping this app.** The maths is deterministic, so putting it behind a language
model costs tokens and usage limits and risks arithmetic errors. The judgement layer already works
by talking, with Copy analysis as the seam. A skill would be maintenance for something already free.

**Interactive mode, the full-screen drawing.** Fails the four tests: there is no single drawing that
is the subject, and nothing in the matrix is dragged. The wheel is the closest candidate but it is a
chooser, not a canvas.

**Achievements and multiple-choice questions.** This serves somebody doing a job, not somebody
learning a subject. Quizzing a designer on contrast thresholds is condescension.

**Transport, recorder, graphs against time.** Nothing in this app runs.

**E-series snapping.** Electronics only; there is no preferred-value series for colour.

**APCA alongside WCAG 2.1.** Tempting, because 2.1 genuinely under-reports light text on mid-dark
grounds. But 2.1 is what gets audited, and showing two disagreeing numbers without a conformance
story attached would confuse more than it helps. Revisit if WCAG 3 stabilises.
