import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema
} from "./common.js";
import {
  LatitudeSchema,
  LongitudeSchema
} from "./geo.js";

export const LocationUpdateInputSchema = z.object({
  sampleId: IdSchema,
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  accuracyMeters: z.number().nonnegative().nullable(),
  altitudeMeters: z.number().nullable(),
  speedMetersPerSecond: z.number().nonnegative().nullable(),
  headingDegrees: z.number().min(0).max(360).nullable(),
  recordedAt: IsoDateTimeSchema
}).strict();

export const LocationSampleSchema =
  LocationUpdateInputSchema.extend({
    id: IdSchema,
    roundId: IdSchema,
    detectedHoleId: IdSchema.nullable(),
    receivedAt: IsoDateTimeSchema
  }).strict();

export const LocationSampleRejectionReasonSchema =
  z.enum([
    "duplicate_sample_id",
    "duplicate_recorded_at",
    "too_old",
    "future_dated"
  ]);

export const LocationSampleWriteResultSchema =
  z.discriminatedUnion(
    "outcome",
    [
      z.object({
        outcome: z.literal("recorded"),
        sample: LocationSampleSchema
      }).strict(),

      z.object({
        outcome: z.literal("duplicate"),
        reason:
          LocationSampleRejectionReasonSchema
            .extract([
              "duplicate_sample_id",
              "duplicate_recorded_at"
            ]),
        sample: LocationSampleSchema
      }).strict(),

      z.object({
        outcome: z.literal("stale"),
        reason:
          LocationSampleRejectionReasonSchema
            .extract([
              "too_old",
              "future_dated"
            ]),
        sample: z.null()
      }).strict()
    ]
  );

export type LocationUpdateInput =
  z.infer<typeof LocationUpdateInputSchema>;

export type LocationSample =
  z.infer<typeof LocationSampleSchema>;

export type LocationSampleRejectionReason =
  z.infer<
    typeof LocationSampleRejectionReasonSchema
  >;

export type LocationSampleWriteResult =
  z.infer<
    typeof LocationSampleWriteResultSchema
  >;
