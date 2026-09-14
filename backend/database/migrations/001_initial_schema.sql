BEGIN;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_lowercase
    CHECK (email = lower(email)),

  CONSTRAINT users_email_not_blank
    CHECK (length(trim(email)) > 0),

  CONSTRAINT users_display_name_not_blank
    CHECK (length(trim(display_name)) > 0)
);

CREATE UNIQUE INDEX users_email_unique
  ON users (lower(email));


CREATE TABLE auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  password_hash TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT auth_accounts_provider_not_blank
    CHECK (length(trim(provider)) > 0),

  CONSTRAINT auth_accounts_subject_not_blank
    CHECK (length(trim(provider_subject)) > 0),

  CONSTRAINT auth_accounts_provider_subject_unique
    UNIQUE (provider, provider_subject),

  CONSTRAINT auth_accounts_user_provider_unique
    UNIQUE (user_id, provider)
);


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


CREATE TABLE partner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  requester_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  recipient_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT partner_links_not_self
    CHECK (requester_user_id <> recipient_user_id),

  CONSTRAINT partner_links_acceptance_order
    CHECK (
      accepted_at IS NULL
      OR accepted_at >= created_at
    ),

  CONSTRAINT partner_links_revocation_order
    CHECK (
      revoked_at IS NULL
      OR revoked_at >= created_at
    )
);

CREATE UNIQUE INDEX partner_links_active_pair_unique
  ON partner_links (
    LEAST(requester_user_id, recipient_user_id),
    GREATEST(requester_user_id, recipient_user_id)
  )
  WHERE revoked_at IS NULL;


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

  is_default BOOLEAN NOT NULL DEFAULT false,

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

CREATE UNIQUE INDEX destinations_one_default_per_user
  ON destinations (user_id)
  WHERE is_default = true;


CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  golfer_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,

  course_id UUID NOT NULL
    REFERENCES courses(id)
    ON DELETE RESTRICT,

  destination_id UUID
    REFERENCES destinations(id)
    ON DELETE SET NULL,

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


CREATE TABLE round_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  round_id UUID NOT NULL
    REFERENCES rounds(id)
    ON DELETE CASCADE,

  viewer_user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,

  CONSTRAINT round_shares_revocation_order
    CHECK (
      revoked_at IS NULL
      OR revoked_at >= granted_at
    ),

  CONSTRAINT round_shares_round_viewer_unique
    UNIQUE (round_id, viewer_user_id)
);

CREATE INDEX round_shares_viewer_idx
  ON round_shares (viewer_user_id);


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

CREATE TRIGGER auth_accounts_set_updated_at
BEFORE UPDATE ON auth_accounts
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
