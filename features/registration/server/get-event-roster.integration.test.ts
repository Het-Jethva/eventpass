import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, beforeAll, expect, it } from "vitest";

import { describeWithDatabase, testDatabaseUrl } from "@/lib/test-db-helper";
import {
  admissionOffer,
  capacityHold,
  checkIn,
  event,
  eventStaff,
  registration,
  registrationAnswer,
  registrationField,
  ticket,
  user,
} from "../../../lib/db/schema";
import {
  decodeRosterCursor,
  encodeRosterCursor,
  getEventRoster,
  ROSTER_PAGE_SIZE,
  type RosterCursor,
} from "./get-event-roster";

const NOW = new Date("2030-06-01T12:00:00.000Z");

describeWithDatabase("Event roster query", () => {
  const client = new Pool({ connectionString: testDatabaseUrl! });
  const database = drizzle({ client });

  beforeAll(async () => {
    await database.execute("select 1");
  });

  afterAll(async () => {
    await client.end();
  });

  /**
   * Builds an Event with one Organizer, one unrelated staff user, and the
   * Registration shapes the roster has to distinguish. Runs inside a
   * transaction the caller rolls back.
   */
  async function seed(transaction: typeof database) {
    const [organizer] = await transaction
      .insert(user)
      .values({
        name: "Roster Organizer",
        email: `organizer-${randomUUID()}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    const [outsider] = await transaction
      .insert(user)
      .values({
        name: "Unrelated Volunteer",
        email: `outsider-${randomUUID()}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });

    const [createdEvent] = await transaction
      .insert(event)
      .values({
        name: "Roster integration test",
        description: "Exercises the Organizer roster query.",
        slug: `roster-test-${randomUUID()}`,
        status: "published",
        eventTimeZone: "UTC",
        startsAt: new Date("2030-06-01T14:00:00.000Z"),
        endsAt: new Date("2030-06-01T18:00:00.000Z"),
        venueName: "Test Venue",
        venueAddress: "Test address",
        capacity: 100,
        registrationOpensAt: new Date("2030-05-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2030-06-01T13:00:00.000Z"),
        checkInOpensAt: new Date("2030-06-01T13:00:00.000Z"),
        checkInClosesAt: new Date("2030-06-01T18:00:00.000Z"),
        publishedAt: new Date("2030-05-01T00:00:00.000Z"),
      })
      .returning({ id: event.id });

    await transaction.insert(eventStaff).values({
      eventId: createdEvent!.id,
      userId: organizer!.id,
      role: "owner",
    });
    // Assigned to no Event, so the authorization check must reject them.
    await transaction.insert(eventStaff).values({
      eventId: createdEvent!.id,
      userId: outsider!.id,
      role: "check_in_volunteer",
    });

    const [field] = await transaction
      .insert(registrationField)
      .values({
        id: randomUUID(),
        eventId: createdEvent!.id,
        answerType: "short_text",
        label: "Team name",
        required: false,
        position: 1,
      })
      .returning({ id: registrationField.id });

    async function addRegistration(values: {
      name: string;
      email: string;
      status: "unconfirmed" | "confirmed" | "waitlisted" | "expired" | "canceled";
      capacityOutcome: "capacity_hold" | "waitlist";
      createdAt: Date;
    }) {
      const [row] = await transaction
        .insert(registration)
        .values({
          eventId: createdEvent!.id,
          attendeeName: values.name,
          email: values.email,
          normalizedEmail: values.email,
          status: values.status,
          capacityOutcome: values.capacityOutcome,
          createdAt: values.createdAt,
          verifiedAt: values.status === "confirmed" ? values.createdAt : null,
        })
        .returning({ id: registration.id });
      return row!.id;
    }

    const admitted = await addRegistration({
      name: "Ada Lovelace",
      email: "ada@example.com",
      status: "confirmed",
      capacityOutcome: "capacity_hold",
      createdAt: new Date("2030-05-10T09:00:00.000Z"),
    });
    const confirmed = await addRegistration({
      name: "Grace Hopper",
      email: "grace@example.com",
      status: "confirmed",
      capacityOutcome: "capacity_hold",
      createdAt: new Date("2030-05-11T09:00:00.000Z"),
    });
    const waitlisted = await addRegistration({
      name: "Alan Turing",
      email: "alan@example.com",
      status: "waitlisted",
      capacityOutcome: "waitlist",
      createdAt: new Date("2030-05-12T09:00:00.000Z"),
    });
    const unconfirmed = await addRegistration({
      name: "Katherine Johnson",
      email: "katherine@example.com",
      status: "unconfirmed",
      capacityOutcome: "capacity_hold",
      createdAt: new Date("2030-05-13T09:00:00.000Z"),
    });

    const [admittedTicket] = await transaction
      .insert(ticket)
      .values({
        id: randomUUID(),
        eventId: createdEvent!.id,
        registrationId: admitted,
        code: "AAAA111122",
        signedPayload: "integration.payload.admitted",
        signingKeyId: "integration-key",
        status: "active",
      })
      .returning({ id: ticket.id });

    // Grace's original Ticket was replaced, so her row must say so.
    await transaction.insert(ticket).values({
      id: randomUUID(),
      eventId: createdEvent!.id,
      registrationId: confirmed,
      code: "BBBB222233",
      signedPayload: "integration.payload.replaced",
      signingKeyId: "integration-key",
      status: "replaced",
      invalidatedAt: new Date("2030-05-20T09:00:00.000Z"),
      createdAt: new Date("2030-05-11T09:00:00.000Z"),
    });
    await transaction.insert(ticket).values({
      id: randomUUID(),
      eventId: createdEvent!.id,
      registrationId: confirmed,
      code: "CCCC333344",
      signedPayload: "integration.payload.current",
      signingKeyId: "integration-key",
      status: "active",
      createdAt: new Date("2030-05-20T09:00:00.000Z"),
    });

    await transaction.insert(checkIn).values({
      eventId: createdEvent!.id,
      ticketId: admittedTicket!.id,
      actorUserId: organizer!.id,
      checkedInAt: new Date("2030-06-01T13:15:00.000Z"),
    });

    await transaction.insert(capacityHold).values({
      registrationId: unconfirmed,
      expiresAt: new Date("2030-06-01T12:10:00.000Z"),
    });

    await transaction.insert(admissionOffer).values({
      registrationId: waitlisted,
      status: "active",
      expiresAt: new Date("2030-06-01T20:00:00.000Z"),
      tokenDigest: `offer-${randomUUID()}`,
    });

    await transaction.insert(registrationAnswer).values({
      registrationId: admitted,
      fieldId: field!.id,
      value: "Team Kinetic",
    });

    return {
      eventId: createdEvent!.id,
      organizerId: organizer!.id,
      outsiderId: outsider!.id,
    };
  }

  it("resolves each Registration to its authoritative status with qualifiers", async () => {
    const rollback = Symbol("rollback roster status");
    try {
      await database.transaction(async (transaction) => {
        const { eventId, organizerId } = await seed(
          transaction as unknown as typeof database,
        );

        const roster = await getEventRoster({
          db: transaction as unknown as typeof database,
          eventId,
          actorUserId: organizerId,
          now: NOW,
        });

        expect(roster).not.toBeNull();
        expect(roster!.totalCount).toBe(4);
        expect(roster!.matchingCount).toBe(4);

        const byName = new Map(
          roster!.rows.map((row) => [row.attendeeName, row]),
        );

        expect(byName.get("Ada Lovelace")!.status.key).toBe("checked_in");
        expect(byName.get("Ada Lovelace")!.checkedInAt).toEqual(
          new Date("2030-06-01T13:15:00.000Z"),
        );

        // Newest Ticket wins, so Grace reads as Confirmed on an active Ticket
        // rather than as replaced.
        expect(byName.get("Grace Hopper")!.status.key).toBe("confirmed");
        expect(byName.get("Grace Hopper")!.status.qualifier).toBeNull();
        expect(byName.get("Grace Hopper")!.ticketCode).toBe("CCCC333344");

        expect(byName.get("Alan Turing")!.status.key).toBe("offer_sent");
        expect(byName.get("Alan Turing")!.status.deadline?.kind).toBe(
          "admission_offer",
        );

        expect(byName.get("Katherine Johnson")!.status.key).toBe("unconfirmed");
        expect(byName.get("Katherine Johnson")!.status.deadline?.kind).toBe(
          "capacity_hold",
        );

        expect(byName.get("Ada Lovelace")!.answers).toEqual([
          {
            fieldId: expect.any(String),
            label: "Team name",
            archived: false,
            value: "Team Kinetic",
          },
        ]);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("returns null for a staff user who is not an Organizer of the Event", async () => {
    const rollback = Symbol("rollback roster authorization");
    try {
      await database.transaction(async (transaction) => {
        const { eventId, outsiderId } = await seed(
          transaction as unknown as typeof database,
        );

        const roster = await getEventRoster({
          db: transaction as unknown as typeof database,
          eventId,
          actorUserId: outsiderId,
          now: NOW,
        });

        // A Check-in Volunteer is denied the full attendee roster, matching the
        // export's authorization.
        expect(roster).toBeNull();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("searches name and email in the database, not a truncated window", async () => {
    const rollback = Symbol("rollback roster search");
    try {
      await database.transaction(async (transaction) => {
        const { eventId, organizerId } = await seed(
          transaction as unknown as typeof database,
        );

        const byName = await getEventRoster({
          db: transaction as unknown as typeof database,
          eventId,
          actorUserId: organizerId,
          searchQuery: "turing",
          now: NOW,
        });
        expect(byName!.rows.map((row) => row.attendeeName)).toEqual([
          "Alan Turing",
        ]);
        expect(byName!.matchingCount).toBe(1);
        // Unfiltered total stays visible so the UI can say "1 of 4".
        expect(byName!.totalCount).toBe(4);

        const byEmail = await getEventRoster({
          db: transaction as unknown as typeof database,
          eventId,
          actorUserId: organizerId,
          searchQuery: "GRACE@EXAMPLE.COM",
          now: NOW,
        });
        expect(byEmail!.rows.map((row) => row.attendeeName)).toEqual([
          "Grace Hopper",
        ]);

        const noMatch = await getEventRoster({
          db: transaction as unknown as typeof database,
          eventId,
          actorUserId: organizerId,
          searchQuery: "nobody-by-that-name",
          now: NOW,
        });
        expect(noMatch!.rows).toEqual([]);
        expect(noMatch!.matchingCount).toBe(0);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("keeps Checked in and Confirmed filters disjoint", async () => {
    const rollback = Symbol("rollback roster filters");
    try {
      await database.transaction(async (transaction) => {
        const { eventId, organizerId } = await seed(
          transaction as unknown as typeof database,
        );

        const checkedIn = await getEventRoster({
          db: transaction as unknown as typeof database,
          eventId,
          actorUserId: organizerId,
          filter: "checked_in",
          now: NOW,
        });
        const confirmed = await getEventRoster({
          db: transaction as unknown as typeof database,
          eventId,
          actorUserId: organizerId,
          filter: "confirmed",
          now: NOW,
        });

        expect(checkedIn!.rows.map((row) => row.attendeeName)).toEqual([
          "Ada Lovelace",
        ]);
        expect(confirmed!.rows.map((row) => row.attendeeName)).toEqual([
          "Grace Hopper",
        ]);
        // Both are `registration.status = 'confirmed'`; overlapping them would
        // make the filter counts exceed the roster.
        expect(checkedIn!.matchingCount + confirmed!.matchingCount).toBe(2);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("pages by keyset without skipping or repeating rows that share a timestamp", async () => {
    const rollback = Symbol("rollback roster paging");
    try {
      await database.transaction(async (transaction) => {
        const { eventId, organizerId } = await seed(
          transaction as unknown as typeof database,
        );

        // Every row shares one created_at, so ordering can only be settled by
        // the id tiebreaker in the keyset predicate.
        const collidingAt = new Date("2030-05-14T09:00:00.000Z");
        const extra = ROSTER_PAGE_SIZE + 3;
        for (let index = 0; index < extra; index += 1) {
          await transaction.insert(registration).values({
            eventId,
            attendeeName: `Bulk Attendee ${index}`,
            email: `bulk-${index}@example.com`,
            normalizedEmail: `bulk-${index}@example.com`,
            status: "confirmed",
            capacityOutcome: "capacity_hold",
            createdAt: collidingAt,
            verifiedAt: collidingAt,
          });
        }

        const seen: string[] = [];
        let cursor: RosterCursor | null = null;
        let pages = 0;

        do {
          const page = await getEventRoster({
            db: transaction as unknown as typeof database,
            eventId,
            actorUserId: organizerId,
            cursor,
            now: NOW,
          });
          expect(page).not.toBeNull();
          expect(page!.rows.length).toBeLessThanOrEqual(ROSTER_PAGE_SIZE);
          seen.push(...page!.rows.map((row) => row.registrationId));

          // Round-trip the cursor through its encoding, the way the URL does.
          const encoded = page!.nextCursor
            ? encodeRosterCursor(page!.nextCursor)
            : null;
          cursor = encoded ? decodeRosterCursor(encoded) : null;
          pages += 1;
        } while (cursor && pages < 10);

        expect(pages).toBeGreaterThan(1);
        expect(seen).toHaveLength(extra + 4);
        expect(new Set(seen).size).toBe(seen.length);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("rejects a malformed cursor instead of throwing", () => {
    expect(decodeRosterCursor(undefined)).toBeNull();
    expect(decodeRosterCursor("")).toBeNull();
    expect(decodeRosterCursor("not-base64url!!")).toBeNull();
    expect(
      decodeRosterCursor(Buffer.from("no-separator", "utf8").toString("base64url")),
    ).toBeNull();
    expect(
      decodeRosterCursor(
        Buffer.from("not-a-date|abc", "utf8").toString("base64url"),
      ),
    ).toBeNull();
  });
});
