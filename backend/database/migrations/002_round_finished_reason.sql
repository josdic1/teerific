ALTER TABLE rounds
  DROP CONSTRAINT IF EXISTS rounds_end_reason_valid;

ALTER TABLE rounds
  ADD CONSTRAINT rounds_end_reason_valid
  CHECK (
    ended_reason IS NULL
    OR ended_reason IN (
      'completed',
      'finished',
      'abandoned'
    )
  );
