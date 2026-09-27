import { parseEnum } from "@/lib/parse-enum";

export const eventStaffRoles = [
  "owner",
  "organizer",
  "check_in_volunteer",
] as const;

export type EventStaffRole = (typeof eventStaffRoles)[number];

export const inviteableStaffRoles = ["organizer", "check_in_volunteer"] as const;

export type InviteableStaffRole = (typeof inviteableStaffRoles)[number];

export function parseEventStaffRole(value: string): EventStaffRole {
  return parseEnum(value, eventStaffRoles, "event staff role");
}

export function parseInviteableStaffRole(value: string): InviteableStaffRole {
  return parseEnum(value, inviteableStaffRoles, "staff invitation role");
}

/**
 * The Event Staff lattice: Check-in Volunteer < Organizer < Event Owner.
 * Every "may this staff member…" question ranks against it, so a future
 * role slots into one table instead of N comparisons scattered per caller.
 */
const EVENT_STAFF_ROLE_RANK: Record<EventStaffRole, number> = {
  check_in_volunteer: 0,
  organizer: 1,
  owner: 2,
};

function staffRoleRank(role: string | null | undefined) {
  if (role == null) return -1;
  for (const candidate of eventStaffRoles) {
    if (candidate === role) return EVENT_STAFF_ROLE_RANK[candidate];
  }
  return -1;
}

export function roleSatisfiesMinimum(
  role: string | null | undefined,
  minimum: EventStaffRole,
) {
  return staffRoleRank(role) >= EVENT_STAFF_ROLE_RANK[minimum];
}

export function isOrganizerOrOwner(role: string | null | undefined) {
  return roleSatisfiesMinimum(role, "organizer");
}

export function isEventOwner(role: string | null | undefined) {
  return roleSatisfiesMinimum(role, "owner");
}

export function canManageRole(
  actorRole: EventStaffRole,
  targetRole: InviteableStaffRole,
) {
  return actorRole === "owner" ||
    (actorRole === "organizer" && targetRole === "check_in_volunteer");
}

export function staffEventHomePath(role: string, eventId: string) {
  return role === "check_in_volunteer" ? `/scanner/${eventId}` : `/events/${eventId}`;
}

export function scannerExitPath(role: string, eventId: string) {
  return role === "check_in_volunteer" ? "/events" : `/events/${eventId}`;
}
