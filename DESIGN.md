---
name: EventPass
description: A near-monochrome operations instrument that speaks in one typeface and reserves every saturated colour for a state it is reporting.
colors:
  # Neutral ramp — hue 260 at very low chroma. Never pure gray. Light-mode
  # canonical; `.dark` re-points the same names in app/globals.css.
  background: "oklch(0.994 0.002 260)"
  foreground: "oklch(0.17 0.013 260)"
  card: "oklch(1 0 0)"
  muted: "oklch(0.967 0.004 260)"
  muted-foreground: "oklch(0.505 0.016 260)"
  accent: "oklch(0.955 0.006 260)"
  border: "oklch(0.916 0.005 260)"
  primary: "oklch(0.21 0.015 260)"
  primary-foreground: "oklch(0.985 0.002 260)"
  ring: "oklch(0.6 0.09 200)"
  sidebar: "oklch(0.975 0.004 260)"
  sidebar-accent: "oklch(0.93 0.008 260)"
  # Brand / informational family — hue 200. Also aliased as `info-*`.
  brand: "oklch(0.5 0.088 200)"
  brand-foreground: "oklch(0.99 0.004 200)"
  brand-text: "oklch(0.45 0.08 200)"
  brand-subtle: "oklch(0.965 0.019 200)"
  brand-border: "oklch(0.87 0.048 200)"
  # Accepted / confirmed / delivered — hue 150.
  success: "oklch(0.49 0.112 150)"
  success-foreground: "oklch(0.99 0.005 150)"
  success-text: "oklch(0.44 0.105 150)"
  success-subtle: "oklch(0.965 0.024 150)"
  success-border: "oklch(0.875 0.052 150)"
  # Duplicate / transient failure / low-confidence clock — hue 75.
  warning: "oklch(0.76 0.145 75)"
  warning-foreground: "oklch(0.24 0.045 75)"
  warning-text: "oklch(0.46 0.098 75)"
  warning-subtle: "oklch(0.97 0.032 75)"
  warning-border: "oklch(0.87 0.072 75)"
  # Invalid / canceled / permanent failure / irreversible action — hue 27.
  destructive: "oklch(0.515 0.192 27)"
  destructive-foreground: "oklch(0.99 0.005 27)"
  destructive-text: "oklch(0.475 0.186 27)"
  destructive-subtle: "oklch(0.965 0.021 27)"
  destructive-border: "oklch(0.875 0.058 27)"
  # Offline acceptance / pending authority — hue 265. A first-class outcome.
  provisional: "oklch(0.485 0.155 265)"
  provisional-foreground: "oklch(0.99 0.004 265)"
  provisional-text: "oklch(0.45 0.15 265)"
  provisional-subtle: "oklch(0.965 0.025 265)"
  provisional-border: "oklch(0.875 0.062 265)"
  # Signal pair — identical in light and dark by contract. Scanner outcomes only.
  signal-success: "oklch(0.945 0.055 150)"
  signal-success-text: "oklch(0.37 0.1 150)"
  signal-warning: "oklch(0.95 0.068 75)"
  signal-warning-text: "oklch(0.39 0.095 75)"
  signal-destructive: "oklch(0.945 0.045 27)"
  signal-destructive-text: "oklch(0.4 0.17 27)"
  signal-provisional: "oklch(0.945 0.05 265)"
  signal-provisional-text: "oklch(0.38 0.145 265)"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 560
    lineHeight: 1.0833
    letterSpacing: "-0.025em"
    fontFeature: '"cv05" 1, "cv08" 1'
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 560
    lineHeight: 1.1111
    letterSpacing: "-0.023em"
  outcome:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1111
    letterSpacing: "-0.023em"
  subhead:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.4444
    letterSpacing: "-0.014em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.011em"
    fontFeature: '"cv05" 1, "cv08" 1'
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4286
    letterSpacing: "-0.006em"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3333
    letterSpacing: "0.002em"
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4286
    letterSpacing: "0.08em"
