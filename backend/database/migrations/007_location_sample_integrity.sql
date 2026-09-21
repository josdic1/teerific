BEGIN;

ALTER TABLE location_samples
  ADD COLUMN client_sample_id UUID;

UPDATE location_samples
SET client_sample_id = gen_random_uuid()
WHERE client_sample_id IS NULL;

ALTER TABLE location_samples
  ALTER COLUMN client_sample_id SET NOT NULL;


CREATE TABLE location_sample_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  round_id UUID NOT NULL
    REFERENCES rounds(id)
    ON DELETE CASCADE,

  client_sample_id UUID NOT NULL,

  reason TEXT NOT NULL,

  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  altitude_meters DOUBLE PRECISION,
  speed_meters_per_second DOUBLE PRECISION,
  heading_degrees DOUBLE PRECISION,

  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT location_sample_rejections_reason_valid
    CHECK (
      reason IN (
        'historical_duplicate',
        'duplicate_sample_id',
        'duplicate_recorded_at',
        'too_old',
        'future_dated'
      )
    ),

  CONSTRAINT location_sample_rejections_latitude_valid
    CHECK (latitude BETWEEN -90 AND 90),

  CONSTRAINT location_sample_rejections_longitude_valid
    CHECK (longitude BETWEEN -180 AND 180),

  CONSTRAINT location_sample_rejections_accuracy_valid
    CHECK (
      accuracy_meters IS NULL
      OR accuracy_meters >= 0
    ),

  CONSTRAINT location_sample_rejections_speed_valid
    CHECK (
      speed_meters_per_second IS NULL
      OR speed_meters_per_second >= 0
    ),

  CONSTRAINT location_sample_rejections_heading_valid
    CHECK (
      heading_degrees IS NULL
      OR heading_degrees BETWEEN 0 AND 360
    )
);

CREATE INDEX location_sample_rejections_round_received_idx
  ON location_sample_rejections (
    round_id,
    received_at DESC
  );


/*
 * Preserve pre-migration duplicates as rejected evidence,
 * then leave one canonical accepted fix per round/timestamp.
 */
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        round_id,
        recorded_at
      ORDER BY
        created_at ASC,
        id ASC
    ) AS duplicate_rank

  FROM location_samples
), duplicates AS (
  SELECT ls.*

  FROM location_samples ls

  JOIN ranked r
    ON r.id = ls.id

  WHERE r.duplicate_rank > 1
)
INSERT INTO location_sample_rejections (
  round_id,
  client_sample_id,
  reason,
  latitude,
  longitude,
  accuracy_meters,
  altitude_meters,
  speed_meters_per_second,
  heading_degrees,
  recorded_at,
  received_at
)
SELECT
  round_id,
  client_sample_id,
  'historical_duplicate',
  latitude,
  longitude,
  accuracy_meters,
  altitude_meters,
  speed_meters_per_second,
  heading_degrees,
  recorded_at,
  created_at
FROM duplicates;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        round_id,
        recorded_at
      ORDER BY
        created_at ASC,
        id ASC
    ) AS duplicate_rank

  FROM location_samples
)
DELETE FROM location_samples ls
USING ranked r
WHERE
  ls.id = r.id
  AND r.duplicate_rank > 1;


CREATE UNIQUE INDEX location_samples_round_client_sample_uidx
  ON location_samples (
    round_id,
    client_sample_id
  );

CREATE UNIQUE INDEX location_samples_round_recorded_at_uidx
  ON location_samples (
    round_id,
    recorded_at
  );

COMMIT;
