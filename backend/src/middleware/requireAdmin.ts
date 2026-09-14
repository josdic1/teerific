import type {
  NextFunction,
  Request,
  Response
} from "express";
import {
  authContext
} from "./requireAuth.js";

export function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const { currentUser } =
    authContext(request);

  if (!currentUser.isAdmin) {
    response.status(403).json({
      error: "ADMIN_REQUIRED"
    });
    return;
  }

  next();
}
