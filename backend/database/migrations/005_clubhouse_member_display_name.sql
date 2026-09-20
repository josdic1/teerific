BEGIN;

ALTER TABLE clubhouse_members
  ADD COLUMN display_name_override TEXT;

ALTER TABLE clubhouse_members
  ADD CONSTRAINT clubhouse_members_display_name_override_length
  CHECK (
    display_name_override IS NULL
    OR (
      length(btrim(display_name_override)) BETWEEN 1 AND 100
    )
  );

COMMIT;
