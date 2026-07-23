import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/db", () => ({ db: {} }));

import {
  auditEntry,
  emailDelivery,
  event,
  eventStaff,
  registration,
  ticket,
  user,
} from "../../../lib/db/schema";
import { createPublishedEventApplicationService } from "./published-event-application";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("Published Event application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });
  const eventIds: string[] = [];
  const userIds: string[] = [];
  const deliveryIds: string[] = [];

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    if (eventIds.length > 0) {
      await database.delete(auditEntry).where(inArray(auditEntry.eventId, eventIds));
      const registrations = await database
        .select({ id: registration.id })
        .from(registration)
        .where(inArray(registration.eventId, eventIds));
      const registrationIds = registrations.map(({ id }) => id);
      if (registrationIds.length > 0) {
        await database
          .delete(ticket)
          .where(inArray(ticket.registrationId, registrationIds));
        await database
          .delete(registration)
          .where(inArray(registration.id, registrationIds));
      }
      await database.delete(eventStaff).where(inArray(eventStaff.eventId, eventIds));
      await database.delete(event).where(inArray(event.id, eventIds));
    }
    if (deliveryIds.length > 0) {
      await database
        .delete(emailDelivery)
        .where(inArray(emailDelivery.id, deliveryIds));
    }
    if (userIds.length > 0) {
      await database.delete(user).where(inArray(user.id, userIds));
    }
    await client.end();
  });

  it("cancels once as the owner, invalidates Tickets, and preserves Registration history", async () => {
    const canceledAt = new Date("2030-01-01T12:00:00.000Z");
    const service = createPublishedEventApplicationService({
      database,
      now: () => canceledAt,
      deliverNotification: async (deliveryId) => {
        deliveryIds.push(deliveryId);
      },
    });
    const [owner] = await database
      .insert(user)
      .values({
        name: "Event Owner",
        email: `event-owner-${randomUUID()}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    userIds.push(owner!.id);
    const [createdEvent] = await database
      .insert(event)
      .values({
        name: "Cancellation test",
        description: "Exercises irreversible Event cancellation.",
        slug: `cancellation-test-${randomUUID()}`,
        status: "published",
        eventTimeZone: "UTC",
        startsAt: new Date("2030-01-02T12:00:00.000Z"),
        endsAt: new Date("2030-01-02T14:00:00.000Z"),
        venueName: "Main hall",
        venueAddress: "University Road",
        capacity: 10,
        registrationOpensAt: new Date("2029-12-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2030-01-02T12:00:00.000Z"),
        checkInOpensAt: new Date("2030-01-02T11:00:00.000Z"),
        checkInClosesAt: new Date("2030-01-02T14:00:00.000Z"),
        publishedAt: new Date("2029-12-01T00:00:00.000Z"),
      })
      .returning({ id: event.id });
    eventIds.push(createdEvent!.id);
    await database.insert(eventStaff).values({
      eventId: createdEvent!.id,
      userId: owner!.id,
      role: "owner",
    });
    const [attendee] = await database
      .insert(registration)
      .values({
        eventId: createdEvent!.id,
        attendeeName: "Ada Lovelace",
        email: `attendee-${randomUUID()}@example.com`,
        normalizedEmail: `attendee-${randomUUID()}@example.com`,
        status: "confirmed",
        capacityOutcome: "capacity_hold",
        verifiedAt: new Date("2029-12-15T12:00:00.000Z"),
      })
      .returning({ id: registration.id });
    const ticketId = randomUUID();
    await database.insert(ticket).values({
      id: ticketId,
      eventId: createdEvent!.id,
      registrationId: attendee!.id,
      code: "BCDEFGHJKM",
      signedPayload: "integration-test-payload",
      signingKeyId: "integration-test-key",
    });

    await expect(
      service.cancelPublishedEvent(createdEvent!.id, owner!.id, {
        reason: "The Venue is unavailable.",
      }),
    ).resolves.toEqual({ outcome: "canceled" });

    const [canceledEvent] = await database
      .select({
        status: event.status,
        reason: event.cancellationReason,
        canceledAt: event.canceledAt,
      })
      .from(event)
      .where(eq(event.id, createdEvent!.id));
    const [canceledTicket] = await database
      .select({ status: ticket.status, invalidatedAt: ticket.invalidatedAt })
      .from(ticket)
      .where(eq(ticket.id, ticketId));
    const [preservedRegistration] = await database
      .select({ status: registration.status })
      .from(registration)
      .where(eq(registration.id, attendee!.id));
    expect(canceledEvent).toEqual({
      status: "canceled",
      reason: "The Venue is unavailable.",
      canceledAt,
    });
    expect(canceledTicket).toEqual({ status: "canceled", invalidatedAt: canceledAt });
    expect(preservedRegistration?.status).toBe("confirmed");
    expect(deliveryIds).toHaveLength(1);

    await expect(
      service.cancelPublishedEvent(createdEvent!.id, owner!.id, {
        reason: "Try again.",
      }),
    ).rejects.toThrow("cannot be restored or canceled again");
  });
});
