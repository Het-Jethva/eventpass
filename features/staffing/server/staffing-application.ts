import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { evaluateStaffInvitationAcceptance } from "@/features/staffing/staff-invitation-policy";
import {
  canManageRole,
  type EventStaffRole,
  type InviteableStaffRole,
} from "@/features/staffing/staffing-policy";
import { db } from "@/lib/db";
import {
  auditEntry,
  event,
  eventStaff,
  ownershipTransfer,
  staffInvitation,
  user,
} from "@/lib/db/schema";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

export const inviteStaffInputSchema = z.object({
  email: z.email("Enter a valid email address.").transform(normalizeStaffEmail),
  role: z.enum(["organizer", "check_in_volunteer"]),
});

export type InviteStaffInput = z.input<typeof inviteStaffInputSchema>;

export class StaffingAuthorizationError extends Error {}
export class StaffingConflictError extends Error {}
export class StaffInvitationUnavailableError extends Error {}
export class StaffInvitationEmailMismatchError extends Error {}
export class OwnershipTransferUnavailableError extends Error {}

export function digestStaffInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function createStaffInvitationToken() {
  return randomBytes(32).toString("base64url");
}

async function lockEvent(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
) {
  await transaction.execute(sql`select id from ${event} where id = ${eventId} for update`);
}

async function findActorRole(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
  actorUserId: string,
) {
  const [assignment] = await transaction
    .select({ role: eventStaff.role })
    .from(eventStaff)
    .where(
      and(eq(eventStaff.eventId, eventId), eq(eventStaff.userId, actorUserId)),
    )
    .limit(1);

  return assignment?.role as EventStaffRole | undefined;
}

function assertCanManageRole(
  actorRole: EventStaffRole | undefined,
  targetRole: InviteableStaffRole,
) {
  if (!actorRole || !canManageRole(actorRole, targetRole)) {
    throw new StaffingAuthorizationError(
      targetRole === "organizer"
        ? "Only the Event Owner can manage Organizers."
        : "Only the Event Owner or an Organizer can manage Check-in Volunteers.",
    );
  }
}

export async function createStaffInvitation(
  eventId: string,
  actorUserId: string,
  rawInput: unknown,
  now = new Date(),
) {
  const input = inviteStaffInputSchema.parse(rawInput);
  const token = createStaffInvitationToken();
  const tokenDigest = digestStaffInvitationToken(token);
  const expiresAt = new Date(now.getTime() + DAY_IN_MS);

  const result = await db.transaction(async (transaction) => {
    await lockEvent(transaction, eventId);
    const actorRole = await findActorRole(transaction, eventId, actorUserId);
    assertCanManageRole(actorRole, input.role);

    const [eventRecord] = await transaction
      .select({ id: event.id, name: event.name })
      .from(event)
      .where(eq(event.id, eventId))
      .limit(1);
    if (!eventRecord) throw new StaffingAuthorizationError("Event not found.");

    await transaction
      .update(staffInvitation)
      .set({ revokedAt: now })
      .where(
        and(
          eq(staffInvitation.eventId, eventId),
          isNull(staffInvitation.consumedAt),
          isNull(staffInvitation.revokedAt),
          lte(staffInvitation.expiresAt, now),
        ),
      );

    const [existingStaff] = await transaction
      .select({ id: eventStaff.id })
      .from(eventStaff)
      .innerJoin(user, eq(user.id, eventStaff.userId))
      .where(
        and(
          eq(eventStaff.eventId, eventId),
          sql`lower(btrim(${user.email})) = ${input.email}`,
        ),
      )
      .limit(1);
    if (existingStaff) {
      throw new StaffingConflictError("That person already has access to this Event.");
    }

    const [pendingInvitation] = await transaction
      .select({ id: staffInvitation.id })
      .from(staffInvitation)
      .where(
        and(
          eq(staffInvitation.eventId, eventId),
          eq(staffInvitation.normalizedEmail, input.email),
          isNull(staffInvitation.consumedAt),
          isNull(staffInvitation.revokedAt),
        ),
      )
      .limit(1);
    if (pendingInvitation) {
      throw new StaffingConflictError(
        "A pending Staff Invitation already exists for that email address.",
      );
    }

    const [invitation] = await transaction
      .insert(staffInvitation)
      .values({
        eventId,
        invitedByUserId: actorUserId,
        normalizedEmail: input.email,
        role: input.role,
        tokenDigest,
        expiresAt,
      })
      .returning({ id: staffInvitation.id });

    await transaction.insert(auditEntry).values({
      eventId,
      actorUserId,
      action: "staff_invitation.created",
      targetType: "staff_invitation",
      targetId: invitation.id,
      metadata: { normalizedEmail: input.email, role: input.role },
    });

    return { eventName: eventRecord.name, invitationId: invitation.id };
  });

  return { ...result, email: input.email, role: input.role, token, expiresAt };
}

