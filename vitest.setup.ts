import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";

import { configureNeonForLocalPostgres } from "./lib/neon-local-proxy";

function parseEnvFile(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return {};
  const parsed: Record<string, string> = {};
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

const fromFiles = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
};
if (
  process.env.TEST_DATABASE_URL === undefined &&
  fromFiles.TEST_DATABASE_URL
) {
  process.env.TEST_DATABASE_URL = fromFiles.TEST_DATABASE_URL;
}

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
