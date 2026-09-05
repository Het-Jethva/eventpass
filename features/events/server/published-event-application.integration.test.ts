import { createHash, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/db", () => ({ db: {} }));

import {
  admissionOffer,
  auditEntry,
  emailDelivery,
  event,
  eventStaff,
  registration,
  ticket,
  user,
} from "../../../lib/db/schema";
import { createPublishedEventApplicationService } from "./published-event-application";

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
      // Audit Entries are append-only in the schema: migration 0009 installs a
      // `prevent_audit_entry_mutation` trigger that raises on delete. That is
      // the behavior the product promises, so teardown suppresses the trigger
      // for its own transaction rather than the schema relaxing for tests.
      // Without this the Events below cannot be removed at all — `audit_entry`
      // references them with `on delete restrict`.
      await database.transaction(async (transaction) => {
        await transaction.execute(sql`set local session_replication_role = replica`);
        await transaction
          .delete(auditEntry)
          .where(inArray(auditEntry.eventId, eventIds));
      });
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
          .delete(admissionOffer)
          .where(inArray(admissionOffer.registrationId, registrationIds));
        await database
          .delete(registration)
          .where(inArray(registration.id, registrationIds));
      }
      await database.delete(eventStaff).where(inArray(eventStaff.eventId, eventIds));
      // Email Deliveries must go before their Events: plan 005 gave
      // `email_delivery` a real `event_id` foreign key, so deleting the Event
      // first violates it. Scoped by Event rather than by `deliveryIds` because
      // the service under test creates deliveries this suite never sees.
      await database
        .delete(emailDelivery)
        .where(inArray(emailDelivery.eventId, eventIds));
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

  it("expires active Admission Offers when the Registration Window is shortened past them", async () => {
    const changedAt = new Date("2030-01-01T12:00:00.000Z");
    const service = createPublishedEventApplicationService({
      database,
      now: () => changedAt,
    });
    const [owner] = await database
      .insert(user)
      .values({
        name: "Window Owner",
        email: `window-owner-${randomUUID()}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    userIds.push(owner!.id);
    const [createdEvent] = await database
      .insert(event)
      .values({
        name: "Window clamp test",
        description: "Shortening registration must expire outstanding offers.",
        slug: `window-clamp-${randomUUID()}`,
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
      .returning({ id: event.id, slug: event.slug });
    eventIds.push(createdEvent!.id);
    await database.insert(eventStaff).values({
      eventId: createdEvent!.id,
      userId: owner!.id,
      role: "owner",
    });
    const waitlistEmail = `waitlist-${randomUUID()}@example.com`;
    const [waitlisted] = await database
      .insert(registration)
      .values({
        eventId: createdEvent!.id,
        attendeeName: "Waitlisted Attendee",
        email: waitlistEmail,
        normalizedEmail: waitlistEmail,
        status: "waitlisted",
        capacityOutcome: "waitlist",
        verifiedAt: new Date("2029-12-15T12:00:00.000Z"),
      })
      .returning({ id: registration.id });
    const [offer] = await database
      .insert(admissionOffer)
      .values({
        registrationId: waitlisted!.id,
        tokenDigest: createHash("sha256").update(`offer-${randomUUID()}`).digest("hex"),
        status: "active",
        expiresAt: new Date("2030-01-02T00:00:00.000Z"),
      })
      .returning({ id: admissionOffer.id });

    await service.updatePublishedEvent(createdEvent!.id, owner!.id, {
      name: "Window clamp test",
      description: "Shortening registration must expire outstanding offers.",
      slug: createdEvent!.slug,
      eventTimeZone: "UTC",
      startsAtLocal: "2030-01-02T12:00",
      endsAtLocal: "2030-01-02T14:00",
      venueName: "Main hall",
      venueAddress: "University Road",
      venueMapUrl: "",
      capacity: 10,
      registrationOpensAtLocal: "2029-12-01T00:00",
      registrationClosesAtLocal: "2030-01-01T12:00",
      checkInOpensAtLocal: "2030-01-02T11:00",
      checkInClosesAtLocal: "2030-01-02T14:00",
    });

    const [expiredOffer] = await database
      .select({ status: admissionOffer.status, expiresAt: admissionOffer.expiresAt })
      .from(admissionOffer)
      .where(eq(admissionOffer.id, offer!.id));
    const [expiredRegistration] = await database
      .select({ status: registration.status })
      .from(registration)
      .where(eq(registration.id, waitlisted!.id));
    expect(expiredOffer?.status).toBe("expired");
    expect(expiredOffer?.expiresAt).toEqual(changedAt);
    expect(expiredRegistration?.status).toBe("expired");
  });
});