export async function acceptStaffInvitation(
  token: string,
  actorUserId: string,
  now = new Date(),
) {
  const tokenDigest = digestStaffInvitationToken(token);

  return db.transaction(async (transaction) => {
    const [invitation] = await transaction
      .select()
      .from(staffInvitation)
      .where(eq(staffInvitation.tokenDigest, tokenDigest))
      .for("update")
      .limit(1);

    if (!invitation) {
      throw new StaffInvitationUnavailableError(
        "This Staff Invitation is expired, revoked, or already used.",
      );
    }

    const [actor] = await transaction
      .select({ email: user.email, suspended: user.suspended })
      .from(user)
      .where(eq(user.id, actorUserId))
      .limit(1);
    if (!actor || actor.suspended) {
      throw new StaffingAuthorizationError("This staff user cannot accept invitations.");
    }
    const acceptance = evaluateStaffInvitationAcceptance(invitation, actor.email, now);
    if (acceptance === "unavailable") {
      throw new StaffInvitationUnavailableError(
        "This Staff Invitation is expired, revoked, or already used.",
      );
    }
    if (acceptance === "email_mismatch") {
      throw new StaffInvitationEmailMismatchError(
        "Sign in with the email address named by this Staff Invitation.",
      );
    }

    const [existingAssignment] = await transaction
      .select({ id: eventStaff.id })
      .from(eventStaff)
      .where(
        and(
          eq(eventStaff.eventId, invitation.eventId),
          eq(eventStaff.userId, actorUserId),
        ),
      )
      .limit(1);
    if (existingAssignment) {
      throw new StaffingConflictError("You already have access to this Event.");
    }

    const [assignment] = await transaction
      .insert(eventStaff)
      .values({
        eventId: invitation.eventId,
        userId: actorUserId,
        role: invitation.role,
      })
      .returning({ id: eventStaff.id });
    await transaction
      .update(staffInvitation)
      .set({ consumedAt: now })
      .where(eq(staffInvitation.id, invitation.id));
    await transaction.insert(auditEntry).values([
      {
        eventId: invitation.eventId,
        actorUserId,
        action: "staff_invitation.accepted",
        targetType: "staff_invitation",
        targetId: invitation.id,
        metadata: { role: invitation.role },
      },
      {
        eventId: invitation.eventId,
        actorUserId,
        action: "event_staff.assigned",
        targetType: "event_staff",
        targetId: assignment.id,
        metadata: { role: invitation.role },
      },
    ]);

    return { eventId: invitation.eventId };
  });
}

export async function revokeStaffInvitation(
  invitationId: string,
  actorUserId: string,
  now = new Date(),
) {
  return db.transaction(async (transaction) => {
    const [invitation] = await transaction
      .select()
      .from(staffInvitation)
      .where(eq(staffInvitation.id, invitationId))
      .for("update")
      .limit(1);
    if (!invitation || invitation.consumedAt || invitation.revokedAt) {
      throw new StaffInvitationUnavailableError("That Staff Invitation is no longer pending.");
    }

    const actorRole = await findActorRole(
      transaction,
      invitation.eventId,
      actorUserId,
    );
    assertCanManageRole(actorRole, invitation.role as InviteableStaffRole);
    await transaction
      .update(staffInvitation)
      .set({ revokedAt: now })
      .where(eq(staffInvitation.id, invitation.id));
    await transaction.insert(auditEntry).values({
      eventId: invitation.eventId,
      actorUserId,
      action: "staff_invitation.revoked",
      targetType: "staff_invitation",
      targetId: invitation.id,
      metadata: { normalizedEmail: invitation.normalizedEmail, role: invitation.role },
    });
    return { eventId: invitation.eventId };
  });
}

