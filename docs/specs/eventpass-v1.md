# EventPass v1 product specification

## Status and current decisions — 2026-08-01

> This file preserves the original v1 specification as a historical product
> document. EventPass is now an implemented, deliberately simple portfolio
> project with one production-capable path and synthetic data. The decisions
> below supersede conflicting assumptions in the historical body; the original
> sections remain below for traceability rather than being silently rewritten.

- **Implementation status:** The deployed application is implemented and
  portfolio-oriented, not an unimplemented starter or a seeded demo.
- **Testing status:** No test framework or automated tests are included by
  design. The historical testing plan below is retained as history and does not
  describe shipped coverage.
- **Typography:** The application uses Geist Sans for general UI and Geist Mono
  for identifiers and verification-oriented data.
- **Motion:** Motion is restrained and purposeful: control/status transitions,
  loading indicators, workspace view transitions, and the landing preview's
  scan-arrival/meter sequence are used where they communicate state. Scanner
  outcomes render immediately; there is no decorative page-entrance animation.
- **Operations:** Expiration and reconciliation are evaluated during reads,
  mutations, relevant traffic, and dashboard activity. There is no cron or
  scheduled cleanup surface.
- **Capacity:** Event capacity is capped at 3,000 attendees.
- **Offline admission:** Online scans receive authoritative admission. Offline
  scans are provisional and only the same phone can catch repeats immediately.
  When separate phones scan offline, reconnect/sync reconciles the attempts: the
  earliest high-confidence attempt can be accepted automatically, while
  low-confidence collisions require a reasoned Organizer decision. Every
  competing attempt and visible conflict is retained. Cross-device offline
  duplicate prevention is not claimed.

## Problem Statement

University-club Organizers need a credible way to register Attendees, issue secure Tickets, and admit people quickly at in-person Events. Typical lightweight form tools do not provide trustworthy single-entry admission, role-scoped staffing, an audit trail, or useful behavior when venue internet is unreliable. EventPass must solve that operational problem through genuine production-capable workflows while remaining inexpensive enough to run on free hosting tiers and polished enough to demonstrate in software-engineering interviews using only synthetic data.

## Solution

Build EventPass as a responsive, full-stack TypeScript web application in which Organizers publish link-accessible Events, configure Registration Fields and capacity, invite Event Staff, and monitor attendance. Attendees register without accounts, verify their email addresses, and receive privacy-preserving signed QR Tickets plus fallback Ticket Codes. Check-in Volunteers use a mobile-first PWA to validate Tickets online or against a recently downloaded Offline Event Snapshot. Offline acceptance is explicitly provisional; idempotent synchronization establishes the authoritative Check-in and exposes cross-device Check-in Conflicts for deterministic or reasoned resolution. Every security-sensitive action and Scan Attempt remains auditable.

The interface follows “The Control Desk”: bright, calm, precise, and operational. It uses the existing neutral global design tokens, clear information hierarchy, strong accessibility, and immediate scanner feedback rather than decorative branding. The application has one real code path, no demo mode, no seed data, and no reset feature; synthetic interview records are created through normal workflows and persist normally.

## User Stories

