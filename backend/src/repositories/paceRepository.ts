import type {
  PaceEstimate
} from "@teerific/shared";
import {
  PaceEstimateSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";

type DurationStatsRow = {
  sample_count: number;
  average_seconds: number | null;
};

type RemainingRow = {
  unvisited_holes: number;
};

function minutes(
  seconds: number
): number {
  return Math.round(
    (seconds / 60) * 10
  ) / 10;
}

export async function getRoundPaceEstimate(
  input: {
    roundId: string;
    courseId: string;
    asOf: Date;
    currentHoleEnteredAt:
      Date | null;
  }
): Promise<PaceEstimate> {
  const [
    currentRoundResult,
    courseHistoryResult,
    remainingResult
  ] =
    await Promise.all([
      pool.query<DurationStatsRow>(
        `
          SELECT
            COUNT(*)::int
              AS sample_count,

            AVG(
              EXTRACT(
                EPOCH FROM
                (
                  exited_at -
                  entered_at
                )
              )
            )::float8
              AS average_seconds

          FROM hole_visits

          WHERE
            round_id = $1
            AND exited_at
              IS NOT NULL
        `,
        [
          input.roundId
        ]
      ),

      pool.query<DurationStatsRow>(
        `
          SELECT
            COUNT(*)::int
              AS sample_count,

            AVG(
              EXTRACT(
                EPOCH FROM
                (
                  hv.exited_at -
                  hv.entered_at
                )
              )
            )::float8
              AS average_seconds

          FROM hole_visits hv

          JOIN rounds r
            ON r.id =
              hv.round_id

          WHERE
            r.course_id = $1

            AND hv.round_id
              <> $2

            AND hv.exited_at
              IS NOT NULL
        `,
        [
          input.courseId,
          input.roundId
        ]
      ),

      pool.query<RemainingRow>(
        `
          SELECT
            COUNT(*)::int
              AS unvisited_holes

          FROM holes h

          WHERE
            h.course_id = $1

            AND NOT EXISTS (
              SELECT 1

              FROM hole_visits hv

              WHERE
                hv.round_id = $2
                AND hv.hole_id =
                  h.id
            )
        `,
        [
          input.courseId,
          input.roundId
        ]
      )
    ]);

  const current =
    currentRoundResult.rows[0];

  const history =
    courseHistoryResult.rows[0];

  const remaining =
    remainingResult.rows[0];

  if (
    !current ||
    !history ||
    !remaining
  ) {
    throw new Error(
      "Pace query returned no row"
    );
  }

  const currentCount =
    current.sample_count;

  const historyCount =
    history.sample_count;

  let basis:
    PaceEstimate["basis"] =
      "unavailable";

  let sourceSeconds:
    number | null =
      null;

  let sampleSize =
    0;

  if (
    currentCount > 0 &&
    current.average_seconds !== null
  ) {
    basis =
      "current_round";

    sourceSeconds =
      current.average_seconds;

    sampleSize =
      currentCount;
  } else if (
    historyCount > 0 &&
    history.average_seconds !== null
  ) {
    basis =
      "course_history";

    sourceSeconds =
      history.average_seconds;

    sampleSize =
      historyCount;
  }

  const currentHoleElapsedSeconds =
    input.currentHoleEnteredAt
      ? Math.max(
          0,
          (
            input.asOf.getTime() -
            input.currentHoleEnteredAt.getTime()
          ) / 1000
        )
      : null;

  let remainingSeconds:
    number | null =
      null;

  if (
    sourceSeconds !== null
  ) {
    remainingSeconds =
      remaining.unvisited_holes *
      sourceSeconds;

    /*
     * The currently open hole is already marked
     * visited, so it is not included in
     * unvisited_holes. Add only its estimated
     * remaining portion.
     */
    if (
      currentHoleElapsedSeconds !==
      null
    ) {
      remainingSeconds +=
        Math.max(
          0,
          sourceSeconds -
          currentHoleElapsedSeconds
        );
    }
  }

  const estimatedFinishAt =
    remainingSeconds === null
      ? null
      : new Date(
          input.asOf.getTime() +
          remainingSeconds * 1000
        );

  return PaceEstimateSchema.parse({
    asOf:
      input.asOf.toISOString(),

    completedHoles:
      currentCount,

    averageCompletedHoleMinutes:
      current.average_seconds === null
        ? null
        : minutes(
            current.average_seconds
          ),

    currentHoleElapsedMinutes:
      currentHoleElapsedSeconds === null
        ? null
        : minutes(
            currentHoleElapsedSeconds
          ),

    estimatedMinutesRemaining:
      remainingSeconds === null
        ? null
        : minutes(
            remainingSeconds
          ),

    estimatedFinishAt:
      estimatedFinishAt
        ? estimatedFinishAt.toISOString()
        : null,

    basis,

    sampleSize
  });
}
