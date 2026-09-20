BEGIN;

ALTER TABLE users
  ALTER COLUMN phone_number DROP NOT NULL,
  ALTER COLUMN phone_verified_at DROP NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT users_phone_e164,
  DROP CONSTRAINT users_phone_verified_after_creation;

ALTER TABLE users
  ADD COLUMN user_type TEXT;

UPDATE users u
SET user_type = CASE
  WHEN u.is_admin THEN 'admin'
  WHEN EXISTS (
    SELECT 1
    FROM clubhouses c
    WHERE c.primary_user_id = u.id
  ) THEN 'member'
  WHEN EXISTS (
    SELECT 1
    FROM clubhouse_members cm
    WHERE cm.user_id = u.id
  ) THEN 'partner'
  ELSE 'member'
END;

ALTER TABLE users
  ADD CONSTRAINT users_phone_e164
    CHECK (
      phone_number IS NULL
      OR phone_number ~ '^\+[1-9][0-9]{7,14}$'
    ),
  ADD CONSTRAINT users_phone_required_for_non_admin
    CHECK (
      is_admin
      OR phone_number IS NOT NULL
    ),
  ADD CONSTRAINT users_phone_verified_after_creation
    CHECK (
      phone_verified_at IS NULL
      OR phone_verified_at >= created_at
    ),
  ADD CONSTRAINT users_phone_verified_required_for_non_admin
    CHECK (
      is_admin
      OR phone_verified_at IS NOT NULL
    ),
  ADD CONSTRAINT users_type_valid
    CHECK (
      user_type IS NULL
      OR user_type IN ('member', 'partner', 'admin')
    ),
  ADD CONSTRAINT users_admin_type_consistent
    CHECK (
      (is_admin AND user_type = 'admin')
      OR (NOT is_admin AND user_type IS DISTINCT FROM 'admin')
    );

CREATE UNIQUE INDEX users_one_admin_uidx
  ON users ((is_admin))
  WHERE is_admin;

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.actor_user_id IS NOT NULL
    AND NEW.actor_user_id IS NULL
    AND NEW.id = OLD.id
    AND NEW.actor_snapshot IS NOT DISTINCT FROM OLD.actor_snapshot
    AND NEW.action = OLD.action
    AND NEW.target_type = OLD.target_type
    AND NEW.target_id IS NOT DISTINCT FROM OLD.target_id
    AND NEW.target_snapshot IS NOT DISTINCT FROM OLD.target_snapshot
    AND NEW.metadata = OLD.metadata
    AND NEW.occurred_at = OLD.occurred_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_events is append-only'
    USING ERRCODE = '55000';
END;
$$;

COMMIT;
