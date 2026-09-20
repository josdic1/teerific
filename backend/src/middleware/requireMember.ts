import type {
  NextFunction,
  Request,
  Response
} from "express";
import { authContext } from "./requireAuth.js";

export function requireMember(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const { currentUser } = authContext(request);

  if (currentUser.userType !== "member") {
    response.status(403).json({
      error: "MEMBER_REQUIRED"
    });
    return;
  }

  next();
}
