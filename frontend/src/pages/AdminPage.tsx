import {
  useEffect,
  useState
} from "react";
import {
  Link
} from "react-router-dom";
import {
  API_BASE
} from "../lib/api";

type Course = {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  region: string;
  countryCode: string;
  timezone: string;
  departureLocation: {
    type: "Point";
    coordinates: [
      number,
      number
    ];
  } | null;
  active: boolean;
};

export default function AdminPage() {
  const [
    courses,
    setCourses
  ] = useState<Course[]>([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState<string | null>(
    null
  );

  const [
    signingOut,
    setSigningOut
  ] = useState(false);

  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        try {
          const response =
            await fetch(
              `${API_BASE}/api/admin/courses`,
              {
                credentials:
                  "include"
              }
            );

          if (!response.ok) {
            throw new Error(
              response.status === 403
                ? "Admin access required."
                : "Could not load courses."
            );
          }

          const payload =
            await response.json() as {
              courses:
                Course[];
            };

          if (!cancelled) {
            setCourses(
              payload.courses
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
                : "Could not load admin."
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    []
  );

  async function signOut() {
    setSigningOut(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/auth/logout`,
          {
            method:
              "POST",

            credentials:
              "include"
          }
        );

      if (
        !response.ok &&
        response.status !== 401
      ) {
        throw new Error(
          "Could not sign out."
        );
      }

      window.location.replace(
        "/login"
      );
    } catch (
      signOutError
    ) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "Could not sign out."
      );

      setSigningOut(false);
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-panel">
        <header className="admin-header">
          <div>
            <div className="eyebrow">
              TEERIFIC ADMIN
            </div>

            <h1>
              Courses
            </h1>

            <p className="muted">
              Permanent course geography,
              hole detection zones and
              departure points.
            </p>
          </div>

          <div className="admin-actions">
            <Link
              className="secondary-button admin-action-button"
              to="/golf"
            >
              Golfer view
            </Link>

            <Link
              className="primary-button admin-action-button"
              to="/admin/field-course"
            >
              Map course
            </Link>

            <button
              type="button"
              className="secondary-button admin-action-button"
              disabled={signingOut}
              onClick={() => {
                void signOut();
              }}
            >
              {signingOut
                ? "Signing out…"
                : "Sign out"}
            </button>
          </div>
        </header>

        {loading && (
          <p className="muted">
            Loading courses…
          </p>
        )}

        {error && (
          <p className="error-message">
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          courses.length === 0 && (
            <div className="admin-empty">
              No courses yet.
            </div>
          )}

        <div className="admin-course-list">
          {courses.map(
            course => (
              <Link
                key={course.id}
                to={
                  `/admin/courses/${course.id}`
                }
                className="admin-course-card"
              >
                <div>
                  <div className="admin-course-name">
                    {course.name}
                  </div>

                  <div className="admin-course-meta">
                    {course.city},{" "}
                    {course.region}
                  </div>

                  <div className="admin-course-address">
                    {course.address}
                  </div>
                </div>

                <div className="admin-course-status">
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

                  <span className="admin-arrow">
                    →
                  </span>
                </div>
              </Link>
            )
          )}
        </div>
      </section>
    </main>
  );
}
