import type {
  AdminClubhouse,
  AdminClubhouseMember,
  AdminMembership,
  AdminOwnedClubhouse,
  AdminUser,
  AdminUserIdentity
} from "@teerific/shared";
import { pool } from "../db/pool.js";

type UserRow = {
  id: string;
  display_name: string | null;
  phone_number: string;
  phone_verified_at: Date;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
  round_count: string;
  last_activity_at: Date | null;
};

type OwnedClubhouseRow = {
  id: string;
  name: string;
  deactivated_at: Date | null;
};

type MembershipRow = {
  membership_id: string;
  clubhouse_id: string;
  clubhouse_name: string;

  primary_user_id: string;
  primary_display_name: string | null;
  primary_phone_number: string;
  primary_is_admin: boolean;

  joined_at: Date;
  deactivated_at: Date | null;
};

type ClubhouseRow = {
  id: string;
  name: string;

  primary_user_id: string;
  primary_display_name: string | null;
  primary_phone_number: string;
  primary_is_admin: boolean;

  deactivated_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ClubhouseMemberRow = {
  membership_id: string;

  user_id: string;
  display_name: string | null;
  phone_number: string;
  is_admin: boolean;

  joined_at: Date;
  deactivated_at: Date | null;
};

function identity(
  id: string,
  displayName: string | null,
  phoneNumber: string,
  isAdmin: boolean
): AdminUserIdentity {
  return {
    id,
    displayName,
    phoneNumber,
    isAdmin
  };
}

async function ownedClubhouses(
  userId: string
): Promise<AdminOwnedClubhouse[]> {
  const result =
    await pool.query<OwnedClubhouseRow>(
      `
        SELECT
          id,
          name,
          deactivated_at
        FROM clubhouses
        WHERE primary_user_id = $1
        ORDER BY created_at DESC
      `,
      [userId]
    );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,

    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null
  }));
}

async function memberships(
  userId: string
): Promise<AdminMembership[]> {
  const result =
    await pool.query<MembershipRow>(
      `
        SELECT
          cm.id AS membership_id,

          c.id AS clubhouse_id,
          c.name AS clubhouse_name,

          primary_user.id
            AS primary_user_id,

          primary_user.display_name
            AS primary_display_name,

          primary_user.phone_number
            AS primary_phone_number,

          primary_user.is_admin
            AS primary_is_admin,

          cm.joined_at,
          cm.deactivated_at

        FROM clubhouse_members cm

        JOIN clubhouses c
          ON c.id = cm.clubhouse_id

        JOIN users primary_user
          ON primary_user.id =
            c.primary_user_id

        WHERE cm.user_id = $1

        ORDER BY cm.joined_at DESC
      `,
      [userId]
    );

  return result.rows.map((row) => ({
    id: row.membership_id,

    clubhouse: {
      id: row.clubhouse_id,
      name: row.clubhouse_name,

      primary: identity(
        row.primary_user_id,
        row.primary_display_name,
        row.primary_phone_number,
        row.primary_is_admin
      )
    },

    joinedAt:
      row.joined_at.toISOString(),

    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null
  }));
}

async function toAdminUser(
  row: UserRow
): Promise<AdminUser> {
  return {
    id: row.id,
    displayName: row.display_name,
    phoneNumber: row.phone_number,

    phoneVerifiedAt:
      row.phone_verified_at.toISOString(),

    isAdmin: row.is_admin,

    createdAt:
      row.created_at.toISOString(),

    updatedAt:
      row.updated_at.toISOString(),

    roundCount:
      Number(row.round_count),

    lastActivityAt:
      row.last_activity_at
        ? row.last_activity_at.toISOString()
        : null,

    ownedClubhouses:
      await ownedClubhouses(row.id),

    memberships:
      await memberships(row.id)
  };
}

