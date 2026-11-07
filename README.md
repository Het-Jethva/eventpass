# EventPass

Event registration, QR tickets, and door check-in that continues when the venue loses its network.

Guests register without accounts. Organizers manage capacity, custom forms, waitlists, staff, and audit history. Volunteers scan signed tickets online or prepare a phone for offline admission. Offline scans stay visibly provisional until reconciliation, and conflicts remain available for review.

## Run locally

Use Node 24, npm, and Docker.

1. Run `npm ci`.
2. Run `docker compose up -d`.
3. Copy `.env.example` to `.env.local`.
4. Set `BETTER_AUTH_SECRET` to a random secret of at least 32 characters.
5. Run `npm run keys:generate` and copy its three ticket-key variables into `.env.local`.
6. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to use signup and guest email.
7. Run `npm run db:migrate`.
8. Run `npm run dev` and open [EventPass](http://localhost:3000).

The [demo](http://localhost:3000/demo) needs no account and sends no email. To create a real event, sign in with your email. First-time organizers get an account after confirming their link.

Local Postgres uses port `54432`. The Neon WebSocket bridge uses `54444`, so the application exercises the same database driver locally and in production.

## Configure the application

Keep secrets in `.env.local` or your deployment environment.

| Variable                         | Purpose                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                   | Postgres connection string. The example defaults to local Docker.                          |
| `NEXT_PUBLIC_APP_URL`            | Public HTTP or HTTPS origin, without a path, query, or fragment.                           |
| `BETTER_AUTH_SECRET`             | Session secret with at least 32 random characters.                                         |
| `BETTER_AUTH_URL`                | Auth origin. Used as the application-origin fallback when `NEXT_PUBLIC_APP_URL` is absent. |
| `PLATFORM_ADMIN_EMAILS`          | Optional comma-separated platform-admin allowlist.                                         |
| `RESEND_API_KEY`                 | Transactional email credential.                                                            |
| `RESEND_FROM_EMAIL`              | Sender address on a verified Resend domain.                                                |
| `RESEND_WEBHOOK_SECRET`          | Signature secret for `/api/webhooks/resend`.                                               |
| `TICKET_SIGNING_KEY_ID`          | Active signing-key identifier.                                                             |
| `TICKET_SIGNING_PRIVATE_KEY_PEM` | P-256 private key used for ticket and scanner signatures.                                  |
| `TICKET_PUBLIC_KEYS_JSON`        | Map of signing-key identifiers to retained PEM public keys.                                |
| `NEON_WS_PROXY`                  | Optional local bridge address. Defaults to `localhost:54444`.                              |
| `THROTTLE_SECRET`                | Optional throttle HMAC secret. Defaults to `BETTER_AUTH_SECRET`.                           |

For production, use a hosted Postgres connection string and your public origin. Retain previous public keys when rotating the signing key so existing tickets continue to verify. Restart the application after changing deployment configuration.

## Verify changes

Run `npm run verify` for lint, route types, TypeScript, focused tests, and the production build. Run `npm audit` to check the installed dependency tree.

With local Postgres and its bridge running, run `npm run test:db` for the full database workflow. This command creates and removes its own temporary database, uses a local fake email provider, and refuses hosted database connections. It reads `.env.local`; the Postgres user needs permission to create databases.

For a manual check, register a guest in the demo, open the door scanner, simulate an offline scan, scan again, and reconnect. The confirmed count increases once after synchronization.

## Commands

| Command                 | Action                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Start Next.js with webpack.                                   |
| `npm run build`         | Build the production app and service worker.                  |
| `npm start`             | Serve the production build.                                   |
| `npm run check`         | Run lint and TypeScript checks.                               |
| `npm test`              | Run focused behavioral tests without external services.       |
| `npm run test:db`       | Verify the complete workflow against isolated local Postgres. |
| `npm run verify`        | Run checks, tests, and the production build.                  |
| `npm run keys:generate` | Print matching P-256 key variables for an environment file.   |
| `npm run db:generate`   | Generate a migration from the Drizzle schema.                 |
| `npm run db:migrate`    | Apply database migrations.                                    |
| `npm run vercel-build`  | Apply migrations and build for deployment.                    |

## Code

The app uses Next.js App Router, React, Drizzle with Postgres, Better Auth magic links, Resend, Serwist, Dexie, ZXing, Tailwind, and Base UI.

`app` contains routes and transport adapters. `features` contains domain operations, shared policies, and product components. `lib` contains database, identity, configuration, and email infrastructure. `components/ui` contains the shared UI components.

Read [the architecture notes](docs/architecture.md) for transaction ownership, capacity rules, offline reconciliation, and verification details.
