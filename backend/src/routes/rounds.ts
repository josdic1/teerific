import { Router } from "express";
import {
  EndRoundInputSchema,
  IdSchema,
  LocationUpdateInputSchema,
  StartRoundInputSchema
} from "@teerific/shared";
import {
  audit
} from "../audit/audit.js";
import {
  withTransaction
} from "../db/transaction.js";
import {
  authContext,
  requireAuth
} from "../middleware/requireAuth.js";
import {
  requireOnboardedUser
} from "../middleware/requireOnboardedUser.js";
import {
  createRound,
  endRound,
  getCurrentRound,
  getRoundForGolfer,
  listRoundsForGolfer
} from "../repositories/roundRepository.js";
import {
  listLocationSamplesForRound,
  recordLocationSample
} from "../repositories/locationRepository.js";
import {
  listHoleVisitsForRound
} from "../repositories/holeVisitRepository.js";
import {
  detectCourseAtPoint
} from "../repositories/courseRepository.js";

export const roundsRouter =
  Router();

roundsRouter.use(
  requireAuth,
  requireOnboardedUser
);

function parseId(
  raw: unknown
): string | null {
  if (
    typeof raw !== "string"
  ) {
    return null;
  }

  const parsed =
    IdSchema.safeParse(raw);

  return parsed.success
    ? parsed.data
    : null;
}

function pgCode(
  error: unknown
): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}


roundsRouter.get(
  "/",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const rounds =
      await listRoundsForGolfer(
        currentUser.id
      );

    response.status(200).json({
      rounds
    });
  }
);


roundsRouter.get(
  "/current",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const round =
      await getCurrentRound(
        currentUser.id
      );

    response.status(200).json({
      round
    });
  }
);


roundsRouter.get(
  "/:id",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const roundId =
      parseId(
        request.params.id
      );

    if (!roundId) {
      response.status(400).json({
        error:
          "INVALID_ROUND_ID"
      });
      return;
    }

    const round =
      await getRoundForGolfer(
        roundId,
        currentUser.id
      );

    if (!round) {
      response.status(404).json({
        error:
          "ROUND_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      round
    });
  }
);


roundsRouter.post(
  "/",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const parsed =
      StartRoundInputSchema.safeParse(
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

    const startInput =
      parsed.data;

    try {
      const outcome =
        await withTransaction(
          async (client) => {
            let courseId:
              string;

            if (
              startInput
                .courseDetectionMethod ===
              "automatic"
            ) {
              const detection =
                await detectCourseAtPoint(
                  {
                    latitude:
                      startInput.latitude,

                    longitude:
                      startInput.longitude
                  },
                  client
                );

              if (
                detection.status !==
                  "matched" ||
                !detection.course
              ) {
                return {
                  type:
                    "course_detection_failed",

                  detection
                } as const;
              }

              courseId =
                detection.course.id;
            } else {
              courseId =
                startInput.courseId;
            }

            const created =
              await createRound(
                currentUser.id,
                courseId,
                startInput
                  .courseDetectionMethod,
                client
              );

            if (
              created ===
              "course_not_found"
            ) {
              return {
                type:
                  "course_not_found"
              } as const;
            }

            await audit(
              {
                actor:
                  currentUser,

                action:
                  "round.started",

                targetType:
                  "round",

                targetId:
                  created.id,

                targetSnapshot: {
                  ...created
                }
              },
              client
            );

            return {
              type:
                "created",

              round:
                created
            } as const;
          }
        );

      if (
        outcome.type ===
        "course_detection_failed"
      ) {
        response.status(409).json({
          error:
            "COURSE_AUTO_DETECTION_FAILED",

          detection:
            outcome.detection
        });

        return;
      }

      if (
        outcome.type ===
        "course_not_found"
      ) {
        response.status(404).json({
          error:
            "ACTIVE_COURSE_NOT_FOUND"
        });

        return;
      }

      response.status(201).json({
        round:
          outcome.round
      });
    } catch (error) {
      if (
        pgCode(error) ===
        "23505"
      ) {
        response.status(409).json({
          error:
            "ACTIVE_ROUND_ALREADY_EXISTS"
        });

        return;
      }

      throw error;
    }
  }
);


roundsRouter.patch(
  "/:id/end",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const roundId =
      parseId(
        request.params.id
      );

    if (!roundId) {
      response.status(400).json({
        error:
          "INVALID_ROUND_ID"
      });
      return;
    }

    const parsed =
      EndRoundInputSchema.safeParse(
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

    const outcome =
      await withTransaction(
        async (client) => {
          const result =
            await endRound(
              roundId,
              currentUser.id,
              parsed.data.reason,
              client
            );

          if (
            result.type !==
            "ended"
          ) {
            return result;
          }

          await audit(
            {
              actor:
                currentUser,

              action:
                "round.ended",

              targetType:
                "round",

              targetId:
                result.round.id,

              targetSnapshot: {
                ...result.round
              },

              metadata: {
                reason:
                  result.round
                    .endedReason
              }
            },
            client
          );

          return result;
        }
      );

    if (
      outcome.type ===
      "not_found"
    ) {
      response.status(404).json({
        error:
          "ROUND_NOT_FOUND"
      });
      return;
    }

    if (
      outcome.type ===
      "already_ended"
    ) {
      response.status(200).json({
        round:
          outcome.round,

        changed:
          false
      });
      return;
    }

    response.status(200).json({
      round:
        outcome.round,

      changed:
        true
    });
  }
);


roundsRouter.post(
  "/:id/location-samples",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const roundId =
      parseId(
        request.params.id
      );

    if (!roundId) {
      response.status(400).json({
        error:
          "INVALID_ROUND_ID"
      });
      return;
    }

    const parsed =
      LocationUpdateInputSchema.safeParse(
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

    const outcome =
      await withTransaction(
        client =>
          recordLocationSample(
            roundId,
            currentUser.id,
            parsed.data,
            client
          )
      );

    if (
      outcome.type ===
      "round_not_found"
    ) {
      response.status(404).json({
        error:
          "ROUND_NOT_FOUND"
      });
      return;
    }

    if (
      outcome.type ===
      "round_ended"
    ) {
      response.status(409).json({
        error:
          "ROUND_ALREADY_ENDED"
      });
      return;
    }

    response.status(201).json({
      sample:
        outcome.sample
    });
  }
);


roundsRouter.get(
  "/:id/location-samples",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const roundId =
      parseId(
        request.params.id
      );

    if (!roundId) {
      response.status(400).json({
        error:
          "INVALID_ROUND_ID"
      });
      return;
    }

    const rawLimit =
      request.query.limit;

    const requestedLimit =
      typeof rawLimit === "string"
        ? Number(rawLimit)
        : 500;

    const samples =
      await listLocationSamplesForRound(
        roundId,
        currentUser.id,
        Number.isFinite(
          requestedLimit
        )
          ? requestedLimit
          : 500
      );

    if (!samples) {
      response.status(404).json({
        error:
          "ROUND_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      samples
    });
  }
);


roundsRouter.get(
  "/:id/hole-visits",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const roundId =
      parseId(
        request.params.id
      );

    if (!roundId) {
      response.status(400).json({
        error:
          "INVALID_ROUND_ID"
      });
      return;
    }

    const visits =
      await listHoleVisitsForRound(
        roundId,
        currentUser.id
      );

    if (!visits) {
      response.status(404).json({
        error:
          "ROUND_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      visits
    });
  }
);
