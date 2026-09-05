import { describe } from "vitest";

/**
 * Integration suites run only when TEST_DATABASE_URL names a database the run
 * may write to and clean up after — the compose.yaml Postgres locally, a
 * service container in CI. Without it they are skipped, not failed, so the
 * unit suite stays runnable anywhere.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
