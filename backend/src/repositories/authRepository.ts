import type {
  CurrentUser,
  UpdateAccountInput
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type UserRow = {
  id: string;
  phone_number: string;
  phone_verified_at: Date;
  display_name: string | null;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
};

function toCurrentUser(
  row: UserRow
): CurrentUser {
  return {
    id: row.id,
    phoneNumber:
      row.phone_number,
    phoneVerifiedAt:
      row.phone_verified_at.toISOString(),
    displayName:
      row.display_name,
    isAdmin:
      row.is_admin,
    createdAt:
      row.created_at.toISOString(),
    updatedAt:
      row.updated_at.toISOString()
  };
}

export async function findOrCreateVerifiedUserByPhone(
  phoneNumber: string,
  db: DbExecutor = pool
): Promise<CurrentUser> {
  const isAdmin =
    process.env.ADMIN_PHONE_NUMBER ===
    phoneNumber;

  const result =
    await db.query<UserRow>(
      `
        INSERT INTO users (
          phone_number,
          phone_verified_at,
          is_admin
        )
        VALUES ($1, now(), $2)

        ON CONFLICT (phone_number)
        DO UPDATE SET
          phone_verified_at =
            COALESCE(
              users.phone_verified_at,
              EXCLUDED.phone_verified_at
            ),

          is_admin =
            users.is_admin
            OR EXCLUDED.is_admin

        RETURNING
          id,
          phone_number,
          phone_verified_at,
          display_name,
          is_admin,
          created_at,
          updated_at
      `,
      [
        phoneNumber,
        isAdmin
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "User upsert returned no row"
    );
  }

  return toCurrentUser(row);
}

export async function createSession(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  db: DbExecutor = pool
): Promise<void> {
  await db.query(
    `
      INSERT INTO sessions (
        user_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3)
    `,
    [
      userId,
      tokenHash,
      expiresAt
    ]
  );
}

export async function findUserBySessionHash(
  tokenHash: string
): Promise<CurrentUser | null> {
  const result =
    await pool.query<UserRow>(
      `
        SELECT
          u.id,
          u.phone_number,
          u.phone_verified_at,
          u.display_name,
          u.is_admin,
          u.created_at,
          u.updated_at

        FROM sessions s

        JOIN users u
          ON u.id = s.user_id

        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()

        LIMIT 1
      `,
      [tokenHash]
    );

  const row =
    result.rows[0];

  return row
    ? toCurrentUser(row)
    : null;
}

export async function revokeSession(
  tokenHash: string,
  db: DbExecutor = pool
): Promise<void> {
  await db.query(
    `
      UPDATE sessions
      SET revoked_at = now()
      WHERE token_hash = $1
        AND revoked_at IS NULL
    `,
    [tokenHash]
  );
}

export async function updateAccount(
  userId: string,
  input: UpdateAccountInput,
  db: DbExecutor = pool
): Promise<CurrentUser> {
  const result =
    await db.query<UserRow>(
      `
        UPDATE users

        SET display_name = $2

        WHERE id = $1

        RETURNING
          id,
          phone_number,
          phone_verified_at,
          display_name,
          is_admin,
          created_at,
          updated_at
      `,
      [
        userId,
        input.displayName
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "User not found"
    );
  }

  return toCurrentUser(row);
}
