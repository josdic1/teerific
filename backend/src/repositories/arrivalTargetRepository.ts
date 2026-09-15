import type {
  ArrivalTargetInput,
  ResolvedArrivalTarget
} from "@teerific/shared";
import {
  ResolvedArrivalTargetSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

export async function resolveArrivalTarget(
  viewerUserId: string,
  input: ArrivalTargetInput,
  db: DbExecutor = pool
): Promise<
  ResolvedArrivalTarget | null
> {
  if (
    input.type ===
    "viewer_current_location"
  ) {
    return ResolvedArrivalTargetSchema.parse({
      source:
        "viewer_current_location",

      label:
        null,

      latitude:
        input.latitude,

      longitude:
        input.longitude,

      accuracyMeters:
        input.accuracyMeters,

      recordedAt:
        input.recordedAt
    });
  }

  const result =
    await db.query<{
      label: string;
      latitude: number;
      longitude: number;
    }>(
      `
        SELECT
          label,
          latitude,
          longitude

        FROM destinations

        WHERE
          id = $1
          AND user_id = $2

        LIMIT 1
      `,
      [
        input.destinationId,
        viewerUserId
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    return null;
  }

  return ResolvedArrivalTargetSchema.parse({
    source:
      "saved_destination",

    label:
      row.label,

    latitude:
      row.latitude,

    longitude:
      row.longitude,

    accuracyMeters:
      null,

    recordedAt:
      null
  });
}
