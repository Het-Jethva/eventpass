import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to use EventPass authentication.");
}

const client = new Pool({ connectionString: databaseUrl });

export const db = drizzle({ client });
