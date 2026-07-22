---
name: The Control Desk
description: A bright, calm operational interface that makes event status and check-in outcomes unmistakable under pressure.
tokens:
  colors:
    background: "oklch(1 0 0)"
    foreground: "oklch(0.145 0 0)"
    card: "oklch(1 0 0)"
    primary: "oklch(0.205 0 0)"
    primary-foreground: "oklch(0.985 0 0)"
    secondary: "oklch(0.97 0 0)"
    muted: "oklch(0.97 0 0)"
    muted-foreground: "oklch(0.556 0 0)"
    border: "oklch(0.922 0 0)"
    ring: "oklch(0.708 0 0)"
    destructive: "oklch(0.577 0.245 27.325)"
  typography:
    sans: Geist
    mono: Geist Mono
  radii:
    base: "0.625rem"
    button: "1.625rem"
---

## Overview

EventPass follows **The Control Desk**: a polished operational workspace inspired by the clarity of Stripe Dashboard and the decisiveness of Square POS. It should feel calm, precise, and dependable—not decorative or futuristic. Dense information is welcome when it is grouped clearly, aligned consistently, and paired with an obvious next action.

Organizer screens prioritize hierarchy, scanning, and comparison. The volunteer scanner prioritizes instant comprehension from arm's length and in bright venue lighting. Public registration pages are quieter and more spacious, but remain visibly part of the same product.

Use the existing semantic tokens from `app/globals.css`. Tailwind utilities may control layout, spacing, typography, and responsive behavior; component-level colors must come from semantic tokens rather than newly invented values.

## Colors

The current neutral shadcn palette is the product palette. Light mode uses a white background, near-black foreground and primary actions, soft neutral secondary surfaces, and quiet gray borders. Dark mode uses the existing inverse tokens. Both modes are first-class, with **System** as the default and a persistent Light/System/Dark selector.

Color communicates hierarchy, not decoration:

- Primary foreground/background pairs identify the single strongest action in a region.
- Muted surfaces separate secondary controls, table headers, and contextual information.
- Borders define structure without turning every section into a floating card.
- Destructive is reserved for errors, invalid tickets, cancellation, suspension, and irreversible actions.
- Check-in outcomes must never rely on color alone; pair them with an icon, concise label, and optional sound or vibration.

Do not add a brand gradient, decorative accent palette, or arbitrary per-component colors. Charts use the existing neutral chart scale and must remain distinguishable through labels, shape, or pattern as well as tone.

## Typography

Use **Geist Sans** for navigation, headings, body copy, labels, tables, forms, and buttons. Use **Geist Mono** only where fixed-width characters improve verification: Ticket Codes, identifiers, timestamps, cryptographic metadata, and debugging details.

Hierarchy should come from size, weight, spacing, and placement rather than dramatic type changes. Page titles are compact and confident; section headings are restrained; labels are direct; supporting copy is short and muted. Operational numbers may be prominent, but avoid oversized marketing-style metrics.

Use sentence case throughout. Prefer concrete status language such as “Checked in,” “Already checked in,” and “Ticket not found” over clever or vague copy.

## Elevation

The interface is primarily flat and border-led. Use background shifts and dividers to establish regions before reaching for shadows. Reserve elevation for genuinely layered UI such as dialogs, popovers, menus, and sticky controls that pass over content.

Avoid placing every section inside an independent rounded card. Related controls and data should share a clear structural region. Rounded corners use the existing global radius scale; pill shapes are appropriate for buttons and compact statuses, not large content containers.

Motion is restrained: use 150–200 ms transitions for state changes, focus, expansion, and overlays. Do not add decorative entrance animations. Scanner feedback is immediate; reduced-motion preferences are respected.

## Components

**Buttons** use the existing shadcn/Base UI component and its semantic variants. Default is for the primary action, outline or secondary for supporting actions, ghost for low-emphasis table and navigation controls, destructive for consequential actions, and link only for actions that visually belong in prose. A view should rarely show more than one dominant default button in the same action group.

**Navigation** keeps the event identity and current section obvious. The top level opens to **Events**. Each event is a focused workspace with **Overview**, **Registrations**, **Form**, **Check-in**, **Staff**, **Audit**, and **Settings** in that order. The scanner launches from Check-in into a separate distraction-free, full-screen shell with large touch targets and a clear route back to the event workspace.

The public attendee path is intentionally linear: **Event page → Registration form → Check email → Verify registration → Ticket page**. The ticket page is also the attendee's secure, accountless management destination for viewing the QR code, editing eligible answers, resending or replacing the ticket, and canceling before the permitted cutoff. Each step uses one obvious primary action and clearly explains what happens next.

**Forms** place labels above fields, keep help and error text adjacent to the relevant control, and preserve entered values after validation errors. Required state and errors are conveyed in text, not color alone.

**Tables and lists** are the default for attendee, staff, audit, delivery, and scan-attempt records. Keep columns aligned, actions predictable, and critical statuses readable without opening a detail view. On narrow screens, preserve priority information instead of shrinking a desktop table beyond usability.

**Status indicators** combine a concise label with an icon or shape. Status wording must match the domain language in `CONTEXT.md`.

**Scanner feedback** is the signature interaction. Success, duplicate, invalid, offline-provisional, and conflict states each receive a distinct icon, headline, explanation, and next action. The result must remain legible in bright light and must not disappear before a volunteer can understand it. Scanner actions use touch targets of at least 44 by 44 CSS pixels.

**Focus and accessibility** follow WCAG 2.2 AA. Preserve the existing visible ring treatment, logical keyboard order, semantic controls, accessible names, screen-reader status announcements, and strong contrast.

## Do's and Don'ts

**Do**

- Make the current state and next action obvious at a glance.
- Use whitespace, alignment, dividers, and typography to create hierarchy.
- Design organizer screens for scanning and comparison, not presentation.
- Keep high-pressure scanner controls large, immediate, and forgiving.
- Show offline state, pending synchronization, and conflicts explicitly.
- Use progressive disclosure for advanced or dangerous actions.
- Preserve the defaults in `globals.css` as the sole color source.

**Don't**

- Resemble a dark cybersecurity console, crypto product, or generic purple-gradient SaaS template.
- Use oversized hero metrics or marketing visuals inside the operational dashboard.
- Turn every content group into a floating, heavily rounded card.
- introduce raw color values or one-off component palettes.
- Hide important state behind hover, color alone, or transient toast messages.
- Animate routine page entry or delay scanner feedback for visual effect.
- Sacrifice clarity to make the interface appear more technically complex.
