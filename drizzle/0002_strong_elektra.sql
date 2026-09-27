CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"event_time_zone" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"venue_name" text NOT NULL,
	"venue_address" text NOT NULL,
	"venue_map_url" text,
	"capacity" integer NOT NULL,
	"registration_opens_at" timestamp with time zone NOT NULL,
	"registration_closes_at" timestamp with time zone NOT NULL,
	"check_in_opens_at" timestamp with time zone NOT NULL,
	"check_in_closes_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_status_check" CHECK ("event"."status" in ('draft', 'published', 'canceled')),
	CONSTRAINT "event_name_not_blank_check" CHECK (length(btrim("event"."name")) > 0),
	CONSTRAINT "event_capacity_positive_check" CHECK ("event"."capacity" > 0),
	CONSTRAINT "event_schedule_check" CHECK ("event"."starts_at" < "event"."ends_at"),
	CONSTRAINT "event_registration_window_check" CHECK ("event"."registration_opens_at" < "event"."registration_closes_at"),
	CONSTRAINT "event_check_in_window_check" CHECK ("event"."check_in_opens_at" < "event"."check_in_closes_at")
);
--> statement-breakpoint
CREATE TABLE "event_staff" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_staff_role_check" CHECK ("event_staff"."role" in ('owner', 'organizer', 'check_in_volunteer'))
);
--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_starts_at_idx" ON "event" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_staff_event_user_unique" ON "event_staff" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_staff_single_owner_unique" ON "event_staff" USING btree ("event_id") WHERE "event_staff"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "event_staff_user_id_idx" ON "event_staff" USING btree ("user_id");