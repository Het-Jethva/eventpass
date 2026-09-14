import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import {
  checkIn,
  event,
  eventStaff,
  registration,
  ticket,
} from "../../../lib/db/schema";
import {
  OFFLINE_EVENT_SNAPSHOT_VERSION,
  type ScannerPreparationResult,
} from "../offline-snapshot";
import { resolveSnapshotValidityState } from "../check-in-validity";
import { signScannerAuthorization } from "../scanner-authorization";
import { isEventSuspended } from "../../events/server/event-suspension";

type ScannerPreparationDatabase = typeof import("../../../lib/db").db;

type ScannerPreparationDependencies = {
  database: ScannerPreparationDatabase;
  getSigningKey: () => Parameters<typeof signScannerAuthorization>[1];
  getVerificationKeys: () => Record<string, JsonWebKey>;
  now?: () => Date;
};

export type PrepareOfflineScannerInput = {
  eventId: string;
  actorUserId: string;
  scannerDeviceId: string;
  scannerDeviceLabel: string;
};

export function createScannerPreparationService({
  database,
  getSigningKey,
  getVerificationKeys,
  now = () => new Date(),
}: ScannerPreparationDependencies) {
  async function prepareOfflineScanner({
    eventId,
    actorUserId,
    scannerDeviceId,
    scannerDeviceLabel,
  }: PrepareOfflineScannerInput): Promise<ScannerPreparationResult> {
    const UUID_PATTERN =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const label = scannerDeviceLabel.trim();
    if (
      !UUID_PATTERN.test(eventId) ||
      !UUID_PATTERN.test(actorUserId) ||
      !UUID_PATTERN.test(scannerDeviceId) ||
      label.length < 2 ||
      label.length > 80
    ) {
      return { outcome: "event_unavailable" };
    }
    const generatedAt = now();
    return database.transaction(async (transaction) => {
      const [authorizedEvent] = await transaction
        .select({
          id: event.id,
          name: event.name,
          status: event.status,
          eventTimeZone: event.eventTimeZone,
          checkInOpensAt: event.checkInOpensAt,
          checkInClosesAt: event.checkInClosesAt,
          suspended: event.suspended,
        })
        .from(eventStaff)
        .innerJoin(event, eq(event.id, eventStaff.eventId))
        // Any Event Staff, not volunteers alone. `admitOnline` has always
        // accepted every role, so restricting preparation to volunteers left an
        // Owner who scans at their own door able to admit online and unable to
        // download the snapshot that keeps them working when the venue network
        // drops. The snapshot carries no email addresses or answers, so an
        // Organizer gains nothing here they cannot already read.
        .where(and(eq(event.id, eventId), eq(eventStaff.userId, actorUserId)))
        .limit(1);

      if (!authorizedEvent) return { outcome: "unauthorized" };
      if (isEventSuspended(authorizedEvent)) {
        return { outcome: "event_unavailable" };
      }
      if (
        authorizedEvent.status !== "published" &&
        authorizedEvent.status !== "canceled"
      ) {
        return { outcome: "event_unavailable" };
      }

      const ticketRows = await transaction
        .select({
          ticketId: ticket.id,
          ticketCode: ticket.code,
          displayName: registration.attendeeName,
          ticketStatus: ticket.status,
          registrationStatus: registration.status,
          checkInId: checkIn.id,
        })
        .from(ticket)
        .innerJoin(registration, eq(registration.id, ticket.registrationId))
        .leftJoin(
          checkIn,
          and(eq(checkIn.ticketId, ticket.id), isNull(checkIn.invalidatedAt)),
        )
        .where(eq(ticket.eventId, eventId));

      const authorization = signScannerAuthorization(
        {
          eventId,
          volunteerUserId: actorUserId,
          scannerDeviceId,
          issuedAt: generatedAt.toISOString(),
          expiresAt: authorizedEvent.checkInClosesAt.toISOString(),
        },
        getSigningKey(),
      );
      const snapshotFreshAfter = new Date(
        authorizedEvent.checkInOpensAt.getTime() - 2 * 60 * 60 * 1000,
      );

      return {
        outcome: "prepared",
        snapshot: {
          version: OFFLINE_EVENT_SNAPSHOT_VERSION,
          generatedAt: generatedAt.toISOString(),
          serverTimeAnchor: generatedAt.toISOString(),
          event: {
            id: authorizedEvent.id,
            name: authorizedEvent.name,
            status: authorizedEvent.status,
            eventTimeZone: authorizedEvent.eventTimeZone,
            checkInOpensAt: authorizedEvent.checkInOpensAt.toISOString(),
            checkInClosesAt: authorizedEvent.checkInClosesAt.toISOString(),
            snapshotFreshAfter: snapshotFreshAfter.toISOString(),
          },
          scannerDevice: {
            id: scannerDeviceId,
            label: scannerDeviceLabel,
          },
          authorization,
          verificationKeys: getVerificationKeys(),
          tickets: ticketRows.map((row) => ({
            ticketId: row.ticketId,
            ticketCode: row.ticketCode,
            displayName: row.displayName,
            validityState: resolveSnapshotValidityState({
              eventStatus: authorizedEvent.status,
              registrationStatus: row.registrationStatus,
              ticketStatus: row.ticketStatus,
            }),
            existingCheckInState: row.checkInId
              ? ("checked_in" as const)
              : ("not_checked_in" as const),
          })),
        },
      };
    });
  }

  return { prepareOfflineScanner };
}
