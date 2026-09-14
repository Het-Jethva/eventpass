# EventPass

Event check-in that stays honest when the venue network drops.

EventPass runs registration, signed QR tickets, and door admission for in-person events. It works offline at the door. It also tells you exactly what an offline scan is worth.

[Live site](https://eventpass.hetjethva.tech) ·
[Live demo](https://eventpass.hetjethva.tech/demo) ·
[Domain glossary](CONTEXT.md) ·
[Architecture decisions](docs/adr)

> This is a portfolio project on production infrastructure. Production has no seeded data. Every database row got there through the same workflow a real organizer uses.
>
> The public `/demo` route is demo mode. It walks through registration, the operations dashboard, and the door scanner with sample data. It runs entirely in the browser. It stores nothing. It resets on refresh or with Start over. The ticket and scan outcomes shown there are the real components rendered with sample props.

## The problem

University clubs run events in basements, gyms, and lecture halls where the network drops. Form tools handle signups but fall apart at the door. They cannot guarantee single entry. They cannot scope a volunteer to one event. They keep no audit trail. They stop working the moment connectivity drops.

Writing an offline scanner is easy. Writing one that does not lie is hard. Two isolated phones cannot agree on whether a ticket was already used. Pretending they can is how one ticket admits two people with no record.

## The approach

EventPass draws the line in the open.

| Connectivity | Guarantee |
|---|---|
| Online | Global single entry. A partial unique index enforces one active check-in per ticket. |
| Offline | Local signature check plus device-local duplicate prevention. |
| After sync | Cross-device duplicates surface as conflicts. They are never dropped silently. |

An offline acceptance shows as provisional on screen, with the snapshot age next to it. Sync decides the final outcome. The earliest high-confidence attempt wins on its own. Low-confidence clock disagreements go to an organizer, who must give a reason. Nothing is thrown away. Every competing attempt stays in the record.

[ADR 0001](docs/adr/0001-offline-duplicate-detection-is-best-effort.md) covers the reasoning.

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

Organizers set venue, schedule, IANA time zone, capacity, and the registration and check-in windows. They build a registration form from short-text, long-text, single-choice, multiple-choice, and acknowledgment fields. They import attendees from CSV in one atomic pass with a capacity-aware preview. They export registrations. They invite staff scoped to a single event. They watch a live operations dashboard next to an audit history nobody can edit.

Attendees register without an account. A 15-minute hold keeps their place while they verify by email. They receive a signed QR ticket and a 10-character Crockford Base32 fallback code. They join a FIFO waitlist if the event is full. They manage, resend, replace, or cancel through a bearer link that rotates on every resend.

Volunteers open a mobile scanner with nothing else on the screen. They admit by camera or by typed code. Every scan returns one outcome. Examples are accepted, duplicate, invalid, expired, canceled, replaced, outside window, provisional, and conflict. The full set lives in `AdmissionOutcome` in `features/admission/server/admission-application.ts`. When the network drops, volunteers keep going on a downloaded snapshot. They can reverse their own most recent check-in within 30 seconds, with a reason.

Platform administrators suspend and reactivate accounts and events. They take time-limited, audited support access to one event's attendee data after giving a reason.

## Routes

The app groups its surfaces by audience.

- `/` is the marketing landing page.
- `/demo` is the public guided demo. It uses sample props and stores nothing.
- `/sign-in` is staff sign-in, including magic link and email confirmation.
- `/e/[slug]` is the public attendee flow. It covers registration, email verification, and the verification result.
- `/tickets/[token]` is the attendee ticket view behind a bearer capability.
- `/offers/[token]` is the waitlist admission offer behind a bearer capability.
- `/staff-invitations/[token]` accepts a staff invitation behind a bearer capability.
- `app/(workspace)` holds the organizer workspace. It covers the event list, event creation, and the per-event sections for overview, form, registrations, check-in, staff, audit, and edit.
- `/scanner/[eventId]` is the volunteer scanner PWA.
- `/admin` is the platform administration surface.
- `/api` holds route handlers for scanner sync, auth callbacks, Resend webhooks, live metrics, and CSV import preview, import confirm, and export.

## Engineering notes

<details>
<summary><strong>Tickets are signed, not guessed</strong></summary>

Each ticket is a compact JWS signed with `ES256` from a platform-wide, versioned ECDSA P-256 key ring. The payload carries a schema version and two opaque identifiers, and nothing else. A ticket therefore leaks no personal information. Private keys stay in deployment secrets. Scanners get public verification keys only, so a stolen scanner cannot mint tickets. Rotated keys keep their public half, so earlier tickets still verify.

A valid signature is necessary and not sufficient. Admission also checks event membership, ticket state, existing check-in state, the check-in window, authorization, and snapshot freshness.

See [ADR 0002](docs/adr/0002-ecdsa-p256-ticket-signatures.md).

</details>

<details>
<summary><strong>Capacity cannot be oversold</strong></summary>

Every capacity-changing operation serializes on a per-event row lock. The count includes confirmed registrations, unexpired 15-minute holds, and active admission offers. A waitlist promotion still in flight already occupies its place. A decrease that would displace an existing claim is rejected. An increase promotes the waitlist in FIFO order by email-verification time.

A partial unique constraint enforces one active registration per normalized email per event. The database enforces this. No application check can be raced past it.

See [ADR 0005](docs/adr/0005-serialize-capacity-on-a-per-event-row-lock.md).

</details>

<details>
<summary><strong>Expiry does not depend on a scheduler</strong></summary>

Reads and mutations evaluate deadlines as they go. Idempotent reconciliation rides along on relevant traffic and dashboard activity. Application logic ignores expired disposable records. At this data volume, scheduled housekeeping would earn nothing.

</details>

<details>
<summary><strong>The offline snapshot holds as little as possible</strong></summary>

A snapshot holds opaque ticket identifiers, display names, validity state, existing check-in state, verification keys, and event rules. It holds no email addresses and no registration answers. One event is cached per browser profile. The snapshot must be refreshed within two hours before check-in opens. Cached data is purged only after check-in closes and every pending scan attempt has been acknowledged. A PWA update waits while unsynchronized attempts exist.

Scanner authorization is a signed capability bound to one event, one volunteer, and one random device UUID. There is no browser fingerprinting. It stays valid through the check-in window. An expired web session therefore cannot halt admission halfway through an event. The cost is that an isolated scanner stays authorized until its capability expires. [ADR 0003](docs/adr/0003-time-bounded-offline-scanner-authorization.md) accepts this on purpose.

</details>

<details>
<summary><strong>Scan attempts are idempotent and append-only</strong></summary>

Every scan attempt gets a client-generated UUID before the UI shows acceptance. It then syncs in batches with at-least-once retry semantics. Replaying a batch creates no second attempt and no second check-in. A known ticket keeps its opaque identifier. Unknown input keeps only a digest and a rejection reason. The audit trail never becomes a pile of scanned secrets.

</details>

<details>
<summary><strong>Bearer capabilities store only digests</strong></summary>

Registration management links, email verification links, staff invitations, and magic links all come from cryptographically random values. Only SHA-256 digests are persisted. Plaintext tokens never reach a log or an audit row. Resending a token-bearing email rotates the token. Email delivery is tracked apart from domain state, so a provider outage never rolls back a committed registration or ticket.

</details>

## Architecture

EventPass is a feature-first modular monolith. Domain authorization and invariant enforcement live at server-only application-service boundaries, close to the database. Server actions and route handlers are untrusted transport. They validate input and return DTOs shaped on purpose.

```text
app/         Routes. Organizer workspace, public attendee flow in /e,
             volunteer scanner in /scanner, /admin, /demo, bearer
             routes in /tickets, /offers, /staff-invitations, /api handlers
features/    Domain modules. Each feature keeps UI beside it.
             features/*/server holds server-only services.
lib/         Database client and schema in lib/db, auth, email, shared utilities
components/  Shared UI, including components/ui primitives
drizzle/     Generated database migrations
docs/        Architecture decision records in docs/adr, agent guides in docs/agents
types/       Shared ambient type declarations
public/      Static assets and the built service worker
```

Server components call server-only data access directly. There are no internal HTTP calls. Route handlers exist for scanner sync in `app/api/scanner/sync/route.ts`, auth callbacks in `app/api/auth/[...all]/route.ts`, Resend webhooks in `app/api/webhooks/resend/route.ts`, live metrics in `app/api/events/[eventId]/live-metrics/route.ts`, and CSV import preview, import confirm, and export under `app/api/events/[eventId]/registrations/`.

Staff identity uses Better Auth with email magic links. See [ADR 0004](docs/adr/0004-better-auth-for-staff-identity.md).

Stack:

- Next.js 16 and React 19 with TypeScript
- PostgreSQL on Neon, reached through `@neondatabase/serverless`
- Drizzle ORM with migrations in `drizzle/`
- Better Auth, Zod, Tailwind CSS 4, Base UI, Serwist, Dexie, Resend
- QR scanning through `@zxing/browser`, ticket rendering through `qrcode`

## Running locally

You need Node 20.9 or newer and a PostgreSQL database. The free Neon tier is enough. CI runs Node 24, as set in `.github/workflows/ci.yml`.

```bash
git clone https://github.com/Het-Jethva/eventpass.git
cd eventpass
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
# then fill in the values below
npm run db:migrate
npm run dev
```

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | yes | Session and token signing secret |
| `BETTER_AUTH_URL` | yes | Auth base URL, for example `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL used in emails and links |
| `TICKET_SIGNING_KEY_ID` | yes | Active ticket signing key version |
| `TICKET_SIGNING_PRIVATE_KEY_PEM` | yes | ECDSA P-256 private key in PEM format |
| `TICKET_PUBLIC_KEYS_JSON` | yes | Map of key ID to public key for verification |
| `RESEND_API_KEY` | yes | Transactional email delivery |
| `RESEND_FROM_EMAIL` | yes | Verified sending address |
| `RESEND_WEBHOOK_SECRET` | yes | Verifies signed delivery webhooks |
| `PLATFORM_ADMIN_EMAILS` | no | Comma-separated platform administrators |
| `THROTTLE_SECRET` | no | Throttle HMAC secret. Falls back to `BETTER_AUTH_SECRET` |
| `NEON_WS_PROXY` | no | WebSocket bridge host for a local Postgres. See below |
| `TEST_DATABASE_URL` | no | Integration tests only. Vitest reads this name from the environment or `.env.local`. It never falls back to `DATABASE_URL` |

Generate a ticket signing key pair:

```bash
openssl ecparam -genkey -name prime256v1 -noout -out ticket-key.pem
openssl ec -in ticket-key.pem -pubout -out ticket-key.pub
```

Turn those PEM files into the env values `.env.example` expects. `TICKET_PUBLIC_KEYS_JSON` is a JSON object, not the raw public PEM:

```bash
node -e "const fs=require('fs'); const id='2026-01'; const priv=fs.readFileSync('ticket-key.pem','utf8').trim(); const pub=fs.readFileSync('ticket-key.pub','utf8').trim(); console.log('TICKET_SIGNING_KEY_ID='+id); console.log('TICKET_SIGNING_PRIVATE_KEY_PEM='+JSON.stringify(priv)); console.log('TICKET_PUBLIC_KEYS_JSON='+JSON.stringify({[id]: pub}));"
```

Paste the three lines into `.env.local`. `npm run db:migrate` and `db:generate` load `.env.local`, then `.env`. A shell `DATABASE_URL` still wins.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run vercel-build` | Deployment build. Applies pending migrations, then builds |
| `npm start` | Serves a production build |
| `npm run lint` | ESLint over `app`, `components`, `features`, `lib`, `types`, and `drizzle.config.ts` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest. Integration suites (`*.integration.test.ts`) skip unless `TEST_DATABASE_URL` is set |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:migrate` | Apply migrations |

### A local database, no Neon account needed

`compose.yaml` starts Postgres alongside Neon's `wsproxy`. The proxy is the whole point. The application connects through `@neondatabase/serverless`, which speaks WebSockets instead of the Postgres wire protocol, so it cannot talk to a plain Postgres container. Bridging it beats swapping in `pg` for local work, because development then runs on the same driver production runs on, pipelining and transaction semantics included.

```bash
docker compose up -d
DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm run db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm run dev
```

PowerShell does not accept `VAR=value cmd`. Assign the URL first:

```powershell
docker compose up -d
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:54432/eventpass"
npm run db:migrate
npm run dev
```

Unit tests run with `npm test`. Integration tests need the same database:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm test
```

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:54432/eventpass"
npm test
```

`lib/db/index.ts` points the driver at the proxy whenever the database URL is local. It does nothing for a hosted Neon URL, so production behavior does not change. The ports are odd on purpose. 54432 and 54444 stay clear of an existing Postgres. Both sit below 55000 because Windows reserves scattered blocks above that for Hyper-V, where a published port fails to bind.

## Checks before you push

CI runs the same four checks on every push to `main` and every pull request.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Integration tests need `TEST_DATABASE_URL`. CI points it at the same Postgres service that `compose.yaml` describes. See `.github/workflows/ci.yml`.

## Out of scope, deliberately

Payments, seat maps, ticket classes, native apps, microservices, message queues, WebSockets, public event discovery, attendee accounts, wallet passes, and seeded production data. Preventing cross-device duplicates while offline is also out of scope. That one is a design decision rather than a backlog item. Version 1 detects and resolves them instead.

## Language and decisions

`CONTEXT.md` defines the domain language. Use those names in code and docs. Event, Registration, Ticket, Check-in, and Check-in Conflict each mean one specific thing there.

`docs/adr` holds the five decisions that shape this project.

- `0001-offline-duplicate-detection-is-best-effort.md`
- `0002-ecdsa-p256-ticket-signatures.md`
- `0003-time-bounded-offline-scanner-authorization.md`
- `0004-better-auth-for-staff-identity.md`
- `0005-serialize-capacity-on-a-per-event-row-lock.md`

## License

[MIT](LICENSE)
