import type {
  ResolvedArrivalOrigin
} from "@teerific/shared";
import {
  GeoPointSchema,
  ResolvedArrivalOriginSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type CourseDepartureRow = {
  id: string;
  name: string;
  departure_location_geojson:
    unknown | null;
};

export async function resolveArrivalOrigin(
  courseId: string,
  db: DbExecutor = pool
): Promise<
  ResolvedArrivalOrigin | null
> {
  const result =
    await db.query<CourseDepartureRow>(
      `
        SELECT
          id,
          name,
          departure_location_geojson

        FROM courses

        WHERE id = $1

        LIMIT 1
      `,
      [courseId]
    );

  const row =
    result.rows[0];

  if (
    !row ||
    row.departure_location_geojson ===
      null
  ) {
    return null;
  }

  /*
   * Fail loudly if stored geographic truth is
   * malformed rather than silently routing from
   * a made-up location.
   */
  const point =
    GeoPointSchema.parse(
      row.departure_location_geojson
    );

  const [
    longitude,
    latitude
  ] =
    point.coordinates;

  return ResolvedArrivalOriginSchema.parse({
    source:
      "course_departure_location",

    courseId:
      row.id,

    courseName:
      row.name,

    latitude,

    longitude
  });
}
