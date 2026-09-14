CREATE OR REPLACE FUNCTION prevent_audit_entry_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Audit Entries are append-only';
	END IF;
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
		OR NEW.action IS DISTINCT FROM OLD.action
		OR NEW.target_type IS DISTINCT FROM OLD.target_type
		OR NEW.target_id IS DISTINCT FROM OLD.target_id
		OR NEW.reason IS DISTINCT FROM OLD.reason
		OR NEW.metadata IS DISTINCT FROM OLD.metadata
		OR NEW.created_at IS DISTINCT FROM OLD.created_at
		OR NEW.event_id IS NOT NULL
		OR OLD.event_id IS NULL THEN
		RAISE EXCEPTION 'Audit Entries are append-only';
	END IF;
	RETURN NEW;
END;
$$;
