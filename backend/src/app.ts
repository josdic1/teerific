import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import { apiRouter } from "./routes/index.js";
import { csrfProtection } from "./middleware/csrf.js";

export const app = express();

app.set(
  "trust proxy",
  process.env.NODE_ENV === "production"
    ? 1
    : "loopback"
);

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN ??
      "http://localhost:5173",
    credentials: true
  })
);

app.use(express.json());
app.use(csrfProtection);

app.use("/api", apiRouter);

const frontendDist = resolve(
  process.cwd(),
  "frontend",
  "dist"
);

app.use(express.static(frontendDist));

app.use((req, res, next) => {
  if (req.method !== "GET") {
    next();
    return;
  }

  if (
    req.path === "/api" ||
    req.path.startsWith("/api/")
  ) {
    next();
    return;
  }

  res.sendFile(
    resolve(frontendDist, "index.html")
  );
});
