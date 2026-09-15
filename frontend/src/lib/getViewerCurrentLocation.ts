import type {
  ViewerCurrentLocationInput
} from "@teerific/shared";

export async function getViewerCurrentLocation():
Promise<ViewerCurrentLocationInput> {
  if (
    !("geolocation" in navigator)
  ) {
    throw new Error(
      "GEOLOCATION_NOT_SUPPORTED"
    );
  }

  return new Promise(
    (
      resolve,
      reject
    ) => {
      navigator.geolocation
        .getCurrentPosition(
          position => {
            resolve({
              type:
                "viewer_current_location",

              latitude:
                position.coords.latitude,

              longitude:
                position.coords.longitude,

              accuracyMeters:
                position.coords.accuracy,

              recordedAt:
                new Date(
                  position.timestamp
                ).toISOString()
            });
          },

          () => {
            reject(
              new Error(
                "VIEWER_LOCATION_UNAVAILABLE"
              )
            );
          },

          {
            enableHighAccuracy:
              true,

            timeout:
              10_000,

            maximumAge:
              30_000
          }
        );
    }
  );
}
