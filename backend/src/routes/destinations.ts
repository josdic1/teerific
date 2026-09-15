import { Router } from "express";
import {
  CreateDestinationInputSchema,
  IdSchema,
  UpdateDestinationInputSchema
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
  createDestination,
  deleteDestination,
  listDestinationsForUser,
  updateDestination
} from "../repositories/destinationRepository.js";

export const destinationsRouter =
  Router();

destinationsRouter.use(
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


destinationsRouter.get(
  "/",
  async (
    request,
    response
  ) => {
    const { currentUser } =
      authContext(request);

    const destinations =
      await listDestinationsForUser(
        currentUser.id
      );

    response.status(200).json({
      destinations
    });
  }
);


destinationsRouter.post(
  "/",
  async (
    request,
    response
  ) => {
    const { currentUser } =
      authContext(request);

    const parsed =
      CreateDestinationInputSchema.safeParse(
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

    const destination =
      await withTransaction(
        async (client) => {
          const created =
            await createDestination(
              currentUser.id,
              parsed.data,
              client
            );

          await audit(
            {
              actor:
                currentUser,

              action:
                "destination.created",

              targetType:
                "destination",

              targetId:
                created.id,

              targetSnapshot: {
                ...created
              }
            },
            client
          );

          return created;
        }
      );

    response.status(201).json({
      destination
    });
  }
);


destinationsRouter.patch(
  "/:id",
  async (
    request,
    response
  ) => {
    const { currentUser } =
      authContext(request);

    const destinationId =
      parseId(
        request.params.id
      );

    if (!destinationId) {
      response.status(400).json({
        error:
          "INVALID_DESTINATION_ID"
      });

      return;
    }

    const parsed =
      UpdateDestinationInputSchema.safeParse(
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

    const result =
      await withTransaction(
        async (client) => {
          const updated =
            await updateDestination(
              destinationId,
              currentUser.id,
              parsed.data,
              client
            );

          if (
            !updated.found ||
            !updated.changed
          ) {
            return updated;
          }

          await audit(
            {
              actor:
                currentUser,

              action:
                "destination.updated",

              targetType:
                "destination",

              targetId:
                updated.value.id,

              targetSnapshot: {
                ...updated.value
              },

              metadata: {
                before:
                  updated.before
              }
            },
            client
          );

          return updated;
        }
      );

    if (!result.found) {
      response.status(404).json({
        error:
          "DESTINATION_NOT_FOUND"
      });

      return;
    }

    response.status(200).json({
      destination:
        result.value,

      changed:
        result.changed
    });
  }
);


destinationsRouter.delete(
  "/:id",
  async (
    request,
    response
  ) => {
    const { currentUser } =
      authContext(request);

    const destinationId =
      parseId(
        request.params.id
      );

    if (!destinationId) {
      response.status(400).json({
        error:
          "INVALID_DESTINATION_ID"
      });

      return;
    }

    const deleted =
      await withTransaction(
        async (client) => {
          const destination =
            await deleteDestination(
              destinationId,
              currentUser.id,
              client
            );

          if (!destination) {
            return null;
          }

          await audit(
            {
              actor:
                currentUser,

              action:
                "destination.deleted",

              targetType:
                "destination",

              targetId:
                destination.id,

              targetSnapshot: {
                ...destination
              }
            },
            client
          );

          return destination;
        }
      );

    if (!deleted) {
      response.status(404).json({
        error:
          "DESTINATION_NOT_FOUND"
      });

      return;
    }

    response.status(204).send();
  }
);
