CREATE TABLE "registration_import" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"status" text DEFAULT 'preview' NOT NULL,
	"payload" jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"imported_count" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_import_status_check" CHECK ("registration_import"."status" in ('preview', 'completed')),
	CONSTRAINT "registration_import_row_count_check" CHECK ("registration_import"."row_count" > 0 and "registration_import"."row_count" <= 500),
	CONSTRAINT "registration_import_completion_check" CHECK (("registration_import"."status" = 'preview' and "registration_import"."completed_at" is null and "registration_import"."imported_count" is null) or ("registration_import"."status" = 'completed' and "registration_import"."completed_at" is not null and "registration_import"."imported_count" is not null))
);
--> statement-breakpoint
ALTER TABLE "registration_import" ADD CONSTRAINT "registration_import_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_import" ADD CONSTRAINT "registration_import_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_import_event_created_at_idx" ON "registration_import" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "registration_import_expiry_idx" ON "registration_import" USING btree ("expires_at");