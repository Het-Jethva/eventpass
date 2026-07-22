import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  bigint,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  suspended: boolean("suspended").default(false).notNull(),
});

export const session = pgTable(
  "session",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const authenticationAttempt = pgTable(
  "authentication_attempt",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    emailKey: text("email_key").notNull(),
    ipKey: text("ip_key").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("authentication_attempt_email_key_attempted_at_idx").on(
      table.emailKey,
      table.attemptedAt,
    ),
    index("authentication_attempt_ip_key_attempted_at_idx").on(
      table.ipKey,
      table.attemptedAt,
    ),
    index("authentication_attempt_attempted_at_idx").on(table.attemptedAt),
  ],
);

export const emailDelivery = pgTable(
  "email_delivery",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id").unique(),
    outcome: text("outcome").notNull(),
    failureKind: text("failure_kind"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "email_delivery_outcome_check",
      sql`${table.outcome} in ('pending', 'submitted', 'sent', 'delivered', 'transient_failure', 'permanent_failure')`,
    ),
    check(
      "email_delivery_failure_kind_check",
      sql`${table.failureKind} is null or ${table.failureKind} in ('transient', 'permanent')`,
    ),
    check("email_delivery_provider_check", sql`${table.provider} in ('resend')`),
  ],
);

export const event = pgTable(
  "event",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    slug: text("slug").notNull(),
    status: text("status").default("draft").notNull(),
    eventTimeZone: text("event_time_zone").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    venueName: text("venue_name").notNull(),
    venueAddress: text("venue_address").notNull(),
    venueMapUrl: text("venue_map_url"),
    capacity: integer("capacity").notNull(),
    registrationOpensAt: timestamp("registration_opens_at", {
      withTimezone: true,
    }).notNull(),
    registrationClosesAt: timestamp("registration_closes_at", {
      withTimezone: true,
    }).notNull(),
    checkInOpensAt: timestamp("check_in_opens_at", {
      withTimezone: true,
    }).notNull(),
    checkInClosesAt: timestamp("check_in_closes_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "event_status_check",
      sql`${table.status} in ('draft', 'published', 'canceled')`,
    ),
    check("event_name_not_blank_check", sql`length(btrim(${table.name})) > 0`),
    check(
      "event_description_not_blank_check",
      sql`length(btrim(${table.description})) > 0`,
    ),
    check(
      "event_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "event_publication_timestamp_check",
      sql`${table.status} = 'draft' or ${table.publishedAt} is not null`,
    ),
    check("event_capacity_positive_check", sql`${table.capacity} > 0`),
    check("event_schedule_check", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "event_registration_window_check",
      sql`${table.registrationOpensAt} < ${table.registrationClosesAt}`,
    ),
    check(
      "event_check_in_window_check",
      sql`${table.checkInOpensAt} < ${table.checkInClosesAt}`,
    ),
    index("event_starts_at_idx").on(table.startsAt),
    uniqueIndex("event_slug_unique").on(table.slug),
  ],
);

export const eventStaff = pgTable(
  "event_staff",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "event_staff_role_check",
      sql`${table.role} in ('owner', 'organizer', 'check_in_volunteer')`,
    ),
    uniqueIndex("event_staff_event_user_unique").on(
      table.eventId,
      table.userId,
    ),
    uniqueIndex("event_staff_single_owner_unique")
      .on(table.eventId)
      .where(sql`${table.role} = 'owner'`),
    index("event_staff_user_id_idx").on(table.userId),
  ],
);

export const staffInvitation = pgTable(
  "staff_invitation",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    normalizedEmail: text("normalized_email").notNull(),
    role: text("role").notNull(),
    tokenDigest: text("token_digest").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "staff_invitation_role_check",
      sql`${table.role} in ('organizer', 'check_in_volunteer')`,
    ),
    check(
      "staff_invitation_email_normalized_check",
      sql`${table.normalizedEmail} = lower(btrim(${table.normalizedEmail}))`,
    ),
    check(
      "staff_invitation_terminal_state_check",
      sql`not (${table.consumedAt} is not null and ${table.revokedAt} is not null)`,
    ),
    uniqueIndex("staff_invitation_token_digest_unique").on(table.tokenDigest),
    uniqueIndex("staff_invitation_active_event_email_unique")
      .on(table.eventId, table.normalizedEmail)
      .where(sql`${table.consumedAt} is null and ${table.revokedAt} is null`),
    index("staff_invitation_event_idx").on(table.eventId, table.createdAt),
  ],
);

export const ownershipTransfer = pgTable(
  "ownership_transfer",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    proposedByUserId: uuid("proposed_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    proposedOwnerUserId: uuid("proposed_owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "ownership_transfer_terminal_state_check",
      sql`not (${table.acceptedAt} is not null and ${table.revokedAt} is not null)`,
    ),
    uniqueIndex("ownership_transfer_active_event_unique")
      .on(table.eventId)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index("ownership_transfer_target_idx").on(
      table.proposedOwnerUserId,
      table.expiresAt,
    ),
  ],
);

