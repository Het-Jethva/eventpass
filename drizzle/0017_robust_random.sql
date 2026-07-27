ALTER TABLE "email_delivery" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "email_delivery" ADD CONSTRAINT "email_delivery_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_delivery_event_outcome_idx" ON "email_delivery" USING btree ("event_id","outcome");