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
