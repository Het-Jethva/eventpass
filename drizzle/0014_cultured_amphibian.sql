ALTER TABLE "email_delivery" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
UPDATE "event"
SET
  "canceled_at" = COALESCE("updated_at", CURRENT_TIMESTAMP),
  "cancellation_reason" = 'Canceled before reason tracking was enabled.'
WHERE "status" = 'canceled';--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_cancellation_check" CHECK (("event"."status" = 'canceled' and "event"."canceled_at" is not null and length(btrim("event"."cancellation_reason")) > 0) or ("event"."status" <> 'canceled' and "event"."canceled_at" is null and "event"."cancellation_reason" is null));
