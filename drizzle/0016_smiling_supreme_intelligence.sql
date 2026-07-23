CREATE TABLE "support_access" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "support_access_reason_not_blank_check" CHECK (length(btrim("support_access"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_entry" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "support_access" ADD CONSTRAINT "support_access_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access" ADD CONSTRAINT "support_access_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_access_event_admin_idx" ON "support_access" USING btree ("event_id","admin_user_id");--> statement-breakpoint
CREATE INDEX "support_access_expires_at_idx" ON "support_access" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_suspension_check" CHECK (("event"."suspended" = true and "event"."suspended_at" is not null and length(btrim("event"."suspension_reason")) > 0) or ("event"."suspended" = false and "event"."suspended_at" is null and "event"."suspension_reason" is null));