import type {
  ArrivalEstimate,
  LiveGolferState,
  ResolvedArrivalOrigin,
  ResolvedArrivalTarget
} from "@teerific/shared";
import {
  ArrivalEstimateSchema
} from "@teerific/shared";
import {
  googleRoutesProvider
} from "../routing/googleRoutesProvider.js";
import type {
  RoutingProvider
} from "../routing/routingProvider.js";

export async function estimateArrival(
  input: {
    state: LiveGolferState;
    origin:
      ResolvedArrivalOrigin | null;
    target:
      ResolvedArrivalTarget;
    now?: Date;
  },
  routingProvider:
    RoutingProvider =
      googleRoutesProvider
): Promise<ArrivalEstimate> {
  const now =
    input.now ??
    new Date();

  if (!input.state.playing) {
    return ArrivalEstimateSchema.parse({
      status:
        "unavailable",

      reason:
        "not_playing"
    });
  }

  const finishAtRaw =
    input.state.pace
      ?.estimatedFinishAt;

  if (!finishAtRaw) {
    return ArrivalEstimateSchema.parse({
      status:
        "unavailable",

      reason:
        "golf_finish_unavailable"
    });
  }

  const finishAt =
    new Date(
      finishAtRaw
    );

  if (
    !Number.isFinite(
      finishAt.getTime()
    ) ||
    finishAt.getTime() <=
      now.getTime()
  ) {
    return ArrivalEstimateSchema.parse({
      status:
        "unavailable",

      reason:
        "golf_finish_not_future"
    });
  }

  if (!input.origin) {
    return ArrivalEstimateSchema.parse({
      status:
        "unavailable",

      reason:
        "departure_location_unavailable"
    });
  }

  try {
    const route =
      await routingProvider
        .computeDrivingRoute({
          origin: {
            latitude:
              input.origin.latitude,

            longitude:
              input.origin.longitude
          },

          destination: {
            latitude:
              input.target.latitude,

            longitude:
              input.target.longitude
          },

          departureTime:
            finishAt
        });

    const arrivalAt =
      new Date(
        finishAt.getTime() +
        route.durationSeconds *
          1000
      );

    return ArrivalEstimateSchema.parse({
      status:
        "available",

      golfFinishAt:
        finishAt.toISOString(),

      driveDurationSeconds:
        route.durationSeconds,

      distanceMeters:
        route.distanceMeters,

      estimatedArrivalAt:
        arrivalAt.toISOString(),

      routingProvider:
        "google_routes"
    });
  } catch (error) {
    console.error(
      "Arrival routing failed:",
      error
    );

    return ArrivalEstimateSchema.parse({
      status:
        "unavailable",

      reason:
        "routing_unavailable"
    });
  }
}
