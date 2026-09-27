CREATE TABLE "ticket" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"code" text NOT NULL,
	"signed_payload" text NOT NULL,
	"signing_key_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_code_format_check" CHECK ("ticket"."code" ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
	CONSTRAINT "ticket_status_check" CHECK ("ticket"."status" in ('active', 'replaced', 'canceled')),
	CONSTRAINT "ticket_invalidation_check" CHECK (("ticket"."status" = 'active' and "ticket"."invalidated_at" is null) or ("ticket"."status" <> 'active' and "ticket"."invalidated_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "registration" ADD COLUMN "management_token_digest" text;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_registration_id_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registration"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_event_code_unique" ON "ticket" USING btree ("event_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_active_registration_unique" ON "ticket" USING btree ("registration_id") WHERE "ticket"."status" = 'active';--> statement-breakpoint
CREATE INDEX "ticket_event_status_idx" ON "ticket" USING btree ("event_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_management_token_digest_unique" ON "registration" USING btree ("management_token_digest") WHERE "registration"."management_token_digest" is not null;