rounded:
  control: "0.375rem"
  container: "0.75rem"
  overlay: "1rem"
  full: "9999px"
spacing:
  2xs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
  section: "5rem"
  section-lg: "7rem"
components:
  button-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.25rem"
  button-default-hover:
    backgroundColor: "oklch(0.21 0.015 260 / 0.8)"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "{colors.destructive-subtle}"
    textColor: "{colors.destructive-text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.25rem"
  button-destructive-solid:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.25rem"
  badge-success:
    backgroundColor: "{colors.success-subtle}"
    textColor: "{colors.success-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  badge-provisional:
    backgroundColor: "{colors.provisional-subtle}"
    textColor: "{colors.provisional-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  input:
    backgroundColor: "oklch(0.916 0.005 260 / 0.5)"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.overlay}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  nav-item-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 0.625rem"
    height: "2.25rem"
  scan-outcome-success:
    backgroundColor: "{colors.signal-success}"
    textColor: "{colors.signal-success-text}"
    typography: "{typography.outcome}"
    padding: "2.5rem 1.5rem"
  scan-outcome-provisional:
    backgroundColor: "{colors.signal-provisional}"
    textColor: "{colors.signal-provisional-text}"
    typography: "{typography.outcome}"
    padding: "2.5rem 1.5rem"
  ticket-code:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.code}"
---

# Design System: EventPass

## Overview

**Creative North Star: "The Control Desk"**

EventPass is an instrument, not a publication. It is the surface a club organizer
configures an event on, and the surface a volunteer stares at across a lit
gymnasium with a queue behind them — and those are the same product, drawn from
the same tokens, speaking in the same voice. The system is deliberately quiet:
near-monochrome neutrals on flat surfaces separated by hairlines, with no
gradient, no ornament, and no second typeface competing for the eye. Everything
saturated in this product is a report about the world, not a decoration on it.

The system speaks with **one voice**. Inter — variable, loaded once — carries
headlines, body copy, tables, forms, buttons, and every scanner string. There is
no display face and no `--font-heading` token; hierarchy is built from size,
weight, and spacing, which is the only hierarchy that survives a dense table.
Optical treatment is not a per-component decision: leading and letter-spacing are
bound to every step of the type scale in `@theme inline`, so a component that
sets `tracking-*` or `leading-*` is overriding a decision that was already made
correctly. Geist Mono is narrowed to a single job — strings a human types, reads
aloud, or compares character by character.

Colour discipline is the system's other load-bearing rule. Five hue families
exist, each carrying the same five roles, and each appears **only** where the
product is reporting a state: accepted, not yet confirmed, repeated, refused. The
brand hue survives as focus ring, selection, and informational register — never
as brand paint. The distinction the product exists to draw is that an offline yes
is not a confirmed yes, so `provisional` is a first-class outcome with its own
hue, never a shade of success. Every pair is verified against WCAG 2.2 AA by
`app/globals.contrast.test.ts`, which fails the build when a token drifts.

**Key Characteristics:**

- One typeface (Inter) across marketing, organizer, scanner, and attendee surfaces
- Near-monochrome neutrals, flat, region boundaries drawn with 1px hairlines
- Saturated colour only where a state is being reported; never decorative
- Five hue families, five roles each, machine-audited for contrast in both themes
- Scanner outcome surfaces pinned identical in light and dark
- Unmodified shadcn primitives; every value from a global token
- Exactly one authored animation in the entire product

## Colors

Near-monochrome by default, with five saturated families held in reserve for the
moment the product has something to say about state.

### Primary

- **Ink** (`{colors.primary}`): The strongest action in any region — the default
  button, the sidebar's active identity. Near-black in light mode, near-white in
  dark. The strongest thing on screen is defined by *contrast*, not hue, so a
  primary button can never be mistaken for a status.
