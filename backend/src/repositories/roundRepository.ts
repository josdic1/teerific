import type {
  CourseDetectionMethodSchema,
  Round,
  RoundEndReasonSchema
} from "@teerific/shared";
import {
  RoundSchema
} from "@teerific/shared";
import type {
  z
} from "zod";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type DetectionMethod =
  z.infer<
    typeof CourseDetectionMethodSchema
  >;

type EndReason =
  z.infer<
    typeof RoundEndReasonSchema
  >;

type RoundRow = {
  id: string;
  golfer_user_id: string;
  course_id: string;
  course_detection_method:
    DetectionMethod;
  started_at: Date;
  ended_at: Date | null;
  ended_reason: EndReason | null;
  created_at: Date;
  updated_at: Date;
};

const ROUND_COLUMNS = `
  id,
  golfer_user_id,
  course_id,
  course_detection_method,
  started_at,
  ended_at,
  ended_reason,
  created_at,
  updated_at
`;

function toRound(
  row: RoundRow
): Round {
  return RoundSchema.parse({
    id:
      row.id,

    golferUserId:
      row.golfer_user_id,

    courseId:
      row.course_id,

    courseDetectionMethod:
      row.course_detection_method,

    startedAt:
      row.started_at.toISOString(),

    endedAt:
      row.ended_at
        ? row.ended_at.toISOString()
        : null,

    endedReason:
      row.ended_reason,

    createdAt:
      row.created_at.toISOString(),

    updatedAt:
      row.updated_at.toISOString()
  });
}


export async function createRound(
  golferUserId: string,
  courseId: string,
  method: DetectionMethod,
  db: DbExecutor
): Promise<
  Round |
  "course_not_found"
> {
  const course =
    await db.query<{
      id: string;
    }>(
      `
        SELECT id
        FROM courses
        WHERE
          id = $1
          AND active = true
        LIMIT 1
      `,
      [courseId]
    );

  if (!course.rows[0]) {
    return "course_not_found";
  }

  const result =
    await db.query<RoundRow>(
      `
        INSERT INTO rounds (
          golfer_user_id,
          course_id,
          course_detection_method
        )
        VALUES (
          $1,
          $2,
          $3
        )
        RETURNING
          ${ROUND_COLUMNS}
      `,
      [
        golferUserId,
        courseId,
        method
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Round insert returned no row"
    );
  }

  return toRound(row);
}


export async function getCurrentRound(
  golferUserId: string,
  db: DbExecutor = pool
): Promise<Round | null> {
  const result =
    await db.query<RoundRow>(
      `
        SELECT
          ${ROUND_COLUMNS}

        FROM rounds

        WHERE
          golfer_user_id = $1
          AND ended_at IS NULL

        LIMIT 1
      `,
      [golferUserId]
    );

  const row =
    result.rows[0];

  return row
    ? toRound(row)
    : null;
}


export async function listRoundsForGolfer(
  golferUserId: string
): Promise<Round[]> {
  const result =
    await pool.query<RoundRow>(
      `
        SELECT
          ${ROUND_COLUMNS}

        FROM rounds

        WHERE
          golfer_user_id = $1

        ORDER BY
          started_at DESC
      `,
      [golferUserId]
    );

  return result.rows.map(
    toRound
  );
}


export async function getRoundForGolfer(
  roundId: string,
  golferUserId: string,
  db: DbExecutor = pool
): Promise<Round | null> {
  const result =
    await db.query<RoundRow>(
      `
        SELECT
          ${ROUND_COLUMNS}

        FROM rounds

        WHERE
          id = $1
          AND golfer_user_id = $2

        LIMIT 1
      `,
      [
        roundId,
        golferUserId
      ]
    );

  const row =
    result.rows[0];

  return row
    ? toRound(row)
    : null;
}


export type EndRoundResult =
  | {
      type: "not_found";
    }
  | {
      type: "already_ended";
      round: Round;
    }
  | {
      type: "ended";
      round: Round;
    };


export async function endRound(
  roundId: string,
  golferUserId: string,
  reason: EndReason,
  db: DbExecutor
): Promise<EndRoundResult> {
  const locked =
    await db.query<RoundRow>(
      `
        SELECT
          ${ROUND_COLUMNS}

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

  const existing =
    locked.rows[0];

  if (!existing) {
    return {
      type:
        "not_found"
    };
  }

  if (
    existing.ended_at !== null
  ) {
    return {
      type:
        "already_ended",

      round:
        toRound(existing)
    };
  }

  const updated =
    await db.query<RoundRow>(
      `
        UPDATE rounds

        SET
          ended_at = now(),
          ended_reason = $3,
          updated_at = now()

        WHERE
          id = $1
          AND golfer_user_id = $2

        RETURNING
          ${ROUND_COLUMNS}
      `,
      [
        roundId,
        golferUserId,
        reason
      ]
    );

  const row =
    updated.rows[0];

  if (!row) {
    throw new Error(
      "Round end returned no row"
    );
  }

  if (row.ended_at) {
    await db.query(
      `
        UPDATE hole_visits

        SET exited_at = $2

        WHERE
          round_id = $1
          AND exited_at IS NULL
          AND entered_at <= $2
      `,
      [
        roundId,
        row.ended_at
      ]
    );
  }

  return {
    type:
      "ended",

    round:
      toRound(row)
  };
}
