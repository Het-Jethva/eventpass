CREATE OR REPLACE FUNCTION "protect_registration_field_meaning"() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD."response_count" > 0 AND NOT EXISTS (
            SELECT 1 FROM "event" e
            WHERE e.id = OLD.event_id AND e.status = 'draft'
              AND NOT EXISTS (SELECT 1 FROM registration r WHERE r.event_id = e.id)
        ) THEN
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
CREATE OR REPLACE FUNCTION "protect_registration_field_choice_identity"() RETURNS trigger AS $$
DECLARE
	answer_count integer;
BEGIN
	IF TG_OP = 'UPDATE' AND NEW."field_id" <> OLD."field_id" THEN
		RAISE EXCEPTION 'Registration Field Choices cannot move between Fields';
	END IF;
	IF TG_OP = 'DELETE' THEN
		SELECT "response_count" INTO answer_count
		FROM "registration_field" WHERE "id" = OLD."field_id";
		IF answer_count > 0 AND NOT EXISTS (
            SELECT 1 FROM "event" e
            INNER JOIN registration_field f ON f.event_id = e.id
            WHERE f.id = OLD.field_id AND e.status = 'draft'
              AND NOT EXISTS (SELECT 1 FROM registration r WHERE r.event_id = e.id)
        ) THEN
			RAISE EXCEPTION 'Choices used by answers must be archived, not deleted';
		END IF;
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

