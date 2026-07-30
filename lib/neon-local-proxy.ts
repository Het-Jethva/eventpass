import { neonConfig } from "@neondatabase/serverless";

/**
 * Points `@neondatabase/serverless` at the `wsproxy` sidecar from
 * `compose.yaml` when the database is a local Postgres.
 *
 * The driver talks WebSockets to a Neon endpoint, so without this it cannot
 * reach a plain Postgres container at all — the connection fails with an
 * `ErrorEvent` carrying no message. Bridging the real driver keeps local
 * development and the integration suites on the same transport production
 * uses, rather than swapping in `pg` and losing its pipelining and transaction
 * semantics.
 *
 * This is a no-op for any hosted database, so production is unaffected: a Neon
 * connection string never matches `isLocalPostgresUrl`.
 */
export function isLocalPostgresUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  return /@(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9.-]*\blocaltest\.me)(:|\/)/i.test(
    databaseUrl,
  );
}

export function configureNeonForLocalPostgres(databaseUrl: string | undefined) {
  if (!isLocalPostgresUrl(databaseUrl)) return false;

  // `wsproxy` serves the bridge at /v1. Neon's own /v2 path does not exist
  // here and fails the upgrade silently.
  const proxyAddress = process.env.NEON_WS_PROXY ?? "localhost:54444";
  neonConfig.wsProxy = () => `${proxyAddress}/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
  return true;
}
