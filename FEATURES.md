# Features

What actually made it into the app, why, and what was decided against.

## Intent

Most contrast checkers compare two colours and print a number. That answers the smallest question a
palette faces. This app exists because three different questions kept coming up about the same set
of colours, and only one of them is about contrast:

- can this colour carry text on that one?
- can a viewer tell these two apart?
- what is this colour saying?

They need different maths and they disagree with each other, which is the interesting part.

## Core philosophy

**Measure, then judge, and keep the two apart.** Every number here is deterministic and has a right
answer. Interpretation is not, so the app computes and offers "Copy analysis" rather than pretending
to decide. Anything modelled rather than measured says so in the same breath.

**The tool must not plant a misconception.** The emotion wheel is popular and overstated. Building
it unqualified would teach something that has to be unlearned later, so every reading carries its
modifiers, and the wheel has three saturation rings because the flat version hides the thing that
moves the reading most.

**Both accounts can be true.** A colour can be right on its own and wrong in a set. The app holds
both views rather than resolving them on your behalf.

## Features

### Brand mode, the pairing matrix

**Why:** a grid of ratios is unreadable; a grid of actual pairings is obvious.
**Purpose:** each cell renders the real combination, so the matrix *is* the preview.
**Decisions:** rows are text, columns are background, and the grid mirrors because contrast is
symmetric; the two halves differ only in which colour carries the type. Statistics use the 28 unique
pairs rather than the 64 cells, so nothing is double counted.
**Show it:** the Detronics palette, Brand tab.

### Shift suggestions

**Why:** "this fails" is half an answer.
**Purpose:** the smallest change that makes a failing pair pass.
**Decisions:** the move is always lightness in OKLCh, holding hue and chroma, because that is the one
axis that keeps the result recognisably the same brand colour. Stepping rather than bisecting:
contrast is not monotonic in lightness, so a bisection finds the wrong crossing or none.
**Decided against:** proposing arbitrary nearby colours. A correct suggestion nobody will adopt is
not a suggestion.

### Channel mode, per-viewer distinguishability

**Why:** a brand palette and a category palette are judged on different questions.
**Purpose:** how many categories a viewer can actually tell apart, in colour, in greyscale, and under
each of the three common forms of colour blindness.
**Decisions:** counted per scenario and never pooled. The first version unioned them and chained
unrelated collapses together, reporting 1 of 5 for a palette with no collapsing pairs at all. A
viewer is one person in one context.
**Show it:** Content families palette, Channel tab. Tritanopia is the limiting case.

### Emotion wheel, and the inversion

**Why:** the emotion a colour communicates is usually the reason it was chosen.
**Purpose:** read a colour's conventional association, and work backwards from an intent to colours
that carry it and also pass contrast.
**Decisions:** twelve anchors at 30 degree spacing. Three saturation rings rather than one flat
wheel, because saturation and lightness move the reading at least as much as hue. Every reading
carries its caveat, and the caveat is not droppable; a test asserts it.
**Decided against:** stating any of it as a measured effect.

### Separate by lightness

**Why:** when two categories collapse but each was chosen for its meaning, changing hue destroys the
reason the colour exists.
**Purpose:** the smallest lightness change that separates a pair on all three tests, hue untouched.
**Decisions:** returns null rather than a bad answer. Some pairs genuinely need a different
distinction rather than a different shade, and saying so is the useful result.

### Allocation by medium

**Why:** 60/30/10 is a starting ratio people quote without the reasoning.
**Purpose:** share of visible area per role for a website, a business card and a user manual, each
with its production notes.
**Decisions:** roles the palette cannot fill are dropped and the remainder renormalised, so the
figures always total 100. The card deliberately inverts the website.

### Emotion inside the standard analysis

**Why:** requested directly. The message a colour sends is as much a property of it as its contrast.
**Purpose:** every colour's geometry carries its emotional reading, and the palette gets an overall
register weighted by chroma.
**Decisions:** reported from the chromatic colours only. An all-neutral palette returns null rather
than an invented message.

### Named palettes

**Why:** comparing a current brand against a revised one is the actual workflow.
**Purpose:** several palettes side by side, switchable, saved per device.
**Decisions:** the model carries a version and a migration from day one, and every edit returns a new
model rather than mutating one. Seeded palettes use fixed ids so two loaders cannot double them.

### Copy analysis

**Why:** the seam between what a program should do and what a conversation should do.
**Purpose:** every measured finding as plain text, for pasting where the judgement call gets made.
**Decisions:** this is the whole integration. No API, no key, no running cost.
