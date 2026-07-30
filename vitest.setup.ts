import { configureNeonForLocalPostgres } from "./lib/neon-local-proxy";

// Integration tests build their own Pool from `@neondatabase/serverless` rather
// than importing `lib/db`, so they need the local proxy configured here too.
configureNeonForLocalPostgres(
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
);
