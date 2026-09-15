export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteRequest = {
  origin: RoutePoint;
  destination: RoutePoint;
  departureTime: Date;
};

export type RouteResult = {
  durationSeconds: number;
  distanceMeters: number;
};

export interface RoutingProvider {
  computeDrivingRoute(
    request: RouteRequest
  ): Promise<RouteResult>;
}
