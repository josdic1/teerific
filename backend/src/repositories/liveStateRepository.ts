import type {
  LiveGolferState,
  LocationSample
} from "@teerific/shared";
import {
  LiveGolferStateSchema,
  LocationSampleSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import {
  getRoundPaceEstimate
} from "./paceRepository.js";

type UserRow = {
  id: string;
  display_name: string | null;
};

type ActiveRoundRow = {
  id: string;
  started_at: Date;
  course_detection_method:
    "automatic" | "manual";

  course_id: string;
  course_name: string;
  course_slug: string;
  course_timezone: string;
};

type HoleRow = {
  id: string;
  hole_number: number;
  par: number | null;
  yardage: number | null;
  entered_at: Date;
};

type LocationRow = {
  id: string;
  round_id: string;
  detected_hole_id: string | null;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  altitude_meters: number | null;
  speed_meters_per_second: number | null;
  heading_degrees: number | null;
  recorded_at: Date;
};

function toLocationSample(
  row: LocationRow
): LocationSample {
  return LocationSampleSchema.parse({
    id:
      row.id,

    roundId:
      row.round_id,

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
      row.recorded_at.toISOString()
  });
}

export async function getLiveGolferState(
  golferUserId: string
): Promise<LiveGolferState | null> {
  const userResult =
    await pool.query<UserRow>(
      `
        SELECT
          id,
          display_name

        FROM users

        WHERE id = $1

        LIMIT 1
      `,
      [golferUserId]
    );

  const user =
    userResult.rows[0];

  if (!user) {
    return null;
  }

  const roundResult =
    await pool.query<ActiveRoundRow>(
      `
        SELECT
          r.id,
          r.started_at,
          r.course_detection_method,

          c.id
            AS course_id,

          c.name
            AS course_name,

          c.slug
            AS course_slug,

          c.timezone
            AS course_timezone

        FROM rounds r

        JOIN courses c
          ON c.id =
            r.course_id

        WHERE
          r.golfer_user_id = $1
          AND r.ended_at IS NULL

        LIMIT 1
      `,
      [golferUserId]
    );

  const round =
    roundResult.rows[0];

  if (!round) {
    return LiveGolferStateSchema.parse({
      golfer: {
        id:
          user.id,

        displayName:
          user.display_name
      },

      playing:
        false,

      round:
        null,

      course:
        null,

      currentHole:
        null,

      latestLocation:
        null,

      holesCompleted:
        0,

      totalHoles:
        0,

      pace:
        null,

      lastUpdatedAt:
        null
    });
  }

  const [
    holeResult,
    latestLocationResult,
    progressResult
  ] =
    await Promise.all([
      pool.query<HoleRow>(
        `
          SELECT
            h.id,
            h.hole_number,
            h.par,
            h.yardage,
            hv.entered_at

          FROM hole_visits hv

          JOIN holes h
            ON h.id =
              hv.hole_id

          WHERE
            hv.round_id = $1
            AND hv.exited_at
              IS NULL

          LIMIT 1
        `,
        [round.id]
      ),

      pool.query<LocationRow>(
        `
          SELECT
            id,
            round_id,
            detected_hole_id,
            latitude,
            longitude,
            accuracy_meters,
            altitude_meters,
            speed_meters_per_second,
            heading_degrees,
            recorded_at

          FROM location_samples

          WHERE round_id = $1

          ORDER BY
            recorded_at DESC,
            created_at DESC

          LIMIT 1
        `,
        [round.id]
      ),

      pool.query<{
        holes_completed: string;
        total_holes: string;
      }>(
        `
          SELECT
            (
              SELECT COUNT(*)::text

              FROM hole_visits

              WHERE
                round_id = $1
                AND exited_at
                  IS NOT NULL
            ) AS holes_completed,

            (
              SELECT COUNT(*)::text

              FROM holes

              WHERE course_id = $2
            ) AS total_holes
        `,
        [
          round.id,
          round.course_id
        ]
      )
    ]);

  const hole =
    holeResult.rows[0];

  const locationRow =
    latestLocationResult.rows[0];

  const latestLocation =
    locationRow
      ? toLocationSample(
          locationRow
        )
      : null;

  const progress =
    progressResult.rows[0];

  if (!progress) {
    throw new Error(
      "Live progress query returned no row"
    );
  }

  const asOf =
    locationRow
      ? locationRow.recorded_at
      : round.started_at;

  const pace =
    await getRoundPaceEstimate({
      roundId:
        round.id,

      courseId:
        round.course_id,

      asOf,

      currentHoleEnteredAt:
        hole
          ? hole.entered_at
          : null
    });

  return LiveGolferStateSchema.parse({
    golfer: {
      id:
        user.id,

      displayName:
        user.display_name
    },

    playing:
      true,

    round: {
      id:
        round.id,

      startedAt:
        round.started_at.toISOString(),

      courseDetectionMethod:
        round.course_detection_method
    },

    course: {
      id:
        round.course_id,

      name:
        round.course_name,

      slug:
        round.course_slug,

      timezone:
        round.course_timezone
    },

    currentHole:
      hole
        ? {
            id:
              hole.id,

            holeNumber:
              hole.hole_number,

            par:
              hole.par,

            yardage:
              hole.yardage,

            enteredAt:
              hole.entered_at.toISOString()
          }
        : null,

    latestLocation,

    holesCompleted:
      Number(
        progress.holes_completed
      ),

    totalHoles:
      Number(
        progress.total_holes
      ),

    pace,

    lastUpdatedAt:
      latestLocation
        ? latestLocation.recordedAt
        : round.started_at.toISOString()
  });
}