export const auditEntry = pgTable(
  "audit_entry",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("audit_entry_action_not_blank_check", sql`length(btrim(${table.action})) > 0`),
    check(
      "audit_entry_target_type_not_blank_check",
      sql`length(btrim(${table.targetType})) > 0`,
    ),
    index("audit_entry_event_created_at_idx").on(table.eventId, table.createdAt),
  ],
);

export const registrationField = pgTable(
  "registration_field",
  {
    id: uuid("id").primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    answerType: text("answer_type").notNull(),
    label: text("label").notNull(),
    helpText: text("help_text"),
    required: boolean("required").default(false).notNull(),
    archived: boolean("archived").default(false).notNull(),
    position: integer("position").notNull(),
    responseCount: integer("response_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "registration_field_answer_type_check",
      sql`${table.answerType} in ('short_text', 'long_text', 'single_choice', 'multiple_choice', 'acknowledgment')`,
    ),
    check(
      "registration_field_label_not_blank_check",
      sql`length(btrim(${table.label})) > 0`,
    ),
    check(
      "registration_field_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    check(
      "registration_field_response_count_nonnegative_check",
      sql`${table.responseCount} >= 0`,
    ),
    index("registration_field_event_position_idx").on(
      table.eventId,
      table.position,
      table.id,
    ),
  ],
);

export const registrationFieldChoice = pgTable(
  "registration_field_choice",
  {
    id: uuid("id").primaryKey(),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => registrationField.id, { onDelete: "restrict" }),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "registration_field_choice_label_not_blank_check",
      sql`length(btrim(${table.label})) > 0`,
    ),
    check(
      "registration_field_choice_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    index("registration_field_choice_field_position_idx").on(
      table.fieldId,
      table.position,
      table.id,
    ),
  ],
);

export const registration = pgTable(
  "registration",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    attendeeName: text("attendee_name").notNull(),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    status: text("status").default("unconfirmed").notNull(),
    capacityOutcome: text("capacity_outcome").notNull(),
    source: text("source").default("attendee").notNull(),
    managementTokenDigest: text("management_token_digest"),
    managementTokenRevokedAt: timestamp("management_token_revoked_at", {
      withTimezone: true,
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "registration_status_check",
      sql`${table.status} in ('unconfirmed', 'confirmed', 'waitlisted', 'expired', 'canceled')`,
    ),
    check(
      "registration_capacity_outcome_check",
      sql`${table.capacityOutcome} in ('capacity_hold', 'waitlist')`,
    ),
    check(
      "registration_source_check",
      sql`${table.source} in ('attendee', 'imported')`,
    ),
    check(
      "registration_attendee_name_not_blank_check",
      sql`length(btrim(${table.attendeeName})) > 0`,
    ),
    check(
      "registration_normalized_email_check",
      sql`${table.normalizedEmail} = lower(btrim(${table.normalizedEmail}))`,
    ),
    uniqueIndex("registration_active_event_email_unique")
      .on(table.eventId, table.normalizedEmail)
      .where(sql`${table.status} in ('unconfirmed', 'confirmed', 'waitlisted')`),
    uniqueIndex("registration_management_token_digest_unique")
      .on(table.managementTokenDigest)
      .where(sql`${table.managementTokenDigest} is not null`),
    index("registration_event_status_idx").on(table.eventId, table.status),
  ],
);

export const ticket = pgTable(
  "ticket",
  {
    id: uuid("id").primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registration.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    signedPayload: text("signed_payload").notNull(),
    signingKeyId: text("signing_key_id").notNull(),
    status: text("status").default("active").notNull(),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("ticket_code_format_check", sql`${table.code} ~ '^[0-9A-HJKMNP-TV-Z]{10}$'`),
    check(
      "ticket_status_check",
      sql`${table.status} in ('active', 'replaced', 'canceled')`,
    ),
    check(
      "ticket_invalidation_check",
      sql`(${table.status} = 'active' and ${table.invalidatedAt} is null) or (${table.status} <> 'active' and ${table.invalidatedAt} is not null)`,
    ),
    uniqueIndex("ticket_event_code_unique").on(table.eventId, table.code),
    uniqueIndex("ticket_active_registration_unique")
      .on(table.registrationId)
      .where(sql`${table.status} = 'active'`),
    index("ticket_event_status_idx").on(table.eventId, table.status),
  ],
);

export const registrationAnswer = pgTable(
  "registration_answer",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registration.id, { onDelete: "restrict" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => registrationField.id, { onDelete: "restrict" }),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("registration_answer_registration_field_unique").on(
      table.registrationId,
      table.fieldId,
    ),
    index("registration_answer_field_idx").on(table.fieldId),
  ],
);

export const capacityHold = pgTable(
  "capacity_hold",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registration.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("capacity_hold_registration_unique").on(table.registrationId),
    index("capacity_hold_active_idx").on(table.expiresAt, table.claimedAt),
  ],
);

