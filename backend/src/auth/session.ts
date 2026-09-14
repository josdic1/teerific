import { createHash, randomBytes } from "node:crypto";
import { parseCookie } from "cookie";
import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "teerific_session";
export const SESSION_TTL_DAYS = 30;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(request: Request): string | null {
  const cookies = parseCookie(request.headers.cookie ?? "");
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: expiresAt,
    path: "/"
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/"
  });
}
