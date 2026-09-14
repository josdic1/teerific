import { Router } from "express";
import {
  AddClubhouseMemberInputSchema,
  CreateClubhouseInputSchema,
  IdSchema
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
  addClubhouseMember,
  createClubhouse,
  findUserIdByPhone,
  isClubhousePrimary,
  listClubhousesForUser,
  setClubhouseActive,
  setClubhouseMemberActive
} from "../repositories/clubhouseRepository.js";

export const clubhousesRouter =
  Router();

clubhousesRouter.use(
  requireAuth,
  requireOnboardedUser
);


clubhousesRouter.get(
  "/",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const clubhouses =
      await listClubhousesForUser(
        currentUser.id
      );

    response.status(200).json({
      clubhouses
    });
  }
);


clubhousesRouter.post(
  "/",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const parsed =
      CreateClubhouseInputSchema.safeParse(
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

    const clubhouse =
      await withTransaction(
        async (client) => {
          const created =
            await createClubhouse(
              currentUser.id,
              parsed.data.name,
              client
            );

          await audit(
            {
              actor:
                currentUser,

              action:
                "clubhouse.created",

              targetType:
                "clubhouse",

              targetId:
                created.id,

              targetSnapshot: {
                id:
                  created.id,

                name:
                  created.name,

                primary:
                  created.primary,

                deactivatedAt:
                  created.deactivatedAt
              }
            },
            client
          );

          return created;
        }
      );

    response.status(201).json({
      clubhouse
    });
  }
);


clubhousesRouter.post(
  "/:id/members",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const clubhouseId =
      IdSchema.safeParse(
        request.params.id
      );

    const body =
      AddClubhouseMemberInputSchema.safeParse(
        request.body
      );

    if (
      !clubhouseId.success ||
      !body.success
    ) {
      response.status(400).json({
        error:
          "INVALID_REQUEST"
      });
      return;
    }

    try {
      const outcome =
        await withTransaction(
          async (client) => {
            const primary =
              await isClubhousePrimary(
                clubhouseId.data,
                currentUser.id,
                client
              );

            if (!primary) {
              return {
                type:
                  "not_primary"
              } as const;
            }

            const userId =
              await findUserIdByPhone(
                body.data.phoneNumber,
                client
              );

            if (!userId) {
              return {
                type:
                  "user_not_found"
              } as const;
            }

            if (
              userId ===
              currentUser.id
            ) {
              return {
                type:
                  "primary_is_member"
              } as const;
            }

            const membership =
              await addClubhouseMember(
                clubhouseId.data,
                userId,
                client
              );

            await audit(
              {
                actor:
                  currentUser,

                action:
                  "clubhouse.member_added",

                targetType:
                  "clubhouse_member",

                targetId:
                  membership.id,

                targetSnapshot: {
                  id:
                    membership.id,

                  clubhouseId:
                    clubhouseId.data,

                  userId,

                  phoneNumber:
                    body.data.phoneNumber,

                  joinedAt:
                    membership.joinedAt,

                  deactivatedAt:
                    membership.deactivatedAt
                }
              },
              client
            );

            return {
              type:
                "created"
            } as const;
          }
        );

      if (
        outcome.type ===
        "not_primary"
      ) {
        response.status(403).json({
          error:
            "CLUBHOUSE_PRIMARY_REQUIRED"
        });
        return;
      }

      if (
        outcome.type ===
        "user_not_found"
      ) {
        response.status(404).json({
          error:
            "USER_NOT_FOUND"
        });
        return;
      }

      if (
        outcome.type ===
        "primary_is_member"
      ) {
        response.status(409).json({
          error:
            "PRIMARY_CANNOT_BE_MEMBER"
        });
        return;
      }

      response.status(204).send();
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error
      ) {
        if (
          error.code === "23505"
        ) {
          response.status(409).json({
            error:
              "CLUBHOUSE_MEMBER_ALREADY_EXISTS"
          });
          return;
        }

        if (
          error.code === "23514"
        ) {
          response.status(409).json({
            error:
              "PRIMARY_CANNOT_BE_MEMBER"
          });
          return;
        }
      }

      throw error;
    }
  }
);


