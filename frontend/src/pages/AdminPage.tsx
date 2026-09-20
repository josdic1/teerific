import {
  useEffect,
  useState
} from "react";
import {
  Link,
  useNavigate
} from "react-router-dom";
import type {
  AdminClubhouse,
  AdminGolfSummary,
  AdminUser
} from "@teerific/shared";
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
    coordinates: [number, number];
  } | null;
  active: boolean;
};

async function adminJson<T>(
  path: string,
  navigate: ReturnType<typeof useNavigate>
): Promise<T> {
  const response = await fetch(
    `${API_BASE}${path}`,
    { credentials: "include" }
  );

  if (response.status === 401) {
    navigate(
      "/admin/login",
      { replace: true }
    );
    throw new Error("UNAUTHENTICATED");
  }

  if (response.status === 403) {
    throw new Error("Admin access required.");
  }

  if (!response.ok) {
    throw new Error("Could not load admin data.");
  }

  return response.json() as Promise<T>;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clubhouses, setClubhouses] = useState<AdminClubhouse[]>([]);
  const [summary, setSummary] = useState<AdminGolfSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [courseData, userData, clubhouseData, summaryData] =
          await Promise.all([
            adminJson<{ courses: Course[] }>(
              "/api/admin/courses",
              navigate
            ),
            adminJson<{ users: AdminUser[] }>(
              "/api/admin/users",
              navigate
            ),
            adminJson<{ clubhouses: AdminClubhouse[] }>(
              "/api/admin/clubhouses",
              navigate
            ),
            adminJson<{ summary: AdminGolfSummary }>(
              "/api/admin/reports/summary",
              navigate
            )
          ]);

        if (!cancelled) {
          setCourses(courseData.courses);
          setUsers(userData.users);
          setClubhouses(clubhouseData.clubhouses);
          setSummary(summaryData.summary);
        }
      } catch (caught) {
        if (
          !cancelled &&
          !(caught instanceof Error && caught.message === "UNAUTHENTICATED")
        ) {
          setError(
            caught instanceof Error
              ? caught.message
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
      cancelled = true;
    };
  }, [navigate]);

  async function signOut() {
    setSigningOut(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include"
        }
      );

      if (!response.ok && response.status !== 401) {
        throw new Error("Could not sign out.");
      }

      window.location.replace("/admin/login");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
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
            <h1>Overview</h1>
            <p className="muted">
              Users, Clubhouses, rounds and courses.
            </p>
          </div>

          <div className="admin-actions">
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
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        {loading && <p className="muted">Loading admin…</p>}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && summary && (
          <>
            <div className="golf-stats">
              <div className="detail">
                <span className="detail-label">Users</span>
                <strong>{summary.totalUsers}</strong>
              </div>
              <div className="detail">
                <span className="detail-label">Clubhouses</span>
                <strong>{summary.totalClubhouses}</strong>
              </div>
              <div className="detail">
                <span className="detail-label">Rounds</span>
                <strong>{summary.totalRounds}</strong>
              </div>
            </div>

            <div className="eyebrow">USERS</div>
            <div className="admin-course-list">
              {users.map(user => (
                <div key={user.id} className="admin-course-card">
                  <div>
                    <div className="admin-course-name">
                      {user.displayName ?? "Profile incomplete"}
                    </div>
                    <div className="admin-course-meta">
                      {user.isAdmin
                        ? "ADMIN"
                        : user.ownedClubhouses.length > 0
                          ? "MEMBER"
                          : "PARTNER"}
                    </div>
                    <div className="admin-course-address">
                      {user.phoneNumber ?? "No phone"}
                    </div>
                  </div>
                  <div className="admin-course-status">
                    <span className="status-pill status-active">
                      {user.roundCount} rounds
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="eyebrow">CLUBHOUSES</div>
            <div className="admin-course-list">
              {clubhouses.map(clubhouse => (
                <div key={clubhouse.id} className="admin-course-card">
                  <div>
                    <div className="admin-course-name">
                      {clubhouse.name}
                    </div>
                    <div className="admin-course-meta">
                      {clubhouse.primary.displayName ?? "Unknown member"}
                    </div>
                    <div className="admin-course-address">
                      {clubhouse.members.length} partner{clubhouse.members.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="eyebrow">COURSES</div>
            <div className="admin-course-list">
              {courses.map(course => (
                <Link
                  key={course.id}
                  to={`/admin/courses/${course.id}`}
                  className="admin-course-card"
                >
                  <div>
                    <div className="admin-course-name">
                      {course.name}
                    </div>
                    <div className="admin-course-meta">
                      {course.city}, {course.region}
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
                      {course.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <span className="admin-arrow">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