export async function removeEventStaff(
  assignmentId: string,
  actorUserId: string,
) {
  return db.transaction(async (transaction) => {
    const [assignment] = await transaction
      .select()
      .from(eventStaff)
      .where(eq(eventStaff.id, assignmentId))
      .for("update")
      .limit(1);
    if (!assignment || assignment.role === "owner") {
      throw new StaffingAuthorizationError("The Event Owner cannot be removed.");
    }
    const actorRole = await findActorRole(transaction, assignment.eventId, actorUserId);
    assertCanManageRole(actorRole, assignment.role as InviteableStaffRole);
    await transaction.delete(eventStaff).where(eq(eventStaff.id, assignment.id));
    await transaction.insert(auditEntry).values({
      eventId: assignment.eventId,
      actorUserId,
      action: "event_staff.removed",
      targetType: "event_staff",
      targetId: assignment.id,
      metadata: { role: assignment.role, userId: assignment.userId },
    });
    return { eventId: assignment.eventId };
  });
}

export async function proposeOwnershipTransfer(
  eventId: string,
  proposedOwnerUserId: string,
  actorUserId: string,
  now = new Date(),
) {
  return db.transaction(async (transaction) => {
    await lockEvent(transaction, eventId);
    const actorRole = await findActorRole(transaction, eventId, actorUserId);
    if (actorRole !== "owner") {
      throw new StaffingAuthorizationError(
        "Only the Event Owner can propose Ownership Transfer.",
      );
    }
    const [target] = await transaction
      .select({ id: eventStaff.id })
      .from(eventStaff)
      .where(
        and(
          eq(eventStaff.eventId, eventId),
          eq(eventStaff.userId, proposedOwnerUserId),
          eq(eventStaff.role, "organizer"),
        ),
      )
      .limit(1);
    if (!target) {
      throw new OwnershipTransferUnavailableError(
        "Ownership Transfer must target an existing Organizer.",
      );
    }

    await transaction
      .update(ownershipTransfer)
      .set({ revokedAt: now })
      .where(
        and(
          eq(ownershipTransfer.eventId, eventId),
          isNull(ownershipTransfer.acceptedAt),
          isNull(ownershipTransfer.revokedAt),
          lte(ownershipTransfer.expiresAt, now),
        ),
      );
    const [activeTransfer] = await transaction
      .select({ id: ownershipTransfer.id })
      .from(ownershipTransfer)
      .where(
        and(
          eq(ownershipTransfer.eventId, eventId),
          isNull(ownershipTransfer.acceptedAt),
          isNull(ownershipTransfer.revokedAt),
        ),
      )
      .limit(1);
    if (activeTransfer) {
      throw new StaffingConflictError(
        "An Ownership Transfer is already pending for this Event.",
      );
    }
    const [transfer] = await transaction
      .insert(ownershipTransfer)
      .values({
        eventId,
        proposedByUserId: actorUserId,
        proposedOwnerUserId,
        expiresAt: new Date(now.getTime() + DAY_IN_MS),
      })
      .returning({ id: ownershipTransfer.id, expiresAt: ownershipTransfer.expiresAt });
    await transaction.insert(auditEntry).values({
      eventId,
      actorUserId,
      action: "ownership_transfer.proposed",
      targetType: "ownership_transfer",
      targetId: transfer.id,
      metadata: { proposedOwnerUserId },
    });
    return transfer;
  });
}

export async function acceptOwnershipTransfer(
  transferId: string,
  actorUserId: string,
  now = new Date(),
) {
  return db.transaction(async (transaction) => {
    const [transfer] = await transaction
      .select()
      .from(ownershipTransfer)
      .where(eq(ownershipTransfer.id, transferId))
      .for("update")
      .limit(1);
    if (
      !transfer ||
      transfer.acceptedAt ||
      transfer.revokedAt ||
      transfer.expiresAt <= now ||
      transfer.proposedOwnerUserId !== actorUserId
    ) {
      throw new OwnershipTransferUnavailableError(
        "This Ownership Transfer is expired, withdrawn, or belongs to another Organizer.",
      );
    }

    await lockEvent(transaction, transfer.eventId);
    const assignments = await transaction
      .select({ id: eventStaff.id, userId: eventStaff.userId, role: eventStaff.role })
      .from(eventStaff)
      .where(
        and(
          eq(eventStaff.eventId, transfer.eventId),
          inArray(eventStaff.userId, [transfer.proposedByUserId, actorUserId]),
        ),
      )
      .for("update");
    const currentOwner = assignments.find(
      (assignment) =>
        assignment.userId === transfer.proposedByUserId && assignment.role === "owner",
    );
    const proposedOwner = assignments.find(
      (assignment) => assignment.userId === actorUserId && assignment.role === "organizer",
    );
    if (!currentOwner || !proposedOwner) {
      throw new OwnershipTransferUnavailableError(
        "The Event staffing changed before this Ownership Transfer was accepted.",
      );
    }

    await transaction
      .update(eventStaff)
      .set({ role: "organizer" })
      .where(eq(eventStaff.id, currentOwner.id));
    await transaction
      .update(eventStaff)
      .set({ role: "owner" })
      .where(eq(eventStaff.id, proposedOwner.id));
    await transaction
      .update(ownershipTransfer)
      .set({ acceptedAt: now })
      .where(eq(ownershipTransfer.id, transfer.id));
    await transaction.insert(auditEntry).values({
      eventId: transfer.eventId,
      actorUserId,
      action: "ownership_transfer.accepted",
      targetType: "ownership_transfer",
      targetId: transfer.id,
      metadata: {
        previousOwnerUserId: transfer.proposedByUserId,
        newOwnerUserId: actorUserId,
      },
    });
    return { eventId: transfer.eventId };
  });
}

