---
name: The Control Desk
description: A calm, precise operational instrument whose admission outcomes are unmistakable under pressure, and whose Ticket is an object worth keeping.
tokens:
  hues:
    brand: 200 # teal — identity and informational register
    success: 150 # green — accepted, confirmed, delivered, synchronized
    warning: 75 # amber — duplicate, transient failure, low-confidence clock
    destructive: 27 # red — invalid, canceled, permanent failure, unresolved conflict
    provisional: 265 # indigo — offline acceptance, pending authority
    neutral: 260 # the tint carried by the whole neutral ramp
  typography:
    sans: Geist # UI, body, tables, forms, and every status or scanner string
    display: Instrument Serif # page titles, public pages, landing headlines only
    mono: IBM Plex Mono # Ticket Codes, identifiers, timestamps, stat values
  radii:
    control: 0.375rem # buttons, inputs, chips, small controls
    container: 0.625rem # regions, panels, table shells, the Ticket body
    overlay: 0.875rem # dialogs, popovers, menus
---

## Overview

EventPass is **The Control Desk**: an operational instrument that stays calm in a
crowded check-in line. It is precise, dependable, and quiet — right up until a
decision has to be made at a door, at which point it becomes impossible to
misread.

Three registers, one system:

- **Organizer surfaces** prioritize scanning, comparison, and density. Calm,
  border-led, typographically ordered.
- **The scanner** prioritizes instant comprehension at arm's length in bright
  venue lighting. It is the loudest thing in the product, deliberately.
- **Attendee surfaces** are quieter and more spacious, and the Ticket itself is
  treated as a physical object — a stub worth keeping, printing, and presenting.

All three share one token set, one type system, and one component library. They
differ in density and scale, never in vocabulary.

## Colors

All color comes from semantic tokens in `app/globals.css`. Components must never
introduce raw color values, per-component palettes, or Tailwind palette classes
such as `text-emerald-600`. If a component needs a color the tokens cannot
express, the token set is wrong — extend it there.

### Neutrals

The neutral ramp carries a slight cool tint (hue 260, chroma ≈ 0.005). It is
never pure gray. `--primary` stays near-black in light mode and near-white in
dark: the strongest action in a region is defined by contrast, not by hue, so a
primary button can never be mistaken for a status.

### The five hues

| Family | Hue | Meaning |
|---|---|---|
| `brand` / `info` | 200 | Product identity, focus ring, selection, active navigation, informational emphasis |
| `success` | 150 | Accepted, confirmed, delivered, fully synchronized |
| `warning` | 75 | Duplicate, transient failure, low-confidence clock, auto-resolved conflict |
| `destructive` | 27 | Invalid, canceled, permanent failure, unresolved conflict, irreversible action |
| `provisional` | 265 | Offline acceptance, pending authority, snapshot in use |

`brand` and `info` deliberately share hue 200. The product's voice and its
informational register are the same register; splitting them would add a hue
without adding meaning.

**`provisional` is a first-class outcome, not a shade of success.** An offline
acceptance is the single most important distinction this product draws — it is a
qualified yes, and it must never render in the same color as a confirmed one.

### Token shape

Every hue family provides five tokens:

- `--{family}` — solid fill
- `--{family}-foreground` — text and icons on that solid fill
- `--{family}-text` — accessible text on `--background` and on `--{family}-subtle`
- `--{family}-subtle` — tinted surface for inline alerts, badges, and rows
- `--{family}-border` — border paired with the subtle surface

Both modes are first-class. Every pair is verified against WCAG 2.2 AA by
`app/globals.contrast.test.ts`, which fails the build on drift. Adding a color
without adding it to that audit is not permitted.

### Color is never the only signal

Every outcome pairs its color with an icon, a concise label, and — on the scanner
— optional sound and vibration. Removing all color from any screen must leave it
fully usable. Charts and meters remain distinguishable by label and value, not
tone alone.

## Typography

**Geist Sans** carries UI, body copy, navigation, tables, forms, buttons, and
**every status, outcome, and scanner string without exception**. Arm's-length
legibility in bright light is a safety property; nothing decorative may touch it.

**Instrument Serif** fills `--font-heading` and appears only in:

- organizer page titles
- public event and registration pages
- landing page headlines
- the Event name on the Ticket

It never appears in scanner outcomes, status labels, badges, table content,
form labels, or any string under `text-xl`. It ships regular and italic only —
that constraint is intentional and must not be worked around with synthetic
bold.

**IBM Plex Mono** carries Ticket Codes, Event Slugs, identifiers, timestamps,
cryptographic metadata, and every operational number in a stat or table cell.
Ticket Codes use Crockford Base32, which already excludes `I`, `L`, `O`, and
`U`; the face must keep `5`/`S`, `2`/`Z`, `8`/`B`, and `6`/`G` distinct.

### Scale

Sizes come from the Tailwind scale. Arbitrary values such as `text-[10px]` and
`text-[11px]` are not permitted — if a size is missing, the scale is wrong.
Hierarchy comes from size, weight, spacing, and placement. Use sentence case
throughout, and concrete status language: "Checked in," "Already checked in,"
"Ticket not found."

## Shape and elevation

Exactly three radii, named by role:

