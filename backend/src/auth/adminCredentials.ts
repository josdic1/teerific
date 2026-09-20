import {
  createHash,
  timingSafeEqual
} from "node:crypto";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function digest(value: string): Buffer {
  return createHash("sha256")
    .update(value, "utf8")
    .digest();
}

function equalSecret(
  actual: string,
  expected: string
): boolean {
  return timingSafeEqual(
    digest(actual),
    digest(expected)
  );
}

export function verifyAdminCredentials(
  username: string,
  password: string
): boolean {
  const expectedUsername =
    requiredEnv("ADMIN_USERNAME");

  const expectedPassword =
    requiredEnv("ADMIN_PASSWORD");

  return (
    equalSecret(username, expectedUsername) &&
    equalSecret(password, expectedPassword)
  );
}

export function adminDisplayName(): string {
  return process.env.ADMIN_DISPLAY_NAME?.trim() || "Admin";
}
