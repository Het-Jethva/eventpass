export const STAFF_MAGIC_LINK_CONSUME_PARAM = "ep_confirm";

function withoutTrailingSlash(pathname: string) {
  return pathname.replace(/\/$/, "");
}

export function isStaffMagicLinkRequestPath(pathname: string) {
  return withoutTrailingSlash(pathname) === "/api/auth/sign-in/magic-link";
}

export function isStaffMagicLinkVerifyPath(pathname: string) {
  return withoutTrailingSlash(pathname) === "/api/auth/magic-link/verify";
}

export function isStaffMagicLinkConsumeRequest(url: URL) {
  return (
    isStaffMagicLinkVerifyPath(url.pathname) &&
    url.searchParams.get(STAFF_MAGIC_LINK_CONSUME_PARAM) === "1"
  );
}

export function staffMagicLinkConfirmPath(token: string, callbackURL?: string) {
  const path = new URL("/sign-in/confirm", "https://eventpass.invalid");
  path.searchParams.set("token", token);
  if (callbackURL) path.searchParams.set("callbackURL", callbackURL);
  return `${path.pathname}?${path.searchParams.toString()}`;
}

export function staffMagicLinkConsumePath(
  token: string,
  callbackURL: string,
  errorCallbackURL: string,
) {
  const path = new URL("/api/auth/magic-link/verify", "https://eventpass.invalid");
  path.searchParams.set("token", token);
  path.searchParams.set("callbackURL", callbackURL);
  path.searchParams.set("errorCallbackURL", errorCallbackURL);
  path.searchParams.set(STAFF_MAGIC_LINK_CONSUME_PARAM, "1");
  return `${path.pathname}?${path.searchParams.toString()}`;
}
