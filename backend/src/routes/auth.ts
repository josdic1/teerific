import { Router } from "express";
import {
  AuthResponseSchema,
  RequestPhonePinInputSchema,
  RequestPhonePinResponseSchema,
  UpdateAccountInputSchema,
  VerifyPhonePinInputSchema
} from "@teerific/shared";
import {
  audit,
  userSnapshot
} from "../audit/audit.js";
import {
  consumeVerifiedPhonePin,
  findPhonePinChallenge,
  issuePhonePin
} from "../auth/phonePin.js";
import {
  sendPhonePinSms,
  verifyPhonePinSms
} from "../auth/sms.js";
import {
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  readSessionToken,
  SESSION_TTL_DAYS,
  setSessionCookie
} from "../auth/session.js";
import {
  withTransaction
} from "../db/transaction.js";
import {
  authContext,
  requireAuth
} from "../middleware/requireAuth.js";
import {
  phonePinRequestRateLimit,
  phonePinVerifyRateLimit
} from "../middleware/authRateLimits.js";
import {
  createSession,
  findOrCreateVerifiedUserByPhone,
  revokeSession,
  updateAccount
} from "../repositories/authRepository.js";
import {
  ensurePrimaryClubhouse
} from "../repositories/clubhouseRepository.js";

export const authRouter =
  Router();

function sessionExpiry(): Date {
  const expires =
    new Date();

  expires.setDate(
    expires.getDate() +
      SESSION_TTL_DAYS
  );

  return expires;
}


authRouter.post(
  "/pin/request",
  phonePinRequestRateLimit,
  async (request, response) => {
    const parsed =
      RequestPhonePinInputSchema.safeParse(
        request.body
      );

    if (!parsed.success) {
      response.status(400).json({
        error:
          "INVALID_REQUEST",
        issues:
          parsed.error.issues
      });
      return;
    }

    const challenge =
      await withTransaction(
        async (client) => {
          const issued =
            await issuePhonePin(
              parsed.data.phoneNumber,
              client
            );

          await audit(
            {
              action:
                "auth.pin_requested",

              targetType:
                "phone_auth",

              metadata: {
                phoneNumber:
                  parsed.data.phoneNumber,

                challengeId:
                  issued.challengeId
              }
            },
            client
          );

          return issued;
        }
      );

    await sendPhonePinSms(
      parsed.data.phoneNumber
    );

    response.status(201).json(
      RequestPhonePinResponseSchema.parse({
        challengeId:
          challenge.challengeId,

        expiresAt:
          challenge.expiresAt.toISOString()
      })
    );
  }
);


authRouter.post(
  "/pin/verify",
  phonePinVerifyRateLimit,
  async (request, response) => {
    const parsed =
      VerifyPhonePinInputSchema.safeParse(
        request.body
      );

    if (!parsed.success) {
      response.status(400).json({
        error:
          "INVALID_REQUEST",
        issues:
          parsed.error.issues
      });
      return;
    }

    const phoneNumber =
      await findPhonePinChallenge(
        parsed.data.challengeId
      );

    if (!phoneNumber) {
      response.status(401).json({
        error:
          "INVALID_OR_EXPIRED_PIN"
      });
      return;
    }

    const approved =
      await verifyPhonePinSms(
        phoneNumber,
        parsed.data.code
      );

    if (!approved) {
      response.status(401).json({
        error:
          "INVALID_OR_EXPIRED_PIN"
      });
      return;
    }

    const token =
      createSessionToken();

    const expiresAt =
      sessionExpiry();

    const result =
      await withTransaction(
        async (client) => {
          const consumedPhoneNumber =
            await consumeVerifiedPhonePin(
              parsed.data.challengeId,
              phoneNumber,
              client
            );

          if (!consumedPhoneNumber) {
            return null;
          }

          const user =
            await findOrCreateVerifiedUserByPhone(
              consumedPhoneNumber,
              client
            );

          await createSession(
            user.id,
            hashSessionToken(
              token
            ),
            expiresAt,
            client
          );

          await audit(
            {
              actor: user,

              action:
                "auth.phone_pin_verified",

              targetType:
                "user",

              targetId:
                user.id,

              targetSnapshot:
                userSnapshot(user),

              metadata: {
                method:
                  "phone_pin"
              }
            },
            client
          );

          return user;
        }
      );

    if (!result) {
      response.status(401).json({
        error:
          "INVALID_OR_EXPIRED_PIN"
      });
      return;
    }

    setSessionCookie(
      response,
      token,
      expiresAt
    );

    response.status(200).json(
      AuthResponseSchema.parse({
        user: result
      })
    );
  }
);


authRouter.post(
  "/logout",
  requireAuth,
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const token =
      readSessionToken(request);

    if (token) {
      await withTransaction(
        async (client) => {
          await revokeSession(
            hashSessionToken(
              token
            ),
            client
          );

          await audit(
            {
              actor:
                currentUser,

              action:
                "auth.logout",

              targetType:
                "user",

              targetId:
                currentUser.id,

              targetSnapshot:
                userSnapshot(
                  currentUser
                )
            },
            client
          );
        }
      );
    }

    clearSessionCookie(
      response
    );

    response.status(204).send();
  }
);


authRouter.get(
  "/me",
  requireAuth,
  (request, response) => {
    const { currentUser } =
      authContext(request);

    response.status(200).json(
      AuthResponseSchema.parse({
        user:
          currentUser
      })
    );
  }
);


authRouter.patch(
  "/me",
  requireAuth,
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const parsed =
      UpdateAccountInputSchema.safeParse(
        request.body
      );

    if (!parsed.success) {
      response.status(400).json({
        error:
          "INVALID_REQUEST",
        issues:
          parsed.error.issues
      });
      return;
    }

    const updated =
      await withTransaction(
        async (client) => {
          const user =
            await updateAccount(
              currentUser.id,
              parsed.data,
              client
            );

          await audit(
            {
              actor:
                currentUser,

              action:
                "user.profile_updated",

              targetType:
                "user",

              targetId:
                user.id,

              targetSnapshot:
                userSnapshot(user),

              metadata: {
                previousDisplayName:
                  currentUser.displayName,

                displayName:
                  user.displayName
              }
            },
            client
          );

          /*
           * Every onboarded non-admin golfer owns
           * exactly one Clubhouse.
           *
           * This is intentionally idempotent:
           * an existing Clubhouse is returned rather
           * than duplicated.
           */
          if (
            !user.isAdmin &&
            user.displayName !== null
          ) {
            const ensured =
              await ensurePrimaryClubhouse(
                user.id,
                `${user.displayName} Clubhouse`,
                client
              );

            if (ensured.created) {
              await audit(
                {
                  actor:
                    user,

                  action:
                    "clubhouse.created",

                  targetType:
                    "clubhouse",

                  targetId:
                    ensured.clubhouse.id,

                  targetSnapshot: {
                    id:
                      ensured.clubhouse.id,

                    name:
                      ensured.clubhouse.name,

                    primary:
                      ensured.clubhouse.primary,

                    deactivatedAt:
                      ensured.clubhouse.deactivatedAt
                  },

                  metadata: {
                    source:
                      "onboarding_auto_create"
                  }
                },
                client
              );
            }
          }

          return user;
        }
      );

    response.status(200).json(
      AuthResponseSchema.parse({
        user:
          updated
      })
    );
  }
);