- **control** — buttons, inputs, chips, badges, small controls
- **container** — regions, panels, table shells, the Ticket body
- **overlay** — dialogs, popovers, menus

`rounded-full` is permitted only for status chips, avatars, and dots. **Buttons
are not pills.** A primary action is a decision, not a chip.

The interface is flat and border-led. Establish regions with background shifts
and dividers before reaching for a shadow. **Decorative elevation is not
permitted** — shadow exists only where something genuinely passes over content:
dialogs, popovers, menus, and sticky bars.

Do not wrap every content group in an independent floating card. Related
controls and data share one bordered region with internal dividers.

## Motion

Motion is used where it carries meaning and nowhere else.

**Permitted:**

- Shared-element morphing between related routes (Event list → Event workspace,
  Ticket surfaces) via React `<ViewTransition>`
- `<Suspense>` reveals resolving a skeleton into its real content
- Crossfades when table content changes within the same route (filters, search)
- 150–200 ms transitions on state, focus, expansion, and overlays

**Not permitted:**

- Directional slide transitions between workspace sections
- Any entrance animation on **scan outcomes**. The outcome appears instantly. A
  200 ms fade on a door decision is 200 ms of a volunteer not knowing.
- Motion that gates interactivity or delays first input

`prefers-reduced-motion` is honored everywhere, and every animation has a
static, fully usable fallback. View transitions rely on
`experimental.viewTransition`; where a browser lacks support the app works
normally without animation.

## Components

**Buttons** use the shared component and its semantic variants. `default` for
the single strongest action in a region, `outline` or `secondary` for supporting
actions, `ghost` for low-emphasis table and navigation controls, `link` only in
prose.

**Destructive splits by role.** A destructive *trigger* — a control sitting in a
table row or a settings list — uses the tinted treatment, so rows do not scream.
The *confirm* button inside the resulting dialog is **solid**. Quiet to reach
for, loud to commit.

**Navigation.** The organizer shell is a left sidebar carrying Event identity and
all seven sections at once: Overview, Registrations, Form, Check-in, Staff,
Audit, Settings. It collapses to a drawer on small screens. Sections are never
hidden behind a scroller without an affordance. One container measure applies
across the app; table-heavy sections may run wider.

The scanner launches from Check-in into a separate full-screen shell with large
touch targets and an unambiguous route back.

**The attendee path** stays linear: Event page → Registration form → Check email
→ Verify registration → Ticket page. Each step has one obvious primary action and
states plainly what happens next.

**The Ticket** is an object. QR representation, Ticket Code, attendee name, and
Event identity lead on **every** viewport — never below management controls, and
never below the fold on a phone, because a phone at a door is the primary case.
The stub carries a perforation edge and corner notches. The QR sits in a fixed
white chamber in both themes; an inverted QR does not scan. Management controls
sit below a hard divider. The print stylesheet is a first-class surface.

**Scanner feedback is the signature interaction.** A resolved scan takes over the
screen: the outcome hue as the surface, a glyph at 96 px or larger, a large sans
headline, the attendee name prominent, and exactly one next action. It persists
until dismissed or replaced by the next scan — it never auto-dismisses before a
volunteer can read it. Each of the ten outcomes is distinguishable by icon,
headline, and color together. Outcome surfaces stay high-luminance in **both**
themes: ambient venue light beats theme preference at a door. Touch targets are
at least 44 × 44 CSS pixels.

**Forms** put labels above fields, keep help and error text beside the control,
and preserve entered values through validation errors. Required state and errors
are conveyed in text, never color alone.

**Tables and lists** are the default for attendee, staff, audit, delivery, and
scan-attempt records. Columns stay aligned, actions predictable, and critical
status readable without opening a detail view. On narrow screens, preserve
priority information rather than shrinking a desktop table past usability.

**Metrics show proportion, not bare counts.** A number without a denominator
cannot be judged. "7 duplicates" is meaningless; "7 of 412 attempts" is
actionable. Prefer share-of-total bars, capacity meters, and sparklines — all
hand-built, no charting dependency. An overview answers three questions at a
glance: how full, how many arrived, is anything wrong. Everything else belongs in
the section that owns it.

**Focus and accessibility** follow WCAG 2.2 AA: the visible ring uses the brand
hue, keyboard order is logical, controls are semantic, names are accessible, and
status changes are announced. Scan outcomes announce assertively and receive
focus.

## Do's and Don'ts

**Do**

- Make the current state and the next action obvious at a glance.
- Treat `provisional` as a distinct outcome everywhere it can occur.
- Show offline state, snapshot age, pending synchronization, and conflicts
  explicitly.
- Give every number a denominator.
- Use progressive disclosure for advanced or dangerous actions.
- Take color, radius, elevation, and type exclusively from the tokens.

**Don't**

- Resemble a dark security console, a crypto product, or a gradient SaaS
  template.
- Introduce raw color values or Tailwind palette classes in components.
- Use arbitrary type sizes.
- Wrap every content group in a floating rounded card.
- Animate a scan outcome, or animate routine content that carries no meaning.
- Hide important state behind hover, color alone, or a transient toast.
- Let the display serif touch anything operational.
- Sacrifice clarity to make the interface look more technically complex.
