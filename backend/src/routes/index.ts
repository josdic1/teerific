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
  healthRouter
} from "./health.js";

export const apiRouter = Router();

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
  "/admin",
  adminRouter
);
