import {
  createHash,
  timingSafeEqual
} from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256")
    .update(value, "utf8")
    .digest();
}

export function testLoginEnabled(): boolean {
  return process.env.TEST_LOGIN_ENABLED === "true";
}

export function verifyTestLoginSecret(
  supplied: string
): boolean {
  const expected =
    process.env.TEST_LOGIN_SECRET;

  if (!expected) {
    return false;
  }

  return timingSafeEqual(
    digest(supplied),
    digest(expected)
  );
}