- **Instrument Teal** (`{colors.brand}`, hue 200): Product identity and the
  informational register, which are deliberately the same register — `info-*` is
  an alias of `brand-*`, not a sixth family. It appears as the focus ring, text
  selection, and informational badges. It is never used as a fill for decoration.

### Secondary

The four state families. Each is a *meaning*, not a palette slot.

| Family | Hue | Meaning |
|---|---|---|
| `success` | 150 | Accepted, confirmed, delivered, fully synchronized |
| `warning` | 75 | Duplicate, transient failure, low-confidence clock, auto-resolved conflict |
| `destructive` | 27 | Invalid, canceled, permanent failure, unresolved conflict, irreversible action |
| `provisional` | 265 | Offline acceptance, pending authority, snapshot in use |

- **Admitted Green** (`{colors.success}`): A scan that is settled.
- **Held Amber** (`{colors.warning}`): Something happened that a human should
  look at before acting — a repeat scan, a door not yet open.
- **Refused Red** (`{colors.destructive}`): A no, and the vocabulary of
  irreversible organizer actions.
- **Unconfirmed Indigo** (`{colors.provisional}`): The most important colour in
  the product. An acceptance saved on a volunteer's phone and not yet landed.

### Tertiary

- **Signal Surfaces** (`{colors.signal-success}`, `{colors.signal-warning}`,
  `{colors.signal-destructive}`, `{colors.signal-provisional}`): High-luminance
  tints used by the full-screen scan outcome and nowhere else. They are declared
  once under `:root, .dark` and are byte-identical in both themes. Their text
  partners (`{colors.signal-success-text}` and siblings) are pinned with them.

### Neutral

- **Cool Paper** (`{colors.background}`) / **Cool Slate** (`{colors.foreground}`):
  Page ground and ink. The whole ramp carries hue 260 at chroma ≈ 0.005 and is
  never pure gray; the contrast audit asserts a non-zero chroma on every neutral.
- **Panel White** (`{colors.card}`): Raised regions and popovers in light mode.
- **Quiet Field** (`{colors.muted}`) / **Quiet Ink** (`{colors.muted-foreground}`):
  Alternating sections, secondary metadata, table subtext.
- **Hairline** (`{colors.border}`): The system's structural element. Every region
  boundary, table divider, and section rule.
- **Rail** (`{colors.sidebar}`, `{colors.sidebar-accent}`): The organizer
  navigation rail and its active row, one step off the page ground.

### Token shape

Every hue family provides the same five roles, so a component can switch families
without switching vocabulary:

- `--{family}` — solid fill
- `--{family}-foreground` — text and icons on that solid fill
- `--{family}-text` — accessible text on `--background` and on `--{family}-subtle`
- `--{family}-subtle` — tinted surface for inline alerts, badges, and rows
- `--{family}-border` — border paired with the subtle surface

### Named Rules

**The Colour Is State Rule.** Saturated colour appears only where the product is
reporting something the user must act on. There is no accent fill, no coloured
hero, no tinted section for visual interest. If you cannot name the state a
colour is reporting, it does not belong on the screen.

**The Two Kinds of Yes Rule.** `provisional` never renders in the colour of
`success`. An offline acceptance is a qualified yes and must be distinguishable
at a glance, across a room, from a confirmed one. Audit test: remove the labels
from two adjacent outcomes and you can still tell a confirmed check-in from an
unconfirmed one.

**The Pinned Signal Rule.** Scan outcome surfaces use the `signal-*` pair and are
identical in light and dark. Ambient venue light beats theme preference at a
door; a rejection rendered as dark red on black is unreadable in a lit gym. Any
subtree carrying a signal surface also carries `.signal-surface`, which re-points
the neutral tokens to their light values so a control rendered inside it is not a
near-black button on a mint background.

