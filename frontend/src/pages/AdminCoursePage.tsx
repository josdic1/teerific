import {
  useEffect,
  useState
} from "react";
import {
  Link,
  useParams
} from "react-router-dom";
import {
  API_BASE
} from "../lib/api";

type GeoPoint = {
  type: "Point";
  coordinates: [
    number,
    number
  ];
};

type Course = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  region: string;
  countryCode: string;
  timezone: string;
  departureLocation:
    GeoPoint | null;
  active: boolean;
};

type Hole = {
  id: string;
  courseId: string;
  holeNumber: number;
  par: number | null;
  yardage: number | null;
  boundary: unknown | null;
};

export default function AdminCoursePage() {
  const {
    courseId
  } = useParams();

  const [
    course,
    setCourse
  ] = useState<Course | null>(
    null
  );

  const [
    holes,
    setHoles
  ] = useState<Hole[]>([]);

  const [
    error,
    setError
  ] = useState<string | null>(
    null
  );

  useEffect(
    () => {
      if (!courseId) {
        setError(
          "Course ID is missing."
        );
        return;
      }

      let cancelled =
        false;

      async function load() {
        try {
          const response =
            await fetch(
              `${API_BASE}/api/admin/courses/${courseId}`,
              {
                credentials:
                  "include"
              }
            );

          if (!response.ok) {
            throw new Error(
              response.status === 404
                ? "Course not found."
                : "Could not load course."
            );
          }

          const payload =
            await response.json() as {
              course:
                Course;
              holes:
                Hole[];
            };

          if (!cancelled) {
            setCourse(
              payload.course
            );

            setHoles(
              [...payload.holes]
                .sort(
                  (a, b) =>
                    a.holeNumber -
                    b.holeNumber
                )
            );
          }
        } catch (
          loadError
        ) {
          if (!cancelled) {
            setError(
              loadError instanceof
                Error
                ? loadError.message
                : "Could not load course."
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
    [
      courseId
    ]
  );

  if (error) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <Link
            to="/admin"
            className="admin-back"
          >
            ← Courses
          </Link>

          <p className="error-message">
            {error}
          </p>
        </section>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <p className="muted">
            Loading course…
          </p>
        </section>
      </main>
    );
  }

  const departure =
    course.departureLocation
      ?.coordinates;

  return (
    <main className="admin-page">
      <section className="admin-panel">
        <Link
          to="/admin"
          className="admin-back"
        >
          ← Courses
        </Link>

        <header className="admin-course-detail-header">
          <div>
            <div className="eyebrow">
              COURSE
            </div>

            <h1>
              {course.name}
            </h1>

            <p className="muted">
              {course.address}
              <br />
              {course.city},{" "}
              {course.region}{" "}
              {course.countryCode}
            </p>
          </div>

          <span
            className={
              course.active
                ? "status-pill status-active"
                : "status-pill"
            }
          >
            {course.active
              ? "ACTIVE"
              : "INACTIVE"}
          </span>
        </header>

        <div className="admin-course-facts">
          <div className="admin-fact">
            <span>
              Holes
            </span>
            <strong>
              {holes.length}
            </strong>
          </div>

          <div className="admin-fact">
            <span>
              Departure
            </span>
            <strong>
              {departure
                ? "SET"
                : "MISSING"}
            </strong>
          </div>

          <div className="admin-fact">
            <span>
              Timezone
            </span>
            <strong>
              {course.timezone}
            </strong>
          </div>
        </div>

        {departure && (
          <div className="admin-departure">
            <div className="eyebrow">
              CLUBHOUSE / DEPARTURE
            </div>

            <div>
              {departure[1].toFixed(6)},{" "}
              {departure[0].toFixed(6)}
            </div>
          </div>
        )}

        <div className="admin-holes-heading">
          <div>
            <div className="eyebrow">
              COURSE GEOMETRY
            </div>

            <h2>
              {holes.length} holes
            </h2>
          </div>
        </div>

        <div className="admin-hole-grid">
          {holes.map(
            hole => (
              <div
                key={hole.id}
                className="admin-hole-card"
              >
                <div className="admin-hole-number">
                  {hole.holeNumber}
                </div>

                <div>
                  <strong>
                    Hole{" "}
                    {hole.holeNumber}
                  </strong>

                  <div className="admin-course-meta">
                    {hole.par
                      ? `Par ${hole.par}`
                      : "Par —"}
                    {" · "}
                    {hole.boundary
                      ? "Detection ready"
                      : "No boundary"}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}