1. As a prospective staff user, I want to sign in through a single-use email magic link, so that I do not need to manage a password.
2. As an authenticated staff user, I want a revocable database-backed session, so that my access remains convenient without being permanent.
3. As a suspended staff user, I want access to be refused consistently, so that a Platform Administrator can contain abuse without deleting history.
4. As a verified staff user, I want to create an Event and become its Event Owner, so that responsibility is unambiguous from the start.
5. As an Event Owner, I want to configure an Event’s title, description, Venue, Event Time Zone, schedule, capacity, Registration Window, and Check-in Window, so that the public information and operational rules are complete.
6. As an Event Owner, I want an Event Slug that is editable in Draft and immutable after publication, so that shared public links remain stable.
7. As an Organizer, I want to preview a Draft Event before publication, so that I can catch content and configuration mistakes.
8. As an Event Owner, I want to publish a Draft Event as link-accessible but unlisted, so that I control distribution without building public discovery.
9. As an Event Owner, I want to delete only an empty Draft Event, so that consequential history cannot disappear.
10. As an Event Owner, I want to cancel a Published Event with a reason, so that Tickets become invalid while Registration and audit history remain available.
11. As an Attendee, I want a clear notice when an Event is canceled, so that I do not rely on an invalid Ticket.
12. As an Organizer, I want to make permitted pre-check-in Event changes, so that genuine operational corrections remain possible.
13. As an Event Owner, I want post-check-in schedule changes limited to extending the Event end or Check-in Window, so that admission rules cannot be rewritten casually during operation.
14. As an Attendee, I want notification of every Material Event Change, so that I can react to schedule, venue, time-zone, capacity, or window changes.
15. As an Organizer, I want to pause and resume the Registration Window without unpublishing the Event, so that I can temporarily stop new demand.
16. As an Organizer, I want Event Capacity to count confirmed Registrations, active Capacity Holds, and active Admission Offers, so that the Event never intentionally overbooks.
17. As an Organizer, I want capacity decreases rejected when they would displace existing claims, so that accepted Attendees retain their places.
18. As an Organizer, I want capacity increases to promote Waitlist Entries in FIFO order, so that new space is allocated fairly.
19. As an Organizer, I want to build a form from short-text, long-text, single-choice, multiple-choice, and acknowledgment Registration Fields, so that the Event can collect relevant information.
20. As an Organizer, I want name and email to be built-in Registration fields, so that identity and ticket delivery remain consistent.
21. As an Organizer, I want a Registration Field’s identity and answer type to remain stable after responses exist, so that historical answers retain meaning.
22. As an Organizer, I want to relabel, clarify, or archive an existing Registration Field, so that copy can improve without corrupting responses.
23. As an Organizer, I want new post-response Registration Fields to be optional, so that existing Attendees are not retroactively invalidated.
24. As an Attendee, I want a public Event page that clearly shows schedule, Event Time Zone, Venue, availability, and registration status, so that I can decide whether to register.
25. As an Attendee, I want to submit the Event’s Registration form without creating an account, so that registration has minimal friction.
26. As an Attendee, I want clear field-level validation that preserves my entered answers, so that I can correct mistakes without starting again.
27. As an Attendee, I want a 15-minute Capacity Hold when space is available, so that email verification latency does not cost me the place immediately.
28. As an Organizer, I want concurrent claims for the final place serialized, so that Event Capacity cannot be exceeded.
29. As an Attendee, I want to verify my email through a single-use link, so that a Ticket is not issued to an unverified address.
30. As an Attendee, I want an expired Capacity Hold to become an Expired Registration, so that scarce capacity is released automatically.
31. As an Attendee, I want a full Event submission to offer waitlist verification rather than a false reservation, so that the outcome is honest.
32. As an Attendee, I want my Waitlist Entry priority based on successful email verification time, so that unverified submissions cannot hold queue position.
33. As an Attendee, I want at most one active Registration for my normalized email address per Event, so that accidental duplicate submissions cannot consume capacity.
34. As a waitlisted Attendee, I want an Admission Offer when I reach the front of the queue, so that I can claim newly available capacity.
35. As a waitlisted Attendee, I want the Admission Offer deadline to be the earlier of 12 hours or Registration Window closure, so that places do not remain stranded.
36. As an Attendee, I want an ignored Admission Offer to expire and allow a new Registration at the back of the queue, so that queue order remains fair.
37. As an Attendee, I want a Registration Management Link after verification, so that I can manage my Registration without an account.
38. As an Attendee, I want to edit my name and eligible answers before registration closes, so that I can correct information.
39. As an Attendee, I want my verified email address to remain immutable, so that the Registration cannot silently move to another identity.
40. As an Attendee, I want to cancel before check-in opens, so that capacity can be offered to the next Waitlist Entry.
41. As an Organizer, I want Attendee answers to remain attendee-authored, so that staff cannot silently rewrite submitted information.
42. As an Organizer, I want to preview a CSV Registration Import before committing it, so that formatting and capacity problems are visible.
43. As an Organizer, I want a Registration Import to succeed completely or not at all, so that partial imports do not create confusing state.
44. As an Organizer, I want an Imported Registration to be explicitly organizer-attested and confirmed without email verification, so that bulk onboarding is both useful and attributable.
45. As an Organizer, I want imports prevented from exceeding remaining Event Capacity, so that bulk actions follow the same capacity rules.
46. As an Organizer, I want a CSV export of names, emails, statuses, answers, Ticket state, and Check-in time, so that I can use Event data operationally.
47. As an Attendee, I want exports to exclude secrets and internal metadata, so that operational access does not expose bearer credentials or implementation details.
48. As an Event Owner, I want to invite an Organizer or Check-in Volunteer through a single-use, email-bound, 24-hour Staff Invitation, so that Event access cannot be self-assigned.
49. As an Event Owner, I want only myself to add or remove Organizers, so that control of the Event remains accountable.
50. As an Organizer, I want to add or remove Check-in Volunteers, so that admission staffing can be managed without ownership powers.
51. As an Event Owner, I want to propose Ownership Transfer to an existing Organizer for 24 hours, so that responsibility changes only with explicit acceptance.
52. As Event Staff, I want permissions scoped to one Event, so that access to one club activity reveals nothing about another.
53. As a Check-in Volunteer, I want only admission tools and minimal attendee information, so that I can work without receiving Organizer privileges or full exports.
54. As a Platform Administrator, I want to suspend and reactivate accounts or Events, so that I can handle abuse without altering domain history.
55. As a Platform Administrator, I want reasoned, time-limited Support Access to one Event, so that support investigations are explicit and audited.
56. As an Attendee with a confirmed Registration, I want a signed single-entry bearer Ticket, so that I can enter without creating an account or presenting identity documents.
57. As an Attendee, I want the Ticket email to contain Event details, a QR representation, a Ticket Code, a management link, and a canonical mobile/print view, so that I can present it conveniently.
58. As an Attendee, I want to resend the same valid Ticket, so that a lost email does not require changing the credential.
59. As an Attendee, I want Ticket Replacement before check-in opens, so that a compromised unused Ticket can be invalidated permanently and replaced.
60. As a Check-in Volunteer, I want a 10-character human-readable Ticket Code fallback, so that I can admit someone when camera scanning is unavailable.
61. As a privacy-conscious Attendee, I want the signed QR payload to contain only version, opaque Event ID, and opaque Ticket ID, so that presentation does not disclose personal information.
62. As a Check-in Volunteer, I want signature verification to reject altered Ticket payloads, so that a forged credential cannot be accepted.
63. As an Organizer, I want old public verification keys retained during key rotation, so that legitimately issued Tickets remain verifiable.
64. As a Check-in Volunteer, I want a dedicated mobile-friendly scanner with immediate camera and manual-entry controls, so that admission remains fast under pressure.
65. As a Check-in Volunteer, I want the scanner to distinguish accepted, duplicate, invalid, expired, canceled, replaced, outside-window, provisional, and conflict outcomes, so that I know the correct next action.
66. As a Check-in Volunteer, I want online scans to enforce one active Check-in per Ticket globally, so that repeat entry is rejected immediately.
67. As a Check-in Volunteer, I want to download a minimal Offline Event Snapshot before the Event, so that I can continue admission during connectivity loss.
68. As an Attendee, I want Offline Event Snapshots to exclude email addresses and Registration answers, so that scanner devices retain the least sensitive useful data.
69. As a Check-in Volunteer, I want snapshot age and offline status always visible, so that I understand the limits of a local decision.
70. As a Check-in Volunteer, I want snapshot refresh required within two hours before check-in opens, so that offline validation starts from reasonably current state.
71. As a Check-in Volunteer, I want a signed Scanner Authorization scoped to my Event and Scanner Device through the Check-in Window, so that an expired ordinary session does not halt offline admission.
72. As an Organizer, I want online role revocation to take effect immediately while acknowledging isolated authorization limits, so that the system describes its security boundary honestly.
73. As a Check-in Volunteer, I want the browser to cache only one Event and purge it after synchronization and check-in closure, so that retained attendee data stays bounded.
74. As a Check-in Volunteer, I want offline signatures verified locally before provisional acceptance, so that malformed or forged Tickets are rejected without connectivity.
75. As a Check-in Volunteer, I want device-local duplicate prevention while offline, so that repeated presentation at my entrance is caught immediately.
76. As an Organizer, I want cross-device offline duplicates detected during synchronization, so that isolated scanners cannot silently create multiple authoritative admissions.
77. As an Organizer, I want the earliest high-confidence Scan Attempt to become the Check-in automatically, so that synchronization order does not decide the winner.
78. As an Organizer, I want low-confidence Check-in Conflicts to require a reasoned choice, so that questionable device clocks do not determine authority automatically.
79. As an Organizer, I want every conflicting Scan Attempt retained, so that resolving a conflict does not erase what happened.
80. As a Check-in Volunteer, I want each Scan Attempt assigned a client-generated identifier before the UI accepts it, so that retries cannot create duplicate records.
81. As a Check-in Volunteer, I want pending Scan Attempts synchronized in retryable batches whenever connectivity returns, so that interrupted uploads recover safely.
82. As a Check-in Volunteer, I want rejected Scan Attempts synchronized without retaining unknown raw QR contents, so that operational evidence does not become a secret-data store.
83. As a Check-in Volunteer, I want Ticket cancellation, replacement, Event changes, revocation, and later Check-ins described as snapshot-relative risks, so that offline confidence is not overstated.
84. As a Check-in Volunteer, I want optional sound and vibration paired with visible and spoken scanner results, so that feedback works in noisy and accessible contexts.
85. As a Check-in Volunteer, I want to reverse only my own most recent Check-in within 30 seconds and provide a reason, so that immediate mistakes are correctable without broad privileges.
86. As an Organizer, I want to reverse any active Check-in with a reason, so that admission errors can be corrected without deleting history.
87. As an Organizer, I want outside-window admission to require an explicit override reason, so that exceptional entry remains accountable.
88. As an Organizer, I want a dashboard showing confirmed Registrations, capacity, waitlist, active Check-ins, Attendance Rate, check-ins over time, invalid and duplicate attempts, conflicts, and device synchronization, so that I can understand Event operations.
89. As an Organizer, I want dashboard data refreshed approximately every five seconds, so that it feels live without requiring a dedicated real-time service.
90. As an Organizer, I want an immutable audit history of privileged changes and Scan Attempts, so that operational and security events can be reconstructed.
91. As a privacy-conscious Attendee, I want Audit Entries to exclude Registration answers and bearer secrets, so that accountability does not cause unnecessary exposure.
92. As an Organizer, I want email delivery attempts and outcomes tracked independently from committed domain state, so that provider failures do not undo Registrations or Tickets.
93. As an Organizer, I want permanent delivery failures suppressed and transient failures retryable, so that messaging remains responsible and recoverable.
94. As an Attendee, I want a retried token-bearing email to rotate its token, so that older links do not remain valid unnecessarily.
95. As a user, I want EventPass to work in current Chrome on Android, Safari on iPhone, and Chromium desktop browsers, so that the core flows cover realistic interview and venue devices.
96. As a keyboard or screen-reader user, I want logical focus order, accessible names, visible focus, announced statuses, and WCAG 2.2 AA contrast, so that I can use the product independently.
97. As a user with reduced-motion preferences, I want routine transitions minimized, so that motion does not interfere with use.
98. As an Organizer, I want a persistent Light/System/Dark preference with System as default, so that the interface fits my environment while preserving the same hierarchy.
99. As an interviewer, I want every demonstrated record to have been created through the real application, so that the portfolio project demonstrates genuine behavior rather than a mocked demo path.
100. As the project owner, I want synthetic data to persist normally with no seed or reset feature, so that the deployed application remains simple and production-capable.

