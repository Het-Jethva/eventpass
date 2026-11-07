import "server-only";

export function getConfiguredApplicationUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!configured) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required to create application links.",
    );
  }
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be an absolute HTTP or HTTPS URL.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be an HTTP or HTTPS origin without a path.",
    );
  }
  return url.origin;
}

export function getConfiguredApplicationOrigin() {
  return getConfiguredApplicationUrl();
}
