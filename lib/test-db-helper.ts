import { describe } from "vitest";

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

export const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
