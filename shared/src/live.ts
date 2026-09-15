import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";
import {
  LocationSampleSchema
} from "./location.js";
import {
  PaceEstimateSchema
} from "./pace.js";
import {
  CourseDetectionMethodSchema
} from "./round.js";

export const LiveGolferStateSchema =
  z.object({
    golfer: z.object({
      id: IdSchema,
      displayName:
        z.string().nullable()
    }).strict(),

    playing:
      z.boolean(),

    round: z.object({
      id: IdSchema,
      startedAt:
        IsoDateTimeSchema,
      courseDetectionMethod:
        CourseDetectionMethodSchema
    }).strict().nullable(),

    course: z.object({
      id: IdSchema,
      name:
        z.string(),
      slug:
        z.string(),
      timezone:
        z.string()
    }).strict().nullable(),

    currentHole: z.object({
      id: IdSchema,
      holeNumber:
        z.number()
          .int()
          .positive(),
      par:
        z.number()
          .int()
          .nullable(),
      yardage:
        z.number()
          .int()
          .nullable(),
      enteredAt:
        IsoDateTimeSchema
    }).strict().nullable(),

    latestLocation:
      LocationSampleSchema.nullable(),

    holesCompleted:
      z.number()
        .int()
        .nonnegative(),

    totalHoles:
      z.number()
        .int()
        .nonnegative(),

    pace:
      PaceEstimateSchema.nullable(),

    lastUpdatedAt:
      IsoDateTimeSchema.nullable()
  })
  .strict();

export type LiveGolferState =
  z.infer<
    typeof LiveGolferStateSchema
  >;
