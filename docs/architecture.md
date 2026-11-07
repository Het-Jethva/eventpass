# EventPass architecture

EventPass is a Next.js App Router application for event registration and door admission. Postgres owns durable state. IndexedDB owns a scanner's offline roster and pending attempts.

## Ownership

Routes and actions in `app` adapt HTTP requests, validate input, obtain sessions, and render or redirect. Server operations in `features/*/server` enforce authorization and complete domain transactions. Browser components import shared contracts and pure policy modules without importing server implementations.

| Module                                                         | Owns                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `features/events/server/capacity-ledger.ts`                    | Confirmed places, live holds, active offers, and expiry                 |
| `features/registration/server/get-public-registration-form.ts` | Ordered form fields and choices for submission, imports, and management |
| `features/tickets/server/registration-confirmation.ts`         | Email verification, offer claims, and waitlist reconciliation           |
| `features/tickets/server/registration-management.ts`           | Guest details, ticket resend, replacement, and cancellation             |
| `features/tickets/server/ticket-issuance.ts`                   | Ticket code allocation, signing, and replacement ordering               |
| `features/admission/server`                                    | Online admission, offline reconciliation, conflicts, and reversals      |
| `features/admission/offline-snapshot-store.ts`                 | Local roster, device identity, atomic admission, and pending attempts   |
| `lib/email/send-email.ts`                                      | Provider delivery, stable retry identity, and delivery tracking         |
| `lib/db/schema.ts`                                             | Persistent records, indexes, and database constraints                   |

## Transactions and capacity

Mutations lock the event before dependent rows. Capacity counts confirmed registrations, unexpired holds, and active offers. Registration, waitlist promotion, imports, and event edits use the same capacity rules.

Registration confirmation consumes its verification link and issues the ticket in one transaction. Replacement invalidates the predecessor before inserting its successor, satisfying the unique active-ticket constraint. A guest management view uses a read-only repeatable-read transaction so details, answers, and ticket state agree.

Email runs after domain commits. Each delivery has one provider idempotency key, including retries after an uncertain response. Provider acceptance counts as success even when tracking fails afterward. Tracking updates preserve stronger webhook outcomes. Failed offer delivery releases its claim so a later reconciliation can offer a reachable place.

## Offline admission

Preparation downloads a signed scanner authorization, public verification keys, and a roster containing no guest email addresses or form answers. Tickets occupy an indexed table. The stored snapshot contains metadata, without a second copy of those tickets.

WebCrypto verifies a presented signature before opening an IndexedDB transaction. The transaction checks snapshot identity, ticket state, time bounds, prior local claims, and the scan-attempt identity before saving the result. If another tab replaces the snapshot during verification, admission retries against the new keys. IndexedDB serializes local writers, so simultaneous scans on one browser cannot both claim a ticket.

Offline acceptance is provisional. Reconciliation verifies the signed device authorization and current staff access, then records attempts idempotently in Postgres. The attempt must occur before the signed authorization expires. Delivery after expiry remains valid for an earlier authorized attempt.

Separate devices can produce conflicts. High-confidence attempts use the shared arbitration policy. Uncertain collisions remain visible for an organizer to resolve. Manual decisions and reversals survive later replay. A pending queue blocks snapshot purging and service-worker activation until scans are acknowledged.

## Identity and configuration

New organizers sign up through a one-time email link. Guests register without accounts. Event roles grant access to existing events, and the platform-admin email allowlist controls platform operations. Suspended accounts cannot receive sign-in mail or create sessions.

Guest management links, offers, and staff invitations are bearer capabilities. Their digests are stored in Postgres. Their pages disable referrers and caching. Ticket and scanner signatures use P-256. Configuration validates the active private key against its retained public key before issuance, and parsed key objects are cached until configuration changes.

## Verification

`npm run verify` runs lint, generated route types, TypeScript, focused behavioral tests, and the production build. The tests cover conflict decisions, concurrent IndexedDB writers, replay identity, snapshot replacement, signature agreement, signed expiry, and mail failure handling.

`npm run test:db` creates a temporary database on a local Postgres instance, applies the real migrations, and exercises organizer signup, registration, capacity, tickets, waitlists, admission, and corrections. A local HTTP server replaces the email provider. The command closes its connections and removes its own temporary database afterward. It refuses hosted database connections.
