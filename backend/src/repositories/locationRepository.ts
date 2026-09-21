import type {
  LocationSample,
  LocationSampleRejectionReason,
  LocationUpdateInput
} from "@teerific/shared";
import {
  GeoAreaSchema,
  LocationSampleSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";
import {
  areaContainsPoint,
  areaDistanceMeters
} from "../geo/containsPoint.js";
import {
  applyConfirmedHoleTransition
} from "./holeVisitRepository.js";
import {
  classifyLocationTimestamp
} from "../services/locationSamplePolicy.js";

type RoundRow = {
  id: string;
  course_id: string;
  ended_at: Date | null;
};

type HoleBoundaryRow = {
  id: string;
  boundary_geojson: unknown;
};

type PriorLocationRow = {
  detected_hole_id: string | null;
  recorded_at: Date;
};

type LocationRow = {
  id: string;
  round_id: string;
  client_sample_id: string;
  detected_hole_id: string | null;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  altitude_meters: number | null;
  speed_meters_per_second: number | null;
  heading_degrees: number | null;
  recorded_at: Date;
  created_at: Date;
};

type DuplicateLocationRow =
  LocationRow & {
    duplicate_reason:
      | "duplicate_sample_id"
      | "duplicate_recorded_at";
};

const MAX_ACCURACY_ASSIST_METERS =
  35;

const LOCATION_COLUMNS = `
  id,
  round_id,
  client_sample_id,
  detected_hole_id,
  latitude,
  longitude,
  accuracy_meters,
  altitude_meters,
  speed_meters_per_second,
  heading_degrees,
  recorded_at,
  created_at
`;

function toLocationSample(
  row: LocationRow
): LocationSample {
  return LocationSampleSchema.parse({
    id:
      row.id,

    roundId:
      row.round_id,

    sampleId:
      row.client_sample_id,

    detectedHoleId:
      row.detected_hole_id,

    latitude:
      row.latitude,

    longitude:
      row.longitude,

    accuracyMeters:
      row.accuracy_meters,

    altitudeMeters:
      row.altitude_meters,

    speedMetersPerSecond:
      row.speed_meters_per_second,

    headingDegrees:
      row.heading_degrees,

    recordedAt:
      row.recorded_at.toISOString(),

    receivedAt:
      row.created_at.toISOString()
  });
}

async function recordLocationRejection(
  roundId: string,
  input: LocationUpdateInput,
  reason:
    | LocationSampleRejectionReason
    | "historical_duplicate",
  db: DbExecutor
): Promise<void> {
  await db.query(
    `
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
        recorded_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
    `,
    [
      roundId,
      input.sampleId,
      reason,
      input.latitude,
      input.longitude,
      input.accuracyMeters,
      input.altitudeMeters,
      input.speedMetersPerSecond,
      input.headingDegrees,
      input.recordedAt
    ]
  );
}

async function findDuplicateLocation(
  roundId: string,
  input: LocationUpdateInput,
  db: DbExecutor
): Promise<DuplicateLocationRow | null> {
  const result =
    await db.query<DuplicateLocationRow>(
      `
        SELECT
          ${LOCATION_COLUMNS},

          CASE
            WHEN client_sample_id = $2
              THEN 'duplicate_sample_id'
            ELSE 'duplicate_recorded_at'
          END AS duplicate_reason

        FROM location_samples

        WHERE
          round_id = $1
          AND (
            client_sample_id = $2
            OR recorded_at = $3
          )

        ORDER BY
          CASE
            WHEN client_sample_id = $2
              THEN 0
            ELSE 1
          END

        LIMIT 1
      `,
      [
        roundId,
        input.sampleId,
        input.recordedAt
      ]
    );

  return result.rows[0] ?? null;
}

function logLocationOutcome(
  input: {
    roundId: string;
    sampleId: string;
    recordedAt: string;
    outcome:
      | "recorded"
      | "duplicate"
      | "stale";
    reason?:
      LocationSampleRejectionReason;
  }
): void {
  console.info(
    JSON.stringify({
      event:
        "teerific.location_sample",
      receivedAt:
        new Date().toISOString(),
      ...input
    })
  );
}

async function detectHole(
  courseId: string,
  input: LocationUpdateInput,
  db: DbExecutor
): Promise<string | null> {
  const holes =
    await db.query<HoleBoundaryRow>(
      `
        SELECT
          id,
          boundary_geojson

        FROM holes

        WHERE
          course_id = $1
          AND boundary_geojson
            IS NOT NULL

        ORDER BY hole_number
      `,
      [courseId]
    );

  const exactMatches:
    string[] =
    [];

  const accuracyMatches:
    string[] =
    [];

  const accuracyTolerance =
    input.accuracyMeters === null
      ? 0
      : Math.min(
          input.accuracyMeters,
          MAX_ACCURACY_ASSIST_METERS
        );

  for (
    const hole of holes.rows
  ) {
    const parsed =
      GeoAreaSchema.safeParse(
        hole.boundary_geojson
      );

    if (!parsed.success) {
      continue;
    }

    if (
      areaContainsPoint(
        parsed.data,
        input.longitude,
        input.latitude
      )
    ) {
      exactMatches.push(
        hole.id
      );

      continue;
    }

    if (
      accuracyTolerance > 0 &&
      areaDistanceMeters(
        parsed.data,
        input.longitude,
        input.latitude
      ) <= accuracyTolerance
    ) {
      accuracyMatches.push(
        hole.id
      );
    }
  }

  /*
   * Prefer an exact geometric hit. If the phone's
   * best point falls just outside the 18m zone, its
   * reported horizontal uncertainty may rescue the
   * sample only when exactly one hole is plausible.
   * Ambiguity is still never guessed.
   */
  if (
    exactMatches.length === 1
  ) {
    return exactMatches[0] ?? null;
  }

  if (
    exactMatches.length > 1
  ) {
    return null;
  }

  return accuracyMatches.length === 1
    ? accuracyMatches[0] ?? null
    : null;
}

export type RecordLocationResult =
  | {
      type:
        "round_not_found";
    }
  | {
      type:
        "round_ended";
    }
  | {
      type:
        "recorded";
      sample:
        LocationSample;
    }
  | {
      type:
        "duplicate";
      reason:
        | "duplicate_sample_id"
        | "duplicate_recorded_at";
      sample:
        LocationSample;
    }
  | {
      type:
        "stale";
      reason:
        | "too_old"
        | "future_dated";
    };

export async function recordLocationSample(
  roundId: string,
  golferUserId: string,
  input: LocationUpdateInput,
  db: DbExecutor
): Promise<RecordLocationResult> {
  /*
   * Lock the round so an end-round request and a
   * location write cannot race each other.
   */
  const roundResult =
    await db.query<RoundRow>(
      `
        SELECT
          id,
          course_id,
          ended_at

        FROM rounds

        WHERE
          id = $1
          AND golfer_user_id = $2

        FOR UPDATE
      `,
      [
        roundId,
        golferUserId
      ]
    );

  const round =
    roundResult.rows[0];

  if (!round) {
    return {
      type:
        "round_not_found"
    };
  }

  if (
    round.ended_at !== null
  ) {
    return {
      type:
        "round_ended"
    };
  }

  const receivedAt =
    new Date();

  const currentRecordedAt =
    new Date(
      input.recordedAt
    );

  const timestampDecision =
    classifyLocationTimestamp(
      currentRecordedAt,
      receivedAt
    );

  if (!timestampDecision.accepted) {
    await recordLocationRejection(
      roundId,
      input,
      timestampDecision.reason,
      db
    );

    logLocationOutcome({
      roundId,
      sampleId:
        input.sampleId,
      recordedAt:
        input.recordedAt,
      outcome:
        "stale",
      reason:
        timestampDecision.reason
    });

    return {
      type:
        "stale",
      reason:
        timestampDecision.reason
    };
  }

  const duplicate =
    await findDuplicateLocation(
      roundId,
      input,
      db
    );

  if (duplicate) {
    await recordLocationRejection(
      roundId,
      input,
      duplicate.duplicate_reason,
      db
    );

    logLocationOutcome({
      roundId,
      sampleId:
        input.sampleId,
      recordedAt:
        input.recordedAt,
      outcome:
        "duplicate",
      reason:
        duplicate.duplicate_reason
    });

    return {
      type:
        "duplicate",
      reason:
        duplicate.duplicate_reason,
      sample:
        toLocationSample(
          duplicate
        )
    };
  }

  const detectedHoleId =
    await detectHole(
      round.course_id,
      input,
      db
    );

  /*
   * Capture the immediately preceding GPS sample
   * before inserting the new one.
   *
   * Two consecutive samples must agree before a
   * HoleVisit transition is accepted.
   */
  const priorResult =
    await db.query<PriorLocationRow>(
      `
        SELECT
          detected_hole_id,
          recorded_at

        FROM location_samples

        WHERE round_id = $1

        ORDER BY
          recorded_at DESC,
          created_at DESC

        LIMIT 1
      `,
      [roundId]
    );

  const prior =
    priorResult.rows[0];

  const result =
    await db.query<LocationRow>(
      `
        INSERT INTO location_samples (
          round_id,
          client_sample_id,
          detected_hole_id,
          latitude,
          longitude,
          accuracy_meters,
          altitude_meters,
          speed_meters_per_second,
          heading_degrees,
          recorded_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10
        )

        RETURNING
          ${LOCATION_COLUMNS}
      `,
      [
        roundId,
        input.sampleId,
        detectedHoleId,
        input.latitude,
        input.longitude,
        input.accuracyMeters,
        input.altitudeMeters,
        input.speedMetersPerSecond,
        input.headingDegrees,
        input.recordedAt
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Location insert returned no row"
    );
  }

  logLocationOutcome({
    roundId,
    sampleId:
      input.sampleId,
    recordedAt:
      input.recordedAt,
    outcome:
      "recorded"
  });

  /*
   * Only the newest chronological sample is allowed
   * to advance live HoleVisit state.
   *
   * Late-arriving samples are still preserved as raw
   * telemetry, but cannot move the golfer backward.
   */
  if (
    detectedHoleId !== null &&
    prior !== undefined &&
    prior.detected_hole_id ===
      detectedHoleId &&
    currentRecordedAt >
      prior.recorded_at
  ) {
    await applyConfirmedHoleTransition(
      roundId,
      detectedHoleId,
      prior.recorded_at,
      db
    );
  }

  return {
    type:
      "recorded",

    sample:
      toLocationSample(row)
  };
}

export async function listLocationSamplesForRound(
  roundId: string,
  golferUserId: string,
  limit = 500
): Promise<
  LocationSample[] | null
> {
  const owner =
    await pool.query<{
      exists: boolean;
    }>(
      `
        SELECT EXISTS (
          SELECT 1

          FROM rounds

          WHERE
            id = $1
            AND golfer_user_id = $2
        ) AS exists
      `,
      [
        roundId,
        golferUserId
      ]
    );

  if (
    !owner.rows[0]?.exists
  ) {
    return null;
  }

  const safeLimit =
    Math.min(
      Math.max(
        limit,
        1
      ),
      5000
    );

  const result =
    await pool.query<LocationRow>(
      `
        SELECT
          ${LOCATION_COLUMNS}

        FROM location_samples

        WHERE round_id = $1

        ORDER BY
          recorded_at ASC,
          created_at ASC

        LIMIT $2
      `,
      [
        roundId,
        safeLimit
      ]
    );

  return result.rows.map(
    toLocationSample
  );
}