export const admissionOffer = pgTable(
  "admission_offer",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registration.id, { onDelete: "restrict" }),
    tokenDigest: text("token_digest").notNull(),
    status: text("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "admission_offer_status_check",
      sql`${table.status} in ('active', 'claimed', 'expired')`,
    ),
    uniqueIndex("admission_offer_active_registration_unique")
      .on(table.registrationId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("admission_offer_token_digest_unique").on(table.tokenDigest),
    index("admission_offer_active_idx").on(table.status, table.expiresAt),
    check(
      "admission_offer_claimed_at_check",
      sql`(${table.status} = 'claimed' and ${table.claimedAt} is not null) or (${table.status} <> 'claimed' and ${table.claimedAt} is null)`,
    ),
  ],
);

export const registrationVerification = pgTable(
  "registration_verification",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registration.id, { onDelete: "restrict" }),
    tokenDigest: text("token_digest").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("registration_verification_token_digest_unique").on(
      table.tokenDigest,
    ),
    index("registration_verification_registration_idx").on(table.registrationId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  eventAssignments: many(eventStaff),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const eventRelations = relations(event, ({ many }) => ({
  staff: many(eventStaff),
  staffInvitations: many(staffInvitation),
  ownershipTransfers: many(ownershipTransfer),
  auditEntries: many(auditEntry),
  registrationFields: many(registrationField),
  registrations: many(registration),
  tickets: many(ticket),
}));

export const eventStaffRelations = relations(eventStaff, ({ one }) => ({
  event: one(event, {
    fields: [eventStaff.eventId],
    references: [event.id],
  }),
  user: one(user, {
    fields: [eventStaff.userId],
    references: [user.id],
  }),
}));

export const staffInvitationRelations = relations(staffInvitation, ({ one }) => ({
  event: one(event, {
    fields: [staffInvitation.eventId],
    references: [event.id],
  }),
  invitedBy: one(user, {
    fields: [staffInvitation.invitedByUserId],
    references: [user.id],
  }),
}));

export const ownershipTransferRelations = relations(
  ownershipTransfer,
  ({ one }) => ({
    event: one(event, {
      fields: [ownershipTransfer.eventId],
      references: [event.id],
    }),
    proposedBy: one(user, {
      fields: [ownershipTransfer.proposedByUserId],
      references: [user.id],
      relationName: "ownershipTransferProposer",
    }),
    proposedOwner: one(user, {
      fields: [ownershipTransfer.proposedOwnerUserId],
      references: [user.id],
      relationName: "ownershipTransferTarget",
    }),
  }),
);

export const auditEntryRelations = relations(auditEntry, ({ one }) => ({
  event: one(event, {
    fields: [auditEntry.eventId],
    references: [event.id],
  }),
  actor: one(user, {
    fields: [auditEntry.actorUserId],
    references: [user.id],
  }),
}));

export const registrationFieldRelations = relations(
  registrationField,
  ({ one, many }) => ({
    event: one(event, {
      fields: [registrationField.eventId],
      references: [event.id],
    }),
    choices: many(registrationFieldChoice),
    answers: many(registrationAnswer),
  }),
);

export const registrationFieldChoiceRelations = relations(
  registrationFieldChoice,
  ({ one }) => ({
    field: one(registrationField, {
      fields: [registrationFieldChoice.fieldId],
      references: [registrationField.id],
    }),
  }),
);

export const registrationRelations = relations(registration, ({ one, many }) => ({
  event: one(event, {
    fields: [registration.eventId],
    references: [event.id],
  }),
  answers: many(registrationAnswer),
  capacityHolds: many(capacityHold),
  admissionOffers: many(admissionOffer),
  verificationCapabilities: many(registrationVerification),
  tickets: many(ticket),
}));

export const ticketRelations = relations(ticket, ({ one }) => ({
  event: one(event, {
    fields: [ticket.eventId],
    references: [event.id],
  }),
  registration: one(registration, {
    fields: [ticket.registrationId],
    references: [registration.id],
  }),
}));

export const registrationAnswerRelations = relations(
  registrationAnswer,
  ({ one }) => ({
    registration: one(registration, {
      fields: [registrationAnswer.registrationId],
      references: [registration.id],
    }),
    field: one(registrationField, {
      fields: [registrationAnswer.fieldId],
      references: [registrationField.id],
    }),
  }),
);

export const capacityHoldRelations = relations(capacityHold, ({ one }) => ({
  registration: one(registration, {
    fields: [capacityHold.registrationId],
    references: [registration.id],
  }),
}));

export const admissionOfferRelations = relations(admissionOffer, ({ one }) => ({
  registration: one(registration, {
    fields: [admissionOffer.registrationId],
    references: [registration.id],
  }),
}));

export const registrationVerificationRelations = relations(
  registrationVerification,
  ({ one }) => ({
    registration: one(registration, {
      fields: [registrationVerification.registrationId],
      references: [registration.id],
    }),
  }),
);
