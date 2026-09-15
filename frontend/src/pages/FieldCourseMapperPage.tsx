import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AuthResponseSchema,
  CreateFieldTestCourseInputSchema,
  type GeoPoint,
} from "@teerific/shared";

import {
  API_BASE,
} from "../lib/api";

import {
  getGolferCurrentPosition,
  watchGolferPosition,
} from "../lib/golferGeolocation";

type CapturedPoint = {
  point:
    GeoPoint;

  accuracyMeters:
    number | null;

  recordedAt:
    string;
};

type FieldMapperDraft = {
  name:
    string;

  address:
    string;

  city:
    string;

  region:
    string;

  departure:
    CapturedPoint | null;

  holes:
    Array<
      CapturedPoint | null
    >;
};

const FIELD_MAPPER_DRAFT_KEY =
  "teerific.field-course-draft.v1";

function isCapturedPoint(
  value: unknown,
): value is CapturedPoint {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as {
      point?: unknown;
      accuracyMeters?: unknown;
      recordedAt?: unknown;
    };

  if (
    typeof candidate.recordedAt !==
    "string"
  ) {
    return false;
  }

  if (
    candidate.accuracyMeters !==
      null &&
    typeof candidate.accuracyMeters !==
      "number"
  ) {
    return false;
  }

  if (
    typeof candidate.point !==
      "object" ||
    candidate.point ===
      null
  ) {
    return false;
  }

  const point =
    candidate.point as {
      type?: unknown;
      coordinates?: unknown;
    };

  return (
    point.type ===
      "Point" &&
    Array.isArray(
      point.coordinates,
    ) &&
    point.coordinates.length ===
      2 &&
    point.coordinates.every(
      coordinate =>
        typeof coordinate ===
          "number" &&
        Number.isFinite(
          coordinate,
        ),
    )
  );
}

function readFieldMapperDraft():
FieldMapperDraft | null {
  try {
    const raw =
      window.localStorage
        .getItem(
          FIELD_MAPPER_DRAFT_KEY,
        );

    if (!raw) {
      return null;
    }

    const value =
      JSON.parse(
        raw,
      ) as {
        name?: unknown;
        address?: unknown;
        city?: unknown;
        region?: unknown;
        departure?: unknown;
        holes?: unknown;
      };

    if (
      typeof value.name !==
        "string" ||
      typeof value.address !==
        "string" ||
      typeof value.city !==
        "string" ||
      typeof value.region !==
        "string" ||
      !Array.isArray(
        value.holes,
      ) ||
      value.holes.length !==
        18
    ) {
      return null;
    }

    if (
      value.departure !==
        null &&
      !isCapturedPoint(
        value.departure,
      )
    ) {
      return null;
    }

    if (
      !value.holes.every(
        hole =>
          hole ===
            null ||
          isCapturedPoint(
            hole,
          ),
      )
    ) {
      return null;
    }

    return {
      name:
        value.name,

      address:
        value.address,

      city:
        value.city,

      region:
        value.region,

      departure:
        value.departure as
          CapturedPoint | null,

      holes:
        value.holes as
          Array<
            CapturedPoint | null
          >,
    };
  } catch {
    return null;
  }
}

const METERS_TO_YARDS =
  1.0936133;

function degreesToRadians(
  degrees: number,
): number {
  return degrees *
    Math.PI /
    180;
}

function distanceMeters(
  first: GeoPoint,
  second: GeoPoint,
): number {
  const [
    firstLongitude,
    firstLatitude,
  ] =
    first.coordinates;

  const [
    secondLongitude,
    secondLatitude,
  ] =
    second.coordinates;

  const earthRadiusMeters =
    6_371_000;

  const latitudeDelta =
    degreesToRadians(
      secondLatitude -
        firstLatitude,
    );

  const longitudeDelta =
    degreesToRadians(
      secondLongitude -
        firstLongitude,
    );

  const firstLatitudeRadians =
    degreesToRadians(
      firstLatitude,
    );

  const secondLatitudeRadians =
    degreesToRadians(
      secondLatitude,
    );

  const a =
    Math.sin(
      latitudeDelta / 2,
    ) ** 2 +
    Math.cos(
      firstLatitudeRadians,
    ) *
    Math.cos(
      secondLatitudeRadians,
    ) *
    Math.sin(
      longitudeDelta / 2,
    ) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.asin(
      Math.sqrt(a),
    )
  );
}

function toGeoPoint(
  latitude: number,
  longitude: number,
): GeoPoint {
  return {
    type:
      "Point",

    coordinates: [
      longitude,
      latitude,
    ],
  };
}

