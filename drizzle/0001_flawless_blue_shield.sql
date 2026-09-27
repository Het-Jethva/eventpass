CREATE TABLE "authentication_attempt" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"email_key" text NOT NULL,
	"ip_key" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_delivery" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"template" text NOT NULL,
	"recipient" text NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"outcome" text NOT NULL,
	"failure_kind" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_delivery_provider_message_id_unique" UNIQUE("provider_message_id"),
	CONSTRAINT "email_delivery_outcome_check" CHECK ("email_delivery"."outcome" in ('pending', 'submitted', 'sent', 'delivered', 'transient_failure', 'permanent_failure')),
	CONSTRAINT "email_delivery_failure_kind_check" CHECK ("email_delivery"."failure_kind" is null or "email_delivery"."failure_kind" in ('transient', 'permanent')),
	CONSTRAINT "email_delivery_provider_check" CHECK ("email_delivery"."provider" in ('resend'))
);
--> statement-breakpoint
CREATE INDEX "authentication_attempt_email_key_attempted_at_idx" ON "authentication_attempt" USING btree ("email_key","attempted_at");--> statement-breakpoint
CREATE INDEX "authentication_attempt_ip_key_attempted_at_idx" ON "authentication_attempt" USING btree ("ip_key","attempted_at");--> statement-breakpoint
CREATE INDEX "authentication_attempt_attempted_at_idx" ON "authentication_attempt" USING btree ("attempted_at");
