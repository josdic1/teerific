import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";
import {
  createPhonePinChallenge,
  findPendingPhonePinChallenge,
  consumeApprovedPhonePinChallenge
} from "../repositories/phonePinRepository.js";

const PIN_TTL_MINUTES = 5;

export async function issuePhonePin(
  phoneNumber: string,
  db: DbExecutor = pool
): Promise<{
  challengeId: string;
  expiresAt: Date;
}> {
  const challengeId = randomUUID();

  const expiresAt =
    new Date(
      Date.now() +
      PIN_TTL_MINUTES * 60 * 1000
    );

  await createPhonePinChallenge(
    challengeId,
    phoneNumber,
    null,
    expiresAt,
    db
  );

  return {
    challengeId,
    expiresAt
  };
}

export async function findPhonePinChallenge(
  challengeId: string
): Promise<string | null> {
  return findPendingPhonePinChallenge(
    challengeId
  );
}

export async function consumeVerifiedPhonePin(
  challengeId: string,
  phoneNumber: string,
  db: DbExecutor
): Promise<string | null> {
  return consumeApprovedPhonePinChallenge(
    challengeId,
    phoneNumber,
    db
  );
}
