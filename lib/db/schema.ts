import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  bigint,
  timestamp,
  boolean,
  integer,
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
  registrationFields: many(registrationField),
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

export const registrationFieldRelations = relations(
  registrationField,
  ({ one, many }) => ({
    event: one(event, {
      fields: [registrationField.eventId],
      references: [event.id],
    }),
    choices: many(registrationFieldChoice),
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
