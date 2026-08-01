CREATE TABLE "registration_attempt" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"email_digest" text NOT NULL,
	"ip_digest" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_attempt" ADD CONSTRAINT "registration_attempt_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_attempt_event_email_attempted_at_idx" ON "registration_attempt" USING btree ("event_id","email_digest","attempted_at");--> statement-breakpoint
CREATE INDEX "registration_attempt_event_ip_attempted_at_idx" ON "registration_attempt" USING btree ("event_id","ip_digest","attempted_at");--> statement-breakpoint
CREATE INDEX "registration_attempt_attempted_at_idx" ON "registration_attempt" USING btree ("attempted_at");