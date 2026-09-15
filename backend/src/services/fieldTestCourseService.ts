import type {
  Course,
  CreateFieldTestCourseInput,
  CurrentUser,
  GeoArea,
  GeoPoint,
  Hole
} from "@teerific/shared";

import {
  audit
} from "../audit/audit.js";

import {
  withTransaction
} from "../db/transaction.js";

import {
  createCourse,
  createHole
} from "../repositories/courseRepository.js";

const EARTH_RADIUS_METERS =
  6_371_000;

const HOLE_RADIUS_METERS =
  18;

const MIN_HOLE_CENTER_DISTANCE_METERS =
  45;

const COURSE_PADDING_METERS =
  35;

const CIRCLE_SEGMENTS =
  24;

type Coordinate =
  GeoPoint["coordinates"];

function degreesToRadians(
  degrees: number
): number {
  return degrees *
    Math.PI /
    180;
}

function distanceMeters(
  first: GeoPoint,
  second: GeoPoint
): number {
  const [
    firstLongitude,
    firstLatitude
  ] =
    first.coordinates;

  const [
    secondLongitude,
    secondLatitude
  ] =
    second.coordinates;

  const latitudeDelta =
    degreesToRadians(
      secondLatitude -
      firstLatitude
    );

  const longitudeDelta =
    degreesToRadians(
      secondLongitude -
      firstLongitude
    );

  const firstLatitudeRadians =
    degreesToRadians(
      firstLatitude
    );

  const secondLatitudeRadians =
    degreesToRadians(
      secondLatitude
    );

  const a =
    Math.sin(
      latitudeDelta / 2
    ) ** 2 +
    Math.cos(
      firstLatitudeRadians
    ) *
    Math.cos(
      secondLatitudeRadians
    ) *
    Math.sin(
      longitudeDelta / 2
    ) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.asin(
      Math.sqrt(a)
    )
  );
}

function circularBoundary(
  point: GeoPoint
): GeoArea {
  const [
    longitude,
    latitude
  ] =
    point.coordinates;

  const latitudeRadians =
    degreesToRadians(
      latitude
    );

  const latitudeDegreesPerMeter =
    1 / 111_320;

  const longitudeDegreesPerMeter =
    1 /
    (
      111_320 *
      Math.max(
        Math.cos(
          latitudeRadians
        ),
        0.000001
      )
    );

  const ring:
    Coordinate[] =
    [];

  for (
    let index = 0;
    index <=
      CIRCLE_SEGMENTS;
    index += 1
  ) {
    const angle =
      (
        index /
        CIRCLE_SEGMENTS
      ) *
      Math.PI *
      2;

    ring.push([
      longitude +
        Math.cos(angle) *
        HOLE_RADIUS_METERS *
        longitudeDegreesPerMeter,

      latitude +
        Math.sin(angle) *
        HOLE_RADIUS_METERS *
        latitudeDegreesPerMeter
    ]);
  }

  return {
    type:
      "Polygon",

    coordinates: [
      ring
    ]
  };
}

function courseBoundary(
  points:
    GeoPoint[]
): GeoArea {
  const coordinates =
    points.map(
      point =>
        point.coordinates
    );

  const latitudes =
    coordinates.map(
      coordinate =>
        coordinate[1]
    );

  const longitudes =
    coordinates.map(
      coordinate =>
        coordinate[0]
    );

  const averageLatitude =
    latitudes.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    latitudes.length;

  const latitudePadding =
    COURSE_PADDING_METERS /
    111_320;

  const longitudePadding =
    COURSE_PADDING_METERS /
    (
      111_320 *
      Math.max(
        Math.cos(
          degreesToRadians(
            averageLatitude
          )
        ),
        0.000001
      )
    );

  const minimumLatitude =
    Math.min(
      ...latitudes
    ) -
    latitudePadding;

  const maximumLatitude =
    Math.max(
      ...latitudes
    ) +
    latitudePadding;

  const minimumLongitude =
    Math.min(
      ...longitudes
    ) -
    longitudePadding;

  const maximumLongitude =
    Math.max(
      ...longitudes
    ) +
    longitudePadding;

  const ring:
    Coordinate[] =
    [
      [
        minimumLongitude,
        minimumLatitude
      ],
      [
        maximumLongitude,
        minimumLatitude
      ],
      [
        maximumLongitude,
        maximumLatitude
      ],
      [
        minimumLongitude,
        maximumLatitude
      ],
      [
        minimumLongitude,
        minimumLatitude
      ]
    ];

  return {
    type:
      "Polygon",

    coordinates: [
      ring
    ]
  };
}

