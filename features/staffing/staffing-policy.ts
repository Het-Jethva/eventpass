export type EventStaffRole = "owner" | "organizer" | "check_in_volunteer";
export type InviteableStaffRole = Exclude<EventStaffRole, "owner">;

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
