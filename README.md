# EventPass

**Event check-in that stays trustworthy when the internet does not.**

EventPass handles registration, signed QR tickets, and attendance for in-person
events. Its distinguishing feature is that admission keeps working when the
venue network drops — and it is honest about exactly how far that guarantee
extends.

🔗 **[eventpass.hetjethva.tech](https://eventpass.hetjethva.tech)** ·
📄 [Product spec](docs/specs/eventpass-v1.md) ·
📚 [Domain glossary](CONTEXT.md) ·
🏛 [Architecture decisions](docs/adr)

> A portfolio project running on production infrastructure. There is no demo
> mode, no seeded data, and no reset button — every record in the database was
> created through the same workflows a real organizer would use.
>
> The landing page is the one exception, and it says so on the page: the scan
> outcomes and ticket shown there are the real components rendered with sample
> props, so that what the product looks like does not depend on a stranger
> having a live event.

---

## The problem

University clubs run events in basements, gyms, and lecture halls where the
network is unreliable. Form tools handle signups but not admission: they cannot
guarantee single entry, cannot scope staff to a single event, keep no audit
trail, and stop working entirely at the door when connectivity fails.

Building an offline scanner is easy. Building one that does not *lie* is the
hard part — two isolated devices genuinely cannot agree on whether a ticket was
already used, and pretending otherwise is how duplicate admissions happen
silently.

## The approach

EventPass draws the line explicitly:

| Connectivity | Guarantee |
|---|---|
| Online | Global single-entry, enforced by a partial unique index on active check-ins |
| Offline | Local signature verification + device-local duplicate prevention |
| After sync | Cross-device duplicates surfaced as **conflicts**, never silently dropped |

An offline acceptance is labelled *provisional* in the UI, snapshot age stays on
screen, and synchronization decides the authoritative outcome: the earliest
high-confidence attempt wins automatically, while low-confidence clock
disagreements require a reasoned organizer decision. Every competing attempt is
retained.

That boundary is documented in
[ADR 0001](docs/adr/0001-offline-duplicate-detection-is-best-effort.md).

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

## Feature tour

**Organizers** configure venue, schedule, IANA time zone, capacity, and the
registration and check-in windows; build a registration form from short-text,
long-text, single-choice, multiple-choice, and acknowledgment fields; import
attendees from CSV atomically with a capacity-aware preview; export
registrations; invite staff scoped to a single event; and watch a live
operations dashboard alongside an immutable audit history.

**Attendees** register with no account, hold a place for 15 minutes while they
verify by email, receive a signed QR ticket plus a 10-character Crockford
Base32 fallback code, join a FIFO waitlist when the event is full, and manage,
resend, replace, or cancel through a revocable bearer link.

**Volunteers** open a distraction-free mobile scanner, admit by camera or manual
code entry, read one unmistakable outcome per scan (accepted, duplicate,
invalid, expired, canceled, replaced, outside-window, provisional, conflict),
continue through connectivity loss on a downloaded snapshot, and reverse their
own most recent check-in within 30 seconds with a reason.

**Platform administrators** suspend or reactivate accounts and events, and take
reasoned, time-limited, audited support access to one event's attendee data.

## Engineering notes

<details>
<summary><strong>Tickets are signed, not guessed</strong></summary>

Each ticket is a compact JWS signed with `ES256` from a platform-wide, versioned
ECDSA P-256 key ring. The payload carries only a schema version and two opaque
identifiers, so presenting a ticket discloses no personal information. Private
keys stay in deployment secrets; scanners receive only public verification keys,
so a compromised scanner cannot mint tickets. Rotated keys retain their public
half, keeping previously issued tickets verifiable.

Signature validity is treated as necessary but insufficient — admission also
checks event membership, ticket state, existing check-in state, the check-in
window, authorization, and snapshot freshness.

See [ADR 0002](docs/adr/0002-ecdsa-p256-ticket-signatures.md).
</details>

<details>
<summary><strong>Capacity cannot be oversold</strong></summary>

Capacity-changing operations serialize on a per-event row lock. Event capacity
counts confirmed registrations, unexpired 15-minute capacity holds, *and* active
admission offers, so a waitlist promotion in flight still consumes a place.
Decreases are rejected when they would displace an existing claim; increases
promote the waitlist in FIFO order by email-verification time.

One active registration per normalized email per event is enforced by a partial
unique constraint rather than an application check.
</details>

<details>
<summary><strong>Expiry does not depend on a scheduler</strong></summary>

Deadlines are evaluated during reads and mutations, with idempotent
reconciliation running on relevant traffic and dashboard activity. Expired
disposable records are ignored by application logic, and the intentionally small
data volume does not require scheduled housekeeping.
</details>

<details>
<summary><strong>The offline snapshot holds as little as possible</strong></summary>

A snapshot contains opaque ticket identifiers, display names, validity state,
existing check-in state, verification keys, and event rules — never email
addresses or registration answers. One event may be cached per browser profile,
it must be refreshed within two hours before check-in opens, and cached data is
purged only after check-in closes *and* every pending scan attempt has been
acknowledged. A PWA update is deferred while unsynchronized attempts exist.

Scanner authorization is a signed capability bound to one event, volunteer, and
random device UUID (no browser fingerprinting) through the check-in window, so
an expired web session does not halt admission mid-event. The tradeoff — an
isolated scanner stays authorized until its capability expires — is documented
in [ADR 0003](docs/adr/0003-time-bounded-offline-scanner-authorization.md).
</details>

<details>
<summary><strong>Scan attempts are idempotent and append-only</strong></summary>

Every scan attempt gets a client-generated UUID *before* the UI shows
acceptance, and syncs with at-least-once retry semantics in batches. Replaying a
batch creates no duplicate attempt or check-in. Known tickets keep their opaque
identifier; unknown input keeps only a digest and a rejection reason, so the
audit trail never becomes a store of scanned secrets.
</details>

<details>
<summary><strong>Bearer capabilities store only digests</strong></summary>

Registration management links, email verification links, staff invitations, and
magic links are generated from cryptographically random values; only SHA-256
digests are persisted, and plaintext tokens are never logged or audited. A
retried token-bearing email rotates its token. Email delivery is tracked
independently of domain state — a provider failure never rolls back a committed
registration or ticket.
</details>

## Architecture

A feature-first modular monolith. Domain authorization and invariant enforcement
live at server-only application-service boundaries close to the database; server
actions and route handlers are treated as untrusted transport that validates
input and returns deliberately shaped DTOs.

```
app/         Routes — (workspace) organizer UI, /e public attendee flow,
             /scanner volunteer PWA, /admin, /api route handlers
features/    Domain modules; features/*/server holds server-only services
lib/         Database, auth, email, shared utilities
drizzle/     database migrations
docs/        Product spec and architecture decision records
```

Server components call server-only data access directly — no internal HTTP
calls. Route handlers are reserved for scanner synchronization, auth callbacks,
provider webhooks, and CSV import/export.

**Stack:** Next.js 16 · React 19 · TypeScript · PostgreSQL (Neon) · Drizzle ORM
· Better Auth · Zod · Tailwind CSS 4 · shadcn/Base UI · Serwist · Dexie ·
Resend

## Running locally

Requires Node 20+ and a PostgreSQL database (the free Neon tier is enough).

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
| `TICKET_PUBLIC_KEYS_JSON` | yes | Key ID → public key map for verification |
| `RESEND_API_KEY` | yes | Transactional email delivery |
| `RESEND_FROM_EMAIL` | yes | Verified sending address |
| `RESEND_WEBHOOK_SECRET` | yes | Verifies signed delivery webhooks |
| `PLATFORM_ADMIN_EMAILS` | no | Comma-separated platform administrators |
| `NEON_WS_PROXY` | no | WebSocket bridge host for a local Postgres (see below) |

Generate a ticket signing key pair with:

```bash
openssl ecparam -genkey -name prime256v1 -noout -out ticket-key.pem
openssl ec -in ticket-key.pem -pubout -out ticket-key.pub
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:migrate` | Apply migrations |

### A local database, no Neon account needed

`compose.yaml` brings up Postgres plus Neon's `wsproxy`. The proxy matters: the
application connects through `@neondatabase/serverless`, which speaks WebSockets
rather than the Postgres wire protocol, so it cannot reach a plain Postgres
container directly. Bridging it — rather than substituting `pg` locally — keeps
development on the same driver production uses, including its pipelining and
transaction semantics.

```bash
docker compose up -d
DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm run db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm run dev
```

`lib/db/index.ts` points the driver at the proxy automatically whenever the
database URL is local, and is inert for a hosted Neon URL, so production
behaviour is unchanged. Ports are non-default (54432, 54444) to avoid colliding
with an existing Postgres, and stay below 55000 because Windows reserves
scattered blocks above that for Hyper-V — a port inside one fails to bind.

## Deliberately out of scope

Payments, seat maps, ticket classes, native apps, microservices, message queues,
WebSockets, public event discovery, attendee accounts, wallet passes, and demo
seeding. Offline *prevention* of cross-device duplicates is also out of scope by
design — v1 detects and resolves them instead.

## License

[MIT](LICENSE)
