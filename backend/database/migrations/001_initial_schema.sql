BEGIN;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  phone_number TEXT NOT NULL UNIQUE,
  phone_verified_at TIMESTAMPTZ NOT NULL,

  display_name TEXT,

  is_admin BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_phone_e164
    CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$'),

  CONSTRAINT users_display_name_not_blank
    CHECK (
      display_name IS NULL
      OR length(trim(display_name)) > 0
    ),

  CONSTRAINT users_phone_verified_after_creation
    CHECK (phone_verified_at >= created_at)
);


CREATE FUNCTION prevent_admin_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_admin THEN
    RAISE EXCEPTION
      'Admin user cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER users_prevent_admin_delete
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_admin_user_delete();


CREATE TABLE phone_pin_challenges (
  id UUID PRIMARY KEY,

  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,

  attempts_remaining INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT phone_pin_challenges_phone_e164
    CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$'),

  CONSTRAINT phone_pin_challenges_hash_not_blank
    CHECK (length(trim(code_hash)) > 0),

  CONSTRAINT phone_pin_challenges_attempts_valid
    CHECK (attempts_remaining BETWEEN 0 AND 5),

  CONSTRAINT phone_pin_challenges_expiry_valid
    CHECK (expires_at > created_at),

  CONSTRAINT phone_pin_challenges_consumed_valid
    CHECK (
      consumed_at IS NULL
      OR consumed_at >= created_at
    )
);

CREATE INDEX phone_pin_challenges_phone_created_idx
  ON phone_pin_challenges (phone_number, created_at DESC);


CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  token_hash TEXT NOT NULL UNIQUE,

  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sessions_token_hash_not_blank
    CHECK (length(trim(token_hash)) > 0),

  CONSTRAINT sessions_expiry_after_creation
    CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx
  ON sessions (user_id);

CREATE INDEX sessions_active_lookup_idx
  ON sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;


CREATE TABLE clubhouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  primary_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,

  name TEXT NOT NULL,

  deactivated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT clubhouses_name_not_blank
    CHECK (length(trim(name)) > 0)
);


CREATE UNIQUE INDEX clubhouses_one_per_primary_user_uidx
ON clubhouses (primary_user_id);


CREATE TABLE clubhouse_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  clubhouse_id UUID NOT NULL
    REFERENCES clubhouses(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,

  CONSTRAINT clubhouse_members_deactivated_after_joined
    CHECK (
      deactivated_at IS NULL
      OR deactivated_at >= joined_at
    )
);

CREATE UNIQUE INDEX clubhouse_members_pair_unique
  ON clubhouse_members (clubhouse_id, user_id);

CREATE INDEX clubhouse_members_user_idx
  ON clubhouse_members (user_id);


/*
 * Database backstop:
 * the Primary belongs structurally to clubhouses.primary_user_id.
 * They may never also appear as a Member of that same Clubhouse.
 */
CREATE FUNCTION prevent_primary_as_clubhouse_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM clubhouses
    WHERE id = NEW.clubhouse_id
      AND primary_user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION
      'Clubhouse Primary cannot also be a Member'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER clubhouse_members_prevent_primary
BEFORE INSERT OR UPDATE
ON clubhouse_members
FOR EACH ROW
EXECUTE FUNCTION prevent_primary_as_clubhouse_member();


CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  actor_user_id UUID
    REFERENCES users(id)
    ON DELETE SET NULL,

  actor_snapshot JSONB,

  action TEXT NOT NULL,

  target_type TEXT NOT NULL,
  target_id UUID,

  target_snapshot JSONB,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT audit_events_action_not_blank
    CHECK (length(trim(action)) > 0),

  CONSTRAINT audit_events_target_type_not_blank
    CHECK (length(trim(target_type)) > 0)
);

CREATE INDEX audit_events_occurred_at_idx
  ON audit_events (occurred_at DESC);