## Implementation Decisions

- Build a single Next.js 16.2 full-stack TypeScript repository using React 19, PostgreSQL on Neon, Drizzle ORM, Better Auth, Zod, Tailwind CSS 4, shadcn/Base UI components, and Tabler icons. Deployment targets Vercel Hobby and Neon’s free tier.
- Before implementation, follow the repository instruction to read the relevant installed Next.js documentation because framework APIs and conventions may differ from prior versions.
- Organize the application as a feature-first modular monolith with deep modules for Events and staffing, Registration and capacity, Ticketing, Admission and offline synchronization, Messaging, and Audit and analytics.
- Keep domain authorization and invariant enforcement at server-only application-service boundaries close to the database. Treat Server Actions and Route Handlers as untrusted transport entry points that validate input and return deliberately shaped DTOs.
- Use Server Components to call server-only data access directly. Use Server Actions for browser mutations and Route Handlers for scanner synchronization, authentication callbacks, provider webhooks, and CSV import/export. Do not make internal HTTP calls from Server Components.
- Use Better Auth only for staff identity, hashed single-use magic links, and database sessions. EventPass owns Event Staff roles, Staff Invitations, Ownership Transfer, Suspension, Scanner Authorization, Platform Administrator powers, and Support Access.
- Magic links expire after 15 minutes and are single-use. Ordinary database sessions use a seven-day rolling lifetime and remain revocable. Staff authorization is rechecked for every protected operation.
- Use one PostgreSQL schema. Externally exposed identifiers are UUIDs, scheduled timestamps use `timestamptz`, and constrained textual states use `text` plus database checks rather than database enums.
- Use Drizzle for schemas, queries, transactions, and migrations, while treating PostgreSQL constraints and transaction semantics as the final source of integrity.
- Serialize capacity-changing operations with a per-Event row lock. Event Capacity includes confirmed Registrations, unexpired Capacity Holds, and active Admission Offers.
- Make expiration correctness independent of schedulers. Evaluate deadlines during reads and mutations, run idempotent reconciliation during relevant traffic and dashboard activity, and let application logic ignore expired disposable records because the intentionally small data volume does not require scheduled housekeeping.
- Store the Registration lifecycle in one state-machine record rather than splitting pending, confirmed, expired, and waitlisted states across unrelated tables. Enforce one active Registration per normalized email address and Event through a partial unique constraint.
- Model Tickets separately from Registrations so replacements preserve history. Permit at most one active Ticket per Registration, never reuse old Ticket Codes, and keep invalidated Ticket records.
- Represent Registration Fields and options relationally. Store each answer against a stable field identifier with a validated JSON value appropriate to the field’s fixed answer type.
- Make Registration Imports preview-first, capacity-aware, audited, and atomic. Imported Registrations are explicitly Organizer-attested and bypass attendee email verification.
- Generate Registration Management Links, email verification links, Staff Invitations, magic links, and similar bearer capabilities from cryptographically random values. Persist only SHA-256 digests; do not log or audit plaintext tokens.
- Sign Tickets using a platform-wide, versioned ECDSA P-256/SHA-256 key ring. Keep private keys in deployment secrets and distribute only public verification keys to scanners.
- Encode Tickets as compact JWS using `ES256`. The protected header carries algorithm, key identifier, and protocol type; the payload carries only schema version, opaque Event ID, and opaque Ticket ID.
- Generate a random 10-character Crockford Base32 Ticket Code, displayed with a visual separator for readability, as the manual-entry representation of the same Ticket.
- Treat signature validity as necessary but insufficient. Admission also verifies Event membership, Ticket state, existing Check-in state, Check-in Window, authorization, and snapshot freshness as applicable.
- Implement browser scanning with `@zxing/browser`, offline persistence with Dexie over IndexedDB, local cryptographic verification with Web Crypto, and PWA/service-worker support through Serwist’s Webpack integration.
- Bind Scanner Authorization to one Event, authenticated Check-in Volunteer, random Scanner Device UUID, and volunteer-supplied device label. Do not fingerprint browsers.
- Cache a maximum of one Offline Event Snapshot per browser profile. It contains only opaque Ticket identifiers, display names, validity state, existing Check-in state, verification keys, Event rules, identity, generation time, and authorization needed for admission—not emails or Registration answers.
- Record a server-time anchor and monotonic elapsed time for offline timing. Preserve raw device time and Timestamp Confidence for reconciliation and review.
- Store every Scan Attempt before showing acceptance, using a client-generated UUID as an idempotency key. Synchronize with at-least-once retry semantics in batches and expose pending state plus a manual retry control.
- Store Scan Attempts append-only. Known Tickets retain their opaque Ticket identifier; unknown input retains only a digest and rejection reason, never the raw value.
- Model authoritative Check-ins separately from Scan Attempts and Check-in Reversals separately from Check-ins. Enforce at most one active Check-in per Ticket through a partial unique constraint.
- Resolve cross-device Check-in Conflicts by earliest high-confidence device-recorded attempt, independent of server receipt order. Require a reasoned Organizer decision when confidence is low, and preserve every competing attempt.
- Defer a PWA update while unsynchronized attempts exist. After the Check-in Window closes, purge cached Event data only after all pending attempts have been acknowledged.
- Use Resend for transactional email from a verified subdomain such as `mail.hetjethva.tech`, with the application intended for `eventpass.hetjethva.tech`. Track delivery through signed provider webhooks.
- A failed Email Delivery never rolls back committed domain state. Retry transient failure, suppress automatic retries after permanent failure, and rotate bearer tokens when retrying token-bearing messages. Store template, recipient, provider identifiers, and outcome rather than message bodies or plaintext links.
- Implement request throttling in PostgreSQL using sliding windows keyed by normalized email and a daily rotating digest of the IP address. Add a honeypot for public forms; do not add Redis or CAPTCHA initially.
- Make the audit store database-enforced append-only, including protection against update and deletion. Capture actor, target, time, device, action, and required reason, but exclude bearer secrets and Registration answers.
- Use restrictive foreign-key deletion behavior for durable domain history. Cascade only disposable authentication artifacts such as sessions and expired tokens. Avoid a generic soft-delete mechanism.
- Refresh dashboard metrics by polling approximately every five seconds and describe them as “live,” not strictly real-time. Do not add a separate push service for v1.
- Follow the established “The Control Desk” design contract: existing `globals.css` semantic colors only, Geist Sans for general UI, Geist Mono only for identifiers and verification-oriented data, flat border-led surfaces, purposeful 150–200 ms transitions, and no decorative entrance animation.
- Organizer navigation is Events followed by the Event workspace sections Overview, Registrations, Form, Check-in, Staff, Audit, and Settings. The scanner is a separate distraction-free full-screen workspace.
- The public flow is Event page, Registration form, email prompt, verification, then Ticket page. The Ticket page is also the accountless Registration management destination.
- Use both light and dark themes, default to the device’s system setting, persist the user’s Light/System/Dark selection, and preserve semantic contrast in both modes.
- Meet WCAG 2.2 AA. Scanner outcomes use text, icons, color, screen-reader announcements, and optional sound or vibration; scanner touch targets are at least 44 by 44 CSS pixels.
- Maintain one production-capable path. Do not add hard-coded showcase behavior, seed data, a demo mode, or a reset function. Synthetic interview records are entered through normal workflows and persist in PostgreSQL.
- Resume and portfolio language must say “offline duplicate detection and conflict resolution” rather than claiming cross-device offline prevention, and “live dashboard” rather than strict real-time updates. Do not claim real users or real registration volume.

