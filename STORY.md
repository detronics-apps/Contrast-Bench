# Story

## The angle

Every contrast checker answers the same small question: these two colours, what is the ratio. That
question is worth answering and it is nowhere near the whole job. A palette has to survive three
different interrogations, and two of them are not about contrast at all: whether a viewer can tell
two colours apart, and what the colours are saying before anybody reads a word.

The app came out of a real session. A brand palette that measured fine and felt wrong. A content
palette where two categories kept reading as one. And the discovery that those are different
failures needing different maths.

## Who it is for

Somebody who owns a palette and has to defend it: a founder, a designer, a one-person brand. People
who already chose their colours for reasons, and now need to know where those reasons break.

## Who it is not for

Not an accessibility auditor. It reports WCAG 2.1 exactly and certifies nothing. Not a palette
generator either: it judges what you bring rather than inventing something new.

## What it takes into account

Contrast under WCAG 2.1, including that formula's known weakness with light text on mid-dark
grounds. Perceptual distance in OKLab. Greyscale collapse. The three common dichromacies. Hue,
saturation and lightness separately, because they carry different parts of the message. Where a
colour sits in the palette's own geometry. And production reality: photocopies, process inks,
reversed type, ISO 3864.

## How it compares

Checkers give you a ratio. Palette generators give you colours. Contrast grids give you a matrix.
None of them tell you that your five content categories are two to a colour-blind viewer, or that
the reason two of them collapse is that the emotions you picked them for are neighbours on the
wheel.

## What a reader takes away even if they never use it again

- Contrast is symmetric. Which colour carries the text does not change the ratio.
- Two different hues at the same lightness are the same colour in greyscale. That is the most common
  way a category palette fails.
- Hue carries the emotional association; lightness carries the separation. When two categories must
  keep their meanings but cannot be told apart, move lightness.
- Colour-emotion association is real, learned, and far weaker than the wheels suggest. Saturation
  and lightness move it at least as much as hue does.
- A palette's most useful colour is usually the mid-tone it does not have.

## What to watch going forward

Whether WCAG 3 and APCA stabilise enough to show alongside 2.1 without muddling the conformance
story. Whether image-drop makes channel mode the primary way in.

## How it was made

Domain first: nine pure modules and their tests, 147 cases green before a line of UI existed. Two of
my own stated figures turned out to be wrong and the tests caught both: a contrast value attributed
to the wrong hex, and a distinguishability count that chained unrelated collapses into nonsense.

## Recording beats

1. Two colours, one ratio. The question everybody already answers.
2. The same palette in channel mode: five categories, two distinguishable. The reveal.
3. Why: greyscale, then each colour blindness, as swatch rows going flat.
4. The wheel. Pick the emotion each colour was chosen for, and watch two of them land side by side.
5. The fix that keeps the meaning: hold the hue, move the lightness.
6. Copy analysis. The seam between what a program decides and what a person does.
