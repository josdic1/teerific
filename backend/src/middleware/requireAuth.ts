import type {
  NextFunction,
  Request,
  Response
} from "express";
import type {
  CurrentUser
} from "@teerific/shared";
import {
  hashSessionToken,
  readSessionToken
} from "../auth/session.js";
import {
  findUserBySessionHash
} from "../repositories/authRepository.js";

export type AuthContext = {
  currentUser: CurrentUser;
};

export function authContext(
  request: Request
): AuthContext {
  if (!request.currentUser) {
    throw new Error(
      "AUTH_CONTEXT_MISSING: requireAuth must run first"
    );
  }

  return {
    currentUser: request.currentUser
  };
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const token = readSessionToken(request);

  if (!token) {
    response.status(401).json({
      error: "UNAUTHENTICATED"
    });
    return;
  }

  const user = await findUserBySessionHash(
    hashSessionToken(token)
  );

  if (!user) {
    response.status(401).json({
      error: "UNAUTHENTICATED"
    });
    return;
  }

  request.currentUser = user;
  next();
}
