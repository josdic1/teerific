import {
  isDeepStrictEqual
} from "node:util";
import type {
  CreateDestinationInput,
  Destination,
  UpdateDestinationInput
} from "@teerific/shared";
import {
  DestinationSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type DestinationRow = {
  id: string;
  user_id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: Date;
  updated_at: Date;
};

const DESTINATION_COLUMNS = `
  id,
  user_id,
  label,
  address,
  latitude,
  longitude,
  created_at,
  updated_at
`;

function toDestination(
  row: DestinationRow
): Destination {
  return DestinationSchema.parse({
    id:
      row.id,

    userId:
      row.user_id,

    label:
      row.label,

    address:
      row.address,

    latitude:
      row.latitude,

    longitude:
      row.longitude,

    createdAt:
      row.created_at.toISOString(),

    updatedAt:
      row.updated_at.toISOString()
  });
}

export async function listDestinationsForUser(
  userId: string,
  db: DbExecutor = pool
): Promise<Destination[]> {
  const result =
    await db.query<DestinationRow>(
      `
        SELECT
          ${DESTINATION_COLUMNS}

        FROM destinations

        WHERE user_id = $1

        ORDER BY
          created_at,
          id
      `,
      [userId]
    );

  return result.rows.map(
    toDestination
  );
}

export async function createDestination(
  userId: string,
  input: CreateDestinationInput,
  db: DbExecutor
): Promise<Destination> {
  const result =
    await db.query<DestinationRow>(
      `
        INSERT INTO destinations (
          user_id,
          label,
          address,
          latitude,
          longitude
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )
        RETURNING
          ${DESTINATION_COLUMNS}
      `,
      [
        userId,
        input.label,
        input.address,
        input.latitude,
        input.longitude
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Destination insert returned no row"
    );
  }

  return toDestination(row);
}

export type DestinationUpdateResult =
  | {
      found: false;
      changed: false;
      before: null;
      value: null;
    }
  | {
      found: true;
      changed: boolean;
      before: Destination;
      value: Destination;
    };

export async function updateDestination(
  destinationId: string,
  userId: string,
  input: UpdateDestinationInput,
  db: DbExecutor
): Promise<DestinationUpdateResult> {
  const existingResult =
    await db.query<DestinationRow>(
      `
        SELECT
          ${DESTINATION_COLUMNS}

        FROM destinations

        WHERE
          id = $1
          AND user_id = $2

        FOR UPDATE
      `,
      [
        destinationId,
        userId
      ]
    );

  const existingRow =
    existingResult.rows[0];

  if (!existingRow) {
    return {
      found:
        false,

      changed:
        false,

      before:
        null,

      value:
        null
    };
  }

  const before =
    toDestination(
      existingRow
    );

  const next = {
    label:
      input.label ??
      before.label,

    address:
      input.address ??
      before.address,

    latitude:
      input.latitude ??
      before.latitude,

    longitude:
      input.longitude ??
      before.longitude
  };

  const comparableBefore = {
    label:
      before.label,

    address:
      before.address,

    latitude:
      before.latitude,

    longitude:
      before.longitude
  };

  if (
    isDeepStrictEqual(
      comparableBefore,
      next
    )
  ) {
    return {
      found:
        true,

      changed:
        false,

      before,

      value:
        before
    };
  }

  const result =
    await db.query<DestinationRow>(
      `
        UPDATE destinations

        SET
          label = $3,
          address = $4,
          latitude = $5,
          longitude = $6

        WHERE
          id = $1
          AND user_id = $2

        RETURNING
          ${DESTINATION_COLUMNS}
      `,
      [
        destinationId,
        userId,
        next.label,
        next.address,
        next.latitude,
        next.longitude
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Destination update returned no row"
    );
  }

  return {
    found:
      true,

    changed:
      true,

    before,

    value:
      toDestination(row)
  };
}

export async function deleteDestination(
  destinationId: string,
  userId: string,
  db: DbExecutor
): Promise<Destination | null> {
  const result =
    await db.query<DestinationRow>(
      `
        DELETE FROM destinations

        WHERE
          id = $1
          AND user_id = $2

        RETURNING
          ${DESTINATION_COLUMNS}
      `,
      [
        destinationId,
        userId
      ]
    );

  const row =
    result.rows[0];

  return row
    ? toDestination(row)
    : null;
}
