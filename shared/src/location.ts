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
    detectedHoleId: IdSchema.nullable()
  }).strict();

export type LocationUpdateInput =
  z.infer<typeof LocationUpdateInputSchema>;

export type LocationSample =
  z.infer<typeof LocationSampleSchema>;
