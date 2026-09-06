export type EventStaffRole = "owner" | "organizer" | "check_in_volunteer";
export type InviteableStaffRole = Exclude<EventStaffRole, "owner">;

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

export function roleSatisfiesMinimum(
  role: string | null | undefined,
  minimum: EventStaffRole,
) {
  return (
    (EVENT_STAFF_ROLE_RANK[role as EventStaffRole] ?? -1) >=
    EVENT_STAFF_ROLE_RANK[minimum]
  );
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
