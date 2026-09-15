import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";
import {
  LatitudeSchema,
  LongitudeSchema
} from "./geo.js";

export const CourseDetectionMethodSchema =
  z.enum([
    "automatic",
    "manual"
  ]);

export const RoundEndReasonSchema =
  z.enum([
    "completed",
    "abandoned"
  ]);

export const DestinationSchema =
  z.object({
    id:
      IdSchema,

    userId:
      IdSchema,

    label:
      z.string()
        .trim()
        .min(1)
        .max(100),

    address:
      z.string()
        .trim()
        .min(1)
        .max(500),

    latitude:
      LatitudeSchema,

    longitude:
      LongitudeSchema,

    createdAt:
      IsoDateTimeSchema,

    updatedAt:
      IsoDateTimeSchema
  })
  .strict();

export const CreateDestinationInputSchema =
  z.object({
    label:
      z.string()
        .trim()
        .min(1)
        .max(100),

    address:
      z.string()
        .trim()
        .min(1)
        .max(500),

    latitude:
      LatitudeSchema,

    longitude:
      LongitudeSchema
  })
  .strict();

export const UpdateDestinationInputSchema =
  CreateDestinationInputSchema
    .partial()
    .strict()
    .refine(
      value =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one destination field must be provided"
      }
    );

export const RoundSchema =
  z.object({
    id:
      IdSchema,

    golferUserId:
      IdSchema,

    courseId:
      IdSchema,

    courseDetectionMethod:
      CourseDetectionMethodSchema,

    startedAt:
      IsoDateTimeSchema,

    endedAt:
      IsoDateTimeSchema.nullable(),

    endedReason:
      RoundEndReasonSchema.nullable(),

    createdAt:
      IsoDateTimeSchema,

    updatedAt:
      IsoDateTimeSchema
  })
  .strict();

export const HoleVisitSchema =
  z.object({
    id:
      IdSchema,

    roundId:
      IdSchema,

    holeId:
      IdSchema,

    enteredAt:
      IsoDateTimeSchema,

    exitedAt:
      IsoDateTimeSchema.nullable(),

    detectedAutomatically:
      z.boolean()
  })
  .strict();

const ManualStartRoundInputSchema =
  z.object({
    courseDetectionMethod:
      z.literal("manual"),

    courseId:
      IdSchema
  })
  .strict();

const AutomaticStartRoundInputSchema =
  z.object({
    courseDetectionMethod:
      z.literal("automatic"),

    latitude:
      LatitudeSchema,

    longitude:
      LongitudeSchema
  })
  .strict();

export const StartRoundInputSchema =
  z.discriminatedUnion(
    "courseDetectionMethod",
    [
      ManualStartRoundInputSchema,
      AutomaticStartRoundInputSchema
    ]
  );

export const EndRoundInputSchema =
  z.object({
    reason:
      RoundEndReasonSchema
  })
  .strict();

export type StartRoundInput =
  z.infer<
    typeof StartRoundInputSchema
  >;

export type EndRoundInput =
  z.infer<
    typeof EndRoundInputSchema
  >;

export type CreateDestinationInput =
  z.infer<
    typeof CreateDestinationInputSchema
  >;

export type UpdateDestinationInput =
  z.infer<
    typeof UpdateDestinationInputSchema
  >;

export type Destination =
  z.infer<
    typeof DestinationSchema
  >;

export type Round =
  z.infer<
    typeof RoundSchema
  >;

export type HoleVisit =
  z.infer<
    typeof HoleVisitSchema
  >;
