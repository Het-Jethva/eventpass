CREATE TABLE "check_in_reversal" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"check_in_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_reversal_kind_check" CHECK ("check_in_reversal"."kind" in ('quick', 'organizer')),
	CONSTRAINT "check_in_reversal_reason_not_blank_check" CHECK (length(btrim("check_in_reversal"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "check_in_reversal" ADD CONSTRAINT "check_in_reversal_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_reversal" ADD CONSTRAINT "check_in_reversal_check_in_id_check_in_id_fk" FOREIGN KEY ("check_in_id") REFERENCES "public"."check_in"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_reversal" ADD CONSTRAINT "check_in_reversal_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "check_in_reversal_check_in_unique" ON "check_in_reversal" USING btree ("check_in_id");--> statement-breakpoint
CREATE INDEX "check_in_reversal_event_created_at_idx" ON "check_in_reversal" USING btree ("event_id","created_at");