import { createHmac, randomInt, randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import type { DbExecutor } from "../db/transaction.js";
import {
  createPhonePinChallenge,
  consumePhonePinChallenge,
} from "../repositories/phonePinRepository.js";

const PIN_TTL_MINUTES = 5;

function pepper(): string {
  const value = process.env.PIN_PEPPER;

  if (!value) {
    throw new Error("PIN_PEPPER is required");
  }

  return value;
}

function hashPin(challengeId: string, code: string): string {
  return createHmac("sha256", pepper())
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export async function issuePhonePin(
  phoneNumber: string,
  db: DbExecutor = pool,
): Promise<{
  challengeId: string;
  expiresAt: Date;
}> {
  const challengeId = randomUUID();

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const expiresAt = new Date(Date.now() + PIN_TTL_MINUTES * 60 * 1000);

  await createPhonePinChallenge(
    challengeId,
    phoneNumber,
    hashPin(challengeId, code),
    expiresAt,
    db,
  );

  if (
    process.env.NODE_ENV !== "production" ||
    process.env.LOG_PHONE_PIN === "true"
  ) {
    console.log(`Phone PIN for ${phoneNumber}: ${code}`);
  }

  return {
    challengeId,
    expiresAt,
  };
}

export async function verifyPhonePin(
  challengeId: string,
  code: string,
  db: DbExecutor,
): Promise<string | null> {
  return consumePhonePinChallenge(challengeId, hashPin(challengeId, code), db);
}
