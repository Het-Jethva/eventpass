import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { configureNeonForLocalPostgres } from "@/lib/neon-local-proxy";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

// Inert unless DATABASE_URL points at a local Postgres, which is the only case
// the driver cannot reach on its own. Must run before the Pool is constructed.
configureNeonForLocalPostgres(process.env.DATABASE_URL);

const client = new Pool({ connectionString: databaseUrl });

export const db = drizzle({ client });

// The pool client and an open transaction both satisfy this. Services take it
// so callers can run work inside one transaction and roll that transaction back.
export type DatabaseClient = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "execute" | "transaction"
>;
