import {
  Router,
  type Request,
  type Response
} from "express";
import {
  IdSchema
} from "@teerific/shared";
import {
  authContext,
  requireAuth
} from "../middleware/requireAuth.js";
import {
  requireAdmin
} from "../middleware/requireAdmin.js";
import {
  listAuditEvents
} from "../repositories/auditRepository.js";
import {
  getAdminGolfSummary
} from "../repositories/reportRepository.js";
import {
  getAdminClubhouse,
  getAdminUser,
  listAdminClubhouses,
  listAdminUsers
} from "../repositories/adminReadRepository.js";
import {
  getCourse,
  listCourseHoles,
  listCourses
} from "../repositories/courseRepository.js";
import {
  deleteCourseCompletely,
  deleteHoleCompletely,
  deleteSimpleRecord,
  deleteUserCompletely,
  type SimpleDeleteResource
} from "../repositories/adminRepository.js";

export const adminRouter = Router();

adminRouter.use(
  requireAuth,
  requireAdmin
);

function parseId(
  value: string | string[] | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed =
    IdSchema.safeParse(value);

  return parsed.success
    ? parsed.data
    : null;
}

async function deleteSimple(
  resource: SimpleDeleteResource,
  request: Request,
  response: Response
): Promise<void> {
  const id =
    parseId(request.params.id);

  if (!id) {
    response.status(400).json({
      error: "INVALID_ID"
    });
    return;
  }

  const { currentUser } =
    authContext(request);

  const deleted =
    await deleteSimpleRecord(
      resource,
      id,
      currentUser
    );

  if (!deleted) {
    response.status(404).json({
      error: "NOT_FOUND"
    });
    return;
  }

  response.status(204).send();
}






adminRouter.get(
  "/courses",
  async (_request, response) => {
    const courses =
      await listCourses();

    response.status(200).json({
      courses
    });
  }
);


adminRouter.get(
  "/courses/:id",
  async (request, response) => {
    const id =
      parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        error: "INVALID_ID"
      });
      return;
    }

    const course =
      await getCourse(id);

    if (!course) {
      response.status(404).json({
        error: "COURSE_NOT_FOUND"
      });
      return;
    }

    const holes =
      await listCourseHoles(id);

    response.status(200).json({
      course,
      holes
    });
  }
);


adminRouter.get(
  "/audit-events",
  async (request, response) => {
    const raw =
      request.query.limit;

    const limit =
      typeof raw === "string"
        ? Number(raw)
        : 200;

    const events =
      await listAuditEvents(
        Number.isFinite(limit)
          ? limit
          : 200
      );

    response.status(200).json({
      events
    });
  }
);


adminRouter.get(
  "/reports/summary",
  async (_request, response) => {
    const summary =
      await getAdminGolfSummary();

    response.status(200).json({
      summary
    });
  }
);

adminRouter.get(
  "/users",
  async (_request, response) => {
    const users =
      await listAdminUsers();

    response.status(200).json({
      users
    });
  }
);


adminRouter.get(
  "/users/:id",
  async (request, response) => {
    const id =
      parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        error: "INVALID_ID"
      });
      return;
    }

    const user =
      await getAdminUser(id);

    if (!user) {
      response.status(404).json({
        error: "USER_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      user
    });
  }
);


adminRouter.get(
  "/clubhouses",
  async (_request, response) => {
    const clubhouses =
      await listAdminClubhouses();

    response.status(200).json({
      clubhouses
    });
  }
);


adminRouter.get(
  "/clubhouses/:id",
  async (request, response) => {
    const id =
      parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        error: "INVALID_ID"
      });
      return;
    }

    const clubhouse =
      await getAdminClubhouse(id);

    if (!clubhouse) {
      response.status(404).json({
        error: "CLUBHOUSE_NOT_FOUND"
      });
      return;
    }

    response.status(200).json({
      clubhouse
    });
  }
);

adminRouter.delete(
  "/users/:id",
  async (request, response) => {
    const id =
      parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        error: "INVALID_ID"
      });
      return;
    }

    const { currentUser } =
      authContext(request);

    const result =
      await deleteUserCompletely(
        id,
        currentUser
      );

    if (result === "not_found") {
      response.status(404).json({
        error: "USER_NOT_FOUND"
      });
      return;
    }

    if (result === "protected") {
      response.status(403).json({
        error:
          "ADMIN_ACCOUNT_CANNOT_BE_DELETED"
      });
      return;
    }

    response.status(204).send();
  }
);


adminRouter.delete(
  "/clubhouses/:id",
  async (request, response) => {
    await deleteSimple(
      "clubhouses",
      request,
      response
    );
  }
);

adminRouter.delete(
  "/clubhouse-members/:id",
  async (request, response) => {
    await deleteSimple(
      "clubhouseMembers",
      request,
      response
    );
  }
);


adminRouter.delete(
  "/courses/:id",
  async (request, response) => {
    const id =
      parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        error: "INVALID_ID"
      });
      return;
    }

    const { currentUser } =
      authContext(request);

    const deleted =
      await deleteCourseCompletely(
        id,
        currentUser
      );

    if (!deleted) {
      response.status(404).json({
        error: "COURSE_NOT_FOUND"
      });
      return;
    }

    response.status(204).send();
  }
);


adminRouter.delete(
  "/holes/:id",
  async (request, response) => {
    const id =
      parseId(request.params.id);

    if (!id) {
      response.status(400).json({
        error: "INVALID_ID"
      });
      return;
    }

    const { currentUser } =
      authContext(request);

    const deleted =
      await deleteHoleCompletely(
        id,
        currentUser
      );

    if (!deleted) {
      response.status(404).json({
        error: "HOLE_NOT_FOUND"
      });
      return;
    }

    response.status(204).send();
  }
);


adminRouter.delete(
  "/destinations/:id",
  async (request, response) => {
    await deleteSimple(
      "destinations",
      request,
      response
    );
  }
);

adminRouter.delete(
  "/rounds/:id",
  async (request, response) => {
    await deleteSimple(
      "rounds",
      request,
      response
    );
  }
);

adminRouter.delete(
  "/location-samples/:id",
  async (request, response) => {
    await deleteSimple(
      "locationSamples",
      request,
      response
    );
  }
);

adminRouter.delete(
  "/hole-visits/:id",
  async (request, response) => {
    await deleteSimple(
      "holeVisits",
      request,
      response
    );
  }
);

adminRouter.delete(
  "/sessions/:id",
  async (request, response) => {
    await deleteSimple(
      "sessions",
      request,
      response
    );
  }
);

adminRouter.delete(
  "/phone-pin-challenges/:id",
  async (request, response) => {
    await deleteSimple(
      "phonePinChallenges",
      request,
      response
    );
  }
);
