import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";
import {
  ArrivalContextSchema,
  type ArrivalContext,
  type ViewerCurrentLocationInput,
} from "@teerific/shared";
import {
  getViewerCurrentLocation,
} from "../lib/getViewerCurrentLocation";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:3000";

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function arrivalUnavailableMessage(
  reason:
    | "not_playing"
    | "golf_finish_unavailable"
    | "golf_finish_not_future"
    | "departure_location_unavailable"
    | "routing_unavailable",
) {
  switch (reason) {
    case "not_playing":
      return "Not currently playing.";

    case "golf_finish_unavailable":
      return "Waiting for enough golf progress to estimate a finish time.";

    case "golf_finish_not_future":
      return "Waiting for a fresh golfer location.";

    case "departure_location_unavailable":
      return "This course does not have a departure point yet.";

    case "routing_unavailable":
      return "Drive-time estimate is temporarily unavailable.";
  }
}

async function readError(response: Response) {
  if (response.status === 401) {
    return "Sign in to view this golfer.";
  }

  if (response.status === 403) {
    return "You do not have access to this golfer.";
  }

  const text =
    await response.text();

  return (
    text.trim() ||
    `Request failed (${response.status}).`
  );
}

export default function GolferStatusPage() {
  const {
    golferUserId,
  } = useParams();

  const [
    context,
    setContext,
  ] = useState<ArrivalContext | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const viewerLocationRef =
    useRef<ViewerCurrentLocationInput | null>(
      null,
    );

  const contextRef =
    useRef<ArrivalContext | null>(
      null,
    );

  const requestInFlightRef =
    useRef(false);

  useEffect(() => {
    contextRef.current =
      context;
  }, [context]);

  const refreshArrival =
    useCallback(
      async () => {
        if (
          !golferUserId ||
          !viewerLocationRef.current ||
          requestInFlightRef.current
        ) {
          return;
        }

        requestInFlightRef.current =
          true;

        try {
          const response =
            await fetch(
              `${API_BASE}/api/golfers/${encodeURIComponent(
                golferUserId,
              )}/arrival-context`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify(
                  viewerLocationRef.current,
                ),
              },
            );

          if (!response.ok) {
            throw new Error(
              await readError(
                response,
              ),
            );
          }

          const payload:
            unknown =
            await response.json();

          if (
            typeof payload !==
              "object" ||
            payload === null ||
            !(
              "context" in
              payload
            )
          ) {
            throw new Error(
              "INVALID_ARRIVAL_RESPONSE",
            );
          }

          const parsed =
            ArrivalContextSchema.parse(
              payload.context,
            );

          setContext(
            parsed,
          );

          setError(
            null,
          );
        } catch (
          caught
        ) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load golfer status.",
          );
        } finally {
          requestInFlightRef.current =
            false;

          setLoading(
            false,
          );
        }
      },
      [
        golferUserId,
      ],
    );

  useEffect(() => {
    if (!golferUserId) {
      setLoading(false);
      return;
    }

    let cancelled =
      false;

    async function start() {
      setLoading(true);

      try {
        const location =
          await getViewerCurrentLocation();

        if (cancelled) {
          return;
        }

        viewerLocationRef.current =
          location;

        await refreshArrival();
      } catch (
        caught
      ) {
        if (cancelled) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message ===
              "VIEWER_LOCATION_UNAVAILABLE"
              ? "Your location is needed to estimate when the golfer will reach you."
              : caught.message ===
                "GEOLOCATION_NOT_SUPPORTED"
                ? "This browser does not support location."
                : caught.message
            : "Unable to get your location.",
        );

        setLoading(
          false,
        );
      }
    }

    void start();

    return () => {
      cancelled =
        true;
    };
  }, [
    golferUserId,
    refreshArrival,
  ]);

  useEffect(() => {
    if (
      !golferUserId ||
      !viewerLocationRef.current
    ) {
      return;
    }

    const stream =
      new EventSource(
        `${API_BASE}/api/golfers/${encodeURIComponent(
          golferUserId,
        )}/live-stream`,
        {
          withCredentials:
            true,
        },
      );

    stream.onmessage =
      event => {
        try {
          const state =
            JSON.parse(
              event.data,
            ) as {
              pace?: {
                estimatedFinishAt?:
                  | string
                  | null;
              } | null;
            };

          const nextFinish =
            state.pace
              ?.estimatedFinishAt ??
            null;

          const currentFinish =
            contextRef.current
              ?.state.pace
              ?.estimatedFinishAt ??
            null;

          if (
            nextFinish !==
            currentFinish
          ) {
            void refreshArrival();
          }
        } catch {
          // Ignore malformed stream events.
          // Canonical REST refresh remains authoritative.
        }
      };

    stream.addEventListener(
      "access-revoked",
      () => {
        setError(
          "You no longer have access to this golfer.",
        );

        stream.close();
      },
    );

    return () => {
      stream.close();
    };
  }, [
    golferUserId,
    refreshArrival,
    context,
  ]);

  useEffect(() => {
    if (
      !golferUserId ||
      !viewerLocationRef.current
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void refreshArrival();
        },
        60_000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    golferUserId,
    refreshArrival,
    context,
  ]);

  async function retryLocation() {
    setError(null);
    setLoading(true);

    try {
      viewerLocationRef.current =
        await getViewerCurrentLocation();

      await refreshArrival();
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to get your location.",
      );

      setLoading(false);
    }
  }

  if (!golferUserId) {
    return (
      <main className="page">
        <section className="status-card">
          <div className="brand">
            TEERIFIC
          </div>

          <h1>
            Golfer status
          </h1>

          <p className="muted">
            Open a golfer status link to continue.
          </p>
        </section>
      </main>
    );
  }

  if (
    loading &&
    !context
  ) {
    return (
      <main className="page">
        <section className="status-card loading-card">
          <div className="brand">
            TEERIFIC
          </div>

          <div className="pulse-dot" />

          <p className="muted">
            Getting live golf status…
          </p>
        </section>
      </main>
    );
  }

  if (
    error &&
    !context
  ) {
    return (
      <main className="page">
        <section className="status-card">
          <div className="brand">
            TEERIFIC
          </div>

          <div className="eyebrow">
            STATUS UNAVAILABLE
          </div>

          <h1>
            Couldn’t calculate arrival
          </h1>

          <p className="muted">
            {error}
          </p>

          <button
            className="primary-button"
            type="button"
            onClick={() => {
              void retryLocation();
            }}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!context) {
    return null;
  }

  const {
    state,
    arrival,
    target,
  } = context;

  const progress =
    state.playing &&
    state.totalHoles > 0
      ? `${state.holesCompleted} of ${state.totalHoles} holes complete`
      : null;

  const hole =
    state.currentHole
      ? `Hole ${state.currentHole.holeNumber}`
      : state.playing
        ? "Starting round"
        : null;

  const arrivalAvailable =
    arrival.status ===
    "available";

  return (
    <main className="page">
      <section className="status-card">
        <header className="topbar">
          <Link
            to="/"
            className="brand"
          >
            TEERIFIC
          </Link>

          <div
            className={
              state.playing
                ? "live-pill"
                : "idle-pill"
            }
          >
            <span className="status-dot" />

            {state.playing
              ? "LIVE"
              : "OFF COURSE"}
          </div>
        </header>

        <div className="golfer-block">
          <div className="eyebrow">
            {state.course
              ?.name ??
              "GOLFER STATUS"}
          </div>

          <h1>
            {state.golfer
              .displayName}
          </h1>

          {state.playing && (
            <div className="round-meta">
              {hole && (
                <span>
                  {hole}
                </span>
              )}

              {hole &&
                progress && (
                  <span className="separator">
                    ·
                  </span>
                )}

              {progress && (
                <span>
                  {progress}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="arrival-panel">
          {arrivalAvailable ? (
            <>
              <div className="arrival-label">
                EXPECTED ARRIVAL
              </div>

              <div className="arrival-time">
                {formatTime(
                  arrival.estimatedArrivalAt,
                )}
              </div>

              <p className="arrival-copy">
                Expected to reach{" "}
                {target.label
                  ? target.label
                  : "your current location"}
                .
              </p>
            </>
          ) : (
            <>
              <div className="arrival-label">
                ARRIVAL
              </div>

              <div className="arrival-unavailable">
                {arrivalUnavailableMessage(
                  arrival.reason,
                )}
              </div>
            </>
          )}
        </div>

        {arrivalAvailable && (
          <div className="details-grid">
            <div className="detail">
              <span className="detail-label">
                Golf finish
              </span>

              <strong>
                {formatTime(
                  arrival.golfFinishAt,
                )}
              </strong>
            </div>

            <div className="detail">
              <span className="detail-label">
                Drive
              </span>

              <strong>
                {Math.max(
                  1,
                  Math.round(
                    arrival.driveDurationSeconds /
                      60,
                  ),
                )}{" "}
                min
              </strong>
            </div>

            <div className="detail">
              <span className="detail-label">
                Distance
              </span>

              <strong>
                {(
                  arrival.distanceMeters /
                  1609.344
                ).toFixed(
                  1,
                )}{" "}
                mi
              </strong>
            </div>
          </div>
        )}

        {state.pace && (
          <div className="pace-note">
            <span>
              Finish estimate based on{" "}
              {state.pace.basis ===
              "current_round"
                ? "today’s round"
                : "course history"}
              .
            </span>
          </div>
        )}

        <footer className="privacy-note">
          Your location is requested once for this view.
          Teerific does not save it.
        </footer>

        {error && (
          <div className="soft-error">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}