CREATE INDEX audit_events_actor_idx
  ON audit_events (actor_user_id, occurred_at DESC);

CREATE INDEX audit_events_target_idx
  ON audit_events (
    target_type,
    target_id,
    occurred_at DESC
  );


CREATE FUNCTION prevent_audit_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_events is append-only'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE
ON audit_events
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_event_mutation();


CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  timezone TEXT NOT NULL,

  boundary_geojson JSONB,
  departure_location_geojson JSONB,

  active BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT courses_name_not_blank
    CHECK (length(trim(name)) > 0),

  CONSTRAINT courses_slug_not_blank
    CHECK (length(trim(slug)) > 0),

  CONSTRAINT courses_address_not_blank
    CHECK (length(trim(address)) > 0),

  CONSTRAINT courses_city_not_blank
    CHECK (length(trim(city)) > 0),

  CONSTRAINT courses_region_not_blank
    CHECK (length(trim(region)) > 0),

  CONSTRAINT courses_timezone_not_blank
    CHECK (length(trim(timezone)) > 0),

  CONSTRAINT courses_boundary_geojson_valid_type
    CHECK (
      boundary_geojson IS NULL
      OR (
        jsonb_typeof(boundary_geojson) = 'object'
        AND boundary_geojson->>'type'
          IN ('Polygon', 'MultiPolygon')
      )
    ),

  CONSTRAINT courses_departure_location_valid_type
    CHECK (
      departure_location_geojson IS NULL
      OR (
        jsonb_typeof(
          departure_location_geojson
        ) = 'object'
        AND
        departure_location_geojson->>'type'
          = 'Point'
      )
    ),

  CONSTRAINT courses_active_requires_boundary
    CHECK (
      active = false
      OR boundary_geojson IS NOT NULL
    )
);


CREATE TABLE holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  course_id UUID NOT NULL
    REFERENCES courses(id)
    ON DELETE CASCADE,

  hole_number INTEGER NOT NULL,
  par INTEGER,
  yardage INTEGER,

  boundary_geojson JSONB,
  tee_location_geojson JSONB,
  green_location_geojson JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT holes_number_positive
    CHECK (hole_number > 0),

  CONSTRAINT holes_par_valid
    CHECK (
      par IS NULL
      OR par BETWEEN 1 AND 7
    ),

  CONSTRAINT holes_yardage_positive
    CHECK (
      yardage IS NULL
      OR yardage > 0
    ),

  CONSTRAINT holes_boundary_geojson_valid_type
    CHECK (
      boundary_geojson IS NULL
      OR (
        jsonb_typeof(boundary_geojson) = 'object'
        AND boundary_geojson->>'type'
          IN ('Polygon', 'MultiPolygon')
      )
    ),

  CONSTRAINT holes_tee_geojson_valid_type
    CHECK (
      tee_location_geojson IS NULL
      OR (
        jsonb_typeof(tee_location_geojson) = 'object'
        AND tee_location_geojson->>'type' = 'Point'
      )
    ),

  CONSTRAINT holes_green_geojson_valid_type
    CHECK (
      green_location_geojson IS NULL
      OR (
        jsonb_typeof(green_location_geojson) = 'object'
        AND green_location_geojson->>'type' = 'Point'
      )
    ),

  CONSTRAINT holes_course_number_unique
    UNIQUE (course_id, hole_number)
);

CREATE INDEX holes_course_id_idx
  ON holes (course_id);


CREATE TABLE destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  label TEXT NOT NULL,
  address TEXT NOT NULL,

  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT destinations_label_not_blank
    CHECK (length(trim(label)) > 0),

  CONSTRAINT destinations_address_not_blank
    CHECK (length(trim(address)) > 0),

  CONSTRAINT destinations_latitude_valid
    CHECK (latitude BETWEEN -90 AND 90),

  CONSTRAINT destinations_longitude_valid
    CHECK (longitude BETWEEN -180 AND 180)
);

CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  golfer_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,

  course_id UUID NOT NULL
    REFERENCES courses(id)
    ON DELETE RESTRICT,

  course_detection_method TEXT NOT NULL,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rounds_detection_method_valid
    CHECK (
      course_detection_method
      IN ('automatic', 'manual')
    ),

  CONSTRAINT rounds_end_reason_valid
    CHECK (
      ended_reason IS NULL
      OR ended_reason IN ('completed', 'abandoned')
    ),

  CONSTRAINT rounds_end_time_valid
    CHECK (
      ended_at IS NULL
      OR ended_at >= started_at
    ),

  CONSTRAINT rounds_end_reason_consistent
    CHECK (
      (ended_at IS NULL AND ended_reason IS NULL)
      OR
      (ended_at IS NOT NULL AND ended_reason IS NOT NULL)
    )
);

CREATE INDEX rounds_golfer_started_at_idx
  ON rounds (golfer_user_id, started_at DESC);

CREATE INDEX rounds_course_started_at_idx
  ON rounds (course_id, started_at DESC);


CREATE UNIQUE INDEX rounds_one_active_per_golfer_uidx
ON rounds (golfer_user_id)
WHERE ended_at IS NULL;


CREATE TABLE location_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  round_id UUID NOT NULL
    REFERENCES rounds(id)
    ON DELETE CASCADE,

  detected_hole_id UUID
    REFERENCES holes(id)
    ON DELETE SET NULL,

  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,

  accuracy_meters DOUBLE PRECISION,
  altitude_meters DOUBLE PRECISION,
  speed_meters_per_second DOUBLE PRECISION,
  heading_degrees DOUBLE PRECISION,

  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT location_samples_latitude_valid
    CHECK (latitude BETWEEN -90 AND 90),

  CONSTRAINT location_samples_longitude_valid
    CHECK (longitude BETWEEN -180 AND 180),

  CONSTRAINT location_samples_accuracy_valid
    CHECK (
      accuracy_meters IS NULL
      OR accuracy_meters >= 0
    ),

  CONSTRAINT location_samples_speed_valid
    CHECK (
      speed_meters_per_second IS NULL
      OR speed_meters_per_second >= 0
    ),

  CONSTRAINT location_samples_heading_valid
    CHECK (
      heading_degrees IS NULL
      OR heading_degrees BETWEEN 0 AND 360
    )
);

CREATE INDEX location_samples_round_recorded_at_idx
  ON location_samples (round_id, recorded_at DESC);


CREATE INDEX location_samples_round_recorded_idx
ON location_samples (
  round_id,
  recorded_at DESC
);


CREATE TABLE hole_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  round_id UUID NOT NULL
    REFERENCES rounds(id)
    ON DELETE CASCADE,

  hole_id UUID NOT NULL
    REFERENCES holes(id)
    ON DELETE RESTRICT,

  entered_at TIMESTAMPTZ NOT NULL,
  exited_at TIMESTAMPTZ,

  detected_automatically BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT hole_visits_exit_time_valid
    CHECK (
      exited_at IS NULL
      OR exited_at >= entered_at
    ),

  CONSTRAINT hole_visits_round_hole_unique
    UNIQUE (round_id, hole_id)
);

CREATE INDEX hole_visits_round_entered_at_idx
  ON hole_visits (round_id, entered_at);


CREATE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER clubhouses_set_updated_at
BEFORE UPDATE ON clubhouses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER courses_set_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER holes_set_updated_at
BEFORE UPDATE ON holes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER destinations_set_updated_at
BEFORE UPDATE ON destinations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER rounds_set_updated_at
BEFORE UPDATE ON rounds
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;


CREATE UNIQUE INDEX hole_visits_one_open_per_round_uidx
ON hole_visits (round_id)
WHERE exited_at IS NULL;

CREATE INDEX hole_visits_round_entered_idx
ON hole_visits (
  round_id,
  entered_at
);
