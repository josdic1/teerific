import type {
  CourseDetectionInput,
  CourseDetectionResult
} from "@teerific/shared";
import {
  CourseDetectionResultSchema
} from "@teerific/shared";
import {
  areaContainsPoint
} from "../geo/containsPoint.js";
import {
  isDeepStrictEqual
} from "node:util";
import type {
  Course,
  CreateCourseInput,
  CreateHoleInput,
  Hole,
  UpdateCourseInput,
  UpdateHoleInput
} from "@teerific/shared";
import {
  CourseSchema,
  HoleSchema
} from "@teerific/shared";
import { pool } from "../db/pool.js";
import type {
  DbExecutor
} from "../db/transaction.js";

type CourseRow = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  region: string;
  country_code: string;
  timezone: string;
  boundary_geojson: unknown | null;
  departure_location_geojson:
    unknown | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

type HoleRow = {
  id: string;
  course_id: string;
  hole_number: number;
  par: number | null;
  yardage: number | null;
  boundary_geojson: unknown | null;
  tee_location_geojson: unknown | null;
  green_location_geojson: unknown | null;
  created_at: Date;
  updated_at: Date;
};

export type UpdateResult<T> =
  | {
      found: false;
      changed: false;
      value: null;
    }
  | {
      found: true;
      changed: boolean;
      value: T;
    };

function toCourse(
  row: CourseRow
): Course {
  return CourseSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    city: row.city,
    region:
      row.region,
    countryCode:
      row.country_code.trim(),
    timezone:
      row.timezone,
    boundary:
      row.boundary_geojson,

    departureLocation:
      row.departure_location_geojson,

    active:
      row.active,
    createdAt:
      row.created_at.toISOString(),
    updatedAt:
      row.updated_at.toISOString()
  });
}

function toHole(
  row: HoleRow
): Hole {
  return HoleSchema.parse({
    id:
      row.id,
    courseId:
      row.course_id,
    holeNumber:
      row.hole_number,
    par:
      row.par,
    yardage:
      row.yardage,
    boundary:
      row.boundary_geojson,
    teeLocation:
      row.tee_location_geojson,
    greenLocation:
      row.green_location_geojson,
    createdAt:
      row.created_at.toISOString(),
    updatedAt:
      row.updated_at.toISOString()
  });
}

function slugBase(
  name: string
): string {
  const base =
    name
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(0, 180);

  return base || "course";
}

