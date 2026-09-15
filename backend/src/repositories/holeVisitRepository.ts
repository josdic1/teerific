import type {
  HoleVisit
} from "@teerific/shared";
import {
  HoleVisitSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type HoleVisitRow = {
  id: string;
  round_id: string;
  hole_id: string;
  entered_at: Date;
  exited_at: Date | null;
  detected_automatically: boolean;
};

const HOLE_VISIT_COLUMNS = `
  id,
  round_id,
  hole_id,
  entered_at,
  exited_at,
  detected_automatically
`;

function toHoleVisit(
  row: HoleVisitRow
): HoleVisit {
  return HoleVisitSchema.parse({
    id:
      row.id,

    roundId:
      row.round_id,

    holeId:
      row.hole_id,

    enteredAt:
      row.entered_at.toISOString(),

    exitedAt:
      row.exited_at
        ? row.exited_at.toISOString()
        : null,

    detectedAutomatically:
      row.detected_automatically
  });
}

export async function applyConfirmedHoleTransition(
  roundId: string,
  holeId: string,
  transitionAt: Date,
  db: DbExecutor
): Promise<void> {
  const openResult =
    await db.query<HoleVisitRow>(
      `
        SELECT
          ${HOLE_VISIT_COLUMNS}

        FROM hole_visits

        WHERE
          round_id = $1
          AND exited_at IS NULL

        FOR UPDATE
      `,
      [roundId]
    );

  const open =
    openResult.rows[0];

  /*
   * Already on this confirmed hole.
   * Nothing to change.
   */
  if (
    open?.hole_id === holeId
  ) {
    return;
  }

  /*
   * Current schema intentionally represents one
   * canonical visit per hole per round.
   *
   * Do not reopen a previously completed hole and
   * corrupt its duration.
   */
  const previousVisit =
    await db.query<{
      exists: boolean;
    }>(
      `
        SELECT EXISTS (
          SELECT 1

          FROM hole_visits

          WHERE
            round_id = $1
            AND hole_id = $2
        ) AS exists
      `,
      [
        roundId,
        holeId
      ]
    );

  if (
    previousVisit.rows[0]?.exists
  ) {
    return;
  }

  /*
   * Do not allow an out-of-order timestamp to
   * close an existing visit before it began.
   */
  if (
    open &&
    transitionAt <
      open.entered_at
  ) {
    return;
  }

  if (open) {
    await db.query(
      `
        UPDATE hole_visits

        SET exited_at = $2

        WHERE
          id = $1
          AND exited_at IS NULL
      `,
      [
        open.id,
        transitionAt
      ]
    );
  }

  await db.query(
    `
      INSERT INTO hole_visits (
        round_id,
        hole_id,
        entered_at,
        detected_automatically
      )
      VALUES (
        $1,
        $2,
        $3,
        true
      )
    `,
    [
      roundId,
      holeId,
      transitionAt
    ]
  );
}


export async function listHoleVisitsForRound(
  roundId: string,
  golferUserId: string
): Promise<HoleVisit[] | null> {
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

  const result =
    await pool.query<HoleVisitRow>(
      `
        SELECT
          ${HOLE_VISIT_COLUMNS}

        FROM hole_visits

        WHERE round_id = $1

        ORDER BY
          entered_at,
          id
      `,
      [roundId]
    );

  return result.rows.map(
    toHoleVisit
  );
}
