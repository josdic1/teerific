import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type PinChallengeRow = {
  id: string;
  phone_number: string;
  code_hash: string;
  attempts_remaining: number;
  expires_at: Date;
  consumed_at: Date | null;
};

export async function createPhonePinChallenge(
  id: string,
  phoneNumber: string,
  codeHash: string,
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

export async function consumePhonePinChallenge(
  id: string,
  expectedHash: string,
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

  const challenge =
    result.rows[0];

  if (
    !challenge ||
    challenge.consumed_at !== null ||
    challenge.expires_at <= new Date() ||
    challenge.attempts_remaining <= 0
  ) {
    return null;
  }

  if (
    challenge.code_hash !==
    expectedHash
  ) {
    await db.query(
      `
        UPDATE phone_pin_challenges
        SET attempts_remaining =
          GREATEST(
            attempts_remaining - 1,
            0
          )
        WHERE id = $1
      `,
      [id]
    );

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