async function setClubhouseState(
  request: Parameters<
    Parameters<
      typeof clubhousesRouter.patch
    >[1]
  >[0],

  response: Parameters<
    Parameters<
      typeof clubhousesRouter.patch
    >[1]
  >[1],

  active: boolean
): Promise<void> {
  const { currentUser } =
    authContext(request);

  const clubhouseId =
    IdSchema.safeParse(
      request.params.id
    );

  if (!clubhouseId.success) {
    response.status(400).json({
      error:
        "INVALID_REQUEST"
    });
    return;
  }

  const changed =
    await withTransaction(
      async (client) => {
        const result =
          await setClubhouseActive(
            clubhouseId.data,
            currentUser.id,
            active,
            client
          );

        if (!result) {
          return null;
        }

        await audit(
          {
            actor:
              currentUser,

            action:
              active
                ? "clubhouse.reactivated"
                : "clubhouse.deactivated",

            targetType:
              "clubhouse",

            targetId:
              clubhouseId.data,

            targetSnapshot: {
              id:
                clubhouseId.data,

              deactivatedAt:
                result.deactivatedAt
            }
          },
          client
        );

        return result;
      }
    );

  if (!changed) {
    response.status(403).json({
      error:
        "CLUBHOUSE_PRIMARY_REQUIRED"
    });
    return;
  }

  response.status(204).send();
}


clubhousesRouter.patch(
  "/:id/deactivate",
  async (request, response) => {
    await setClubhouseState(
      request,
      response,
      false
    );
  }
);


clubhousesRouter.patch(
  "/:id/reactivate",
  async (request, response) => {
    await setClubhouseState(
      request,
      response,
      true
    );
  }
);


async function setMemberState(
  request: Parameters<
    Parameters<
      typeof clubhousesRouter.patch
    >[1]
  >[0],

  response: Parameters<
    Parameters<
      typeof clubhousesRouter.patch
    >[1]
  >[1],

  active: boolean
): Promise<void> {
  const { currentUser } =
    authContext(request);

  const clubhouseId =
    IdSchema.safeParse(
      request.params.id
    );

  const membershipId =
    IdSchema.safeParse(
      request.params.membershipId
    );

  if (
    !clubhouseId.success ||
    !membershipId.success
  ) {
    response.status(400).json({
      error:
        "INVALID_REQUEST"
    });
    return;
  }

  const outcome =
    await withTransaction(
      async (client) => {
        const primary =
          await isClubhousePrimary(
            clubhouseId.data,
            currentUser.id,
            client
          );

        if (!primary) {
          return {
            type:
              "not_primary"
          } as const;
        }

        const changed =
          await setClubhouseMemberActive(
            clubhouseId.data,
            membershipId.data,
            active,
            client
          );

        if (!changed) {
          return {
            type:
              "not_found"
          } as const;
        }

        await audit(
          {
            actor:
              currentUser,

            action:
              active
                ? "clubhouse.member_reactivated"
                : "clubhouse.member_deactivated",

            targetType:
              "clubhouse_member",

            targetId:
              membershipId.data,

            targetSnapshot: {
              id:
                membershipId.data,

              clubhouseId:
                clubhouseId.data,

              deactivatedAt:
                changed.deactivatedAt
            }
          },
          client
        );

        return {
          type:
            "changed"
        } as const;
      }
    );

  if (
    outcome.type ===
    "not_primary"
  ) {
    response.status(403).json({
      error:
        "CLUBHOUSE_PRIMARY_REQUIRED"
    });
    return;
  }

  if (
    outcome.type ===
    "not_found"
  ) {
    response.status(404).json({
      error:
        "CLUBHOUSE_MEMBER_NOT_FOUND"
    });
    return;
  }

  response.status(204).send();
}


clubhousesRouter.patch(
  "/:id/members/:membershipId/deactivate",
  async (request, response) => {
    await setMemberState(
      request,
      response,
      false
    );
  }
);


clubhousesRouter.patch(
  "/:id/members/:membershipId/reactivate",
  async (request, response) => {
    await setMemberState(
      request,
      response,
      true
    );
  }
);
