import type {
  CurrentUser
} from "@teerific/shared";
import {
  audit
} from "../audit/audit.js";
import { pool } from "../db/pool.js";

export type DeleteUserResult =
  | "deleted"
  | "not_found"
  | "protected";

export async function deleteUserCompletely(
  userId: string,
  actor: CurrentUser
): Promise<DeleteUserResult> {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const user =
      await client.query<{
        id: string;
        display_name: string | null;
        phone_number: string;
        is_admin: boolean;
      }>(
        `
          SELECT
            id,
            display_name,
            phone_number,
            is_admin

          FROM users

          WHERE id = $1

          FOR UPDATE
        `,
        [userId]
      );

    const row =
      user.rows[0];

    if (!row) {
      await client.query(
        "ROLLBACK"
      );

      return "not_found";
    }

    if (row.is_admin) {
      await client.query(
        "ROLLBACK"
      );

      return "protected";
    }

    await audit(
      {
        actor,

        action:
          "admin.user_deleted",

        targetType:
          "user",

        targetId:
          row.id,

        targetSnapshot: {
          id:
            row.id,

          displayName:
            row.display_name,

          phoneNumber:
            row.phone_number,

          isAdmin:
            row.is_admin
        },

        metadata: {
          cascade:
            true
        }
      },
      client
    );

    await client.query(
      `
        DELETE FROM clubhouses
        WHERE primary_user_id =
          $1
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM rounds
        WHERE golfer_user_id =
          $1
      `,
      [userId]
    );

    await client.query(
      `
        DELETE
        FROM phone_pin_challenges
        WHERE phone_number =
          $1
      `,
      [row.phone_number]
    );

    await client.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [userId]
    );

    await client.query(
      "COMMIT"
    );

    return "deleted";
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    throw error;
  } finally {
    client.release();
  }
}


export async function deleteCourseCompletely(
  courseId: string,
  actor: CurrentUser
): Promise<boolean> {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await client.query<{
        snapshot:
          Record<string, unknown>;
      }>(
        `
          SELECT
            to_jsonb(c)
              AS snapshot

          FROM courses c

          WHERE c.id = $1

          FOR UPDATE
        `,
        [courseId]
      );

    const row =
      result.rows[0];

    if (!row) {
      await client.query(
        "ROLLBACK"
      );

      return false;
    }

    await audit(
      {
        actor,

        action:
          "admin.course_deleted",

        targetType:
          "course",

        targetId:
          courseId,

        targetSnapshot:
          row.snapshot,

        metadata: {
          cascade:
            true
        }
      },
      client
    );

    await client.query(
      `
        DELETE FROM rounds
        WHERE course_id = $1
      `,
      [courseId]
    );

    await client.query(
      `
        DELETE FROM courses
        WHERE id = $1
      `,
      [courseId]
    );

    await client.query(
      "COMMIT"
    );

    return true;
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    throw error;
  } finally {
    client.release();
  }
}


export async function deleteHoleCompletely(
  holeId: string,
  actor: CurrentUser
): Promise<boolean> {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await client.query<{
        snapshot:
          Record<string, unknown>;
      }>(
        `
          SELECT
            to_jsonb(h)
              AS snapshot

          FROM holes h

          WHERE h.id = $1

          FOR UPDATE
        `,
        [holeId]
      );

    const row =
      result.rows[0];

    if (!row) {
      await client.query(
        "ROLLBACK"
      );

      return false;
    }

    await audit(
      {
        actor,

        action:
          "admin.hole_deleted",

        targetType:
          "hole",

        targetId:
          holeId,

        targetSnapshot:
          row.snapshot,

        metadata: {
          cascade:
            true
        }
      },
      client
    );

    await client.query(
      `
        DELETE FROM hole_visits
        WHERE hole_id = $1
      `,
      [holeId]
    );

    await client.query(
      `
        DELETE FROM holes
        WHERE id = $1
      `,
      [holeId]
    );

    await client.query(
      "COMMIT"
    );

    return true;
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    throw error;
  } finally {
    client.release();
  }
}


const SIMPLE_TABLES = {
  clubhouses:
    "clubhouses",

  clubhouseMembers:
    "clubhouse_members",

  destinations:
    "destinations",

  rounds:
    "rounds",

  locationSamples:
    "location_samples",

  holeVisits:
    "hole_visits",

  sessions:
    "sessions",

  phonePinChallenges:
    "phone_pin_challenges"
} as const;

export type SimpleDeleteResource =
  keyof typeof SIMPLE_TABLES;

export async function deleteSimpleRecord(
  resource: SimpleDeleteResource,
  id: string,
  actor: CurrentUser
): Promise<boolean> {
  const table =
    SIMPLE_TABLES[resource];

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await client.query<{
        snapshot:
          Record<string, unknown>;
      }>(
        `
          SELECT
            to_jsonb(t)
              AS snapshot

          FROM ${table} t

          WHERE t.id = $1

          FOR UPDATE
        `,
        [id]
      );

    const row =
      result.rows[0];

    if (!row) {
      await client.query(
        "ROLLBACK"
      );

      return false;
    }

    await audit(
      {
        actor,

        action:
          `admin.${table}.deleted`,

        targetType:
          table,

        targetId:
          id,

        targetSnapshot:
          row.snapshot
      },
      client
    );

    await client.query(
      `
        DELETE FROM ${table}
        WHERE id = $1
      `,
      [id]
    );

    await client.query(
      "COMMIT"
    );

    return true;
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    throw error;
  } finally {
    client.release();
  }
}
