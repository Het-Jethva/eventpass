export class PublishedEventChangeError extends Error {}

export type PublishedEventConfiguration = {
  role: string;
  name: string;
  description: string;
  eventTimeZone: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  venueAddress: string;
  venueMapUrl: string | null;
  capacity: number;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  checkInOpensAt: Date;
  checkInClosesAt: Date;
};

export function assertPostCheckInChangeAllowed(
  current: PublishedEventConfiguration,
  next: Omit<PublishedEventConfiguration, "role">,
) {
  const immutableValuesChanged =
    next.name !== current.name ||
    next.description !== current.description ||
    next.eventTimeZone !== current.eventTimeZone ||
    next.startsAt.getTime() !== current.startsAt.getTime() ||
    next.venueName !== current.venueName ||
    next.venueAddress !== current.venueAddress ||
    next.venueMapUrl !== current.venueMapUrl ||
    next.capacity !== current.capacity ||
    next.registrationOpensAt.getTime() !==
      current.registrationOpensAt.getTime() ||
    next.registrationClosesAt.getTime() !==
      current.registrationClosesAt.getTime() ||
    next.checkInOpensAt.getTime() !== current.checkInOpensAt.getTime();
  if (
    current.role !== "owner" ||
    immutableValuesChanged ||
    next.endsAt < current.endsAt ||
    next.checkInClosesAt < current.checkInClosesAt
  ) {
    throw new PublishedEventChangeError(
      "After check-in opens, only the Event Owner can extend the Event end or Check-in close.",
    );
  }
}
