import {
  LocationUpdateInputSchema,
  type LocationUpdateInput,
} from "@teerific/shared";

function finiteOrNull(
  value: number | null,
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

function positionToLocation(
  position: GeolocationPosition,
): LocationUpdateInput {
  const {
    coords,
  } = position;

  const speed =
    finiteOrNull(
      coords.speed,
    );

  const heading =
    finiteOrNull(
      coords.heading,
    );

  return LocationUpdateInputSchema.parse({
    latitude:
      coords.latitude,

    longitude:
      coords.longitude,

    accuracyMeters:
      Number.isFinite(
        coords.accuracy,
      )
        ? coords.accuracy
        : null,

    altitudeMeters:
      finiteOrNull(
        coords.altitude,
      ),

    speedMetersPerSecond:
      speed !== null &&
      speed >= 0
        ? speed
        : null,

    headingDegrees:
      heading !== null &&
      heading >= 0 &&
      heading <= 360
        ? heading
        : null,

    recordedAt:
      new Date(
        position.timestamp,
      ).toISOString(),
  });
}

function geolocationError(
  error: GeolocationPositionError,
): Error {
  switch (
    error.code
  ) {
    case error.PERMISSION_DENIED:
      return new Error(
        "LOCATION_PERMISSION_DENIED",
      );

    case error.POSITION_UNAVAILABLE:
      return new Error(
        "LOCATION_UNAVAILABLE",
      );

    case error.TIMEOUT:
      return new Error(
        "LOCATION_TIMEOUT",
      );

    default:
      return new Error(
        "LOCATION_ERROR",
      );
  }
}

export function getGolferCurrentPosition():
Promise<LocationUpdateInput> {
  if (
    !(
      "geolocation" in
      navigator
    )
  ) {
    return Promise.reject(
      new Error(
        "GEOLOCATION_NOT_SUPPORTED",
      ),
    );
  }

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      navigator.geolocation
        .getCurrentPosition(
          position => {
            resolve(
              positionToLocation(
                position,
              ),
            );
          },

          error => {
            reject(
              geolocationError(
                error,
              ),
            );
          },

          {
            enableHighAccuracy:
              true,

            timeout:
              15_000,

            maximumAge:
              0,
          },
        );
    },
  );
}

export function watchGolferPosition(
  onPosition:
    (
      location:
        LocationUpdateInput,
    ) => void,

  onError:
    (
      error:
        Error,
    ) => void,
): () => void {
  if (
    !(
      "geolocation" in
      navigator
    )
  ) {
    onError(
      new Error(
        "GEOLOCATION_NOT_SUPPORTED",
      ),
    );

    return () => {};
  }

  const watchId =
    navigator.geolocation
      .watchPosition(
        position => {
          try {
            onPosition(
              positionToLocation(
                position,
              ),
            );
          } catch (
            error
          ) {
            onError(
              error instanceof Error
                ? error
                : new Error(
                    "INVALID_GPS_SAMPLE",
                  ),
            );
          }
        },

        error => {
          onError(
            geolocationError(
              error,
            ),
          );
        },

        {
          enableHighAccuracy:
            true,

          timeout:
            15_000,

          maximumAge:
            0,
        },
      );

  return () => {
    navigator.geolocation
      .clearWatch(
        watchId,
      );
  };
}
