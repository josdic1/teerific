import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.js";
import { GeoAreaSchema, GeoPointSchema } from "./geo.js";

const CourseNameSchema =
  z.string().trim().min(1).max(200);

const AddressSchema =
  z.string().trim().min(1).max(500);

const PlaceNameSchema =
  z.string().trim().min(1).max(100);

const CountryCodeSchema =
  z.string().trim().length(2).transform(
    value => value.toUpperCase()
  );

const TimezoneSchema =
  z.string().trim().min(1).max(100);

export const CourseSchema = z.object({
  id: IdSchema,
  name: CourseNameSchema,
  slug: z.string().trim().min(1).max(200),
  address: AddressSchema,
  city: PlaceNameSchema,
  region: PlaceNameSchema,
  countryCode: z.string().length(2),
  timezone: TimezoneSchema,
  boundary: GeoAreaSchema.nullable(),
  active: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
})
.strict()
.refine(
  course => !course.active || course.boundary !== null,
  {
    message: "Active courses require a geographic boundary",
    path: ["boundary"]
  }
);

const CourseInputBaseSchema = z.object({
  name: CourseNameSchema,
  address: AddressSchema,
  city: PlaceNameSchema,
  region: PlaceNameSchema,
  countryCode: CountryCodeSchema,
  timezone: TimezoneSchema,
  boundary: GeoAreaSchema.nullable().optional(),
  active: z.boolean().optional()
}).strict();

export const CreateCourseInputSchema =
  CourseInputBaseSchema.refine(
    course =>
      course.active !== true ||
      (course.boundary !== undefined && course.boundary !== null),
    {
      message: "Active courses require a geographic boundary",
      path: ["boundary"]
    }
  );

export const UpdateCourseInputSchema =
  CourseInputBaseSchema
    .partial()
    .refine(
      value => Object.keys(value).length > 0,
      {
        message: "At least one course field must be provided"
      }
    );

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

export const CreateHoleInputSchema = z.object({
  holeNumber: z.number().int().positive(),
  par: z.number().int().min(1).max(7).nullable().optional(),
  yardage: z.number().int().positive().nullable().optional(),
  boundary: GeoAreaSchema.nullable().optional(),
  teeLocation: GeoPointSchema.nullable().optional(),
  greenLocation: GeoPointSchema.nullable().optional()
}).strict();

export const UpdateHoleInputSchema =
  CreateHoleInputSchema
    .partial()
    .strict()
    .refine(
      value => Object.keys(value).length > 0,
      {
        message: "At least one hole field must be provided"
      }
    );

export type Course =
  z.infer<typeof CourseSchema>;

export type CreateCourseInput =
  z.infer<typeof CreateCourseInputSchema>;

export type UpdateCourseInput =
  z.infer<typeof UpdateCourseInputSchema>;

export type Hole =
  z.infer<typeof HoleSchema>;

export type CreateHoleInput =
  z.infer<typeof CreateHoleInputSchema>;

export type UpdateHoleInput =
  z.infer<typeof UpdateHoleInputSchema>;
