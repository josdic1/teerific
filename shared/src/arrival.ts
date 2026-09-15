import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";
import {
  LatitudeSchema,
  LongitudeSchema
} from "./geo.js";
import {
  LiveGolferStateSchema
} from "./live.js";

export const ViewerCurrentLocationInputSchema =
  z.object({
    type:
      z.literal(
        "viewer_current_location"
      ),

    latitude:
      LatitudeSchema,

    longitude:
      LongitudeSchema,

    accuracyMeters:
      z.number()
        .nonnegative()
        .nullable(),

    recordedAt:
      IsoDateTimeSchema
  })
  .strict();

export const SavedDestinationArrivalTargetInputSchema =
  z.object({
    type:
      z.literal(
        "saved_destination"
      ),

    destinationId:
      IdSchema
  })
  .strict();

export const ArrivalTargetInputSchema =
  z.discriminatedUnion(
    "type",
    [
      ViewerCurrentLocationInputSchema,
      SavedDestinationArrivalTargetInputSchema
    ]
  );

export const ResolvedArrivalOriginSchema =
  z.object({
    source:
      z.literal(
        "course_departure_location"
      ),

    courseId:
      IdSchema,

    courseName:
      z.string()
        .trim()
        .min(1),

    latitude:
      LatitudeSchema,

    longitude:
      LongitudeSchema
  })
  .strict();

export const ResolvedArrivalTargetSchema =
  z.object({
    source:
      z.enum([
        "viewer_current_location",
        "saved_destination"
      ]),

    label:
      z.string()
        .nullable(),

    latitude:
      LatitudeSchema,

    longitude:
      LongitudeSchema,

    accuracyMeters:
      z.number()
        .nonnegative()
        .nullable(),

    recordedAt:
      IsoDateTimeSchema.nullable()
  })
  .strict();

export const ArrivalEstimateSchema =
  z.discriminatedUnion(
    "status",
    [
      z.object({
        status:
          z.literal("available"),

        golfFinishAt:
          IsoDateTimeSchema,

        driveDurationSeconds:
          z.number()
            .int()
            .nonnegative(),

        distanceMeters:
          z.number()
            .int()
            .nonnegative(),

        estimatedArrivalAt:
          IsoDateTimeSchema,

        routingProvider:
          z.literal("google_routes")
      })
      .strict(),

      z.object({
        status:
          z.literal("unavailable"),

        reason:
          z.enum([
            "not_playing",
            "golf_finish_unavailable",
            "golf_finish_not_future",
            "departure_location_unavailable",
            "routing_unavailable"
          ])
      })
      .strict()
    ]
  );

export const ArrivalContextSchema =
  z.object({
    state:
      LiveGolferStateSchema,

    origin:
      ResolvedArrivalOriginSchema.nullable(),

    target:
      ResolvedArrivalTargetSchema,

    arrival:
      ArrivalEstimateSchema
  })
  .strict();

export type ViewerCurrentLocationInput =
  z.infer<
    typeof ViewerCurrentLocationInputSchema
  >;

export type ArrivalTargetInput =
  z.infer<
    typeof ArrivalTargetInputSchema
  >;

export type ResolvedArrivalOrigin =
  z.infer<
    typeof ResolvedArrivalOriginSchema
  >;

export type ResolvedArrivalTarget =
  z.infer<
    typeof ResolvedArrivalTargetSchema
  >;

export type ArrivalEstimate =
  z.infer<
    typeof ArrivalEstimateSchema
  >;

export type ArrivalContext =
  z.infer<
    typeof ArrivalContextSchema
  >;
