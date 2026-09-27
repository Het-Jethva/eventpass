ALTER TABLE "event" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
UPDATE "event"
SET
  "description" = "name",
  "slug" = concat(
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''),
      'event'
    ),
    '-',
    left("id"::text, 8)
  );--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_slug_unique" ON "event" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_description_not_blank_check" CHECK (length(btrim("event"."description")) > 0);--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_slug_format_check" CHECK ("event"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_publication_timestamp_check" CHECK ("event"."status" = 'draft' or "event"."published_at" is not null);--> statement-breakpoint
CREATE FUNCTION prevent_published_event_slug_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'An Event Slug is immutable after publication.';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER event_published_slug_immutable
BEFORE UPDATE OF slug ON "event"
FOR EACH ROW EXECUTE FUNCTION prevent_published_event_slug_change();
