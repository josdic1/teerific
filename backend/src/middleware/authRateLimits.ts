import { rateLimit } from "express-rate-limit";

export const phonePinRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_PIN_REQUESTS"
  }
});

export const phonePinVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_PIN_ATTEMPTS"
  }
});