async function readApiError(
  response: Response,
): Promise<string> {
  try {
    const body =
      await response.json() as {
        error?: unknown;
        firstHoleNumber?: unknown;
        secondHoleNumber?: unknown;
        distanceMeters?: unknown;
        minimumMeters?: unknown;
      };

    if (
      body.error ===
      "FIELD_TEST_HOLES_TOO_CLOSE"
    ) {
      return `Hole ${body.firstHoleNumber} and Hole ${body.secondHoleNumber} are only ${body.distanceMeters}m apart. Minimum is ${body.minimumMeters}m.`;
    }

    if (
      typeof body.error ===
      "string"
    ) {
      return body.error;
    }
  } catch {
    // Fall through.
  }

  return `Request failed (${response.status}).`;
}

export default function FieldCourseMapperPage() {
  const initialDraft =
    useMemo(
      () =>
        readFieldMapperDraft(),
      [],
    );

  const [
    authorized,
    setAuthorized,
  ] = useState<
    boolean | null
  >(null);

  const [
    name,
    setName,
  ] = useState(
    initialDraft?.name ??
      "Teerific Park Test Course",
  );

  const [
    address,
    setAddress,
  ] = useState(
    initialDraft?.address ??
      "",
  );

  const [
    city,
    setCity,
  ] = useState(
    initialDraft?.city ??
      "",
  );

  const [
    region,
    setRegion,
  ] = useState(
    initialDraft?.region ??
      "NJ",
  );

  const countryCode =
    "US";

  const timezone =
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone ||
    "America/New_York";

  const [
    departure,
    setDeparture,
  ] = useState<
    CapturedPoint | null
  >(
    initialDraft
      ?.departure ??
      null,
  );

  const [
    liveLocation,
    setLiveLocation,
  ] = useState<
    CapturedPoint | null
  >(null);

  const [
    holes,
    setHoles,
  ] = useState<
    Array<
      CapturedPoint | null
    >
  >(
    initialDraft
      ?.holes ??
      Array.from(
        {
          length: 18,
        },
        () => null,
      ),
  );

  const [
    capturing,
    setCapturing,
  ] = useState<
    string | null
  >(null);

  const [
    saving,
    setSaving,
  ] = useState(
    false,
  );

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    createdCourse,
    setCreatedCourse,
  ] = useState<{
    id:
      string;

    name:
      string;
  } | null>(
    null,
  );

  useEffect(
    () => {
      let cancelled =
        false;

      async function checkAdmin() {
        try {
          const response =
            await fetch(
              `${API_BASE}/api/auth/me`,
              {
                credentials:
                  "include",
              },
            );

          if (
            !response.ok
          ) {
            if (
              !cancelled
            ) {
              setAuthorized(
                false,
              );
            }

            return;
          }

          const auth =
            AuthResponseSchema.parse(
              await response.json(),
            );

          if (
            !cancelled
          ) {
            setAuthorized(
              auth.user.isAdmin,
            );
          }
        } catch {
          if (
            !cancelled
          ) {
            setAuthorized(
              false,
            );
          }
        }
      }

      void checkAdmin();

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );

  useEffect(
    () => {
      const hasStartingPoint =
        departure !==
          null ||
        holes.some(
          Boolean,
        );

      if (
        !authorized ||
        !hasStartingPoint
      ) {
        return;
      }

      const stopWatching =
        watchGolferPosition(
          location => {
            setLiveLocation({
              point:
                toGeoPoint(
                  location.latitude,
                  location.longitude,
                ),

              accuracyMeters:
                location.accuracyMeters,

              recordedAt:
                location.recordedAt,
            });
          },

          () => {
            // Individual Record actions still surface
            // geolocation errors directly.
          },
        );

      return () => {
        stopWatching();
      };
    },
    [
      authorized,
      departure,
      holes,
    ],
  );

  useEffect(
    () => {
      const draft:
        FieldMapperDraft = {
          name,
          address,
          city,
          region,
          departure,
          holes,
        };

      try {
        window.localStorage
          .setItem(
            FIELD_MAPPER_DRAFT_KEY,
            JSON.stringify(
              draft,
            ),
          );
      } catch {
        // Mapping still works if local storage is unavailable.
      }
    },
    [
      name,
      address,
      city,
      region,
      departure,
      holes,
    ],
  );

  const completedHoleCount =
    useMemo(
      () =>
        holes.filter(
          Boolean,
        ).length,
      [
        holes,
      ],
    );

  const nextHoleNumber =
    holes.findIndex(
      point =>
        point === null,
    ) + 1;

  const previousPoint =
    nextHoleNumber === 1
      ? departure
      : nextHoleNumber > 1
        ? holes[
            nextHoleNumber -
              2
          ]
        : holes[17];

  const liveDistanceYards =
    previousPoint &&
    liveLocation
      ? Math.round(
          distanceMeters(
            previousPoint.point,
            liveLocation.point,
          ) *
            METERS_TO_YARDS,
        )
      : null;

  const spacingState =
    liveDistanceYards ===
    null
      ? null
      : liveDistanceYards <
          50
        ? "too-close"
        : liveDistanceYards <=
            100
          ? "ideal"
          : "far";

  async function capturePoint():
  Promise<CapturedPoint> {
    const location =
      await getGolferCurrentPosition();

    return {
      point:
        toGeoPoint(
          location.latitude,
          location.longitude,
        ),

      accuracyMeters:
        location.accuracyMeters,

      recordedAt:
        location.recordedAt,
    };
  }

  async function captureDeparture() {
    setCapturing(
      "departure",
    );

    setError(
      null,
    );

    try {
      setDeparture(
        await capturePoint(),
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to capture departure point.",
      );
    } finally {
      setCapturing(
        null,
      );
    }
  }

  async function captureHole(
    index:
      number,
  ) {
    setCapturing(
      `hole-${index + 1}`,
    );

    setError(
      null,
    );

    try {
      const point =
        await capturePoint();

      setHoles(
        current =>
          current.map(
            (
              existing,
              currentIndex,
            ) =>
              currentIndex ===
              index
                ? point
                : existing,
          ),
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to capture hole.",
      );
    } finally {
      setCapturing(
        null,
      );
    }
  }

  async function saveCourse() {
    if (
      !departure
    ) {
      setError(
        "Capture the departure point first.",
      );

      return;
    }

    if (
      holes.some(
        point =>
          point === null,
      )
    ) {
      setError(
        "Capture all 18 holes before creating the course.",
      );

      return;
    }

    setSaving(
      true,
    );

    setError(
      null,
    );

    try {
      const input =
        CreateFieldTestCourseInputSchema.parse({
          name,
          address,
          city,
          region,
          countryCode:
            countryCode.toUpperCase(),
          timezone,

          departureLocation:
            departure.point,

          holes:
            holes.map(
              (
                captured,
                index,
              ) => ({
                holeNumber:
                  index + 1,

                location:
                  captured!.point,
              }),
            ),
        });

      const response =
        await fetch(
          `${API_BASE}/api/courses/field-test`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                input,
              ),
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      const payload =
        await response.json() as {
          course?: {
            id?: unknown;
            name?: unknown;
          };
        };

      if (
        typeof payload.course
          ?.id !==
          "string" ||
        typeof payload.course
          ?.name !==
          "string"
      ) {
        throw new Error(
          "INVALID_FIELD_TEST_RESPONSE",
        );
      }

      try {
        window.localStorage
          .removeItem(
            FIELD_MAPPER_DRAFT_KEY,
          );
      } catch {
        // Course was created successfully regardless.
      }

      setCreatedCourse({
        id:
          payload.course.id,

        name:
          payload.course.name,
      });
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create field-test course.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  if (
    authorized ===
    null
  ) {
    return (
      <main className="field-mapper-page">
        <section className="field-mapper-card">
          <div className="brand">
            TEERIFIC
          </div>

          <p className="muted">
            Checking admin access…
          </p>
        </section>
      </main>
    );
  }

  if (
    !authorized
  ) {
    return (
      <main className="field-mapper-page">
        <section className="field-mapper-card">
          <div className="brand">
            TEERIFIC
          </div>

          <h1>
            Admin only
          </h1>

          <p className="muted">
            Field-course creation is restricted to Teerific admins.
          </p>
        </section>
      </main>
    );
  }

  if (
    createdCourse
  ) {
    return (
      <main className="field-mapper-page">
        <section className="field-mapper-card">
          <div className="brand">
            TEERIFIC
          </div>

          <div className="mapper-success">
            <div className="eyebrow">
              COURSE READY
            </div>

            <h1>
              {createdCourse.name}
            </h1>

            <p className="muted">
              All 18 test holes and the departure point were created atomically.
            </p>

            <a
              href="/golf"
              className="primary-button"
            >
              Go to golfer view
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="field-mapper-page">
      <section className="field-mapper-card">
        <header className="topbar">
          <div className="brand">
            TEERIFIC
          </div>

          <div className="mapper-progress">
            {completedHoleCount}/18
          </div>
        </header>

        <div className="mapper-heading">
          <div className="eyebrow">
            FIELD TEST COURSE
          </div>

          <h1>
            Map the park
          </h1>

          <p className="muted">
            Stand at each fake hole location and record the GPS point.
          </p>

          <p className="mapper-draft-note">
            Progress is saved automatically on this phone.
          </p>
        </div>

        <div className="mapper-fields">
          <label className="auth-field">
            <span>
              Course name
            </span>

            <input
              value={name}
              onChange={event => {
                setName(
                  event.target.value,
                );
              }}
            />
          </label>

          <label className="auth-field">
            <span>
              Address / park
            </span>

            <input
              value={address}
              onChange={event => {
                setAddress(
                  event.target.value,
                );
              }}
            />
          </label>

          <div className="mapper-field-row">
            <label className="auth-field">
              <span>
                City
              </span>

              <input
                value={city}
                onChange={event => {
                  setCity(
                    event.target.value,
                  );
                }}
              />
            </label>

            <label className="auth-field">
              <span>
                State
              </span>

              <input
                value={region}
                onChange={event => {
                  setRegion(
                    event.target.value,
                  );
                }}
              />
            </label>
          </div>
        </div>

        <div className="mapper-point">
          <div>
            <strong>
              Departure point
            </strong>

            <p className="muted">
              Where Teerific should start the drive home.
            </p>
          </div>

          <button
            type="button"
            className={
              departure
                ? "secondary-button mapper-recorded"
                : "secondary-button"
            }
            disabled={
              capturing !==
              null
            }
            onClick={() => {
              void captureDeparture();
            }}
          >
            {capturing ===
            "departure"
              ? "Reading GPS…"
              : departure
                ? "Recapture"
                : "Record"}
          </button>
        </div>

        {departure && (
          <div className="mapper-reading">
            GPS accuracy:{" "}
            {departure.accuracyMeters !==
            null
              ? `${Math.round(
                  departure.accuracyMeters,
                )}m`
              : "unknown"}
          </div>
        )}

        {previousPoint &&
          nextHoleNumber > 0 &&
          nextHoleNumber <= 18 && (
          <div
            className={
              spacingState ===
              "ideal"
                ? "mapper-distance mapper-distance-good"
                : spacingState ===
                    "too-close"
                  ? "mapper-distance mapper-distance-close"
                  : "mapper-distance"
            }
          >
            <div>
              <span className="detail-label">
                DISTANCE FROM{" "}
                {nextHoleNumber === 1
                  ? "DEPARTURE"
                  : `HOLE ${nextHoleNumber - 1}`}
              </span>

              <strong>
                {liveDistanceYards !==
                null
                  ? `${liveDistanceYards} yd`
                  : "Reading GPS…"}
              </strong>
            </div>

            <span className="mapper-distance-note">
              {liveDistanceYards ===
              null
                ? "Walk toward the next hole."
                : liveDistanceYards <
                    50
                  ? "Keep walking"
                  : liveDistanceYards <=
                      100
                    ? "Good spacing"
                    : "More than needed"}
            </span>
          </div>
        )}

        <div className="mapper-hole-list">
          {holes.map(
            (
              hole,
              index,
            ) => {
              const holeNumber =
                index + 1;

              const active =
                holeNumber ===
                nextHoleNumber;

              return (
                <div
                  className={
                    active
                      ? "mapper-hole mapper-hole-next"
                      : "mapper-hole"
                  }
                  key={
                    holeNumber
                  }
                >
                  <div>
                    <strong>
                      Hole {holeNumber}
                    </strong>

                    <span className="mapper-hole-status">
                      {hole
                        ? hole.accuracyMeters !==
                          null
                          ? `${Math.round(
                              hole.accuracyMeters,
                            )}m accuracy`
                          : "Recorded"
                        : active
                          ? "Next"
                          : "Not recorded"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={
                      hole
                        ? "secondary-button mapper-recorded"
                        : "secondary-button"
                    }
                    disabled={
                      capturing !==
                      null
                    }
                    onClick={() => {
                      void captureHole(
                        index,
                      );
                    }}
                  >
                    {capturing ===
                    `hole-${holeNumber}`
                      ? "Reading GPS…"
                      : hole
                        ? "Recapture"
                        : "Record"}
                  </button>
                </div>
              );
            },
          )}
        </div>

        {error && (
          <div className="soft-error">
            {error}
          </div>
        )}

        <button
          type="button"
          className="primary-button mapper-save"
          disabled={
            saving ||
            !departure ||
            completedHoleCount !==
              18
          }
          onClick={() => {
            void saveCourse();
          }}
        >
          {saving
            ? "Creating course…"
            : "Create 18-hole test course"}
        </button>
      </section>
    </main>
  );
}
