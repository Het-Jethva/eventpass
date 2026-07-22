CREATE TABLE "registration_field" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"answer_type" text NOT NULL,
	"label" text NOT NULL,
	"help_text" text,
	"required" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"response_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_field_answer_type_check" CHECK ("registration_field"."answer_type" in ('short_text', 'long_text', 'single_choice', 'multiple_choice', 'acknowledgment')),
	CONSTRAINT "registration_field_label_not_blank_check" CHECK (length(btrim("registration_field"."label")) > 0),
	CONSTRAINT "registration_field_position_nonnegative_check" CHECK ("registration_field"."position" >= 0),
	CONSTRAINT "registration_field_response_count_nonnegative_check" CHECK ("registration_field"."response_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "registration_field_choice" (
	"id" uuid PRIMARY KEY NOT NULL,
	"field_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_field_choice_label_not_blank_check" CHECK (length(btrim("registration_field_choice"."label")) > 0),
	CONSTRAINT "registration_field_choice_position_nonnegative_check" CHECK ("registration_field_choice"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "registration_field" ADD CONSTRAINT "registration_field_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_field_choice" ADD CONSTRAINT "registration_field_choice_field_id_registration_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."registration_field"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_field_event_position_idx" ON "registration_field" USING btree ("event_id","position","id");--> statement-breakpoint
CREATE INDEX "registration_field_choice_field_position_idx" ON "registration_field_choice" USING btree ("field_id","position","id");
--> statement-breakpoint
CREATE FUNCTION "protect_registration_field_meaning"() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD."response_count" > 0 THEN
			RAISE EXCEPTION 'Registration Fields with answers must be archived, not deleted';
		END IF;
		RETURN OLD;
	END IF;

	IF NEW."event_id" <> OLD."event_id" THEN
		RAISE EXCEPTION 'Registration Fields cannot move between Events';
	END IF;
	IF NEW."response_count" < OLD."response_count" THEN
		RAISE EXCEPTION 'Registration Field response counts cannot decrease';
	END IF;
	IF OLD."response_count" > 0 AND NEW."answer_type" <> OLD."answer_type" THEN
		RAISE EXCEPTION 'Registration Field answer types cannot change after answers exist';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "registration_field_meaning_guard"
BEFORE UPDATE OR DELETE ON "registration_field"
FOR EACH ROW EXECUTE FUNCTION "protect_registration_field_meaning"();
--> statement-breakpoint
CREATE FUNCTION "require_optional_new_registration_field"() RETURNS trigger AS $$
BEGIN
	IF NEW."required" AND EXISTS (
		SELECT 1 FROM "registration_field"
		WHERE "event_id" = NEW."event_id" AND "response_count" > 0
	) THEN
		RAISE EXCEPTION 'Registration Fields added after responses exist must be optional';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "registration_field_new_optional_guard"
BEFORE INSERT ON "registration_field"
FOR EACH ROW EXECUTE FUNCTION "require_optional_new_registration_field"();
--> statement-breakpoint
CREATE FUNCTION "protect_registration_field_choice_identity"() RETURNS trigger AS $$
DECLARE
	answer_count integer;
BEGIN
	IF TG_OP = 'UPDATE' AND NEW."field_id" <> OLD."field_id" THEN
		RAISE EXCEPTION 'Registration Field Choices cannot move between Fields';
	END IF;
	IF TG_OP = 'DELETE' THEN
		SELECT "response_count" INTO answer_count
		FROM "registration_field" WHERE "id" = OLD."field_id";
		IF answer_count > 0 THEN
			RAISE EXCEPTION 'Choices used by answers must be archived, not deleted';
		END IF;
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "registration_field_choice_identity_guard"
BEFORE UPDATE OR DELETE ON "registration_field_choice"
FOR EACH ROW EXECUTE FUNCTION "protect_registration_field_choice_identity"();