**The Audited Palette Rule.** No colour ships without a corresponding pair in
`app/globals.contrast.test.ts`. The suite verifies both themes against WCAG 2.2
AA (4.5:1 text, 3:1 focus indicator), asserts every neutral carries a tint,
asserts the five hues stay ≥ 35° apart, and fails the build if any saturated
violet reappears from the stock preset.

**The Never-Colour-Alone Rule.** Every outcome pairs its colour with an icon and
a concise label, and on the scanner with optional sound and vibration. Strip all
colour from any screen and it must remain fully usable.

**The Derived Literals Rule.** Hex values exist only where the platform will not
read a custom property, and every one of them is the sRGB conversion of a token
rather than a colour someone chose:

- `app/manifest.ts` — `theme_color` and `background_color`, both `#fcfdfe`.
- `app/layout.tsx` — the media-scoped `themeColor` pair, `#fcfdfe` light and
  `#090c11` dark. These two are `--background` in each theme; a theme-colour
  that has drifted from the page puts a visibly different band above the
  content on a phone.
- `app/opengraph-image.tsx` — Satori resolves neither custom properties nor the
  font variables, so the card restates `--foreground`, `--background`,
  `--muted-foreground` and `--border` and fetches Inter itself.
- `lib/email/shell.ts` — one exported style string, since an email client reads
  no stylesheet of ours. It carried `#171717`, a pure neutral the palette does
  not contain, until this pass.

A hex literal anywhere else, or one in these files that no longer matches its
token, is drift. Re-derive them when a token moves.

## Typography

**Display Font:** none. There is no display face in this product.
**Body Font:** Inter (variable, `--font-inter`; `ui-sans-serif, system-ui` fallback)
**Label/Mono Font:** Geist Mono (`--font-geist-mono`, weights 400 and 500 only)

**Character:** One instrument, played across its full range. Inter is variable,
so a page title can sit at weight 560 — between the nine standard stops, where
600 goes blunt and 500 goes weak — without loading a second file. It runs with
`cv05` and `cv08` enabled globally so `Il1` in an attendee name cannot collapse
into three identical strokes, the same disambiguation logic the Crockford Base32
ticket alphabet is built on. Geist Mono is not a texture; it is a legibility tool
for strings a person dictates down a phone.

### Hierarchy

- **Headline** (560, `3rem` → `4.5rem` responsive, line-height 1.0833): The one
  page title per surface. Applied with `font-headline`, which resolves to
  `--font-weight-headline: 560`.
- **Title** (560, `2.25rem` → `3rem`, line-height 1.1111): Section headings on
  public surfaces.
- **Outcome** (600, `2.25rem` → `3rem`): Reserved for the scanner's resolved
  outcome headline. `font-semibold` exists in this system for one reason — to
  punch across a lit room — and is not the weight for ordinary headings.
- **Subhead** (500, `1.125rem`): Supporting paragraphs beneath a headline, and
  step titles. Body prose caps at roughly 65–75 characters (`max-w-xl` /
  `max-w-md`).
- **Body** (400, `1rem`, line-height 1.5): Default running text.
- **Reading** (400, `1rem`, line-height 1.75, `text-reading`) and **Support**
  (400, `0.875rem`, line-height 1.7143, `text-support`): the same two sizes
  opened up for prose that runs to several lines. A roster cell and the
  paragraph explaining what a roster is are both 14px and want different
  leading; without these steps thirty components each patched the scale
  locally with `leading-6`.
- **Label** (500, `0.875rem`): Buttons, navigation items, table headers, badges
  above caption size, and every control string.
- **Caption** (400, `0.75rem`): Metadata, timestamps in lists, helper text.
- **Code** (500, `0.875rem`–`1.5rem`, letter-spacing `0.08em` via
  `tracking-code`): Ticket codes, event slugs, identifiers, timestamps, and
  operational figures in stat positions.

### Named Rules

