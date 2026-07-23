CREATE TABLE "check_in_conflict" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"authoritative_scan_attempt_id" uuid,
	"resolved_by_user_id" uuid,
	"resolution_reason" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_conflict_status_check" CHECK ("check_in_conflict"."status" in ('unresolved', 'resolved_auto', 'resolved_manual')),
	CONSTRAINT "check_in_conflict_resolution_check" CHECK (("check_in_conflict"."status" = 'unresolved' and "check_in_conflict"."authoritative_scan_attempt_id" is null and "check_in_conflict"."resolved_by_user_id" is null and "check_in_conflict"."resolution_reason" is null and "check_in_conflict"."resolved_at" is null) or ("check_in_conflict"."status" = 'resolved_auto' and "check_in_conflict"."authoritative_scan_attempt_id" is not null and "check_in_conflict"."resolved_by_user_id" is null and "check_in_conflict"."resolution_reason" is null and "check_in_conflict"."resolved_at" is not null) or ("check_in_conflict"."status" = 'resolved_manual' and "check_in_conflict"."authoritative_scan_attempt_id" is not null and "check_in_conflict"."resolved_by_user_id" is not null and length(btrim("check_in_conflict"."resolution_reason")) > 0 and "check_in_conflict"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "scan_attempt" DROP CONSTRAINT "scan_attempt_outcome_check";--> statement-breakpoint
ALTER TABLE "check_in_conflict" ADD CONSTRAINT "check_in_conflict_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_conflict" ADD CONSTRAINT "check_in_conflict_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_conflict" ADD CONSTRAINT "check_in_conflict_authoritative_scan_attempt_id_scan_attempt_id_fk" FOREIGN KEY ("authoritative_scan_attempt_id") REFERENCES "public"."scan_attempt"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_conflict" ADD CONSTRAINT "check_in_conflict_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "check_in_conflict_unresolved_ticket_unique" ON "check_in_conflict" USING btree ("ticket_id") WHERE "check_in_conflict"."status" = 'unresolved';--> statement-breakpoint
CREATE INDEX "check_in_conflict_event_status_idx" ON "check_in_conflict" USING btree ("event_id","status","created_at");--> statement-breakpoint
ALTER TABLE "scan_attempt" ADD CONSTRAINT "scan_attempt_outcome_check" CHECK ("scan_attempt"."outcome" in ('accepted', 'duplicate', 'invalid', 'unknown', 'canceled', 'replaced', 'expired', 'outside_window', 'conflict'));