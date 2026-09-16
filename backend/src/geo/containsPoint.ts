type Position = [
  number,
  number
];

type Polygon = {
  type: "Polygon";
  coordinates: Position[][];
};

type MultiPolygon = {
  type: "MultiPolygon";
  coordinates: Position[][][];
};

type GeoArea =
  | Polygon
  | MultiPolygon;

function pointOnSegment(
  point: Position,
  a: Position,
  b: Position
): boolean {
  const [px, py] = point;
  const [ax, ay] = a;
  const [bx, by] = b;

  const cross =
    (px - ax) * (by - ay) -
    (py - ay) * (bx - ax);

  if (
    Math.abs(cross) >
    1e-10
  ) {
    return false;
  }

  const dot =
    (px - ax) * (px - bx) +
    (py - ay) * (py - by);

  return dot <= 0;
}

function pointInRing(
  point: Position,
  ring: Position[]
): boolean {
  let inside = false;

  for (
    let i = 0, j = ring.length - 1;
    i < ring.length;
    j = i++
  ) {
    const a = ring[j];
    const b = ring[i];

    if (
      !a ||
      !b
    ) {
      continue;
    }

    if (
      pointOnSegment(
        point,
        a,
        b
      )
    ) {
      return true;
    }

    const [x, y] =
      point;

    const [xi, yi] =
      b;

    const [xj, yj] =
      a;

    const intersects =
      (
        (yi > y) !==
        (yj > y)
      ) &&
      (
        x <
        (
          (xj - xi) *
          (y - yi)
        ) /
        (yj - yi) +
        xi
      );

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInPolygon(
  point: Position,
  rings: Position[][]
): boolean {
  const exterior =
    rings[0];

  if (
    !exterior ||
    !pointInRing(
      point,
      exterior
    )
  ) {
    return false;
  }

  /*
   * GeoJSON polygon rings after the first
   * are holes in the polygon.
   */
  for (
    let i = 1;
    i < rings.length;
    i += 1
  ) {
    const hole =
      rings[i];

    if (
      hole &&
      pointInRing(
        point,
        hole
      )
    ) {
      return false;
    }
  }

  return true;
}

export function areaContainsPoint(
  area: GeoArea,
  longitude: number,
  latitude: number
): boolean {
  const point: Position = [
    longitude,
    latitude
  ];

  if (
    area.type ===
    "Polygon"
  ) {
    return pointInPolygon(
      point,
      area.coordinates
    );
  }

  return area.coordinates.some(
    polygon =>
      pointInPolygon(
        point,
        polygon
      )
  );
}


const METERS_PER_LATITUDE_DEGREE =
  111_320;

function pointToSegmentDistanceMeters(
  longitude: number,
  latitude: number,
  a: Position,
  b: Position
): number {
  const longitudeScale =
    METERS_PER_LATITUDE_DEGREE *
    Math.max(
      Math.cos(
        latitude *
        Math.PI /
        180
      ),
      0.000001
    );

  const ax =
    (a[0] - longitude) *
    longitudeScale;

  const ay =
    (a[1] - latitude) *
    METERS_PER_LATITUDE_DEGREE;

  const bx =
    (b[0] - longitude) *
    longitudeScale;

  const by =
    (b[1] - latitude) *
    METERS_PER_LATITUDE_DEGREE;

  const dx =
    bx - ax;

  const dy =
    by - ay;

  const lengthSquared =
    dx * dx +
    dy * dy;

  if (
    lengthSquared === 0
  ) {
    return Math.hypot(
      ax,
      ay
    );
  }

  const projection =
    Math.max(
      0,
      Math.min(
        1,
        -(ax * dx + ay * dy) /
          lengthSquared
      )
    );

  return Math.hypot(
    ax + projection * dx,
    ay + projection * dy
  );
}

function ringDistanceMeters(
  longitude: number,
  latitude: number,
  ring: Position[]
): number {
  let minimum =
    Number.POSITIVE_INFINITY;

  for (
    let index = 0;
    index < ring.length;
    index += 1
  ) {
    const a =
      ring[index];

    const b =
      ring[
        (index + 1) %
        ring.length
      ];

    if (
      !a ||
      !b
    ) {
      continue;
    }

    minimum =
      Math.min(
        minimum,
        pointToSegmentDistanceMeters(
          longitude,
          latitude,
          a,
          b
        )
      );
  }

  return minimum;
}

function polygonDistanceMeters(
  longitude: number,
  latitude: number,
  rings: Position[][]
): number {
  if (
    pointInPolygon(
      [longitude, latitude],
      rings
    )
  ) {
    return 0;
  }

  return Math.min(
    ...rings.map(
      ring =>
        ringDistanceMeters(
          longitude,
          latitude,
          ring
        )
    )
  );
}

export function areaDistanceMeters(
  area: GeoArea,
  longitude: number,
  latitude: number
): number {
  if (
    area.type ===
    "Polygon"
  ) {
    return polygonDistanceMeters(
      longitude,
      latitude,
      area.coordinates
    );
  }

  return Math.min(
    ...area.coordinates.map(
      polygon =>
        polygonDistanceMeters(
          longitude,
          latitude,
          polygon
        )
    )
  );
}
