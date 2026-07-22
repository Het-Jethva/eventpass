CREATE TABLE "admission_offer" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_offer_status_check" CHECK ("admission_offer"."status" in ('active', 'claimed', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "capacity_hold" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"attendee_name" text NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"status" text DEFAULT 'unconfirmed' NOT NULL,
	"capacity_outcome" text NOT NULL,
	"source" text DEFAULT 'attendee' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_status_check" CHECK ("registration"."status" in ('unconfirmed', 'confirmed', 'waitlisted', 'expired', 'canceled')),
	CONSTRAINT "registration_capacity_outcome_check" CHECK ("registration"."capacity_outcome" in ('capacity_hold', 'waitlist')),
	CONSTRAINT "registration_source_check" CHECK ("registration"."source" in ('attendee', 'imported')),
	CONSTRAINT "registration_attendee_name_not_blank_check" CHECK (length(btrim("registration"."attendee_name")) > 0),
	CONSTRAINT "registration_normalized_email_check" CHECK ("registration"."normalized_email" = lower(btrim("registration"."normalized_email")))
);
--> statement-breakpoint
CREATE TABLE "registration_answer" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admission_offer" ADD CONSTRAINT "admission_offer_registration_id_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registration"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_hold" ADD CONSTRAINT "capacity_hold_registration_id_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registration"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_answer" ADD CONSTRAINT "registration_answer_registration_id_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registration"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_answer" ADD CONSTRAINT "registration_answer_field_id_registration_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."registration_field"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_verification" ADD CONSTRAINT "registration_verification_registration_id_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registration"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admission_offer_active_registration_unique" ON "admission_offer" USING btree ("registration_id") WHERE "admission_offer"."status" = 'active';--> statement-breakpoint
CREATE INDEX "admission_offer_active_idx" ON "admission_offer" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_hold_registration_unique" ON "capacity_hold" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "capacity_hold_active_idx" ON "capacity_hold" USING btree ("expires_at","claimed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_active_event_email_unique" ON "registration" USING btree ("event_id","normalized_email") WHERE "registration"."status" in ('unconfirmed', 'confirmed', 'waitlisted');--> statement-breakpoint
CREATE INDEX "registration_event_status_idx" ON "registration" USING btree ("event_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_answer_registration_field_unique" ON "registration_answer" USING btree ("registration_id","field_id");--> statement-breakpoint
CREATE INDEX "registration_answer_field_idx" ON "registration_answer" USING btree ("field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_verification_token_digest_unique" ON "registration_verification" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "registration_verification_registration_idx" ON "registration_verification" USING btree ("registration_id");