import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  AuthResponseSchema,
  CourseDetectionResultSchema,
  CourseSchema,
  HoleSchema,
  HoleVisitSchema,
  LiveGolferStateSchema,
  RoundSchema,
  type AuthResponse,
  type Course,
  type LiveGolferState,
  type LocationUpdateInput,
  type Round,
} from "@teerific/shared";

import { API_BASE } from "../lib/api";

import {
  getGolferCurrentPosition,
  watchGolferPosition,
} from "../lib/golferGeolocation";

import {
  isNativeGolferLocation,
  startNativeGolferLocation,
  stopNativeGolferLocation,
} from "../lib/nativeGolferLocation";


type CurrentUser =
  AuthResponse["user"];

type CourseHole =
  ReturnType<typeof HoleSchema.parse>;

type HoleVisit =
  ReturnType<typeof HoleVisitSchema.parse>;

function formatTime(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour:
        "numeric",

      minute:
        "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}

async function readApiError(
  response:
    Response,
): Promise<string> {
  try {
    const body =
      await response
        .clone()
        .json() as {
          error?:
            unknown;
        };

    if (
      typeof body.error ===
      "string"
    ) {
      switch (body.error) {
        case "COURSE_AUTO_DETECTION_FAILED":
          return "No Teerific course was found at your current location.";

        case "ACTIVE_ROUND_ALREADY_EXISTS":
          return "You already have an active round.";

        case "ACTIVE_COURSE_NOT_FOUND":
          return "That course is not currently available.";

        case "ROUND_ALREADY_ENDED":
          return "This round has already ended.";

        case "UNAUTHENTICATED":
          return "Sign in to continue.";

        default:
          return body.error;
      }
    }
  } catch {
    // Fall through.
  }

  return `REQUEST_FAILED_${response.status}`;
}

async function postLocationSample(
  roundId:
    string,

  location:
    LocationUpdateInput,
) {
  const response =
    await fetch(
      `${API_BASE}/api/rounds/${encodeURIComponent(
        roundId,
      )}/location-samples`,
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
            location,
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
}

async function fetchLiveGolferState(
  userId: string,
): Promise<LiveGolferState> {
  const response =
    await fetch(
      `${API_BASE}/api/golfers/${encodeURIComponent(
        userId,
      )}/live-state`,
      {
        credentials:
          "include",
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
      state:
        unknown;
    };

  return LiveGolferStateSchema.parse(
    payload.state,
  );
}

export default function GolferRoundPage() {
  const [
    user,
    setUser,
  ] = useState<
    CurrentUser | null
  >(
    null,
  );

  const [
    round,
    setRound,
  ] = useState<
    Round | null
  >(
    null,
  );

  const [
    courses,
    setCourses,
  ] = useState<Course[]>([]);

  const [
    selectedCourseId,
    setSelectedCourseId,
  ] = useState<string | null>(
    null,
  );

  const [
    confirmedCourseId,
    setConfirmedCourseId,
  ] = useState<string | null>(
    null,
  );

  const [
    confirmingCourse,
    setConfirmingCourse,
  ] = useState(
    false,
  );

  const [
    courseConfirmationMessage,
    setCourseConfirmationMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    liveState,
    setLiveState,
  ] = useState<
    LiveGolferState | null
  >(
    null,
  );

  const [
    holes,
    setHoles,
  ] = useState<CourseHole[]>([]);

  const [
    holeVisits,
    setHoleVisits,
  ] = useState<HoleVisit[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );

  const [
    working,
    setWorking,
  ] = useState(
    false,
  );

  const [
    tracking,
    setTracking,
  ] = useState(
    false,
  );


  const [
    error,
    setError,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    pageVisible,
    setPageVisible,
  ] = useState(
    !document.hidden,
  );

  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        try {
          const authResponse =
            await fetch(
              `${API_BASE}/api/auth/me`,
              {
                credentials:
                  "include",
              },
            );

          if (
            authResponse.status ===
            401
          ) {
            setUser(
              null,
            );

            return;
          }

          if (
            !authResponse.ok
          ) {
            throw new Error(
              await readApiError(
                authResponse,
              ),
            );
          }

          const authPayload =
            AuthResponseSchema
              .parse(
                await authResponse
                  .json(),
              );

          if (
            cancelled
          ) {
            return;
          }

          setUser(
            authPayload.user,
          );

          const roundResponse =
            await fetch(
              `${API_BASE}/api/rounds/current`,
              {
                credentials:
                  "include",
              },
            );

          if (
            !roundResponse.ok
          ) {
            throw new Error(
              await readApiError(
                roundResponse,
              ),
            );
          }

          const roundPayload =
            await roundResponse
              .json() as {
                round:
                  unknown;
              };

          const currentRound =
            roundPayload.round ===
            null
              ? null
              : RoundSchema.parse(
                  roundPayload.round,
                );

          if (
            cancelled
          ) {
            return;
          }

          setRound(
            currentRound,
          );

        } catch (
          caught
        ) {
          if (
            !cancelled
          ) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to load golfer.",
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );

  useEffect(
    () => {
      if (
        !user ||
        round
      ) {
        return;
      }

      let cancelled =
        false;

      async function loadCourses() {
        try {
          const response =
            await fetch(
              `${API_BASE}/api/courses`,
              {
                credentials:
                  "include",
              },
            );

          if (!response.ok) {
            throw new Error(
              await readApiError(
                response,
              ),
            );
          }

          const payload =
            await response.json() as {
              courses:
                unknown[];
            };

          const parsed =
            payload.courses.map(
              course =>
                CourseSchema.parse(
                  course,
                ),
            );

          if (!cancelled) {
            setCourses(
              parsed,
            );
          }
        } catch (
          caught
        ) {
          if (!cancelled) {
            setError(
              caught instanceof Error
                ? caught.message
                : "COURSE_LIBRARY_FAILED",
            );
          }
        }
      }

      void loadCourses();

      return () => {
        cancelled =
          true;
      };
    },
    [
      user,
      round,
    ],
  );

  useEffect(
    () => {
      function updateVisibility() {
        setPageVisible(
          !document.hidden,
        );
      }

      document.addEventListener(
        "visibilitychange",
        updateVisibility,
      );

      return () => {
        document.removeEventListener(
          "visibilitychange",
          updateVisibility,
        );
      };
    },
    [],
  );

  useEffect(
    () => {
      if (!user) {
        return;
      }

      let cancelled = false;

      async function refreshState() {
        try {
          const state =
            await fetchLiveGolferState(
              user!.id,
            );

          if (!cancelled) {
            setLiveState(state);
          }
        } catch {
          // Try again on next refresh.
        }
      }

      void refreshState();

      const timer =
        window.setInterval(
          () => {
            void refreshState();
          },
          2000,
        );

      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    },
    [user],
  );

  useEffect(
    () => {
      if (
        !round ||
        !user ||
        !isNativeGolferLocation()
      ) {
        return;
      }

      setTracking(true);
      setError(null);

      void startNativeGolferLocation(
        round.id,
        API_BASE,
      ).catch(
        caught => {
          setError(
            caught instanceof Error
              ? caught.message
              : "NATIVE_GPS_START_FAILED",
          );
        },
      );

      return () => {
        setTracking(false);

        void stopNativeGolferLocation()
          .catch(() => {});
      };
    },
    [
      round,
      user,
    ],
  );

  useEffect(
    () => {
      if (
        isNativeGolferLocation()
      ) {
        return;
      }

      if (
        !round ||
        !user ||
        !pageVisible
      ) {
        setTracking(
          false,
        );

        return;
      }

      let active =
        true;

      let uploadChain:
        Promise<void> =
        Promise.resolve();

      setTracking(
        true,
      );

      setError(
        null,
      );

      const reportError =
        (caught: Error) => {
          if (
            active
          ) {
            setError(
              caught.message,
            );
          }
        };

      const queueLocation =
        (
          location:
            LocationUpdateInput,
        ) => {
          uploadChain =
            uploadChain
              .then(
                async () => {
                  if (
                    !active
                  ) {
                    return;
                  }

                  await postLocationSample(
                    round.id,
                    location,
                  );

                  const nextState =
                    await fetchLiveGolferState(
                      user.id,
                    );

                  if (
                    active
                  ) {
                    setLiveState(
                      nextState,
                    );
                  }
                },
              )
              .catch(
                caught => {
                  reportError(
                    caught instanceof Error
                      ? caught
                      : new Error(
                          "GPS_UPLOAD_FAILED",
                        ),
                  );
                },
              );
        };

      /*
       * iOS Safari may suspend watchPosition while
       * Google Earth is in front. Every foreground
       * return therefore forces a fresh position,
       * then a second fresh confirmation sample.
       */
      void getGolferCurrentPosition()
        .then(
          queueLocation,
        )
        .catch(
          reportError,
        );

      const confirmationTimer =
        window.setTimeout(
          () => {
            if (
              !active
            ) {
              return;
            }

            void getGolferCurrentPosition()
              .then(
                queueLocation,
              )
              .catch(
                reportError,
              );
          },
          2_500,
        );

      const stopWatching =
        watchGolferPosition(
          queueLocation,
          reportError,
        );

      return () => {
        active =
          false;

        window.clearTimeout(
          confirmationTimer,
        );

        stopWatching();

        setTracking(
          false,
        );
      };
    },
    [
      round,
      user,
      pageVisible,
    ],
  );

  useEffect(
    () => {
      if (!round) {
        setHoles([]);
        setHoleVisits([]);
        return;
      }

      let cancelled =
        false;

      async function loadRoundProgress() {
        try {
          const [
            holesResponse,
            visitsResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_BASE}/api/courses/${encodeURIComponent(
                  round!.courseId,
                )}/holes`,
                {
                  credentials:
                    "include",
                },
              ),
              fetch(
                `${API_BASE}/api/rounds/${encodeURIComponent(
                  round!.id,
                )}/hole-visits`,
                {
                  credentials:
                    "include",
                },
              ),
            ]);

          if (
            !holesResponse.ok ||
            !visitsResponse.ok
          ) {
            return;
          }

          const holesPayload =
            await holesResponse.json() as {
              holes:
                unknown[];
            };

          const visitsPayload =
            await visitsResponse.json() as {
              visits:
                unknown[];
            };

          if (cancelled) {
            return;
          }

          setHoles(
            holesPayload.holes.map(
              hole =>
                HoleSchema.parse(hole),
            ),
          );

          setHoleVisits(
            visitsPayload.visits.map(
              visit =>
                HoleVisitSchema.parse(visit),
            ),
          );
        } catch {
          // Live round tracking remains independent.
        }
      }

      void loadRoundProgress();

      return () => {
        cancelled =
          true;
      };
    },
    [
      round,
      liveState?.currentHole?.holeNumber,
    ],
  );

  async function signOut() {
    setWorking(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `${API_BASE}/api/auth/logout`,
          {
            method:
              "POST",

            credentials:
              "include",
          },
        );

      if (
        !response.ok &&
        response.status !== 401
      ) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      setUser(
        null,
      );

      setRound(
        null,
      );

      setLiveState(
        null,
      );

      window.location.replace(
        "/login",
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "SIGN_OUT_FAILED",
      );

      setWorking(
        false,
      );
    }
  }

  async function chooseCourse(
    courseId: string,
  ) {
    setSelectedCourseId(
      courseId,
    );

    setConfirmedCourseId(
      null,
    );

    setCourseConfirmationMessage(
      null,
    );

    setConfirmingCourse(
      true,
    );

    setError(
      null,
    );

    try {
      const location =
        await getGolferCurrentPosition();

      const response =
        await fetch(
          `${API_BASE}/api/courses/detect`,
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
              JSON.stringify({
                latitude:
                  location.latitude,

                longitude:
                  location.longitude,
              }),
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      const payload =
        await response.json() as {
          detection:
            unknown;
        };

      const detection =
        CourseDetectionResultSchema.parse(
          payload.detection,
        );

      if (
        detection.status ===
          "matched" &&
        detection.course?.id ===
          courseId
      ) {
        setConfirmedCourseId(
          courseId,
        );

        setCourseConfirmationMessage(
          "Location confirmed",
        );

        return;
      }

      setCourseConfirmationMessage(
        "You are not currently at this course.",
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "COURSE_LOCATION_CHECK_FAILED",
      );
    } finally {
      setConfirmingCourse(
        false,
      );
    }
  }

  async function startSelectedCourseRound() {
    if (
      !user ||
      !confirmedCourseId
    ) {
      return;
    }

    setWorking(
      true,
    );

    setError(
      null,
    );

    try {
      const location =
        await getGolferCurrentPosition();

      const response =
        await fetch(
          `${API_BASE}/api/rounds`,
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
              JSON.stringify({
                courseDetectionMethod:
                  "manual",

                courseId:
                  confirmedCourseId,
              }),
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      const payload =
        await response.json() as {
          round:
            unknown;
        };

      const createdRound =
        RoundSchema.parse(
          payload.round,
        );

      setRound(
        createdRound,
      );

      await postLocationSample(
        createdRound.id,
        location,
      );

      const nextState =
        await fetchLiveGolferState(
          user.id,
        );

      setLiveState(
        nextState,
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ROUND_START_FAILED",
      );
    } finally {
      setWorking(
        false,
      );
    }
  }


  async function endRound(
    reason:
      | "completed"
      | "finished"
      | "abandoned",
  ) {
    if (
      !round
    ) {
      return;
    }

    const activeRound =
      round;

    setWorking(
      true,
    );

    setError(
      null,
    );

    /*
     * Removing the active round stops the
     * GPS watcher. If ending fails, restoring
     * the round automatically restarts GPS.
     */
    setRound(
      null,
    );

    try {
      const response =
        await fetch(
          `${API_BASE}/api/rounds/${encodeURIComponent(
            activeRound.id,
          )}/end`,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reason,
              }),
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

    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ROUND_END_FAILED",
      );

      /*
       * Ending failed, so restore the active
       * round. The GPS effect restarts itself.
       */
      setRound(
        activeRound,
      );
    } finally {
      setWorking(
        false,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main className="golf-page">
        <section className="golf-card">
          <div className="brand">
            TEERIFIC
          </div>

          <p>
            Loading golfer…
          </p>
        </section>
      </main>
    );
  }

  if (
    !user
  ) {
    return (
      <main className="golf-page">
        <section className="golf-card">
          <div className="brand">
            TEERIFIC
          </div>

          <h1>
            Sign in required
          </h1>

          <p className="muted">
            You need a Teerific session before starting a round.
          </p>

          <Link
            to="/login?next=/golf"
            className="primary-button"
          >
            Sign in
          </Link>

          {error && (
            <div className="soft-error">
              {error}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (
    !round
  ) {
    return (
      <main className="golf-page">
        <section className="golf-card">
          <header className="topbar">
            <div className="brand">
              TEERIFIC
            </div>

            <div className="topbar-actions">
              <div className="idle-pill">
                OFF COURSE
              </div>

              <button
                type="button"
                className="signout-button"
                disabled={working}
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="golf-hero course-library-hero">
            <div className="eyebrow">
              CHOOSE YOUR COURSE
            </div>

            <h1>
              Where are you playing?
            </h1>
          </div>

          <div className="course-library">
            {courses.length === 0 ? (
              <p className="muted">
                No courses available.
              </p>
            ) : (
              courses.map(
                course => (
                  <button
                    key={course.id}
                    type="button"
                    className={
                      selectedCourseId ===
                      course.id
                        ? "course-library-item course-library-item-selected"
                        : "course-library-item"
                    }
                    disabled={
                      confirmingCourse ||
                      working
                    }
                    onClick={() => {
                      void chooseCourse(
                        course.id,
                      );
                    }}
                  >
                    <strong>
                      {course.name}
                    </strong>

                    <span>
                      {course.city}, {course.region}
                    </span>
                  </button>
                ),
              )
            )}
          </div>

          {selectedCourseId && (
            <div className="course-confirmation">
              <strong>
                {confirmingCourse
                  ? "Checking your location…"
                  : courseConfirmationMessage}
              </strong>

              {confirmedCourseId ===
                selectedCourseId && (
                <button
                  type="button"
                  className="primary-button golf-start-button"
                  disabled={working}
                  onClick={() => {
                    void startSelectedCourseRound();
                  }}
                >
                  {working
                    ? "Starting round…"
                    : "Start Round"}
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="soft-error">
              {error}
            </div>
          )}
        </section>
      </main>
    );
  }

  const holeText =
    liveState
      ?.currentHole
      ? `Hole ${liveState.currentHole.holeNumber}`
      : "Finding hole…";

  return (
    <main className="golf-page">
      <section className="golf-card">
        <header className="topbar">
          <div className="brand">
            TEERIFIC
          </div>

          <div className="topbar-actions">
            <div className="live-pill">
              <span className="status-dot" />

              LIVE
            </div>

            <button
              type="button"
              className="signout-button"
              disabled={working}
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="golf-course-block">
          <div className="eyebrow">
            {liveState
              ?.course
              ?.name ??
              "ACTIVE ROUND"}
          </div>

          <div className="golf-hole">
            {holeText}
          </div>

          <div className="round-meta">
            {liveState &&
             liveState.totalHoles > 0
              ? `${liveState.holesCompleted} of ${liveState.totalHoles} holes complete`
              : "Waiting for course progress"}
          </div>
        </div>

        <div className="golf-stats">
          <div className="detail">
            <span className="detail-label">
              GPS
            </span>

            <strong>
              {tracking
                ? "Tracking"
                : "Starting…"}
            </strong>
          </div>

          <div className="detail">
            <span className="detail-label">
              Accuracy
            </span>

            <strong>
              {liveState
                ?.latestLocation
                ?.accuracyMeters !==
              null &&
              liveState
                ?.latestLocation
                ?.accuracyMeters !==
              undefined
                ? `${Math.round(
                    liveState.latestLocation
                      .accuracyMeters,
                  )} m`
                : "—"}
            </strong>
          </div>

          <div className="detail">
            <span className="detail-label">
              Est. finish
            </span>

            <strong>
              {formatTime(
                liveState
                  ?.pace
                  ?.estimatedFinishAt,
              )}
            </strong>
          </div>
        </div>

        {holeVisits.length > 0 && (
          <div className="hole-timeline">
            {holeVisits.map(
              visit => {
                const hole =
                  holes.find(
                    candidate =>
                      candidate.id ===
                      visit.holeId,
                  );

                return (
                  <div
                    key={visit.id}
                    className="hole-timeline-row"
                  >
                    <span>
                      {hole
                        ? `Hole ${hole.holeNumber}`
                        : "Hole"}
                    </span>

                    <strong>
                      {formatTime(
                        visit.enteredAt,
                      )}
                    </strong>
                  </div>
                );
              },
            )}
          </div>
        )}

        {!isNativeGolferLocation() && !pageVisible && (
          <div className="tracking-warning">
            Teerific is backgrounded. Mobile browsers may pause GPS tracking.
          </div>
        )}

        {!isNativeGolferLocation() && (
          <div className="tracking-note">
            Keep Teerific open so the browser can continue supplying GPS.
          </div>
        )}

        {error && (
          <div className="soft-error">
            {error}
          </div>
        )}

        <div className="round-actions">
          <button
            type="button"
            className="primary-button"
            disabled={
              working
            }
            onClick={() => {
              void endRound(
                "finished",
              );
            }}
          >
            Finish round
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={
              working
            }
            onClick={() => {
              void endRound(
                "abandoned",
              );
            }}
          >
            Abandon round
          </button>
        </div>
      </section>
    </main>
  );
}