## Testing Decisions

- Use one high-level domain application-service seam for the agreed tests. Tests invoke public use-case interfaces and assert observable returned and persisted outcomes rather than internal helper calls, SQL shape, component structure, or implementation details.
- Exercise the real PostgreSQL transaction and constraint behavior where concurrency or uniqueness is the subject. Exercise the real Ticket signing and verification implementation for cryptographic behavior. Mock only true external boundaries such as email delivery or uncontrollable time when a test requires them; do not mock EventPass modules.
- Implement exactly six critical domain tests initially, with no coverage target, broad end-to-end suite, snapshot-heavy component suite, or elaborate CI requirement:
  1. Two concurrent attempts to claim the final available place cannot overbook Event Capacity.
  2. One Event cannot have two active Registrations for the same normalized email address.
  3. A Ticket whose signed payload has been tampered with is rejected.
  4. A second admission attempt for an already checked-in Ticket is rejected as a duplicate.
  5. Retrying synchronization with the same Scan Attempt UUID is idempotent and creates no duplicate Scan Attempt or Check-in.
  6. Provisional Check-ins for the same Ticket from separate offline Scanner Devices become a Check-in Conflict and resolve according to Timestamp Confidence rules.
- Build these behaviors test-first using red, green, and refactor. Keep each test deterministic and independently repeatable.
- The starter repository contains no comparable domain tests, so there is no local prior art to preserve. Establish the single application-service seam without creating lower-level test-only interfaces.

