import { z } from "zod";
import {
  IsoDateTimeSchema
} from "./common.js";

export const PaceBasisSchema =
  z.enum([
    "current_round",
    "course_history",
    "unavailable"
  ]);

export const PaceEstimateSchema =
  z.object({
    asOf:
      IsoDateTimeSchema,

    completedHoles:
      z.number()
        .int()
        .nonnegative(),

    averageCompletedHoleMinutes:
      z.number()
        .nonnegative()
        .nullable(),

    currentHoleElapsedMinutes:
      z.number()
        .nonnegative()
        .nullable(),

    estimatedMinutesRemaining:
      z.number()
        .nonnegative()
        .nullable(),

    estimatedFinishAt:
      IsoDateTimeSchema.nullable(),

    basis:
      PaceBasisSchema,

    sampleSize:
      z.number()
        .int()
        .nonnegative()
  })
  .strict();

export type PaceEstimate =
  z.infer<
    typeof PaceEstimateSchema
  >;
