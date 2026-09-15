import {
  ArrivalContextSchema,
  ArrivalTargetInputSchema
} from "@teerific/shared";
import {
  resolveArrivalTarget
} from "../repositories/arrivalTargetRepository.js";
import {
  resolveArrivalOrigin
} from "../repositories/arrivalOriginRepository.js";
import {
  estimateArrival
} from "../services/arrivalEstimateService.js";
import { Router } from "express";
import {
  IdSchema
} from "@teerific/shared";
import {
  authContext,
  requireAuth
} from "../middleware/requireAuth.js";
import {
  requireOnboardedUser
} from "../middleware/requireOnboardedUser.js";
import {
  canUserViewPrimary
} from "../repositories/clubhouseRepository.js";
import {
  getLiveGolferState
} from "../repositories/liveStateRepository.js";

export const golfersRouter =
  Router();

golfersRouter.use(
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


golfersRouter.get(
  "/:golferUserId/live-state",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const golferUserId =
      parseId(
        request.params
          .golferUserId
      );

    if (!golferUserId) {
      response.status(400).json({
        error:
          "INVALID_GOLFER_ID"
      });
      return;
    }

    const allowed =
      currentUser.isAdmin ||
      currentUser.id ===
        golferUserId ||
      await canUserViewPrimary(
        currentUser.id,
        golferUserId
      );

    if (!allowed) {
      response.status(403).json({
        error:
          "GOLFER_VIEW_FORBIDDEN"
      });
      return;
    }

    const state =
      await getLiveGolferState(
        golferUserId
      );

    if (!state) {
      response.status(404).json({
        error:
          "GOLFER_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      state
    });
  }
);


golfersRouter.get(
  "/:golferUserId/live-stream",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const golferUserId =
      parseId(
        request.params
          .golferUserId
      );

    if (!golferUserId) {
      response.status(400).json({
        error:
          "INVALID_GOLFER_ID"
      });
      return;
    }

    const targetGolferUserId =
      golferUserId;

    async function isAllowed():
    Promise<boolean> {
      return (
        currentUser.isAdmin ||
        currentUser.id ===
          targetGolferUserId ||
        await canUserViewPrimary(
          currentUser.id,
          targetGolferUserId
        )
      );
    }

    if (
      !(await isAllowed())
    ) {
      response.status(403).json({
        error:
          "GOLFER_VIEW_FORBIDDEN"
      });
      return;
    }

    const initialState =
      await getLiveGolferState(
        targetGolferUserId
      );

    if (!initialState) {
      response.status(404).json({
        error:
          "GOLFER_NOT_FOUND"
      });
      return;
    }

    response.status(200);

    response.set({
      "Content-Type":
        "text/event-stream",

      "Cache-Control":
        "no-cache, no-transform",

      "Connection":
        "keep-alive",

      "X-Accel-Buffering":
        "no"
    });

    response.flushHeaders();

    let closed =
      false;

    let previousJson =
      JSON.stringify(
        initialState
      );

    function send(
      event: string,
      data: unknown
    ): void {
      if (closed) {
        return;
      }

      response.write(
        `event: ${event}\n`
      );

      response.write(
        `data: ${JSON.stringify(data)}\n\n`
      );
    }

    send(
      "state",
      initialState
    );

    const heartbeat =
      setInterval(
        () => {
          if (!closed) {
            response.write(
              ": keepalive\n\n"
            );
          }
        },
        15_000
      );

    let timer:
      NodeJS.Timeout | null =
        null;

    async function poll():
    Promise<void> {
      if (closed) {
        return;
      }

      try {
        /*
         * Re-check authorization every cycle.
         *
         * If Primary deactivates this membership
         * while the stream is open, access stops.
         */
        if (
          !(await isAllowed())
        ) {
          send(
            "access-revoked",
            {
              error:
                "GOLFER_VIEW_FORBIDDEN"
            }
          );

          closed = true;

          clearInterval(
            heartbeat
          );

          response.end();

          return;
        }

        const state =
          await getLiveGolferState(
            targetGolferUserId
          );

        if (!state) {
          send(
            "golfer-unavailable",
            {
              error:
                "GOLFER_NOT_FOUND"
            }
          );

          closed = true;

          clearInterval(
            heartbeat
          );

          response.end();

          return;
        }

        const json =
          JSON.stringify(
            state
          );

        /*
         * SSE transmits only meaningful changes,
         * not a duplicate payload every 2 seconds.
         */
        if (
          json !==
          previousJson
        ) {
          previousJson =
            json;

          send(
            "state",
            state
          );
        }
      } catch (error) {
        console.error(
          "Live golfer stream poll failed:",
          error
        );

        send(
          "stream-error",
          {
            error:
              "LIVE_STATE_UNAVAILABLE"
          }
        );
      }

      if (!closed) {
        timer =
          setTimeout(
            () => {
              void poll();
            },
            2_000
          );
      }
    }

    timer =
      setTimeout(
        () => {
          void poll();
        },
        2_000
      );

    request.on(
      "close",
      () => {
        closed = true;

        clearInterval(
          heartbeat
        );

        if (timer) {
          clearTimeout(
            timer
          );
        }
      }
    );
  }
);


golfersRouter.post(
  "/:golferUserId/arrival-context",
  async (
    request,
    response
  ) => {
    const { currentUser } =
      authContext(request);

    const golferUserId =
      parseId(
        request.params.golferUserId
      );

    if (!golferUserId) {
      response.status(400).json({
        error:
          "INVALID_GOLFER_ID"
      });

      return;
    }

    const parsed =
      ArrivalTargetInputSchema.safeParse(
        request.body
      );

    if (!parsed.success) {
      response.status(400).json({
        error:
          "INVALID_ARRIVAL_TARGET",

        issues:
          parsed.error.issues
      });

      return;
    }

    const allowed =
      currentUser.isAdmin ||
      currentUser.id ===
        golferUserId ||
      await canUserViewPrimary(
        currentUser.id,
        golferUserId
      );

    if (!allowed) {
      response.status(403).json({
        error:
          "GOLFER_VIEW_FORBIDDEN"
      });

      return;
    }

    const state =
      await getLiveGolferState(
        golferUserId
      );

    if (!state) {
      response.status(404).json({
        error:
          "GOLFER_NOT_FOUND"
      });

      return;
    }

    /*
     * Viewer current location is deliberately
     * request-scoped.
     *
     * It is validated and used here, but never
     * written to a Teerific table.
     */
    const target =
      await resolveArrivalTarget(
        currentUser.id,
        parsed.data
      );

    if (!target) {
      response.status(404).json({
        error:
          "SAVED_DESTINATION_NOT_FOUND"
      });

      return;
    }

    const origin =
      state.course
        ? await resolveArrivalOrigin(
            state.course.id
          )
        : null;

    const arrival =
      await estimateArrival({
        state,
        origin,
        target
      });

    const context =
      ArrivalContextSchema.parse({
        state,
        origin,
        target,
        arrival
      });

    response.status(200).json({
      context
    });
  }
);
