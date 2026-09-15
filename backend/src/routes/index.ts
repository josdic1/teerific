import { Router } from "express";
import {
  adminRouter
} from "./admin.js";
import {
  authRouter
} from "./auth.js";
import {
  clubhousesRouter
} from "./clubhouses.js";
import {
  coursesRouter
} from "./courses.js";
import {
  healthRouter
} from "./health.js";
import {
  golfersRouter
} from "./golfers.js";
import {
  roundsRouter
} from "./rounds.js";
import {
  destinationsRouter
} from "./destinations.js";

export const apiRouter =
  Router();

apiRouter.use(
  "/health",
  healthRouter
);

apiRouter.use(
  "/auth",
  authRouter
);

apiRouter.use(
  "/clubhouses",
  clubhousesRouter
);

apiRouter.use(
  "/courses",
  coursesRouter
);

apiRouter.use(
  "/rounds",
  roundsRouter
);

apiRouter.use(
  "/destinations",
  destinationsRouter
);

apiRouter.use(
  "/golfers",
  golfersRouter
);

apiRouter.use(
  "/admin",
  adminRouter
);
