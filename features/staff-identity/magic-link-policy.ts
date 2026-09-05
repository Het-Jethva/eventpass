function withoutTrailingSlash(pathname: string) {
  return pathname.replace(/\/$/, "");
}

export function isStaffMagicLinkRequestPath(pathname: string) {
  return withoutTrailingSlash(pathname) === "/api/auth/sign-in/magic-link";
}

export function isStaffMagicLinkVerifyPath(pathname: string) {
  return withoutTrailingSlash(pathname) === "/api/auth/magic-link/verify";
}
