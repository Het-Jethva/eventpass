<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# EventPass

Event registration and offline-capable check-in. `README.md` has the product and architecture; `CONTEXT.md` is the glossary, and its capitalised terms (Registration, Ticket, Check-in, Capacity Hold, Admission Offer, Event Time Zone…) are the names to use in code, tests and copy. Decisions already made live in `docs/adr/`; when a change would cut across one, say so rather than quietly override it.

## Where code goes

- `features/<feature>/*.ts(x)` — policy and UI that may run anywhere. Pure functions here are the cheapest place to put a rule and a test.
- `features/<feature>/server/<name>-application.ts` — the service: `create…Service({ database, …deps })`, every query and invariant, and `import "server-only"` as its first line. Dependencies (mailers, clocks, token factories) are injected so integration tests can substitute them.
- `features/<feature>/server/<name>.ts` — the one-line facade that wires `db` and the real mailers into the service. Pages, route handlers and actions import this, never the service directly.
- `app/**/actions.ts` — server actions: validate with Zod, call the facade, map domain errors to a sentence a person can act on. Domain logic stays out of `app/`.
- `lib/email/*` — one file per message. Every outbound link is built from `NEXT_PUBLIC_APP_URL`; a request's `Host` header is never a source for a URL.

## Rules the code depends on

- Bearer capabilities (verification, management, offer, invitation, scanner tokens) are stored only as SHA-256 digests. Compare digests, never plaintext.
- Capacity decisions run inside a transaction that has locked the Event row (`lockEventForMutation`, ADR 0005). Anything that confirms, holds, offers or cancels goes through it.
- Every instant shown to a person is formatted in the Event Time Zone. `dateStyle`/`timeStyle` cannot be combined with `timeZoneName` (ECMA-402 throws), so spell components out — see `formatEventRange` in `lib/email/send-ticket.ts`.
- Schema changes: edit `lib/db/schema.ts`, run `npm run db:generate`, commit the new file under `drizzle/`. Migrations are applied by `vercel-build` in deployment and by CI before tests.

## Verifying

`npm run typecheck && npm run lint && npm test` is the bar for every change; `npm run build` before touching `next.config.ts`, the service worker or anything under `app/` that renders statically.

Integration suites (`*.integration.test.ts`) run only when `TEST_DATABASE_URL` is set and skip otherwise. Locally: `docker compose up -d`, then `DATABASE_URL=postgresql://postgres:postgres@localhost:54432/eventpass npm run db:migrate`, then run tests with `TEST_DATABASE_URL` set to the same URL. The app reaches local Postgres through the wsproxy container in `compose.yaml`, so the production driver is the one under test. `next build` uses `--webpack` because `@serwist/next` does not yet support Turbopack.

## Commits

Conventional prefix (`fix(security):`, `test:`, `chore(docs):`), then a body in plain prose that says what was wrong and why this is the fix. Work lands on `main`.