## Out of Scope

- Payment processing, refunds, pricing tiers, and commerce workflows.
- Seat maps, assigned seating, ticket classes, group bookings, and transfer between Attendees.
- Native iOS or Android applications; installation remains an optional web PWA capability.
- Microservices, workers, message queues, Redis, Kafka, a dedicated WebSocket service, or a separately deployed API.
- Strict real-time dashboard guarantees; v1 uses short-interval polling.
- Public Event discovery, search, recommendations, and marketplace behavior; Published Events are unlisted and link-accessible.
- Multi-session, recurring, or conference-series hierarchy; separately ticketed occurrences are separate Events.
- Attendee accounts, social login, passwords, identity-document checking, or non-bearer personalized admission.
- PDF Tickets, Apple Wallet or Google Wallet passes, calendar files, attachments, Event cover uploads, and seat-selection visuals.
- Custom domains per Organizer, white labeling, custom color themes, or manually defined component palettes.
- Demographic analytics, marketing attribution, campaign tools, and behavioral tracking.
- Offline prevention of duplicates across isolated devices; v1 detects and resolves those conflicts after synchronization.
- Encryption of IndexedDB at rest; v1 minimizes cached data, limits retention, and relies on browser/device security.
- Obsolete browsers and embedded in-app browsers beyond graceful unsupported messaging and manual Ticket Code fallback.
- CAPTCHA and distributed rate-limiting infrastructure.
- Automated demo seeding, demo accounts, demo mode, data-reset controls, or fabricated usage counters.
- A comprehensive test suite beyond the six agreed critical domain tests.

## Further Notes

- EventPass is a portfolio project intended for interview demonstrations with synthetic data, but the implementation and persistence model must be capable of real operation.
- The expected low-cost deployment is Vercel for the complete Next.js application, Neon for PostgreSQL, and Resend for email, all initially within free-tier limits.
- The intended public application hostname is `eventpass.hetjethva.tech`; a separate sending subdomain such as `mail.hetjethva.tech` keeps email DNS configuration isolated.
- Existing domain documentation defines the authoritative vocabulary, and the four ADRs govern offline duplicate guarantees, Ticket cryptography, offline Scanner Authorization, and staff identity.
- The scanner’s offline guarantee is deliberately bounded: local signature verification and device-local duplicate detection continue without connectivity, while revocation, replacement, cross-device Check-ins, and Material Event Changes remain relative to the latest Offline Event Snapshot.
- The product should look polished through disciplined hierarchy, typography, spacing, responsive behavior, and state design while retaining the existing global neutral tokens and shadcn/Base UI conventions.
- The repository is currently a styled Next.js starter rather than an implemented EventPass system. This issue specifies the complete v1 product; implementation should be divided into dependency-aware delivery tickets before coding begins.
