import {
  useEffect,
  useState,
} from "react";

import {
  AuthResponseSchema,
  LiveGolferStateSchema,
  RoundSchema,
  type AuthResponse,
  type LiveGolferState,
  type LocationUpdateInput,
  type Round,
} from "@teerific/shared";

import {
  getGolferCurrentPosition,
  watchGolferPosition,
} from "../lib/golferGeolocation";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:3000";

type CurrentUser =
  AuthResponse["user"];

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
      return body.error;
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
    liveState,
    setLiveState,
  ] = useState<
    LiveGolferState | null
  >(
    null,
  );

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
    trackingEnabled,
    setTrackingEnabled,
  ] = useState(
    true,
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

          setTrackingEnabled(
            currentRound !==
            null,
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
      if (
        !user
      ) {
        return;
      }

      let cancelled =
        false;

      async function loadInitialState() {
        try {
          const response =
            await fetch(
              `${API_BASE}/api/golfers/${encodeURIComponent(
                user!.id,
              )}/live-state`,
              {
                credentials:
                  "include",
              },
            );

          if (
            !response.ok
          ) {
            return;
          }

          const payload =
            await response
              .json() as {
                state:
                  unknown;
              };

          const parsed =
            LiveGolferStateSchema
              .parse(
                payload.state,
              );

          if (
            !cancelled
          ) {
            setLiveState(
              parsed,
            );
          }
        } catch {
          // SSE below remains canonical.
        }
      }

      void loadInitialState();

      const stream =
        new EventSource(
          `${API_BASE}/api/golfers/${encodeURIComponent(
            user.id,
          )}/live-stream`,
          {
            withCredentials:
              true,
          },
        );

      stream.onmessage =
        event => {
          try {
            const parsed =
              LiveGolferStateSchema
                .parse(
                  JSON.parse(
                    event.data,
                  ),
                );

            setLiveState(
              parsed,
            );
          } catch {
            // Ignore malformed SSE.
          }
        };

      stream.addEventListener(
        "access-revoked",
        () => {
          setError(
            "GOLFER_ACCESS_REVOKED",
          );

          stream.close();
        },
      );

      return () => {
        cancelled =
          true;

        stream.close();
      };
    },
    [
      user,
    ],
  );

  useEffect(
    () => {
      if (
        !round ||
        !trackingEnabled
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

      const stopWatching =
        watchGolferPosition(
          location => {
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
                  },
                )
                .catch(
                  caught => {
                    if (
                      active
                    ) {
                      setError(
                        caught instanceof Error
                          ? caught.message
                          : "GPS_UPLOAD_FAILED",
                      );
                    }
                  },
                );
          },

          caught => {
            if (
              active
            ) {
              setError(
                caught.message,
              );
            }
          },
        );

      return () => {
        active =
          false;

        stopWatching();

        setTracking(
          false,
        );
      };
    },
    [
      round,
      trackingEnabled,
    ],
  );

  async function startRound() {
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
                  "automatic",

                latitude:
                  location.latitude,

                longitude:
                  location.longitude,
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

      const payload =
        await response
          .json() as {
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

      setTrackingEnabled(
        true,
      );

      try {
        await postLocationSample(
          createdRound.id,
          location,
        );
      } catch (
        caught
      ) {
        setError(
          caught instanceof Error
            ? caught.message
            : "INITIAL_GPS_UPLOAD_FAILED",
        );
      }
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
     * Stop browser GPS before ending the
     * server-side round so no location
     * sample races the end request.
     */
    setTrackingEnabled(
      false,
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

      setRound(
        null,
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ROUND_END_FAILED",
      );

      /*
       * Ending failed, so the server round
       * is still active. Resume tracking.
       */
      setTrackingEnabled(
        true,
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

            <div className="idle-pill">
              OFF COURSE
            </div>
          </header>

          <div className="golf-hero">
            <div className="eyebrow">
              READY TO PLAY
            </div>

            <h1>
              {user.displayName ??
                "Golfer"}
            </h1>

            <p className="muted">
              Teerific will use your current GPS location to identify the course automatically.
            </p>
          </div>

          <button
            type="button"
            className="primary-button golf-start-button"
            disabled={
              working
            }
            onClick={() => {
              void startRound();
            }}
          >
            {working
              ? "Finding course…"
              : "Start round"}
          </button>

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

          <div className="live-pill">
            <span className="status-dot" />

            LIVE
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

        {!pageVisible && (
          <div className="tracking-warning">
            Teerific is backgrounded. Mobile browsers may pause GPS tracking.
          </div>
        )}

        <div className="tracking-note">
          Keep Teerific open during the field test so the browser can continue supplying GPS.
        </div>

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
                "completed",
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