const USER_SELECT = `
  SELECT
    u.id,
    u.display_name,
    u.phone_number,
    u.phone_verified_at,
    u.is_admin,
    u.created_at,
    u.updated_at,

    (
      SELECT COUNT(*)::text
      FROM rounds r
      WHERE r.golfer_user_id = u.id
    ) AS round_count,

    (
      SELECT MAX(activity_at)
      FROM (
        SELECT MAX(s.last_seen_at)
          AS activity_at
        FROM sessions s
        WHERE s.user_id = u.id

        UNION ALL

        SELECT MAX(r.started_at)
        FROM rounds r
        WHERE r.golfer_user_id = u.id

        UNION ALL

        SELECT MAX(ls.recorded_at)
        FROM location_samples ls
        JOIN rounds lr
          ON lr.id = ls.round_id
        WHERE lr.golfer_user_id = u.id
      ) activity
    ) AS last_activity_at

  FROM users u
`;

export async function listAdminUsers():
Promise<AdminUser[]> {
  const result =
    await pool.query<UserRow>(
      `
        ${USER_SELECT}
        ORDER BY u.created_at DESC
      `
    );

  return Promise.all(
    result.rows.map(toAdminUser)
  );
}

export async function getAdminUser(
  userId: string
): Promise<AdminUser | null> {
  const result =
    await pool.query<UserRow>(
      `
        ${USER_SELECT}
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId]
    );

  const row = result.rows[0];

  return row
    ? toAdminUser(row)
    : null;
}


async function clubhouseMembers(
  clubhouseId: string
): Promise<AdminClubhouseMember[]> {
  const result =
    await pool.query<ClubhouseMemberRow>(
      `
        SELECT
          cm.id AS membership_id,

          u.id AS user_id,
          u.display_name,
          u.phone_number,
          u.is_admin,

          cm.joined_at,
          cm.deactivated_at

        FROM clubhouse_members cm

        JOIN users u
          ON u.id = cm.user_id

        WHERE cm.clubhouse_id = $1

        ORDER BY cm.joined_at
      `,
      [clubhouseId]
    );

  return result.rows.map((row) => ({
    id: row.membership_id,

    user: identity(
      row.user_id,
      row.display_name,
      row.phone_number,
      row.is_admin
    ),

    joinedAt:
      row.joined_at.toISOString(),

    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null
  }));
}

async function toAdminClubhouse(
  row: ClubhouseRow
): Promise<AdminClubhouse> {
  return {
    id: row.id,
    name: row.name,

    primary: identity(
      row.primary_user_id,
      row.primary_display_name,
      row.primary_phone_number,
      row.primary_is_admin
    ),

    deactivatedAt:
      row.deactivated_at
        ? row.deactivated_at.toISOString()
        : null,

    createdAt:
      row.created_at.toISOString(),

    updatedAt:
      row.updated_at.toISOString(),

    members:
      await clubhouseMembers(row.id)
  };
}

const CLUBHOUSE_SELECT = `
  SELECT
    c.id,
    c.name,

    primary_user.id
      AS primary_user_id,

    primary_user.display_name
      AS primary_display_name,

    primary_user.phone_number
      AS primary_phone_number,

    primary_user.is_admin
      AS primary_is_admin,

    c.deactivated_at,
    c.created_at,
    c.updated_at

  FROM clubhouses c

  JOIN users primary_user
    ON primary_user.id =
      c.primary_user_id
`;

export async function listAdminClubhouses():
Promise<AdminClubhouse[]> {
  const result =
    await pool.query<ClubhouseRow>(
      `
        ${CLUBHOUSE_SELECT}
        ORDER BY c.created_at DESC
      `
    );

  return Promise.all(
    result.rows.map(
      toAdminClubhouse
    )
  );
}

export async function getAdminClubhouse(
  clubhouseId: string
): Promise<AdminClubhouse | null> {
  const result =
    await pool.query<ClubhouseRow>(
      `
        ${CLUBHOUSE_SELECT}
        WHERE c.id = $1
        LIMIT 1
      `,
      [clubhouseId]
    );

  const row = result.rows[0];

  return row
    ? toAdminClubhouse(row)
    : null;
}
