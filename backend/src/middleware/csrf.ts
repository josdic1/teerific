import type {
  NextFunction,
  Request,
  Response
} from "express";

const SAFE_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS"
]);

function allowedOrigin(): string {
  return process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
}

export function csrfProtection(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(request.method)) {
    next();
    return;
  }

  const origin = request.headers.origin;

  if (origin) {
    if (origin !== allowedOrigin()) {
      response.status(403).json({
        error: "INVALID_REQUEST_ORIGIN"
      });
      return;
    }

    next();
    return;
  }

  const referer = request.headers.referer;

  if (referer) {
    try {
      if (new URL(referer).origin !== allowedOrigin()) {
        response.status(403).json({
          error: "INVALID_REQUEST_ORIGIN"
        });
        return;
      }
    } catch {
      response.status(403).json({
        error: "INVALID_REQUEST_ORIGIN"
      });
      return;
    }
  }

  next();
}
