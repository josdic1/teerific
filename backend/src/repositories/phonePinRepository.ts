import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type PinChallengeRow = {
  id: string;
  phone_number: string;
  code_hash: string | null;
  attempts_remaining: number;
  expires_at: Date;
  consumed_at: Date | null;
};

export async function createPhonePinChallenge(
  id: string,
  phoneNumber: string,
  codeHash: string | null,
  expiresAt: Date,
  db: DbExecutor = pool
): Promise<void> {
  await db.query(
    `
      INSERT INTO phone_pin_challenges (
        id,
        phone_number,
        code_hash,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
    `,
    [
      id,
      phoneNumber,
      codeHash,
      expiresAt
    ]
  );
}

export async function findPendingPhonePinChallenge(
  id: string,
  db: DbExecutor = pool
): Promise<string | null> {
  const result =
    await db.query<PinChallengeRow>(
      `
        SELECT
          id,
          phone_number,
          code_hash,
          attempts_remaining,
          expires_at,
          consumed_at
        FROM phone_pin_challenges
        WHERE id = $1
      `,
      [id]
    );

  const challenge = result.rows[0];

  if (
    !challenge ||
    challenge.consumed_at !== null ||
    challenge.expires_at <= new Date()
  ) {
    return null;
  }

  return challenge.phone_number;
}

export async function consumeApprovedPhonePinChallenge(
  id: string,
  phoneNumber: string,
  db: DbExecutor
): Promise<string | null> {
  const result =
    await db.query<PinChallengeRow>(
      `
        SELECT
          id,
          phone_number,
          code_hash,
          attempts_remaining,
          expires_at,
          consumed_at
        FROM phone_pin_challenges
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

  const challenge = result.rows[0];

  if (
    !challenge ||
    challenge.phone_number !== phoneNumber ||
    challenge.consumed_at !== null ||
    challenge.expires_at <= new Date()
  ) {
    return null;
  }

  await db.query(
    `
      UPDATE phone_pin_challenges
      SET consumed_at = now()
      WHERE id = $1
    `,
    [id]
  );

  return challenge.phone_number;
}