export type FieldTestCourseCreationResult =
  | {
      type:
        "created";

      course:
        Course;

      holes:
        Hole[];
    }
  | {
      type:
        "holes_too_close";

      firstHoleNumber:
        number;

      secondHoleNumber:
        number;

      distanceMeters:
        number;

      minimumMeters:
        number;
    };

export async function createFieldTestCourse(
  input:
    CreateFieldTestCourseInput,

  actor:
    CurrentUser
): Promise<
  FieldTestCourseCreationResult
> {
  const holes =
    [...input.holes]
      .sort(
        (
          first,
          second
        ) =>
          first.holeNumber -
          second.holeNumber
      );

  for (
    let firstIndex = 0;
    firstIndex <
      holes.length;
    firstIndex += 1
  ) {
    const first =
      holes[firstIndex];

    if (!first) {
      continue;
    }

    for (
      let secondIndex =
        firstIndex + 1;

      secondIndex <
        holes.length;

      secondIndex += 1
    ) {
      const second =
        holes[
          secondIndex
        ];

      if (!second) {
        continue;
      }

      const distance =
        distanceMeters(
          first.location,
          second.location
        );

      if (
        distance <
        MIN_HOLE_CENTER_DISTANCE_METERS
      ) {
        return {
          type:
            "holes_too_close",

          firstHoleNumber:
            first.holeNumber,

          secondHoleNumber:
            second.holeNumber,

          distanceMeters:
            Math.round(
              distance * 10
            ) / 10,

          minimumMeters:
            MIN_HOLE_CENTER_DISTANCE_METERS
        };
      }
    }
  }

  return withTransaction(
    async client => {
      const boundary =
        courseBoundary([
          input.departureLocation,
          ...holes.map(
            hole =>
              hole.location
          )
        ]);

      const course =
        await createCourse(
          {
            name:
              input.name,

            address:
              input.address,

            city:
              input.city,

            region:
              input.region,

            countryCode:
              input.countryCode,

            timezone:
              input.timezone,

            boundary,

            departureLocation:
              input.departureLocation,

            active:
              true
          },
          client
        );

      await audit(
        {
          actor,

          action:
            "course.created",

          targetType:
            "course",

          targetId:
            course.id,

          targetSnapshot: {
            ...course
          },

          metadata: {
            source:
              "field_test_mapper",

            holeRadiusMeters:
              HOLE_RADIUS_METERS
          }
        },
        client
      );

      const createdHoles:
        Hole[] =
        [];

      for (
        const holePoint
        of holes
      ) {
        const hole =
          await createHole(
            course.id,
            {
              holeNumber:
                holePoint.holeNumber,

              par:
                4,

              boundary:
                circularBoundary(
                  holePoint.location
                )
            },
            client
          );

        if (!hole) {
          throw new Error(
            "Created field-test course disappeared during transaction"
          );
        }

        createdHoles.push(
          hole
        );

        await audit(
          {
            actor,

            action:
              "hole.created",

            targetType:
              "hole",

            targetId:
              hole.id,

            targetSnapshot: {
              ...hole
            },

            metadata: {
              source:
                "field_test_mapper",

              fieldTestCenter:
                holePoint.location,

              radiusMeters:
                HOLE_RADIUS_METERS
            }
          },
          client
        );
      }

      return {
        type:
          "created",

        course,

        holes:
          createdHoles
      } as const;
    }
  );
}
