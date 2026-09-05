export class PlatformAdminError extends Error {}

export class PlatformAdminRequiredError extends PlatformAdminError {
  constructor(message = "Platform Administrator access required.") {
    super(message);
    this.name = "PlatformAdminRequiredError";
  }
}

export class InvalidAdminReasonError extends PlatformAdminError {
  constructor(message = "An explicit reason is required for administrator actions.") {
    super(message);
    this.name = "InvalidAdminReasonError";
  }
}

export class SupportAccessRequiredError extends PlatformAdminError {
  constructor(
    message = "Active, reasoned Support Access is required to inspect attendee data.",
  ) {
    super(message);
    this.name = "SupportAccessRequiredError";
  }
}

export class SupportAccessExpiredError extends PlatformAdminError {
  constructor(message = "Support Access has expired.") {
    super(message);
    this.name = "SupportAccessExpiredError";
  }
}

export class EventSuspendedError extends PlatformAdminError {
  constructor(message = "This Event is currently unavailable.") {
    super(message);
    this.name = "EventSuspendedError";
  }
}

export class UserSuspendedError extends PlatformAdminError {
  constructor(message = "This staff account is suspended.") {
    super(message);
    this.name = "UserSuspendedError";
  }
}

export class AdminSelfActionError extends PlatformAdminError {
  constructor(message = "You cannot suspend your own account.") {
    super(message);
    this.name = "AdminSelfActionError";
  }
}

export function assertNotSelfAdminAction(
  actorUserId: string,
  targetUserId: string,
) {
  if (actorUserId === targetUserId) {
    throw new AdminSelfActionError();
  }
}

export function parsePlatformAdminEmails(envValue?: string): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isPlatformAdmin({
  userEmail,
  isPlatformAdminFlag,
  configuredAdminEmails,
}: {
  userEmail?: string | null;
  isPlatformAdminFlag?: boolean | null;
  configuredAdminEmails?: string[];
}): boolean {
  if (isPlatformAdminFlag === true) {
    return true;
  }

  if (!userEmail) {
    return false;
  }

  const normalized = userEmail.trim().toLowerCase();
  const adminEmails =
    configuredAdminEmails ?? parsePlatformAdminEmails(process.env.PLATFORM_ADMIN_EMAILS);

  return adminEmails.includes(normalized);
}

export function validateAdminReason(reason?: string | null): string {
  if (!reason || reason.trim().length === 0) {
    throw new InvalidAdminReasonError();
  }
  return reason.trim();
}

export function isSupportAccessActive({
  expiresAt,
  revokedAt,
  now = new Date(),
}: {
  expiresAt: Date;
  revokedAt?: Date | null;
  now?: Date;
}): boolean {
  if (revokedAt) {
    return false;
  }
  return expiresAt.getTime() > now.getTime();
}
