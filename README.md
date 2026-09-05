# EventPass

**Event check-in that keeps working when the venue network does not.**

EventPass runs registration, signed QR tickets, and door admission for
in-person events. What sets it apart is not that it works offline. Plenty of
scanners claim that. It is that it tells you exactly how much an offline scan
is worth.

[eventpass.hetjethva.tech](https://eventpass.hetjethva.tech) ·
[Domain glossary](CONTEXT.md) ·
[Architecture decisions](docs/adr)

> This is a portfolio project on production infrastructure. No demo mode, no
> seeded data, no reset button. Every row in the database got there through the
> same workflow a real organizer would use.
>
> The landing page is the one exception, and it says so on the page. The scan
> outcomes and the ticket you see there are the real components rendered with
> sample props, so the product does not look empty to a stranger who has no
> live event.

---

## The problem

University clubs run events in basements, gyms, and lecture halls where the
network drops. Form tools handle signups but fall apart at the door. They
cannot guarantee single entry, cannot scope a volunteer to one event, keep no
audit trail, and stop working the moment connectivity does.

Writing an offline scanner is easy. Writing one that does not lie is the hard
part. Two isolated phones cannot agree on whether a ticket was already used.
Pretending they can is how the same ticket admits two people and nobody finds
out.

## The approach

EventPass draws the line in the open.

| Connectivity | Guarantee |
|---|---|
| Online | Global single entry, enforced by a partial unique index on active check-ins |
| Offline | Local signature check plus device-local duplicate prevention |
| After sync | Cross-device duplicates surface as conflicts, never silently dropped |

An offline acceptance says *provisional* on screen, with the snapshot age next
to it. Sync decides the real outcome. The earliest high-confidence attempt wins
on its own. Low-confidence clock disagreements go to an organizer, who has to
give a reason. Nothing gets thrown away. Every competing attempt stays in the
record.

[ADR 0001](docs/adr/0001-offline-duplicate-detection-is-best-effort.md) covers
the reasoning.

### Scan authority at the door

```mermaid
sequenceDiagram
    participant S as EventPass server
    participant O as Online phone
    participant A as Offline phone A
    participant B as Offline phone B
    O->>S: Scan while online
    S-->>O: Authoritative admission
    A->>A: Scan while offline
    A-->>A: Provisional local result
    A->>S: Reconnect and sync
    alt No competing offline scan
        S-->>A: Accepted after reconciliation
    else Separate phones scanned offline
        B->>B: Same ticket scanned offline
        B-->>B: Provisional local result
        B->>S: Reconnect and sync
        S-->>A: Visible reconciliation conflict
        S-->>B: Visible reconciliation conflict
    end
```

## What it does

**Organizers** set venue, schedule, IANA time zone, capacity, and the
registration and check-in windows. They build a registration form from
short-text, long-text, single-choice, multiple-choice, and acknowledgment
fields. They import attendees from CSV in one atomic pass with a capacity-aware
preview, export registrations, invite staff scoped to a single event, and watch
a live operations dashboard next to an audit history nobody can edit.

**Attendees** register without an account. A 15-minute hold keeps their place
while they verify by email. They get a signed QR ticket and a 10-character
Crockford Base32 fallback code, join a FIFO waitlist if the event is full, and
manage, resend, replace, or cancel through a bearer link that rotates on every
resend.

**Volunteers** open a mobile scanner with nothing else on the screen. They
admit by camera or by typing the code, and every scan returns exactly one
outcome: accepted, duplicate, invalid, expired, canceled, replaced,
outside-window, provisional, or conflict. When the network drops they keep
going on a downloaded snapshot. They can reverse their own most recent check-in
within 30 seconds, with a reason.

**Platform administrators** suspend and reactivate accounts and events, and
take time-limited, audited support access to one event's attendee data after
giving a reason.

## Engineering notes

<details>
<summary><strong>Tickets are signed, not guessed</strong></summary>

Each ticket is a compact JWS signed with `ES256` from a platform-wide,
versioned ECDSA P-256 key ring. The payload carries a schema version and two
opaque identifiers, nothing else, so handing someone your ticket leaks no
personal information. Private keys stay in deployment secrets. Scanners get
public verification keys only, so stealing a scanner does not let you mint
tickets. Rotated keys keep their public half, so tickets issued earlier still
verify.

A valid signature is necessary and nowhere near sufficient. Admission also
checks event membership, ticket state, existing check-in state, the check-in
window, authorization, and snapshot freshness.

See [ADR 0002](docs/adr/0002-ecdsa-p256-ticket-signatures.md).
</details>

<details>
<summary><strong>Capacity cannot be oversold</strong></summary>

Every capacity-changing operation serializes on a per-event row lock. The count
includes confirmed registrations, unexpired 15-minute holds, and active
admission offers, so a waitlist promotion still in flight already occupies its
place. A decrease that would displace an existing claim is rejected. An
increase promotes the waitlist in FIFO order by email-verification time.

A partial unique constraint enforces one active registration per normalized
email per event. The database does this, not an application check that a race
can slip past.

See [ADR 0005](docs/adr/0005-serialize-capacity-on-a-per-event-row-lock.md).
</details>

<details>
<summary><strong>Expiry does not depend on a scheduler</strong></summary>

Reads and mutations evaluate deadlines as they go, and idempotent
reconciliation rides along on relevant traffic and dashboard activity.
Application logic ignores expired disposable records. At this data volume,
scheduled housekeeping would earn nothing.
</details>

<details>
<summary><strong>The offline snapshot holds as little as possible</strong></summary>

A snapshot holds opaque ticket identifiers, display names, validity state,
existing check-in state, verification keys, and event rules. No email
addresses, no registration answers. One event caches per browser profile. It
has to be refreshed within two hours before check-in opens. Cached data is
purged only after check-in closes and every pending scan attempt has been
acknowledged, and a PWA update waits while unsynchronized attempts exist.

Scanner authorization is a signed capability bound to one event, one volunteer,
and a random device UUID, with no browser fingerprinting, valid through the
check-in window. An expired web session therefore cannot halt admission halfway
through an event. The cost is that an isolated scanner stays authorized until
its capability expires, which
[ADR 0003](docs/adr/0003-time-bounded-offline-scanner-authorization.md)
accepts on purpose.
</details>

<details>
<summary><strong>Scan attempts are idempotent and append-only</strong></summary>

Every scan attempt gets a client-generated UUID before the UI shows acceptance,
then syncs in batches with at-least-once retry semantics. Replaying a batch
creates no second attempt and no second check-in. A known ticket keeps its
opaque identifier. Unknown input keeps only a digest and a rejection reason, so
the audit trail never turns into a pile of scanned secrets.
</details>

<details>
<summary><strong>Bearer capabilities store only digests</strong></summary>

Registration management links, email verification links, staff invitations, and
magic links all come from cryptographically random values. Only SHA-256 digests
are persisted. Plaintext tokens never reach a log or an audit row. Resending a
token-bearing email rotates the token. Email delivery is tracked apart from
domain state, so a provider outage never rolls back a committed registration or
ticket.
</details>

## Architecture

A feature-first modular monolith. Domain authorization and invariant
enforcement live at server-only application-service boundaries, close to the
database. Server actions and route handlers are untrusted transport. They
validate input and return DTOs shaped on purpose.

```
app/         Routes: (workspace) organizer UI, /e public attendee flow,
             /scanner volunteer PWA, /admin, /api route handlers
features/    Domain modules; features/*/server holds server-only services
lib/         Database, auth, email, shared utilities
drizzle/     Database migrations
docs/        Architecture decision records and agent guides
```

Server components call server-only data access directly. There are no internal
HTTP calls. Route handlers exist for scanner synchronization, auth callbacks,
provider webhooks, and CSV import and export.

**Stack:** Next.js 16, React 19, TypeScript, PostgreSQL (Neon), Drizzle ORM,
Better Auth, Zod, Tailwind CSS 4, shadcn/Base UI, Serwist, Dexie, Resend.

## Running locally

You need Node 20 or newer and a PostgreSQL database. The free Neon tier is
plenty.

```bash
git clone https://github.com/Het-Jethva/eventpass.git
cd eventpass
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate
npm run dev
```

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | yes | Session and token signing secret |
| `BETTER_AUTH_URL` | yes | Auth base URL, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL used in emails and links |
| `TICKET_SIGNING_KEY_ID` | yes | Active ticket signing key version |
| `TICKET_SIGNING_PRIVATE_KEY_PEM` | yes | ECDSA P-256 private key (PEM) |
| `TICKET_PUBLIC_KEYS_JSON` | yes | Key ID to public key map for verification |
| `RESEND_API_KEY` | yes | Transactional email delivery |
| `RESEND_FROM_EMAIL` | yes | Verified sending address |
| `RESEND_WEBHOOK_SECRET` | yes | Verifies signed delivery webhooks |
| `PLATFORM_ADMIN_EMAILS` | no | Comma-separated platform administrators |
| `NEON_WS_PROXY` | no | WebSocket bridge host for a local Postgres (see below) |

Generate a ticket signing key pair:

```bash
openssl ecparam -genkey -name prime256v1 -noout -out ticket-key.pem
openssl ec -in ticket-key.pem -pubout -out ticket-key.pub
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run vercel-build` | Deployment build. Applies pending migrations, then builds |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest. Integration suites (`*.integration.test.ts`) skip unless `TEST_DATABASE_URL` is set |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:migrate` | Apply migrations |

### A local database, no Neon account needed

`compose.yaml` starts Postgres alongside Neon's `wsproxy`. The proxy is the
whole point. The application connects through `@neondatabase/serverless`, which
speaks WebSockets instead of the Postgres wire protocol, so it cannot talk to a
plain Postgres container. Bridging it beats swapping in `pg` for local work,
because development then runs on the same driver production runs on, pipelining
and transaction semantics included.

```bash
docker compose up -d
DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm run db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm run dev
```

Unit tests run with `npm test`. Integration tests need the same database:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm test
```

`lib/db/index.ts` points the driver at the proxy whenever the database URL is
local, and does nothing for a hosted Neon URL, so production behaviour does not
change. The ports are odd on purpose. 54432 and 54444 stay clear of an existing
Postgres, and both sit below 55000 because Windows reserves scattered blocks
above that for Hyper-V, where a published port fails to bind.

## Out of scope, deliberately

Payments, seat maps, ticket classes, native apps, microservices, message
queues, WebSockets, public event discovery, attendee accounts, wallet passes,
demo seeding. Preventing cross-device duplicates while offline is also out of
scope, and that one is a design decision rather than a backlog item. v1 detects
and resolves them instead.

## License

[MIT](LICENSE)
