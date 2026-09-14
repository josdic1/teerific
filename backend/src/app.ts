import cors from "cors";
import express from "express";
import { apiRouter } from "./routes/index.js";
import { csrfProtection } from "./middleware/csrf.js";

export const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(csrfProtection);

app.use("/api", apiRouter);
