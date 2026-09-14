import type {
  NextFunction,
  Request,
  Response
} from "express";
import { authContext } from "./requireAuth.js";

export function requireOnboardedUser(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const { currentUser } =
    authContext(request);

  if (currentUser.displayName === null) {
    response.status(403).json({
      error: "PROFILE_SETUP_REQUIRED"
    });
    return;
  }

  next();
}
