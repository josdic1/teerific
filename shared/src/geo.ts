import { z } from "zod";

export const LatitudeSchema = z.number().min(-90).max(90);
export const LongitudeSchema = z.number().min(-180).max(180);

export const CoordinateSchema = z.tuple([
  LongitudeSchema,
  LatitudeSchema
]);

export const GeoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: CoordinateSchema
}).strict();

const LinearRingSchema = z.array(CoordinateSchema).min(4);
const PolygonCoordinatesSchema = z.array(LinearRingSchema).min(1);

export const GeoPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: PolygonCoordinatesSchema
}).strict();

export const GeoMultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(PolygonCoordinatesSchema).min(1)
}).strict();

export const GeoAreaSchema = z.union([
  GeoPolygonSchema,
  GeoMultiPolygonSchema
]);

export type GeoPoint = z.infer<typeof GeoPointSchema>;
export type GeoArea = z.infer<typeof GeoAreaSchema>;
