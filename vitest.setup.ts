import { vi } from "vitest";

import { configureNeonForLocalPostgres } from "./lib/neon-local-proxy";

// `server-only` throws whenever it is imported outside a React Server
// Components bundle, which is exactly what a Node test process is. The guard
// exists to keep database code out of browser bundles, not out of tests.
vi.mock("server-only", () => ({}));

// Request throttles digest emails and addresses with this secret. Any value
// works for tests; it just has to exist.
process.env.BETTER_AUTH_SECRET ??= "eventpass-test-secret";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

// Integration tests build their own Pool from `@neondatabase/serverless` rather
// than importing `lib/db`, so they need the local proxy configured here too.
// Only TEST_DATABASE_URL is honoured, so a DATABASE_URL left in the shell can
// never point a test run at a real database.
configureNeonForLocalPostgres(process.env.TEST_DATABASE_URL);
