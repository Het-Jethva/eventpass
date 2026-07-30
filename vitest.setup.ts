import { neonConfig } from "@neondatabase/serverless";

// Integration tests connect through `@neondatabase/serverless`, the same driver
// the application uses in production. That driver speaks WebSockets to a Neon
// endpoint, so reaching a local Postgres requires pointing it at the `wsproxy`
// sidecar from `compose.yaml` and disabling the transport assumptions that only
// hold for Neon's managed endpoint.
//
// This runs for tests only. `lib/db/index.ts` is untouched, so production
// behavior is unchanged.

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const isLocalDatabase =
  databaseUrl !== undefined &&
  /@(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9.-]*\blocaltest\.me)(:|\/)/i.test(
    databaseUrl,
  );

if (isLocalDatabase) {
  // `wsproxy` serves the WebSocket bridge at /v1. The Neon endpoint's own /v2
  // path does not exist here, and requesting it fails the upgrade with an
  // ErrorEvent carrying no message.
  const proxyAddress = process.env.NEON_WS_PROXY ?? "localhost:54444";
  neonConfig.wsProxy = () => `${proxyAddress}/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}
