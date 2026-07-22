CREATE TABLE "check_in" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invalidated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scan_attempt" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_id" uuid,
	"check_in_id" uuid,
	"actor_user_id" uuid NOT NULL,
	"input_digest" text NOT NULL,
	"input_method" text NOT NULL,
	"outcome" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_attempt_input_method_check" CHECK ("scan_attempt"."input_method" in ('camera', 'manual')),
	CONSTRAINT "scan_attempt_outcome_check" CHECK ("scan_attempt"."outcome" in ('accepted', 'duplicate', 'invalid', 'unknown', 'canceled', 'replaced', 'expired', 'outside_window')),
	CONSTRAINT "scan_attempt_check_in_outcome_check" CHECK (("scan_attempt"."outcome" = 'accepted' and "scan_attempt"."check_in_id" is not null) or ("scan_attempt"."outcome" <> 'accepted' and "scan_attempt"."check_in_id" is null))
);
--> statement-breakpoint
CREATE FUNCTION prevent_scan_attempt_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'Scan Attempts are append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER scan_attempt_immutable
BEFORE UPDATE OR DELETE ON "scan_attempt"
FOR EACH ROW EXECUTE FUNCTION prevent_scan_attempt_mutation();
--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_attempt" ADD CONSTRAINT "scan_attempt_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_attempt" ADD CONSTRAINT "scan_attempt_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_attempt" ADD CONSTRAINT "scan_attempt_check_in_id_check_in_id_fk" FOREIGN KEY ("check_in_id") REFERENCES "public"."check_in"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_attempt" ADD CONSTRAINT "scan_attempt_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "check_in_active_ticket_unique" ON "check_in" USING btree ("ticket_id") WHERE "check_in"."invalidated_at" is null;--> statement-breakpoint
CREATE INDEX "check_in_event_checked_in_at_idx" ON "check_in" USING btree ("event_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "scan_attempt_event_attempted_at_idx" ON "scan_attempt" USING btree ("event_id","attempted_at");--> statement-breakpoint
CREATE INDEX "scan_attempt_ticket_idx" ON "scan_attempt" USING btree ("ticket_id");
