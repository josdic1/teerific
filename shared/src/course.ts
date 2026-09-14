import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.js";
import { GeoAreaSchema, GeoPointSchema } from "./geo.js";

export const CourseSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  countryCode: z.string().length(2),
  timezone: z.string().trim().min(1).max(100),
  boundary: GeoAreaSchema.nullable(),
  active: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
}).strict();

export const HoleSchema = z.object({
  id: IdSchema,
  courseId: IdSchema,
  holeNumber: z.number().int().positive(),
  par: z.number().int().min(1).max(7).nullable(),
  yardage: z.number().int().positive().nullable(),
  boundary: GeoAreaSchema.nullable(),
  teeLocation: GeoPointSchema.nullable(),
  greenLocation: GeoPointSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
}).strict();

export type Course = z.infer<typeof CourseSchema>;
export type Hole = z.infer<typeof HoleSchema>;
