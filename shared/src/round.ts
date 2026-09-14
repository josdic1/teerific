import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.js";
import {
  LatitudeSchema,
  LongitudeSchema
} from "./geo.js";

export const CourseDetectionMethodSchema = z.enum([
  "automatic",
  "manual"
]);

export const RoundEndReasonSchema = z.enum([
  "completed",
  "abandoned"
]);

export const DestinationSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  label: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(500),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  isDefault: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
}).strict();

export const RoundSchema = z.object({
  id: IdSchema,
  golferUserId: IdSchema,
  courseId: IdSchema,
  destinationId: IdSchema.nullable(),
  courseDetectionMethod: CourseDetectionMethodSchema,
  startedAt: IsoDateTimeSchema,
  endedAt: IsoDateTimeSchema.nullable(),
  endedReason: RoundEndReasonSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
}).strict();

export const HoleVisitSchema = z.object({
  id: IdSchema,
  roundId: IdSchema,
  holeId: IdSchema,
  enteredAt: IsoDateTimeSchema,
  exitedAt: IsoDateTimeSchema.nullable(),
  detectedAutomatically: z.boolean()
}).strict();

export type Destination = z.infer<typeof DestinationSchema>;
export type Round = z.infer<typeof RoundSchema>;
export type HoleVisit = z.infer<typeof HoleVisitSchema>;
