import {
  CourseDetectionInputSchema
} from "@teerific/shared";
import {
  detectCourseAtPoint
} from "../repositories/courseRepository.js";
import { Router } from "express";
import {
  CreateCourseInputSchema,
  CreateHoleInputSchema,
  IdSchema,
  UpdateCourseInputSchema,
  UpdateHoleInputSchema
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
  requireAdmin
} from "../middleware/requireAdmin.js";
import {
  requireOnboardedUser
} from "../middleware/requireOnboardedUser.js";
import {
  createCourse,
  createHole,
  getCourse,
  listCourseHoles,
  listCourses,
  updateCourse,
  updateHole
} from "../repositories/courseRepository.js";

export const coursesRouter =
  Router();

coursesRouter.use(
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


coursesRouter.get(
  "/",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const courses =
      await listCourses(
        currentUser.isAdmin
      );

    response.status(200).json({
      courses
    });
  }
);


coursesRouter.get(
  "/:courseId/holes",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const courseId =
      parseId(
        request.params.courseId
      );

    if (!courseId) {
      response.status(400).json({
        error:
          "INVALID_COURSE_ID"
      });
      return;
    }

    const holes =
      await listCourseHoles(
        courseId,
        currentUser.isAdmin
      );

    if (!holes) {
      response.status(404).json({
        error:
          "COURSE_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      holes
    });
  }
);


coursesRouter.get(
  "/:id",
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const courseId =
      parseId(
        request.params.id
      );

    if (!courseId) {
      response.status(400).json({
        error:
          "INVALID_COURSE_ID"
      });
      return;
    }

    const course =
      await getCourse(
        courseId,
        currentUser.isAdmin
      );

    if (!course) {
      response.status(404).json({
        error:
          "COURSE_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      course
    });
  }
);


coursesRouter.post(
  "/",
  requireAdmin,
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const parsed =
      CreateCourseInputSchema.safeParse(
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

    try {
      const course =
        await withTransaction(
          async (client) => {
            const created =
              await createCourse(
                parsed.data,
                client
              );

            await audit(
              {
                actor:
                  currentUser,

                action:
                  "course.created",

                targetType:
                  "course",

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
        course
      });
    } catch (error) {
      const code =
        pgCode(error);

      if (
        code === "23514"
      ) {
        response.status(400).json({
          error:
            "INVALID_COURSE_STATE"
        });
        return;
      }

      if (
        code === "23505"
      ) {
        response.status(409).json({
          error:
            "COURSE_CONFLICT"
        });
        return;
      }

      throw error;
    }
  }
);


coursesRouter.patch(
  "/:id",
  requireAdmin,
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const courseId =
      parseId(
        request.params.id
      );

    if (!courseId) {
      response.status(400).json({
        error:
          "INVALID_COURSE_ID"
      });
      return;
    }

    const parsed =
      UpdateCourseInputSchema.safeParse(
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

    try {
      const outcome =
        await withTransaction(
          async (client) => {
            const result =
              await updateCourse(
                courseId,
                parsed.data,
                client
              );

            if (
              !result.found
            ) {
              return result;
            }

            if (
              result.changed
            ) {
              await audit(
                {
                  actor:
                    currentUser,

                  action:
                    "course.updated",

                  targetType:
                    "course",

                  targetId:
                    courseId,

                  targetSnapshot: {
                    ...result.value
                  },

                  metadata: {
                    changedFields:
                      Object.keys(
                        parsed.data
                      )
                  }
                },
                client
              );
            }

            return result;
          }
        );

      if (!outcome.found) {
        response.status(404).json({
          error:
            "COURSE_NOT_FOUND"
        });
        return;
      }

      response.status(200).json({
        course:
          outcome.value,
        changed:
          outcome.changed
      });
    } catch (error) {
      const code =
        pgCode(error);

      if (
        code === "23514"
      ) {
        response.status(400).json({
          error:
            "INVALID_COURSE_STATE"
        });
        return;
      }

      if (
        code === "23505"
      ) {
        response.status(409).json({
          error:
            "COURSE_CONFLICT"
        });
        return;
      }

      throw error;
    }
  }
);


coursesRouter.post(
  "/:courseId/holes",
  requireAdmin,
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const courseId =
      parseId(
        request.params.courseId
      );

    if (!courseId) {
      response.status(400).json({
        error:
          "INVALID_COURSE_ID"
      });
      return;
    }

    const parsed =
      CreateHoleInputSchema.safeParse(
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

    try {
      const hole =
        await withTransaction(
          async (client) => {
            const created =
              await createHole(
                courseId,
                parsed.data,
                client
              );

            if (!created) {
              return null;
            }

            await audit(
              {
                actor:
                  currentUser,

                action:
                  "hole.created",

                targetType:
                  "hole",

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

      if (!hole) {
        response.status(404).json({
          error:
            "COURSE_NOT_FOUND"
        });
        return;
      }

      response.status(201).json({
        hole
      });
    } catch (error) {
      const code =
        pgCode(error);

      if (
        code === "23505"
      ) {
        response.status(409).json({
          error:
            "HOLE_NUMBER_ALREADY_EXISTS"
        });
        return;
      }

      if (
        code === "23514"
      ) {
        response.status(400).json({
          error:
            "INVALID_HOLE_STATE"
        });
        return;
      }

      throw error;
    }
  }
);


coursesRouter.patch(
  "/:courseId/holes/:holeId",
  requireAdmin,
  async (request, response) => {
    const { currentUser } =
      authContext(request);

    const courseId =
      parseId(
        request.params.courseId
      );

    const holeId =
      parseId(
        request.params.holeId
      );

    if (
      !courseId ||
      !holeId
    ) {
      response.status(400).json({
        error:
          "INVALID_ID"
      });
      return;
    }

    const parsed =
      UpdateHoleInputSchema.safeParse(
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

    try {
      const outcome =
        await withTransaction(
          async (client) => {
            const result =
              await updateHole(
                courseId,
                holeId,
                parsed.data,
                client
              );

            if (
              !result.found
            ) {
              return result;
            }

            if (
              result.changed
            ) {
              await audit(
                {
                  actor:
                    currentUser,

                  action:
                    "hole.updated",

                  targetType:
                    "hole",

                  targetId:
                    holeId,

                  targetSnapshot: {
                    ...result.value
                  },

                  metadata: {
                    changedFields:
                      Object.keys(
                        parsed.data
                      )
                  }
                },
                client
              );
            }

            return result;
          }
        );

      if (!outcome.found) {
        response.status(404).json({
          error:
            "HOLE_NOT_FOUND"
        });
        return;
      }

      response.status(200).json({
        hole:
          outcome.value,
        changed:
          outcome.changed
      });
    } catch (error) {
      const code =
        pgCode(error);

      if (
        code === "23505"
      ) {
        response.status(409).json({
          error:
            "HOLE_NUMBER_ALREADY_EXISTS"
        });
        return;
      }

      if (
        code === "23514"
      ) {
        response.status(400).json({
          error:
            "INVALID_HOLE_STATE"
        });
        return;
      }

      throw error;
    }
  }
);


coursesRouter.post(
  "/detect",
  async (
    request,
    response
  ) => {
    const parsed =
      CourseDetectionInputSchema.safeParse(
        request.body
      );

    if (!parsed.success) {
      response
        .status(400)
        .json({
          error:
            "INVALID_COURSE_DETECTION_INPUT"
        });

      return;
    }

    const detection =
      await detectCourseAtPoint(
        parsed.data
      );

    response.json({
      detection
    });
  }
);