**The One Voice Rule.** Inter carries every heading, control, table cell, and
door decision. There is no display face, no `--font-heading`, and no second
family introduced for tone. Arm's-length legibility in bright light is a safety
property; nothing decorative may touch it.

**The Bound Optics Rule.** Leading and letter-spacing are properties of a size,
not decisions to re-make per component. Both are declared on every step of the
`--text-*` scale, so `text-4xl` already knows it wants line-height 1.1111 and
tracking -0.023em. A `tracking-*`, `leading-*`, or `text-[...]` class in a
product component is a bug — the scale is wrong, fix it there. That is not a
figure of speech: thirty components had each written `text-sm leading-6`, which
was the scale missing a reading register rather than thirty separate mistakes,
and the fix was two new steps. `app/design-rules.test.ts` enforces this across
`app/` and `features/`; `components/ui/` is exempt because those primitives are
deliberately unmodified.

**The Mono Is For Dictation Rule.** Geist Mono appears on ticket codes, event
slugs, web addresses, identifiers, and timestamps: text a human types, reads
aloud, or compares character by character. It never carries prose, headings,
labels, or a "technical" mood.

**The Sentence Case Rule.** Sentence case throughout, with concrete status
language: "Checked in", "Already checked in", "Ticket not found". No uppercase
tracking-out labels, no eyebrows or kickers above headings — a heading that needs
a label above it to be understood is the wrong heading.

## Layout

**One measure.** Public and workspace content share a `max-w-6xl` (72rem) column
with `1rem` gutters that open to `1.5rem` at `sm`. Table-heavy organizer sections
may run wider; nothing runs narrower for effect.

**Section rhythm.** Public sections stack vertically, each closed by a full-bleed
`border-b` hairline rather than a gap or a colour change. Vertical padding runs
`5rem` (`py-20`), opening to `7rem` at `sm`. A section's internal blocks separate
at `2.5rem`–`3rem`; content groups within a block at `1rem`–`1.5rem`; label-to-value
pairs at `0.25rem`–`0.5rem`.

**Asymmetric editorial grids for prose-plus-artifact pairs.** Where a heading and
its paragraph sit beside a rendered product surface, the split is intentionally
uneven — `0.9fr 1.1fr` and `0.62fr 1.38fr` — so the artifact leads and the copy
supports. These collapse to a single column below `lg`.

**Density is a register, not a different system.** Organizer surfaces pack tighter
(`py-3` list rows, `p-5`/`p-6` panels); attendee and scanner surfaces open up
(`p-6`/`p-8`, `py-10`). Same tokens, same components, different scale.

**Responsive behaviour is priority-preserving, never shrink-to-fit.** The
organizer rail is a persistent `16rem` sidebar at `lg` and a full-height drawer
below it — never a horizontal scroller with hidden sections. The ticket flips its
column order on mobile so the QR renders first while the DOM keeps the event name
ahead of it for screen readers. Tables preserve priority information on narrow
screens rather than compressing a desktop layout past usability.

**Scanner touch targets are at least 44 × 44 CSS pixels.**

### Named Rules

**The Hairline Rhythm Rule.** Space separates things that belong together; a
hairline separates things that don't. Reach for `border-b` / `divide-y` before
reaching for a bigger gap, and never for both at full strength.

## Elevation & Depth

**This system is flat.** Depth is carried by a 1px hairline in `{colors.border}`
and by one step of tonal shift (`{colors.background}` → `{colors.muted}` →
`{colors.card}` / `{colors.sidebar}`). Regions are established by borders and
dividers, not by lifting. Across the entire product there are exactly four
shadowed elements, and all four are things that genuinely pass over content: the
alert dialog, the admin action dialog, the select popup, and the mobile
navigation drawer.

### Shadow Vocabulary

