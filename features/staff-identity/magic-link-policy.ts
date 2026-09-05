export function isStaffMagicLinkRequestPath(pathname: string) {
  return pathname.replace(/\/$/, "").endsWith("/sign-in/magic-link");
}

export function isStaffMagicLinkVerifyPath(pathname: string) {
  return pathname.replace(/\/$/, "").endsWith("/magic-link/verify");
}

export function shouldSendStaffMagicLink({
  hasAccount,
  hasPendingInvitation,
  isConfiguredPlatformAdmin,
}: {
  hasAccount: boolean;
  hasPendingInvitation: boolean;
  isConfiguredPlatformAdmin: boolean;
}) {
  return hasAccount || hasPendingInvitation || isConfiguredPlatformAdmin;
}
