import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, isNull } from "drizzle-orm";
import nextEnv from "@next/env";

test("registration, capacity, tickets and offline corrections work together", async (t) => {
  nextEnv.loadEnvConfig(process.cwd(), true);
  const configured = process.env.DATABASE_URL;
  assert.ok(configured, "Set DATABASE_URL to a local Postgres instance.");
  const databaseUrl = new URL(configured);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname),
    "Database verification only runs against local Postgres.",
  );
  const databaseName = `eventpass_verify_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: configured });
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseUrl.pathname = `/${databaseName}`;
  process.env.DATABASE_URL = databaseUrl.toString();
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3100";
  process.env.BETTER_AUTH_URL = "http://localhost:3100";
  process.env.BETTER_AUTH_SECRET =
    "local-verification-secret-with-at-least-32-characters";

  let applicationDatabase;
  let provider;
  try {
    const migrationPool = new pg.Pool({
      connectionString: databaseUrl.toString(),
    });
    try {
      await migrate(drizzle(migrationPool), {
        migrationsFolder: path.resolve("drizzle"),
      });
    } finally {
      await migrationPool.end();
    }

    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    process.env.TICKET_SIGNING_KEY_ID = "verification";
    process.env.TICKET_SIGNING_PRIVATE_KEY_PEM = privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    process.env.TICKET_PUBLIC_KEYS_JSON = JSON.stringify({
      verification: publicKey
        .export({ format: "pem", type: "spki" })
        .toString(),
    });
    const messages = [];
    provider = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      messages.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ id: randomUUID() }));
    });
    await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const address = provider.address();
    assert.ok(address && typeof address !== "string");
    process.env.RESEND_BASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.RESEND_API_KEY = "re_local_verification_only";

    const { db } = await import("@/lib/db");
    applicationDatabase = db;
    const schema = await import("@/lib/db/schema");
    const { createDraftEvent } =
      await import("@/features/events/server/create-draft-event");
    const { publishEvent } =
      await import("@/features/events/server/publish-event");
    const { updatePublishedEvent } =
      await import("@/features/events/server/published-events");
    const { saveRegistrationForm } =
      await import("@/features/registration/server/registration-form");
    const { submitRegistration } =
      await import("@/features/registration/server/submit-registration");
    const { verifyRegistration, claimAdmissionOffer } =
      await import("@/features/tickets/server/registration-confirmation");
    const { getManagementView, replaceTicket, cancelRegistration } =
      await import("@/features/tickets/server/registration-management");
    const { prepareOfflineScanner } =
      await import("@/features/admission/server/prepare-scanner");
    const { admitOnline } =
      await import("@/features/admission/server/admission");
    const { reverseCheckIn } =
      await import("@/features/admission/server/check-in-corrections");
    const { synchronizeOfflineAttempts } =
      await import("@/features/admission/server/offline-synchronization");
    const { signScannerAuthorization } =
      await import("@/features/admission/scanner-authorization");
    const {
      previewRegistrationImport,
      confirmRegistrationImport,
      exportEventRegistrations,
    } =
      await import("@/features/registration-import/server/registration-import");

    const { isEligibleStaffMagicLinkRecipient } =
      await import("@/features/staff-identity/server/staff-magic-link-eligibility");
    assert.equal(
      await isEligibleStaffMagicLinkRecipient("owner@example.invalid"),
      true,
    );
    const { auth } = await import("@/lib/auth");
    const signIn = await auth.handler(
      new Request("http://localhost:3100/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3100",
        },
        body: JSON.stringify({
          email: "owner@example.invalid",
          callbackURL: "/events",
        }),
      }),
    );
    assert.equal(signIn.status, 200);
    const signInMail = messages.find(
      (message) => message.subject === "Your EventPass sign-in link",
    );
    assert.ok(signInMail);
    const signInUrl = signInMail.text.match(/http:\/\/[^\s]+/)[0];
    const signedIn = await auth.handler(new Request(signInUrl));
    const cookie = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    assert.ok(cookie);
    const staffSession = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    assert.equal(staffSession.user.email, "owner@example.invalid");
    const ownerId = staffSession.user.id;
    await db
      .update(schema.user)
      .set({ suspended: true })
      .where(eq(schema.user.id, ownerId));
    assert.equal(
      await isEligibleStaffMagicLinkRecipient("owner@example.invalid"),
      false,
    );
    await db
      .update(schema.user)
      .set({ suspended: false })
      .where(eq(schema.user.id, ownerId));
    t.diagnostic(
      "First-time organizer signup, magic-link verification, session cookies and suspension gate passed against the local mail provider.",
    );
    const now = Date.now();
    const localTime = (offset) =>
      new Date(now + offset).toISOString().slice(0, 16);
    const input = {
      name: "Workflow verification",
      description: "A disposable event.",
      slug: "workflow-verification",
      eventTimeZone: "UTC",
      venueName: "Test venue",
      venueAddress: "Local only",
      venueMapUrl: "",
      capacity: 1,
      startsAtLocal: localTime(3_600_000),
      endsAtLocal: localTime(7_200_000),
      registrationOpensAtLocal: localTime(-86_400_000),
      registrationClosesAtLocal: localTime(1_800_000),
      checkInOpensAtLocal: localTime(1_800_000),
      checkInClosesAtLocal: localTime(7_200_000),
    };
    const { id: eventId } = await createDraftEvent(ownerId, input);
    const fieldId = randomUUID();
    const choices = ["Morning", "Evening"].map((label) => ({
      id: randomUUID(),
      label,
      archived: false,
    }));
    await saveRegistrationForm(eventId, ownerId, [
      {
        id: fieldId,
        answerType: "single_choice",
        label: "Session",
        helpText: "Choose one",
        required: true,
        archived: false,
        choices,
      },
    ]);
    await publishEvent(eventId, ownerId);
    const guests = ["first", "second"].map((name) => ({
      name,
      email: `${name}@example.invalid`,
      answers: { [fieldId]: choices[0].id },
    }));
    const submissions = await Promise.all(
      guests.map((guest) =>
        submitRegistration(input.slug, guest, new Headers()),
      ),
    );
    assert.deepEqual(submissions.map(({ outcome }) => outcome).sort(), [
      "capacity_hold",
      "waitlist_verification",
    ]);
    assert.ok(submissions.every((result) => result.deliveryStatus === "sent"));
    const tokens = guests.map((guest) => {
      const email = messages.find((message) =>
        message.to.includes(guest.email),
      );
      assert.ok(email);
      return new URL(email.text.match(/http:\/\/[^\s]+/)[0]).searchParams.get(
        "token",
      );
    });
    const held = submissions.findIndex(
      ({ outcome }) => outcome === "capacity_hold",
    );
    const waiting = held === 0 ? 1 : 0;
    const confirmed = await verifyRegistration(input.slug, tokens[held]);
    assert.equal(confirmed.outcome, "confirmed");
    const signingPem = process.env.TICKET_SIGNING_PRIVATE_KEY_PEM;
    delete process.env.TICKET_SIGNING_PRIVATE_KEY_PEM;
    assert.equal(
      (await verifyRegistration(input.slug, tokens[waiting])).outcome,
      "waitlisted",
    );
    process.env.TICKET_SIGNING_PRIVATE_KEY_PEM = signingPem;
    const management = await getManagementView(confirmed.managementToken);
    assert.equal(management.fields[0].value, choices[0].id);
    assert.equal(
      (await replaceTicket(confirmed.managementToken)).outcome,
      "replaced",
    );
    assert.equal(
      (await cancelRegistration(confirmed.managementToken)).outcome,
      "canceled",
    );
    const offerMail = messages.find((message) =>
      message.subject.startsWith("A place is available"),
    );
    assert.ok(offerMail);
    const offerToken = new URL(
      offerMail.text.match(/http:\/\/[^\s]+/)[0],
    ).pathname
      .split("/")
      .at(-1);
    const claimed = await claimAdmissionOffer(offerToken);
    assert.equal(claimed.outcome, "confirmed");
    t.diagnostic(
      "Concurrent capacity reservation, shared form reads, replacement, cancellation and waitlist offer passed.",
    );

    await updatePublishedEvent(eventId, ownerId, {
      ...input,
      checkInOpensAtLocal: localTime(-3_600_000),
    });
    const deviceId = randomUUID();
    const prepared = await prepareOfflineScanner({
      eventId,
      actorUserId: ownerId,
      scannerDeviceId: deviceId,
      scannerDeviceLabel: "Verification device",
    });
    assert.equal(prepared.outcome, "prepared");
    const view = await getManagementView(claimed.managementToken);
    const scan = {
      eventId,
      actorUserId: ownerId,
      clientAttemptId: randomUUID(),
      input: view.ticket.code,
      inputMethod: "manual",
    };
    const admitted = await admitOnline(scan);
    assert.equal(admitted.outcome, "accepted");
    assert.equal((await admitOnline(scan)).checkInId, admitted.checkInId);
    assert.equal(
      (await admitOnline({ ...scan, clientAttemptId: randomUUID() })).outcome,
      "duplicate",
    );
    await reverseCheckIn({
      eventId,
      actorUserId: ownerId,
      checkInId: admitted.checkInId,
      reason: "Guest left before entry",
    });
    const attempt = {
      id: randomUUID(),
      eventId,
      ticketId: claimed.ticketId,
      inputDigest: createHash("sha256").update(view.ticket.code).digest("hex"),
      inputMethod: "manual",
      capturedOutcome: "provisional",
      deviceRecordedAt: prepared.snapshot.serverTimeAnchor,
      serverTimeAnchor: prepared.snapshot.serverTimeAnchor,
      monotonicElapsedMs: 0,
      timestampConfidence: "high",
      signedTicket: null,
      scannerDeviceId: deviceId,
    };
    const reconciled = await synchronizeOfflineAttempts({
      authorization: prepared.snapshot.authorization,
      attempts: [attempt],
    });
    assert.equal(reconciled.outcome, "acknowledged");
    assert.equal(reconciled.results[0].outcome, "not_checked_in");
    const expiredAnchor = new Date(now - 120_000).toISOString();
    const authorization = signScannerAuthorization(
      {
        eventId,
        volunteerUserId: ownerId,
        scannerDeviceId: deviceId,
        issuedAt: expiredAnchor,
        expiresAt: new Date(now - 60_000).toISOString(),
      },
      { id: "verification", privateKey },
    );
    const authorizedAttempt = {
      ...attempt,
      id: randomUUID(),
      serverTimeAnchor: expiredAnchor,
      deviceRecordedAt: expiredAnchor,
      monotonicElapsedMs: 30_000,
    };
    assert.equal(
      (
        await synchronizeOfflineAttempts({
          authorization,
          attempts: [authorizedAttempt],
        })
      ).outcome,
      "acknowledged",
    );
    assert.equal(
      (
        await synchronizeOfflineAttempts({
          authorization,
          attempts: [
            {
              ...authorizedAttempt,
              id: randomUUID(),
              monotonicElapsedMs: 60_000,
            },
          ],
        })
      ).outcome,
      "unauthorized",
    );
    const active = await db
      .select()
      .from(schema.checkIn)
      .where(isNull(schema.checkIn.invalidatedAt));
    assert.equal(active.length, 0);
    assert.ok(
      (
        await db
          .select()
          .from(schema.auditEntry)
          .where(eq(schema.auditEntry.eventId, eventId))
      ).length > 0,
    );
    t.diagnostic(
      "Online replay, duplicate admission, reversal preservation, late offline delivery and signed expiry passed.",
    );

    const importEvent = await createDraftEvent(ownerId, {
      ...input,
      slug: "import-verification",
      capacity: 2,
    });
    await publishEvent(importEvent.id, ownerId);
    const oldPreview = await previewRegistrationImport(
      importEvent.id,
      ownerId,
      "name,email\nImported Guest,import@example.invalid",
    );
    assert.equal(oldPreview.canConfirm, true);
    await saveRegistrationForm(importEvent.id, ownerId, [
      {
        id: randomUUID(),
        answerType: "short_text",
        label: "Organization",
        helpText: "",
        required: true,
        archived: false,
        choices: [],
      },
    ]);
    assert.equal(
      (await confirmRegistrationImport(importEvent.id, ownerId, oldPreview.id))
        .outcome,
      "stale",
    );
    const freshPreview = await previewRegistrationImport(
      importEvent.id,
      ownerId,
      "name,email,Organization\nImported Guest,import@example.invalid,Example",
    );
    assert.equal(freshPreview.canConfirm, true);
    const imported = await confirmRegistrationImport(
      importEvent.id,
      ownerId,
      freshPreview.id,
    );
    assert.equal(imported.outcome, "completed");
    assert.equal(imported.importedCount, 1);
    assert.equal(
      (
        await confirmRegistrationImport(
          importEvent.id,
          ownerId,
          freshPreview.id,
        )
      ).alreadyCompleted,
      true,
    );
    const exported = await exportEventRegistrations(importEvent.id, ownerId);
    assert.ok(exported.csv.includes("import@example.invalid"));
    assert.ok(exported.csv.includes("Example"));
    t.diagnostic(
      "CSV preview, current-form revalidation, idempotent import confirmation and export passed.",
    );
  } finally {
    await applicationDatabase?.$client.end();
    if (provider)
      await new Promise((resolve, reject) =>
        provider.close((error) => (error ? reject(error) : resolve())),
      );
    await admin.query(`drop database "${databaseName}"`);
    await admin.end();
  }
});
