import "server-only";

export function getConfiguredApplicationUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!configured) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required to create application links.",
    );
  }
  return configured;
}

export function getConfiguredApplicationOrigin() {
  return new URL(getConfiguredApplicationUrl()).origin;
}