- **Overlay** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`,
  Tailwind `shadow-xl`): The only shadow in the system. Dialogs, popovers, menus,
  and the navigation drawer. Dialogs pair it with a `ring-1` in
  `foreground/5` (`foreground/10` in dark) so the edge stays defined against a
  dark backdrop.
- **Scrim** (`--scrim`, `bg-scrim`): Behind modal surfaces. Not a shadow, but
  the same job — it signals that what's beneath is inert. Pinned to the *light*
  ink at 45% in both themes rather than tracking `--foreground`, which inverts:
  a 45% near-white veil over a dark page lightens what it is meant to push
  back. Two dialogs had each reached for a raw `black` to dodge that.

### Named Rules

**The Flat-By-Default Rule.** Decorative elevation is not permitted. A shadow
appears only where an element physically passes over content that remains
present. If the thing beneath it is gone, so is the shadow.

**The One Region Rule.** Related controls and data share one bordered region with
internal dividers. Do not wrap every content group in an independent floating
card — that assembles a dashboard out of confetti and is a named product
anti-reference.

## Shapes

**Three radii, named by role, and nothing else:**

- **Control** (`0.375rem`): Buttons, chips, small controls, sidebar navigation
  rows, the ticket's QR chamber.
- **Container** (`0.75rem`): Regions, panels, table shells, the ticket body, the
  operations frame.
- **Overlay** (`1rem`): Dialogs, popovers, menus, and the shadcn text field.

The legacy Tailwind scale names are mapped onto these three in `@theme inline`
(`rounded-md` → control, `rounded-lg`/`rounded-xl` → container, `rounded-3xl` →
overlay) so stock shadcn markup conforms without a sweep. **Prefer the role names
in new code.**

`rounded-full` is permitted for exactly three things: status chips and badges,
avatars and dots, and progress meters.

**Borders are the system's primary form.** Every surface edge is a 1px hairline;
regions do not fade, blur, or glow into one another. The printed ticket doubles
its border to 2px and drops its radius entirely, because a printed artifact has a
real edge.

**The perforation** is the one bespoke geometry: a repeating radial-gradient of
punched holes (`0.09375rem` radius on a `0.5rem` pitch) plus two half-visible
notch circles that carry the host surface's background colour. It runs horizontal
on mobile and vertical from `sm` up. A dashed border reads as a dashed box; this
reads as a tear line, and prints as one.

### Named Rules

**The Buttons Are Not Pills Rule.** A primary action is a decision, not a chip.
Buttons take the control radius. `rounded-full` on an action is out.

## Components

Every component is an unmodified shadcn/Base UI primitive or a thin composition
of them. Variants carry meaning; there are no per-component palettes and no raw
values.

### Buttons

- **Shape:** Control radius (`0.375rem`), transparent 1px border by default so
  every variant shares one box model. Heights: `1.5rem` (xs), `2rem` (sm),
  `2.25rem` (default), `2.5rem` (lg).
- **Default:** Ink fill (`{colors.primary}`) with paper text. One per region — the
  single strongest action. Hover drops to 80% opacity.
- **Outline / Secondary:** Supporting actions. Outline is background-filled with a
  hairline; secondary is a muted fill that darkens on hover via a `color-mix`
  against the foreground.
- **Ghost:** Low-emphasis table and navigation controls. No resting background.
- **Link:** Prose only.
- **Hover / Focus:** `transition-all`; focus-visible draws a 3px `ring-ring/30`
  plus a solid ring-coloured border. Active state nudges `translate-y-px`, except
  on popup triggers where the press is already expressed by the popup opening.
- **Destructive splits by role.** The `destructive` variant is the *trigger* —
  tinted subtle surface with accessible red text — because a solid red button in
  every table row makes the table scream. The `destructive-solid` variant is the
  *confirm* inside the dialog that trigger opens. Quiet to reach for, loud to
  commit.

### Chips

- **Style:** `rounded-full`, `1.25rem` tall, caption type at weight 500, with a
  transparent border replaced by the family border on state variants.
- **State:** Neutral variants (`default`, `secondary`, `outline`, `ghost`) for
  non-semantic labels; the five family variants (`success`, `warning`,
  `destructive`, `info`, `provisional`) each pair their subtle surface, text, and
  border. Always accompanied by an icon or a plain-language label.

### Cards / Containers

- **Corner Style:** Container radius (`0.75rem`).
- **Background:** `{colors.card}` for content-bearing frames, `{colors.background}`
  for the ticket, `{colors.muted}` for a full-width alternating section.
- **Shadow Strategy:** None. See Elevation & Depth.
- **Border:** 1px hairline on all sides; internal structure by `border-b` header
  and footer bands and `divide-y` rows.
- **Internal Padding:** `1.25rem`–`1.5rem`, opening to `2rem` at `sm`.

### Inputs / Fields

- **Style:** `2.25rem` tall, translucent `input/50` fill, transparent border, no
  visible resting stroke. Labels sit above the field; help and error text sit
  beside the control.
- **Focus:** Border shifts to the ring colour and a 3px `ring-ring/30` appears.
- **Error:** `aria-invalid` drives a destructive border and a destructive-tinted
  ring. Required state and errors are always stated in text, never colour alone;
  entered values survive a validation error.

### Navigation

- **Organizer rail:** A persistent `16rem` left sidebar on `{colors.sidebar}`
  carrying event identity, status badge, the mono slug, and all seven sections at
  once — Overview, Registrations, Form, Check-in, Staff, Audit, Settings. Items
  are `2.25rem` tall with an icon and a label at Label type; the active item takes
  the sidebar accent fill and `aria-current="page"`. Below `lg` the same body
  renders inside a shadowed drawer with a scrim. Sections are never hidden behind
  a scroller.
- **Public header:** `3.5rem` sticky bar, `bg-background/90` with a backdrop blur
  and a bottom hairline. Wordmark left, muted section anchors that darken to
  foreground on hover, theme switcher and a single outline sign-in action right.
- **Theme switcher:** Three icon-only buttons (light / system / dark) in a
  hairlined `rounded-lg` group; the current mode renders as `secondary` and
  carries `aria-pressed`. Icon-only on purpose — three spelled-out labels made a
  preference control wider than the product's own name.

### Scan Outcome (signature)

The product's defining surface. A resolved scan takes over the screen: a 96px
icon, an optional qualifier chip, the outcome headline at weight 600, the
attendee's name, the ticket code in mono, one sentence of instruction, and
exactly one next action. Ten outcomes resolve into four tones — `success`,
`provisional`, `warning`, `destructive` — and each outcome is distinguishable by
icon, headline, and colour *together*, not by any one of them.

The surface uses a pinned `signal-*` tint and carries `.signal-surface`, which
re-points every neutral token in the subtree to its light value and sets
`color-scheme: light`, so anything rendered into `actions` inherits a light
treatment. **It never animates in.** A 200 ms fade on a door decision is 200 ms
of a volunteer not knowing. It persists until dismissed or replaced by the next
scan, announces assertively, and receives focus.

The component takes a `titleAs` prop so an embedded demonstration renders as a
paragraph rather than injecting "Checked in" into the host page's heading outline.

### Ticket (signature)

An object, not a panel. Container radius, hairline border, split into a details
half and a stub half by the perforation with its two notch circles; the notches
take a `surroundClassName` from the host because they must carry whatever colour
sits behind the ticket. The QR sits in a fixed white chamber at control radius in
**both** themes — an inverted QR does not scan. The event name, attendee, ticket
code, and QR lead on every viewport, never below management controls and never
below the fold on a phone. The print stylesheet is a first-class surface: it
returns the entire neutral set to light values by reference, squares the corners,
doubles the border, and hides the notches and action controls. Like the scan
outcome, it accepts `titleAs` for embedded use.

### Metrics and Meters

Metrics show proportion, not bare counts — "183 of 240 registered", not "183". A
meter is a `0.375rem` `rounded-full` track in `{colors.muted}` with a foreground
fill, labelled and given `role="progressbar"` with real `aria-value*` attributes.
Charts and meters are hand-built; there is no charting dependency. All figures use
`font-variant-numeric: tabular-nums`, applied globally to `table`, `time`, and
badges so columns of numbers line up for comparison.

### Named Rules

**The One Authored Moment Rule.** The product contains exactly one authored
animation, and it runs in two beats on a single exponential ease-out: the newest
row arrives in the activity list (`.animate-scan-arrive`, 0.55s), then the
arrivals meter answers it (`.animate-meter-fill`, 1.1s, delayed past the
arrival so the count reads as its consequence). The moment dramatizes the one
thing this product claims — a door being worked — rather than decorating the
page's entrance. It carries no information the adjacent figures do not already
state, which is precisely why it is safe to remove entirely. The activity row is
not a scan outcome: a door decision still appears instantly and never animates.
Everything else that moves is either a 150–200 ms state transition, a
`<Suspense>` reveal, or a browser-driven view transition on a shared element.
`prefers-reduced-motion` collapses durations *and* resets `animation-delay` to
zero — without the second part, a delayed animation still holds its empty `from`
state for the length of the delay.

**The Real Component Rule.** Marketing surfaces render the actual product
components with static props — the ticket, the scan outcome, the operations frame
— never a screenshot and never a mock-up. A screenshot goes stale silently; a
rendered component cannot. Every saturated colour on the landing page therefore
belongs to a real component reporting a real state.

## Do's and Don'ts

### Do:

- **Do** take every colour, radius, weight, and type size from `app/globals.css`.
- **Do** let hierarchy come from size, weight, and spacing — headings at 560,
  scanner outcomes at 600, everything else at 400/500.
- **Do** reserve `font-semibold` for the scanner outcome, where weight has to
  carry across a lit room.
- **Do** use the mono face only for ticket codes, slugs, web addresses,
  identifiers, and timestamps, and pair ticket codes with `tracking-code`.
- **Do** treat `provisional` as a distinct outcome everywhere it can occur, and
  show offline state, snapshot age, pending synchronization, and conflicts
  explicitly.
- **Do** give every number a denominator.
- **Do** draw regions with a hairline and one step of tonal shift.
- **Do** add every new colour pair to `app/globals.contrast.test.ts` in the same
  change that introduces it.
- **Do** pass `titleAs` when embedding a component that owns an `h1` or `h2` on
  its own page.
- **Do** use progressive disclosure for advanced or dangerous actions, with the
  tinted destructive trigger and the solid destructive confirm.

### Don't:

- **Don't** introduce a second typeface, a display face, or a `--font-heading`
  token. There is one voice.
- **Don't** set `tracking-*`, `leading-*`, or an arbitrary `text-[...]` size in a
  product component. The scale already carries its optics.
- **Don't** put a kicker, eyebrow, or uppercase label above a heading. If the
  heading needs one, rewrite the heading.
- **Don't** use saturated colour as decoration — no coloured heroes, accent
  fills, tinted sections for interest, or gradients.
- **Don't** render an offline acceptance in the colour of a confirmed one.
- **Don't** move a `signal-*` token into `.dark`, or render a scan outcome that
  changes with the theme.
- **Don't** introduce raw colour values or Tailwind palette classes such as
  `text-emerald-600` in components.
- **Don't** add a shadow to anything that isn't passing over live content, and
  don't wrap every content group in an independent floating card.
- **Don't** animate a scan outcome, or add a second authored animation without
  deleting one.
- **Don't** make a button a pill.
- **Don't** hide important state behind hover, colour alone, or a transient toast.
- **Don't** resemble a dark security console, a crypto product, or a
  purple-gradient SaaS template — the contrast audit actively fails on saturated
  violet.
