import "dotenv/config";
import type {
  RouteRequest,
  RouteResult,
  RoutingProvider
} from "./routingProvider.js";

type GoogleRoute = {
  duration?: string;
  distanceMeters?: number;
};

type GoogleRoutesResponse = {
  routes?: GoogleRoute[];
  error?: {
    message?: string;
    status?: string;
  };
};

function parseDurationSeconds(
  raw: string
): number {
  const match =
    /^([0-9]+(?:\.[0-9]+)?)s$/
      .exec(raw);

  if (!match?.[1]) {
    throw new Error(
      `Invalid Google route duration: ${raw}`
    );
  }

  const seconds =
    Number(match[1]);

  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    throw new Error(
      `Invalid Google route duration: ${raw}`
    );
  }

  return Math.round(seconds);
}

export class GoogleRoutesProvider
implements RoutingProvider {
  async computeDrivingRoute(
    request: RouteRequest
  ): Promise<RouteResult> {
    const apiKey =
      process.env
        .GOOGLE_ROUTES_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GOOGLE_ROUTES_API_KEY is not configured"
      );
    }

    const response =
      await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-Goog-Api-Key":
              apiKey,

            "X-Goog-FieldMask":
              "routes.duration,routes.distanceMeters"
          },

          body:
            JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude:
                      request.origin.latitude,

                    longitude:
                      request.origin.longitude
                  }
                }
              },

              destination: {
                location: {
                  latLng: {
                    latitude:
                      request.destination.latitude,

                    longitude:
                      request.destination.longitude
                  }
                }
              },

              travelMode:
                "DRIVE",

              routingPreference:
                "TRAFFIC_AWARE",

              departureTime:
                request.departureTime
                  .toISOString()
            })
        }
      );

    const body = (await response.json()) as GoogleRoutesResponse;

    if (!response.ok) {
      throw new Error(
        body.error?.message ??
        `Google Routes HTTP ${response.status}`
      );
    }

    const route =
      body.routes?.[0];

    if (
      !route ||
      route.duration === undefined ||
      route.distanceMeters ===
        undefined
    ) {
      throw new Error(
        "Google Routes returned no usable route"
      );
    }

    return {
      durationSeconds:
        parseDurationSeconds(
          route.duration
        ),

      distanceMeters:
        route.distanceMeters
    };
  }
}

export const googleRoutesProvider =
  new GoogleRoutesProvider();
