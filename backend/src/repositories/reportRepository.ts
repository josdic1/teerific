import type {
  AdminGolfSummary
} from "@teerific/shared";
import { pool } from "../db/pool.js";

type SummaryRow = {
  total_users: string;
  total_clubhouses: string;
  total_rounds: string;
  completed_rounds: string;
  abandoned_rounds: string;
  average_round_minutes: number | null;
  average_hole_minutes: number | null;
  total_location_samples: string;
};

export async function getAdminGolfSummary():
Promise<AdminGolfSummary> {
  const result =
    await pool.query<SummaryRow>(
      `
        SELECT
          (
            SELECT COUNT(*)::text
            FROM users
          ) AS total_users,

          (
            SELECT COUNT(*)::text
            FROM clubhouses
          ) AS total_clubhouses,

          (
            SELECT COUNT(*)::text
            FROM rounds
          ) AS total_rounds,

          (
            SELECT COUNT(*)::text
            FROM rounds
            WHERE ended_reason = 'completed'
          ) AS completed_rounds,

          (
            SELECT COUNT(*)::text
            FROM rounds
            WHERE ended_reason = 'abandoned'
          ) AS abandoned_rounds,

          (
            SELECT
              AVG(
                EXTRACT(
                  EPOCH FROM
                  (ended_at - started_at)
                ) / 60.0
              )::float8
            FROM rounds
            WHERE ended_at IS NOT NULL
          ) AS average_round_minutes,

          (
            SELECT
              AVG(
                EXTRACT(
                  EPOCH FROM
                  (exited_at - entered_at)
                ) / 60.0
              )::float8
            FROM hole_visits
            WHERE exited_at IS NOT NULL
          ) AS average_hole_minutes,

          (
            SELECT COUNT(*)::text
            FROM location_samples
          ) AS total_location_samples
      `
    );

  const row = result.rows[0];

  if (!row) {
    throw new Error(
      "Admin summary query returned no row"
    );
  }

  return {
    totalUsers:
      Number(row.total_users),

    totalClubhouses:
      Number(row.total_clubhouses),

    totalRounds:
      Number(row.total_rounds),

    completedRounds:
      Number(row.completed_rounds),

    abandonedRounds:
      Number(row.abandoned_rounds),

    averageRoundMinutes:
      row.average_round_minutes,

    averageHoleMinutes:
      row.average_hole_minutes,

    totalLocationSamples:
      Number(row.total_location_samples)
  };
}
