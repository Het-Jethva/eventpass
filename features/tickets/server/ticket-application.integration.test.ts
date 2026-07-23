import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  admissionOffer,
  capacityHold,
  event,
  registration,
  registrationAnswer,
  registrationField,
  registrationVerification,
  ticket,
} from "../../../lib/db/schema";
import { digestBearerToken, createTicketApplicationService } from "./ticket-application";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });

describeWithDatabase("Ticket application service", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });
  const eventIds: string[] = [];
  const offeredTokens: string[] = [];
  const sentTicketCodes: string[] = [];
  let managementTokenSequence = 0;
  const service = createTicketApplicationService({
    database,
    now: () => new Date("2030-01-01T12:00:00.000Z"),
    getSigningKey: () => ({ id: "integration-key", privateKey }),
    sendTicketEmail: async ({ ticketCode }) => {
      sentTicketCodes.push(ticketCode);
    },
    sendAdmissionOfferEmail: async ({ token }) => {
      offeredTokens.push(token);
    },
    createManagementToken: () =>
      randomBytes(32 + (managementTokenSequence++ % 2)).toString("base64url"),
  });

  async function createHeldRegistration(
    expiresAt = new Date("2030-01-01T12:15:00.000Z"),
    capacity = 5,
  ) {
    const [createdEvent] = await database
      .insert(event)
      .values({
        name: "Ticket integration test",
        description: "Exercises confirmation and Ticket issuance.",
        slug: `ticket-test-${randomUUID()}`,
        status: "published",
        eventTimeZone: "UTC",
        startsAt: new Date("2030-01-02T12:00:00.000Z"),
        endsAt: new Date("2030-01-02T14:00:00.000Z"),
        venueName: "Test Venue",
        venueAddress: "Test address",
        capacity,
        registrationOpensAt: new Date("2029-12-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2030-01-02T12:00:00.000Z"),
        checkInOpensAt: new Date("2030-01-02T11:00:00.000Z"),
        checkInClosesAt: new Date("2030-01-02T14:00:00.000Z"),
        publishedAt: new Date("2029-12-01T00:00:00.000Z"),
      })
      .returning({ id: event.id, slug: event.slug });
    eventIds.push(createdEvent!.id);
    const [createdRegistration] = await database
      .insert(registration)
      .values({
        eventId: createdEvent!.id,
        attendeeName: "Ada Lovelace",
        email: "ada@example.com",
        normalizedEmail: "ada@example.com",
        capacityOutcome: "capacity_hold",
      })
      .returning({ id: registration.id });
    const verificationToken = randomBytes(32).toString("base64url");
    await database.insert(registrationVerification).values({
      registrationId: createdRegistration!.id,
      tokenDigest: digestBearerToken(verificationToken),
      expiresAt,
    });
    await database.insert(capacityHold).values({
      registrationId: createdRegistration!.id,
      expiresAt,
    });
    return {
      event: createdEvent!,
      registrationId: createdRegistration!.id,
      verificationToken,
    };
  }

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    if (eventIds.length > 0) {
      const registrations = await database
        .select({ id: registration.id })
        .from(registration)
        .where(inArray(registration.eventId, eventIds));
      const registrationIds = registrations.map(({ id }) => id);
      if (registrationIds.length > 0) {
        await database
          .delete(registrationAnswer)
          .where(inArray(registrationAnswer.registrationId, registrationIds));
        await database.delete(ticket).where(inArray(ticket.registrationId, registrationIds));
        await database
          .delete(admissionOffer)
          .where(inArray(admissionOffer.registrationId, registrationIds));
        await database
          .delete(registrationVerification)
          .where(inArray(registrationVerification.registrationId, registrationIds));
        await database
          .delete(capacityHold)
          .where(inArray(capacityHold.registrationId, registrationIds));
        await database.delete(registration).where(inArray(registration.id, registrationIds));
      }
      await database.delete(registrationField).where(inArray(registrationField.eventId, eventIds));
      await database.delete(event).where(inArray(event.id, eventIds));
    }
    await client.end();
  });

  it("claims an unexpired Capacity Hold exactly once and issues one active Ticket", async () => {
    const held = await createHeldRegistration(undefined, 1);

    const first = await service.verifyRegistration(held.event.slug, held.verificationToken);
    const second = await service.verifyRegistration(held.event.slug, held.verificationToken);

    expect(first.outcome).toBe("confirmed");
    expect(second).toEqual({ outcome: "consumed" });
    const [confirmed] = await database
      .select({ status: registration.status, verifiedAt: registration.verifiedAt })
      .from(registration)
      .where(eq(registration.id, held.registrationId));
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.verifiedAt).toEqual(new Date("2030-01-01T12:00:00.000Z"));
    const issued = await database
      .select({ code: ticket.code, status: ticket.status })
      .from(ticket)
      .where(and(eq(ticket.registrationId, held.registrationId), eq(ticket.status, "active")));
    expect(issued).toHaveLength(1);
    expect(issued[0]?.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
  });

  it("expires an unclaimed Registration instead of issuing a Ticket", async () => {
    const held = await createHeldRegistration(new Date("2030-01-01T11:59:59.000Z"));

    expect(await service.verifyRegistration(held.event.slug, held.verificationToken)).toEqual({
      outcome: "expired",
    });
    const [expired] = await database
      .select({ status: registration.status })
      .from(registration)
      .where(eq(registration.id, held.registrationId));
    expect(expired?.status).toBe("expired");
    expect(
      await database.select().from(ticket).where(eq(ticket.registrationId, held.registrationId)),
    ).toHaveLength(0);
  });

  it("rejects malformed and Event-mismatched capabilities safely", async () => {
    const held = await createHeldRegistration(undefined, 1);
    const other = await createHeldRegistration();

    expect(await service.verifyRegistration(held.event.slug, "not-a-token")).toEqual({
      outcome: "invalid",
    });
    expect(await service.verifyRegistration(other.event.slug, held.verificationToken)).toEqual({
      outcome: "mismatched",
    });
  });

  it("establishes waitlist priority only after successful email verification", async () => {
    const held = await createHeldRegistration(undefined, 1);
    await service.verifyRegistration(held.event.slug, held.verificationToken);
    const [pending] = await database
      .insert(registration)
      .values({
        eventId: held.event.id,
        attendeeName: "Verified Waitlist Entry",
        email: "verified-waitlist@example.com",
        normalizedEmail: "verified-waitlist@example.com",
        capacityOutcome: "waitlist",
      })
      .returning({ id: registration.id });
    const token = randomBytes(32).toString("base64url");
    await database.insert(registrationVerification).values({
      registrationId: pending!.id,
      tokenDigest: digestBearerToken(token),
      expiresAt: new Date("2030-01-01T12:15:00.000Z"),
    });

    expect(await service.verifyRegistration(held.event.slug, token)).toEqual({
      outcome: "waitlisted",
    });
    const [verified] = await database
      .select({ status: registration.status, verifiedAt: registration.verifiedAt })
      .from(registration)
      .where(eq(registration.id, pending!.id));
    expect(verified).toEqual({
      status: "waitlisted",
      verifiedAt: new Date("2030-01-01T12:00:00.000Z"),
    });
  });

  it("promotes verified waitlist entries FIFO and claims an offer exactly once", async () => {
    const held = await createHeldRegistration(undefined, 1);
    await service.verifyRegistration(held.event.slug, held.verificationToken);
    const waitlisted = await database
      .insert(registration)
      .values([
        {
          eventId: held.event.id,
          attendeeName: "First Waitlisted",
          email: "first-waitlisted@example.com",
          normalizedEmail: "first-waitlisted@example.com",
          status: "waitlisted",
          capacityOutcome: "waitlist",
          verifiedAt: new Date("2030-01-01T12:01:00.000Z"),
        },
        {
          eventId: held.event.id,
          attendeeName: "Second Waitlisted",
          email: "second-waitlisted@example.com",
          normalizedEmail: "second-waitlisted@example.com",
          status: "waitlisted",
          capacityOutcome: "waitlist",
          verifiedAt: new Date("2030-01-01T12:02:00.000Z"),
        },
      ])
      .returning({ id: registration.id });

    await database.update(event).set({ capacity: 2 }).where(eq(event.id, held.event.id));
    expect(await service.reconcileEventWaitlist(held.event.id)).toEqual({ promoted: 1 });
    const [firstOffer] = await database
      .select({ registrationId: admissionOffer.registrationId, expiresAt: admissionOffer.expiresAt })
      .from(admissionOffer)
      .where(
        and(
          eq(admissionOffer.status, "active"),
          inArray(admissionOffer.registrationId, waitlisted.map(({ id }) => id)),
        ),
      );
    expect(firstOffer?.registrationId).toBe(waitlisted[0]!.id);
    expect(firstOffer?.expiresAt).toEqual(new Date("2030-01-02T00:00:00.000Z"));

    const token = offeredTokens.at(-1)!;
    expect((await service.claimAdmissionOffer(token)).outcome).toBe("confirmed");
    expect(await service.claimAdmissionOffer(token)).toEqual({ outcome: "consumed" });
    expect(
      await database.select().from(ticket).where(eq(ticket.registrationId, waitlisted[0]!.id)),
    ).toHaveLength(1);

    await database
      .update(registration)
      .set({ status: "canceled" })
      .where(eq(registration.id, waitlisted[0]!.id));
    expect(await service.reconcileEventWaitlist(held.event.id)).toEqual({ promoted: 1 });
    const activeOffers = await database
      .select({ registrationId: admissionOffer.registrationId })
      .from(admissionOffer)
      .where(
        and(
          eq(admissionOffer.status, "active"),
          inArray(admissionOffer.registrationId, waitlisted.map(({ id }) => id)),
        ),
      );
    expect(activeOffers).toEqual([{ registrationId: waitlisted[1]!.id }]);
  });

  it("expires an ignored offer and promotes the next verified entry", async () => {
    const held = await createHeldRegistration(undefined, 1);
    await service.verifyRegistration(held.event.slug, held.verificationToken);
    const earlierEmail = `earlier-${randomUUID()}@example.com`;
    const laterEmail = `later-${randomUUID()}@example.com`;
    const queued = await database
      .insert(registration)
      .values([
        {
          eventId: held.event.id,
          attendeeName: "Earlier Entry",
          email: earlierEmail,
          normalizedEmail: earlierEmail,
          status: "waitlisted",
          capacityOutcome: "waitlist",
          verifiedAt: new Date("2030-01-01T10:00:00.000Z"),
        },
        {
          eventId: held.event.id,
          attendeeName: "Later Entry",
          email: laterEmail,
          normalizedEmail: laterEmail,
          status: "waitlisted",
          capacityOutcome: "waitlist",
          verifiedAt: new Date("2030-01-01T11:00:00.000Z"),
        },
      ])
      .returning({ id: registration.id });
    await database.update(event).set({ capacity: 2 }).where(eq(event.id, held.event.id));

    let currentTime = new Date("2030-01-01T12:00:00.000Z");
    const expiringService = createTicketApplicationService({
      database,
      now: () => currentTime,
      getSigningKey: () => ({ id: "integration-key", privateKey }),
      sendTicketEmail: async () => undefined,
      sendAdmissionOfferEmail: async () => undefined,
    });
    expect(await expiringService.reconcileEventWaitlist(held.event.id)).toEqual({ promoted: 1 });
    currentTime = new Date("2030-01-02T00:00:01.000Z");
    expect(await expiringService.reconcileEventWaitlist(held.event.id)).toEqual({ promoted: 1 });

    const statuses = await database
      .select({ id: registration.id, status: registration.status })
      .from(registration)
      .where(inArray(registration.id, queued.map(({ id }) => id)));
    expect(statuses.find(({ id }) => id === queued[0]!.id)?.status).toBe("expired");
    const [active] = await database
      .select({ registrationId: admissionOffer.registrationId })
      .from(admissionOffer)
      .where(
        and(
          eq(admissionOffer.status, "active"),
          inArray(admissionOffer.registrationId, queued.map(({ id }) => id)),
        ),
      );
    expect(active?.registrationId).toBe(queued[1]!.id);
  });

  it("updates attendee-authored details while keeping the verified email immutable", async () => {
    const held = await createHeldRegistration();
    const fieldId = randomUUID();
    await database.insert(registrationField).values({
      id: fieldId,
      eventId: held.event.id,
      answerType: "short_text",
      label: "Accessibility note",
      required: false,
      position: 0,
    });
    const verified = await service.verifyRegistration(held.event.slug, held.verificationToken);
    expect(verified.outcome).toBe("confirmed");
    if (verified.outcome !== "confirmed") throw new Error("Expected confirmation.");

    expect(
      await service.updateRegistration(verified.managementToken, {
        name: "Ada Byron",
        answers: { [fieldId]: "Front-row access" },
      }),
    ).toEqual({ outcome: "updated" });
    const [updated] = await database
      .select({ name: registration.attendeeName, email: registration.email })
      .from(registration)
      .where(eq(registration.id, held.registrationId));
    expect(updated).toEqual({ name: "Ada Byron", email: "ada@example.com" });
    const [answer] = await database
      .select({ value: registrationAnswer.value })
      .from(registrationAnswer)
      .where(
        and(
          eq(registrationAnswer.registrationId, held.registrationId),
          eq(registrationAnswer.fieldId, fieldId),
        ),
      );
    expect(answer?.value).toBe("Front-row access");
  });

  it("resends the existing Ticket and replaces it without reusing its identity", async () => {
    const held = await createHeldRegistration();
    const verified = await service.verifyRegistration(held.event.slug, held.verificationToken);
    expect(verified.outcome).toBe("confirmed");
    if (verified.outcome !== "confirmed") throw new Error("Expected confirmation.");
    const [original] = await database
      .select({ id: ticket.id, code: ticket.code })
      .from(ticket)
      .where(and(eq(ticket.registrationId, held.registrationId), eq(ticket.status, "active")));

    expect(await service.resendTicket(verified.managementToken)).toEqual({
      outcome: "sent",
      deliveryStatus: "sent",
    });
    expect(sentTicketCodes.at(-1)).toBe(original!.code);
    expect(await service.replaceTicket(verified.managementToken)).toEqual({
      outcome: "replaced",
      deliveryStatus: "sent",
    });
    const issued = await database
      .select({ id: ticket.id, code: ticket.code, status: ticket.status })
      .from(ticket)
      .where(eq(ticket.registrationId, held.registrationId));
    expect(issued).toHaveLength(2);
    expect(issued.find(({ id }) => id === original!.id)?.status).toBe("replaced");
    const replacement = issued.find(({ status }) => status === "active");
    expect(replacement?.id).not.toBe(original!.id);
    expect(replacement?.code).not.toBe(original!.code);
  });

  it("cancels before check-in, preserves history, and promotes the waitlist", async () => {
    const held = await createHeldRegistration(undefined, 1);
    const verified = await service.verifyRegistration(held.event.slug, held.verificationToken);
    expect(verified.outcome).toBe("confirmed");
    if (verified.outcome !== "confirmed") throw new Error("Expected confirmation.");
    const waitlistEmail = `cancel-waitlist-${randomUUID()}@example.com`;
    await database.insert(registration).values({
      eventId: held.event.id,
      attendeeName: "Next Attendee",
      email: waitlistEmail,
      normalizedEmail: waitlistEmail,
      status: "waitlisted",
      capacityOutcome: "waitlist",
      verifiedAt: new Date("2030-01-01T11:00:00.000Z"),
    });

    expect(await service.cancelRegistration(verified.managementToken)).toEqual({
      outcome: "canceled",
    });
    const [canceled] = await database
      .select({ status: registration.status })
      .from(registration)
      .where(eq(registration.id, held.registrationId));
    expect(canceled?.status).toBe("canceled");
    const [historicalTicket] = await database
      .select({ status: ticket.status })
      .from(ticket)
      .where(eq(ticket.registrationId, held.registrationId));
    expect(historicalTicket?.status).toBe("canceled");
    expect((await service.getManagementView(verified.managementToken))?.registrationStatus).toBe(
      "canceled",
    );
    expect(offeredTokens.length).toBeGreaterThan(0);
  });

  it("stops honoring a revoked management capability", async () => {
    const held = await createHeldRegistration();
    const verified = await service.verifyRegistration(held.event.slug, held.verificationToken);
    expect(verified.outcome).toBe("confirmed");
    if (verified.outcome !== "confirmed") throw new Error("Expected confirmation.");
    await database
      .update(registration)
      .set({ managementTokenRevokedAt: new Date("2030-01-01T12:01:00.000Z") })
      .where(eq(registration.id, held.registrationId));

    expect(await service.getManagementView(verified.managementToken)).toBeNull();
    expect(
      await service.updateRegistration(verified.managementToken, {
        name: "Unauthorized change",
        answers: {},
      }),
    ).toEqual({ outcome: "invalid" });
  });
});
