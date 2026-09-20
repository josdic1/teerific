import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AuthResponseSchema,
  ClubhouseSchema,
  type Clubhouse,
  type CurrentUser,
} from "@teerific/shared";
import { API_BASE } from "../lib/api";

type NotificationKey =
  | "roundStarts"
  | "backNineStarts"
  | "hole18Starts"
  | "roundEnds"
  | "headingHome";

const alerts: Array<{ key: NotificationKey; label: string }> = [
  { key: "roundStarts", label: "Round starts" },
  { key: "backNineStarts", label: "Back nine starts" },
  { key: "hole18Starts", label: "Hole 18 starts" },
  { key: "roundEnds", label: "Round ends" },
  { key: "headingHome", label: "Heading home" },
];

export default function NotificationsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [clubhouses, setClubhouses] = useState<Clubhouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);

    const authResponse = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
    });
    if (!authResponse.ok) throw new Error("Sign in to continue.");
    const auth = AuthResponseSchema.parse(await authResponse.json());
    setUser(auth.user);

    const response = await fetch(`${API_BASE}/api/clubhouses`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Unable to load notification settings.");
    const payload = await response.json() as { clubhouses: unknown[] };
    setClubhouses(payload.clubhouses.map(item => ClubhouseSchema.parse(item)));
  }

  useEffect(() => {
    void load()
      .catch(caught => setError(caught instanceof Error ? caught.message : "Unable to load notification settings."))
      .finally(() => setLoading(false));
  }, []);

  const followed = user
    ? clubhouses.flatMap(clubhouse =>
        clubhouse.members
          .filter(member =>
            member.user.id === user.id &&
            member.deactivatedAt === null &&
            clubhouse.deactivatedAt === null
          )
          .map(member => ({ clubhouse, member }))
      )
    : [];

  async function toggle(
    clubhouse: Clubhouse,
    memberId: string,
    key: NotificationKey,
    current: boolean,
  ) {
    const member = clubhouse.members.find(item => item.id === memberId);
    if (!member) return;

    const next = {
      ...member.notifications,
      [key]: !current,
    };

    setWorkingId(`${memberId}:${key}`);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/clubhouses/${encodeURIComponent(clubhouse.id)}/notifications`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        },
      );
      if (!response.ok) throw new Error("Unable to save notification setting.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save notification setting.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="golf-page">
      <section className="golf-card luxury-panel">
        <header className="topbar">
          <Link to="/menu" className="brand">TEERIFIC</Link>
          <Link to="/menu" className="signout-button">Done</Link>
        </header>

        <div className="luxury-menu-hero">
          <div className="eyebrow">NOTIFICATIONS</div>
          <h1>Notify me when</h1>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : followed.length === 0 ? (
          <p className="muted">Notification choices appear when you are connected to a golfer.</p>
        ) : (
          followed.map(({ clubhouse, member }) => (
            <section className="notification-group" key={member.id}>
              <div className="notification-golfer">
                {clubhouse.primary.displayName ?? clubhouse.name}
              </div>

              <div className="notification-list" aria-label={`Notifications for ${clubhouse.primary.displayName ?? clubhouse.name}`}>
                {alerts.map(({ key, label }) => {
                  const on = member.notifications[key];
                  const busy = workingId === `${member.id}:${key}`;

                  return (
                    <button
                      type="button"
                      className="notification-row notification-button"
                      key={key}
                      disabled={busy}
                      aria-pressed={on}
                      onClick={() => {
                        void toggle(clubhouse, member.id, key, on);
                      }}
                    >
                      <span>{label}</span>
                      <span className={on ? "notification-state notification-state-on" : "notification-state"}>
                        {on ? "ON" : "OFF"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {error && <div className="soft-error">{error}</div>}
      </section>
    </main>
  );
}
