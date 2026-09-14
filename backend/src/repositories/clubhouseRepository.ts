import type {
  Clubhouse,
  ClubhouseMember,
  UserSummary
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type ClubhouseRow = {
  id: string;
  name: string;

  primary_user_id: string;
  primary_display_name: string | null;

  deactivated_at: Date | null;

  created_at: Date;
  updated_at: Date;
};

type MemberRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  joined_at: Date;
  deactivated_at: Date | null;
};

type AddedMemberRow = {
  id: string;
  joined_at: Date;
  deactivated_at: Date | null;
};

type ActivationRow = {
  deactivated_at: Date | null;
};

function toPrimary(
  row: ClubhouseRow
): UserSummary {
  return {
    id: row.primary_user_id,

    displayName:
      row.primary_display_name
  };
}

function toMember(
  row: MemberRow
): ClubhouseMember {
  return {
    id: row.id,

    user: {
      id: row.user_id,
      displayName:
        row.display_name
    },

    joinedAt:
      row.joined_at.toISOString(),

    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null
  };
}

async function getMembers(
  clubhouseId: string,
  db: DbExecutor = pool
): Promise<ClubhouseMember[]> {
  const result =
    await db.query<MemberRow>(
      `
        SELECT
          cm.id,
          cm.user_id,
          u.display_name,
          cm.joined_at,
          cm.deactivated_at

        FROM clubhouse_members cm

        JOIN users u
          ON u.id =
            cm.user_id

        WHERE
          cm.clubhouse_id = $1

        ORDER BY
          cm.joined_at
      `,
      [clubhouseId]
    );

  return result.rows.map(
    toMember
  );
}

async function toClubhouse(
  row: ClubhouseRow,
  db: DbExecutor = pool
): Promise<Clubhouse> {
  return {
    id:
      row.id,

    name:
      row.name,

    primary:
      toPrimary(row),

    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null,

    createdAt:
      row.created_at.toISOString(),

    updatedAt:
      row.updated_at.toISOString(),

    members:
      await getMembers(
        row.id,
        db
      )
  };
}

const CLUBHOUSE_SELECT = `
  SELECT
    c.id,
    c.name,
    c.primary_user_id,

    primary_user.display_name
      AS primary_display_name,

    c.deactivated_at,
    c.created_at,
    c.updated_at

  FROM clubhouses c

  JOIN users primary_user
    ON primary_user.id =
      c.primary_user_id
`;

export async function createClubhouse(
  primaryUserId: string,
  name: string,
  db: DbExecutor = pool
): Promise<Clubhouse> {
  const result =
    await db.query<ClubhouseRow>(
      `
        INSERT INTO clubhouses (
          primary_user_id,
          name
        )
        VALUES ($1, $2)

        RETURNING
          id,
          name,
          primary_user_id,

          (
            SELECT display_name
            FROM users
            WHERE id = $1
          ) AS primary_display_name,

          deactivated_at,
          created_at,
          updated_at
      `,
      [
        primaryUserId,
        name
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Clubhouse insert returned no row"
    );
  }

  return toClubhouse(
    row,
    db
  );
}

export async function listClubhousesForUser(
  userId: string
): Promise<Clubhouse[]> {
  const result =
    await pool.query<ClubhouseRow>(
      `
        ${CLUBHOUSE_SELECT}

        WHERE
          c.primary_user_id = $1

          OR EXISTS (
            SELECT 1
            FROM clubhouse_members cm
            WHERE
              cm.clubhouse_id =
                c.id
              AND cm.user_id =
                $1
          )

        ORDER BY
          c.created_at DESC
      `,
      [userId]
    );

  return Promise.all(
    result.rows.map(
      (row) =>
        toClubhouse(row)
    )
  );
}

export async function isClubhousePrimary(
  clubhouseId: string,
  userId: string,
  db: DbExecutor = pool
): Promise<boolean> {
  const result =
    await db.query<{
      exists: boolean
    }>(
      `
        SELECT EXISTS (
          SELECT 1

          FROM clubhouses

          WHERE id = $1
            AND primary_user_id =
              $2
        ) AS exists
      `,
      [
        clubhouseId,
        userId
      ]
    );

  return (
    result.rows[0]?.exists ??
    false
  );
}

export async function findUserIdByPhone(
  phoneNumber: string,
  db: DbExecutor = pool
): Promise<string | null> {
  const result =
    await db.query<{
      id: string
    }>(
      `
        SELECT id

        FROM users

        WHERE phone_number = $1

        LIMIT 1
      `,
      [phoneNumber]
    );

  return (
    result.rows[0]?.id ??
    null
  );
}

export async function addClubhouseMember(
  clubhouseId: string,
  userId: string,
  db: DbExecutor = pool
): Promise<{
  id: string;
  joinedAt: string;
  deactivatedAt: string | null;
}> {
  const result =
    await db.query<AddedMemberRow>(
      `
        INSERT INTO clubhouse_members (
          clubhouse_id,
          user_id
        )
        VALUES ($1, $2)

        RETURNING
          id,
          joined_at,
          deactivated_at
      `,
      [
        clubhouseId,
        userId
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Clubhouse member insert returned no row"
    );
  }

  return {
    id:
      row.id,

    joinedAt:
      row.joined_at.toISOString(),

    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null
  };
}

export async function setClubhouseActive(
  clubhouseId: string,
  primaryUserId: string,
  active: boolean,
  db: DbExecutor = pool
): Promise<{
  deactivatedAt: string | null;
} | null> {
  const result =
    await db.query<ActivationRow>(
      `
        UPDATE clubhouses

        SET deactivated_at =
          CASE
            WHEN $3::boolean
              THEN NULL

            ELSE COALESCE(
              deactivated_at,
              now()
            )
          END

        WHERE id = $1
          AND primary_user_id =
            $2

        RETURNING
          deactivated_at
      `,
      [
        clubhouseId,
        primaryUserId,
        active
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    return null;
  }

  return {
    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null
  };
}

export async function setClubhouseMemberActive(
  clubhouseId: string,
  membershipId: string,
  active: boolean,
  db: DbExecutor = pool
): Promise<{
  deactivatedAt: string | null;
} | null> {
  const result =
    await db.query<ActivationRow>(
      `
        UPDATE clubhouse_members

        SET deactivated_at =
          CASE
            WHEN $3::boolean
              THEN NULL

            ELSE COALESCE(
              deactivated_at,
              now()
            )
          END

        WHERE id = $1
          AND clubhouse_id = $2

        RETURNING
          deactivated_at
      `,
      [
        membershipId,
        clubhouseId,
        active
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    return null;
  }

  return {
    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null
  };
}

export async function canUserViewPrimary(
  viewerUserId: string,
  golferUserId: string
): Promise<boolean> {
  if (
    viewerUserId ===
    golferUserId
  ) {
    return true;
  }

  const result =
    await pool.query<{
      exists: boolean
    }>(
      `
        SELECT EXISTS (
          SELECT 1

          FROM clubhouses c

          JOIN clubhouse_members cm
            ON cm.clubhouse_id =
              c.id

          WHERE
            c.primary_user_id =
              $2

            AND cm.user_id =
              $1

            AND c.deactivated_at
              IS NULL

            AND cm.deactivated_at
              IS NULL
        ) AS exists
      `,
      [
        viewerUserId,
        golferUserId
      ]
    );

  return (
    result.rows[0]?.exists ??
    false
  );
}
