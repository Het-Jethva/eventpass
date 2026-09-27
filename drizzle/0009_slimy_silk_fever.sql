CREATE TABLE "audit_entry" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_entry_action_not_blank_check" CHECK (length(btrim("audit_entry"."action")) > 0),
	CONSTRAINT "audit_entry_target_type_not_blank_check" CHECK (length(btrim("audit_entry"."target_type")) > 0)
);
--> statement-breakpoint
CREATE FUNCTION prevent_audit_entry_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'Audit Entries are append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_entry_immutable
BEFORE UPDATE OR DELETE ON "audit_entry"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_entry_mutation();
--> statement-breakpoint
CREATE TABLE "ownership_transfer" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"proposed_by_user_id" uuid NOT NULL,
	"proposed_owner_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ownership_transfer_terminal_state_check" CHECK (not ("ownership_transfer"."accepted_at" is not null and "ownership_transfer"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "staff_invitation" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"normalized_email" text NOT NULL,
	"role" text NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invitation_role_check" CHECK ("staff_invitation"."role" in ('organizer', 'check_in_volunteer')),
	CONSTRAINT "staff_invitation_email_normalized_check" CHECK ("staff_invitation"."normalized_email" = lower(btrim("staff_invitation"."normalized_email"))),
	CONSTRAINT "staff_invitation_terminal_state_check" CHECK (not ("staff_invitation"."consumed_at" is not null and "staff_invitation"."revoked_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_proposed_by_user_id_user_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_proposed_owner_user_id_user_id_fk" FOREIGN KEY ("proposed_owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitation" ADD CONSTRAINT "staff_invitation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitation" ADD CONSTRAINT "staff_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entry_event_created_at_idx" ON "audit_entry" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ownership_transfer_active_event_unique" ON "ownership_transfer" USING btree ("event_id") WHERE "ownership_transfer"."accepted_at" is null and "ownership_transfer"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "ownership_transfer_target_idx" ON "ownership_transfer" USING btree ("proposed_owner_user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitation_token_digest_unique" ON "staff_invitation" USING btree ("token_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitation_active_event_email_unique" ON "staff_invitation" USING btree ("event_id","normalized_email") WHERE "staff_invitation"."consumed_at" is null and "staff_invitation"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "staff_invitation_event_idx" ON "staff_invitation" USING btree ("event_id","created_at");