export async function getEventStaffing(
  eventId: string,
  actorUserId: string,
  now = new Date(),
) {
  const [actorAssignment] = await db
    .select({ role: eventStaff.role, eventName: event.name })
    .from(eventStaff)
    .innerJoin(event, eq(event.id, eventStaff.eventId))
    .where(
      and(eq(eventStaff.eventId, eventId), eq(eventStaff.userId, actorUserId)),
    )
    .limit(1);
  const actorRole = actorAssignment?.role as EventStaffRole | undefined;
  if (!actorAssignment || !actorRole || actorRole === "check_in_volunteer") {
    throw new StaffingAuthorizationError("You cannot manage staffing for this Event.");
  }

  const [staff, invitations, transfers] = await Promise.all([
    db
      .select({
        assignmentId: eventStaff.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: eventStaff.role,
        createdAt: eventStaff.createdAt,
      })
      .from(eventStaff)
      .innerJoin(user, eq(user.id, eventStaff.userId))
      .where(eq(eventStaff.eventId, eventId))
      .orderBy(asc(eventStaff.createdAt)),
    db
      .select({
        id: staffInvitation.id,
        normalizedEmail: staffInvitation.normalizedEmail,
        role: staffInvitation.role,
        expiresAt: staffInvitation.expiresAt,
      })
      .from(staffInvitation)
      .where(
        and(
          eq(staffInvitation.eventId, eventId),
          isNull(staffInvitation.consumedAt),
          isNull(staffInvitation.revokedAt),
          gt(staffInvitation.expiresAt, now),
        ),
      )
      .orderBy(asc(staffInvitation.createdAt)),
    db
      .select({
        id: ownershipTransfer.id,
        proposedOwnerUserId: ownershipTransfer.proposedOwnerUserId,
        expiresAt: ownershipTransfer.expiresAt,
      })
      .from(ownershipTransfer)
      .where(
        and(
          eq(ownershipTransfer.eventId, eventId),
          isNull(ownershipTransfer.acceptedAt),
          isNull(ownershipTransfer.revokedAt),
          gt(ownershipTransfer.expiresAt, now),
        ),
      )
      .limit(1),
  ]);

  return {
    eventId,
    eventName: actorAssignment.eventName,
    actorRole,
    staff: staff.map((member) => ({
      ...member,
      role: member.role as EventStaffRole,
    })),
    invitations: invitations.map((invitation) => ({
      ...invitation,
      role: invitation.role as InviteableStaffRole,
    })),
    activeTransfer: transfers[0] ?? null,
  };
}

export async function inspectStaffInvitation(token: string, now = new Date()) {
  const [invitation] = await db
    .select({
      eventName: event.name,
      normalizedEmail: staffInvitation.normalizedEmail,
      role: staffInvitation.role,
      expiresAt: staffInvitation.expiresAt,
      consumedAt: staffInvitation.consumedAt,
      revokedAt: staffInvitation.revokedAt,
    })
    .from(staffInvitation)
    .innerJoin(event, eq(event.id, staffInvitation.eventId))
    .where(eq(staffInvitation.tokenDigest, digestStaffInvitationToken(token)))
    .limit(1);

  if (
    !invitation ||
    invitation.consumedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= now
  ) {
    return null;
  }
  return {
    eventName: invitation.eventName,
    normalizedEmail: invitation.normalizedEmail,
    role: invitation.role as InviteableStaffRole,
    expiresAt: invitation.expiresAt,
  };
}