async function chooseSlug(
  name: string,
  db: DbExecutor
): Promise<string> {
  const base =
    slugBase(name);

  for (
    let suffix = 1;
    suffix <= 10_000;
    suffix += 1
  ) {
    const candidate =
      suffix === 1
        ? base
        : `${base}-${suffix}`;

    const result =
      await db.query<{
        exists: boolean;
      }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM courses
            WHERE slug = $1
          ) AS exists
        `,
        [candidate]
      );

    if (
      !result.rows[0]?.exists
    ) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to generate unique course slug"
  );
}

const COURSE_COLUMNS = `
  id,
  name,
  slug,
  address,
  city,
  region,
  country_code,
  timezone,
  boundary_geojson,
  departure_location_geojson,
  active,
  created_at,
  updated_at
`;

const HOLE_COLUMNS = `
  id,
  course_id,
  hole_number,
  par,
  yardage,
  boundary_geojson,
  tee_location_geojson,
  green_location_geojson,
  created_at,
  updated_at
`;

export async function listCourses(
  includeInactive = false
): Promise<Course[]> {
  const result =
    await pool.query<CourseRow>(
      `
        SELECT
          ${COURSE_COLUMNS}
        FROM courses
        WHERE
          $1::boolean
          OR active = true
        ORDER BY
          name,
          id
      `,
      [
        includeInactive
      ]
    );

  return result.rows.map(
    toCourse
  );
}

export async function getCourse(
  courseId: string,
  includeInactive = false,
  db: DbExecutor = pool
): Promise<Course | null> {
  const result =
    await db.query<CourseRow>(
      `
        SELECT
          ${COURSE_COLUMNS}
        FROM courses
        WHERE
          id = $1
          AND (
            $2::boolean
            OR active = true
          )
        LIMIT 1
      `,
      [
        courseId,
        includeInactive
      ]
    );

  const row =
    result.rows[0];

  return row
    ? toCourse(row)
    : null;
}

export async function createCourse(
  input: CreateCourseInput,
  db: DbExecutor
): Promise<Course> {
  const slug =
    await chooseSlug(
      input.name,
      db
    );

  const boundary =
    input.boundary == null
      ? null
      : JSON.stringify(
          input.boundary
        );

  const departureLocation =
    input.departureLocation == null
      ? null
      : JSON.stringify(
          input.departureLocation
        );

  const result =
    await db.query<CourseRow>(
      `
        INSERT INTO courses (
          name,
          slug,
          address,
          city,
          region,
          country_code,
          timezone,
          boundary_geojson,
          departure_location_geojson,
          active
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          $9::jsonb,
          $10
        )
        RETURNING
          ${COURSE_COLUMNS}
      `,
      [
        input.name,
        slug,
        input.address,
        input.city,
        input.region,
        input.countryCode,
        input.timezone,
        boundary,
        departureLocation,
        input.active ?? false
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Course insert returned no row"
    );
  }

  return toCourse(row);
}

export async function updateCourse(
  courseId: string,
  input: UpdateCourseInput,
  db: DbExecutor
): Promise<
  UpdateResult<Course>
> {
  const locked =
    await db.query<CourseRow>(
      `
        SELECT
          ${COURSE_COLUMNS}
        FROM courses
        WHERE id = $1
        FOR UPDATE
      `,
      [courseId]
    );

  const oldRow =
    locked.rows[0];

  if (!oldRow) {
    return {
      found: false,
      changed: false,
      value: null
    };
  }

  const current =
    toCourse(oldRow);

  const changed =
    (input.name !== undefined &&
      input.name !==
        current.name) ||

    (input.address !== undefined &&
      input.address !==
        current.address) ||

    (input.city !== undefined &&
      input.city !==
        current.city) ||

    (input.region !== undefined &&
      input.region !==
        current.region) ||

    (input.countryCode !== undefined &&
      input.countryCode !==
        current.countryCode) ||

    (input.timezone !== undefined &&
      input.timezone !==
        current.timezone) ||

    (
      input.boundary !== undefined &&
      !isDeepStrictEqual(
        input.boundary,
        current.boundary
      )
    ) ||

    (
      input.departureLocation !==
        undefined &&
      !isDeepStrictEqual(
        input.departureLocation,
        current.departureLocation
      )
    ) ||

    (input.active !== undefined &&
      input.active !==
        current.active);

  if (!changed) {
    return {
      found: true,
      changed: false,
      value: current
    };
  }

  const sets: string[] = [];
  const values: unknown[] = [
    courseId
  ];

  function set(
    sql: string,
    value: unknown
  ): void {
    values.push(value);

    sets.push(
      `${sql} = $${values.length}`
    );
  }

  if (
    input.name !== undefined
  ) {
    set(
      "name",
      input.name
    );
  }

  if (
    input.address !== undefined
  ) {
    set(
      "address",
      input.address
    );
  }

  if (
    input.city !== undefined
  ) {
    set(
      "city",
      input.city
    );
  }

  if (
    input.region !== undefined
  ) {
    set(
      "region",
      input.region
    );
  }

  if (
    input.countryCode !== undefined
  ) {
    set(
      "country_code",
      input.countryCode
    );
  }

  if (
    input.timezone !== undefined
  ) {
    set(
      "timezone",
      input.timezone
    );
  }

  if (
    input.boundary !== undefined
  ) {
    values.push(
      input.boundary === null
        ? null
        : JSON.stringify(
            input.boundary
          )
    );

    sets.push(
      `boundary_geojson = $${values.length}::jsonb`
    );
  }

  if (
    input.departureLocation !==
      undefined
  ) {
    values.push(
      input.departureLocation === null
        ? null
        : JSON.stringify(
            input.departureLocation
          )
    );

    sets.push(
      `departure_location_geojson = $${values.length}::jsonb`
    );
  }

  if (
    input.active !== undefined
  ) {
    set(
      "active",
      input.active
    );
  }

  sets.push(
    "updated_at = now()"
  );

  const result =
    await db.query<CourseRow>(
      `
        UPDATE courses
        SET
          ${sets.join(",\n          ")}
        WHERE id = $1
        RETURNING
          ${COURSE_COLUMNS}
      `,
      values as any[]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Course update returned no row"
    );
  }

  return {
    found: true,
    changed: true,
    value:
      toCourse(row)
  };
}

export async function listCourseHoles(
  courseId: string,
  includeInactiveCourse = false
): Promise<Hole[] | null> {
  const course =
    await getCourse(
      courseId,
      includeInactiveCourse
    );

  if (!course) {
    return null;
  }

  const result =
    await pool.query<HoleRow>(
      `
        SELECT
          ${HOLE_COLUMNS}
        FROM holes
        WHERE course_id = $1
        ORDER BY
          hole_number
      `,
      [courseId]
    );

  return result.rows.map(
    toHole
  );
}

export async function createHole(
  courseId: string,
  input: CreateHoleInput,
  db: DbExecutor
): Promise<Hole | null> {
  const course =
    await getCourse(
      courseId,
      true,
      db
    );

  if (!course) {
    return null;
  }

  const result =
    await db.query<HoleRow>(
      `
        INSERT INTO holes (
          course_id,
          hole_number,
          par,
          yardage,
          boundary_geojson,
          tee_location_geojson,
          green_location_geojson
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb
        )
        RETURNING
          ${HOLE_COLUMNS}
      `,
      [
        courseId,
        input.holeNumber,
        input.par ?? null,
        input.yardage ?? null,

        input.boundary == null
          ? null
          : JSON.stringify(
              input.boundary
            ),

        input.teeLocation == null
          ? null
          : JSON.stringify(
              input.teeLocation
            ),

        input.greenLocation == null
          ? null
          : JSON.stringify(
              input.greenLocation
            )
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Hole insert returned no row"
    );
  }

  return toHole(row);
}

export async function updateHole(
  courseId: string,
  holeId: string,
  input: UpdateHoleInput,
  db: DbExecutor
): Promise<
  UpdateResult<Hole>
> {
  const locked =
    await db.query<HoleRow>(
      `
        SELECT
          ${HOLE_COLUMNS}
        FROM holes
        WHERE
          id = $1
          AND course_id = $2
        FOR UPDATE
      `,
      [
        holeId,
        courseId
      ]
    );

  const oldRow =
    locked.rows[0];

  if (!oldRow) {
    return {
      found: false,
      changed: false,
      value: null
    };
  }

  const current =
    toHole(oldRow);

  const changed =
    (
      input.holeNumber !== undefined &&
      input.holeNumber !==
        current.holeNumber
    ) ||

    (
      input.par !== undefined &&
      input.par !==
        current.par
    ) ||

    (
      input.yardage !== undefined &&
      input.yardage !==
        current.yardage
    ) ||

    (
      input.boundary !== undefined &&
      !isDeepStrictEqual(
        input.boundary,
        current.boundary
      )
    ) ||

    (
      input.teeLocation !== undefined &&
      !isDeepStrictEqual(
        input.teeLocation,
        current.teeLocation
      )
    ) ||

    (
      input.greenLocation !== undefined &&
      !isDeepStrictEqual(
        input.greenLocation,
        current.greenLocation
      )
    );

  if (!changed) {
    return {
      found: true,
      changed: false,
      value: current
    };
  }

  const sets: string[] = [];
  const values: unknown[] = [
    holeId,
    courseId
  ];

  function set(
    sql: string,
    value: unknown
  ): void {
    values.push(value);

    sets.push(
      `${sql} = $${values.length}`
    );
  }

  if (
    input.holeNumber !== undefined
  ) {
    set(
      "hole_number",
      input.holeNumber
    );
  }

  if (
    input.par !== undefined
  ) {
    set(
      "par",
      input.par
    );
  }

  if (
    input.yardage !== undefined
  ) {
    set(
      "yardage",
      input.yardage
    );
  }

  for (
    const [
      key,
      column
    ] of [
      [
        "boundary",
        "boundary_geojson"
      ],
      [
        "teeLocation",
        "tee_location_geojson"
      ],
      [
        "greenLocation",
        "green_location_geojson"
      ]
    ] as const
  ) {
    const value =
      input[key];

    if (
      value !== undefined
    ) {
      values.push(
        value === null
          ? null
          : JSON.stringify(value)
      );

      sets.push(
        `${column} = $${values.length}::jsonb`
      );
    }
  }

  sets.push(
    "updated_at = now()"
  );

  const result =
    await db.query<HoleRow>(
      `
        UPDATE holes
        SET
          ${sets.join(",\n          ")}
        WHERE
          id = $1
          AND course_id = $2
        RETURNING
          ${HOLE_COLUMNS}
      `,
      values as any[]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Hole update returned no row"
    );
  }

  return {
    found: true,
    changed: true,
    value:
      toHole(row)
  };
}


export async function detectCourseAtPoint(
  input: CourseDetectionInput,
  db: DbExecutor = pool
): Promise<CourseDetectionResult> {
  const result =
    await db.query<CourseRow>(
      `
        SELECT
          id,
          name,
          slug,
          address,
          city,
          region,
          country_code,
          timezone,
          boundary_geojson,
          departure_location_geojson,
          active,
          created_at,
          updated_at

        FROM courses

        WHERE
          active = TRUE
          AND boundary_geojson
            IS NOT NULL

        ORDER BY
          name,
          id
      `
    );

  const matches =
    result.rows
      .map(toCourse)
      .filter(course => {
        /*
         * CourseSchema + DB invariant say an
         * active course must have a boundary.
         *
         * If that invariant is ever broken,
         * fail loudly rather than silently
         * returning a false no-match.
         */
        if (!course.boundary) {
          throw new Error(
            `Active course ${course.id} has no boundary`
          );
        }

        return areaContainsPoint(
          course.boundary,
          input.longitude,
          input.latitude
        );
      });

  if (matches.length === 0) {
    return CourseDetectionResultSchema.parse({
      status:
        "no_match",

      course:
        null,

      candidates:
        []
    });
  }

  if (matches.length === 1) {
    const course =
      matches[0];

    if (!course) {
      throw new Error(
        "Matched course disappeared"
      );
    }

    return CourseDetectionResultSchema.parse({
      status:
        "matched",

      course,

      candidates:
        [course]
    });
  }

  return CourseDetectionResultSchema.parse({
    status:
      "ambiguous",

    course:
      null,

    candidates:
      matches
  });
}
