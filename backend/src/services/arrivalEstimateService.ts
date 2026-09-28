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

type CachedRoute =
  Awaited<
    ReturnType<
      RoutingProvider["computeDrivingRoute"]
    >
  >;

const ROUTE_CACHE_MS =
  5 * 60 * 1000;

const routeCache =
  new Map<
    string,
    {
      expiresAt: number;
      route: Promise<CachedRoute>;
    }
  >();

function routeCacheKey(
  origin: ResolvedArrivalOrigin,
  target: ResolvedArrivalTarget
): string {
  return [
    origin.latitude.toFixed(5),
    origin.longitude.toFixed(5),
    target.latitude.toFixed(5),
    target.longitude.toFixed(5)
  ].join(":");
}

async function computeArrivalRoute(
  routingProvider: RoutingProvider,
  origin: ResolvedArrivalOrigin,
  target: ResolvedArrivalTarget,
  departureTime: Date
): Promise<CachedRoute> {
  const input = {
    origin: {
      latitude: origin.latitude,
      longitude: origin.longitude
    },
    destination: {
      latitude: target.latitude,
      longitude: target.longitude
    },
    departureTime
  };

  if (
    routingProvider !==
    googleRoutesProvider
  ) {
    return routingProvider
      .computeDrivingRoute(input);
  }

  const key =
    routeCacheKey(
      origin,
      target
    );

  const now = Date.now();
  const cached =
    routeCache.get(key);

  if (
    cached &&
    cached.expiresAt > now
  ) {
    return cached.route;
  }

  const route =
    routingProvider
      .computeDrivingRoute(input);

  routeCache.set(key, {
    expiresAt:
      now + ROUTE_CACHE_MS,
    route
  });

  try {
    return await route;
  } catch (error) {
    routeCache.delete(key);
    throw error;
  }
}

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
      await computeArrivalRoute(
        routingProvider,
        input.origin,
        input.target,
        finishAt
      );

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
