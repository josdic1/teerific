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
  phone_number: string | null;
  phone_verified_at: Date | null;
  display_name: string | null;
  is_admin: boolean;
  user_type: "member" | "partner" | "admin" | null;
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
      row.phone_verified_at
        ? row.phone_verified_at.toISOString()
        : null,
    displayName:
      row.display_name,
    isAdmin:
      row.is_admin,
    userType:
      row.user_type,
    createdAt:
      row.created_at.toISOString(),
    updatedAt:
      row.updated_at.toISOString()
  };
}

const USER_RETURNING = `
  id,
  phone_number,
  phone_verified_at,
  display_name,
  is_admin,
  user_type,
  created_at,
  updated_at
`;

export async function findOrCreateVerifiedUserByPhone(
  phoneNumber: string,
  db: DbExecutor = pool
): Promise<CurrentUser> {
  const result =
    await db.query<UserRow>(
      `
        INSERT INTO users (
          phone_number,
          phone_verified_at,
          is_admin
        )
        VALUES ($1, now(), false)

        ON CONFLICT (phone_number)
        DO UPDATE SET
          phone_verified_at =
            COALESCE(
              users.phone_verified_at,
              EXCLUDED.phone_verified_at
            )

        RETURNING
          ${USER_RETURNING}
      `,
      [phoneNumber]
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

export async function findOrCreateAdminUser(
  displayName: string,
  db: DbExecutor = pool
): Promise<CurrentUser> {
  const existing =
    await db.query<UserRow>(
      `
        SELECT ${USER_RETURNING}
        FROM users
        WHERE is_admin = true
        LIMIT 1
      `
    );

  const found = existing.rows[0];

  if (found) {
    if (
      found.display_name !== displayName ||
      found.user_type !== "admin"
    ) {
      const updated =
        await db.query<UserRow>(
          `
            UPDATE users
            SET
              display_name = $2,
              user_type = 'admin'
            WHERE id = $1
            RETURNING ${USER_RETURNING}
          `,
          [found.id, displayName]
        );

      const row = updated.rows[0];
      if (!row) {
        throw new Error("Admin update returned no row");
      }
      return toCurrentUser(row);
    }

    return toCurrentUser(found);
  }

  const inserted =
    await db.query<UserRow>(
      `
        INSERT INTO users (
          phone_number,
          phone_verified_at,
          display_name,
          is_admin,
          user_type
        )
        VALUES (
          NULL,
          NULL,
          $1,
          true,
          'admin'
        )
        RETURNING ${USER_RETURNING}
      `,
      [displayName]
    );

  const row = inserted.rows[0];
  if (!row) {
    throw new Error("Admin insert returned no row");
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
          u.user_type,
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

        SET
          display_name = $2,
          user_type = COALESCE(user_type, $3)

        WHERE id = $1
          AND is_admin = false

        RETURNING
          ${USER_RETURNING}
      `,
      [
        userId,
        input.displayName,
        input.userType
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
