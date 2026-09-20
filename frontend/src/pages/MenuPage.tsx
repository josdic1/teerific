import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthResponseSchema, type CurrentUser } from "@teerific/shared";
import { API_BASE } from "../lib/api";

export default function MenuPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(async response => {
        if (!response.ok) throw new Error("Sign in to continue.");
        const auth = AuthResponseSchema.parse(await response.json());
        setUser(auth.user);
      })
      .catch(caught => {
        setError(caught instanceof Error ? caught.message : "Unable to load account.");
      });
  }, []);

  async function signOut() {
    setWorking(true);
    setError(null);
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      navigate("/login", { replace: true });
    } catch {
      setError("Unable to sign out.");
    } finally {
      setWorking(false);
    }
  }

  const name = user?.displayName ?? "Account";
  const initial = name.trim().charAt(0).toUpperCase() || "T";

  return (
    <main className="golf-page">
      <section className="golf-card luxury-panel">
        <header className="topbar">
          <Link to={user?.userType === "partner" ? "/partners" : "/golf"} className="brand">
            TEERIFIC
          </Link>
          <div className="user-identity user-identity-static">
            <span className="user-identity-badge">{initial}</span>
            <span className="user-identity-name">{name}</span>
          </div>
        </header>

        <div className="luxury-menu-hero">
          <div className="eyebrow">PRIVATE MENU</div>
          <h1>{name}</h1>
        </div>

        <nav className="luxury-menu" aria-label="Account menu">
          {user?.userType === "member" && (
            <Link to="/golf" className="luxury-menu-row">
              <span>Play Golf</span><span aria-hidden="true">›</span>
            </Link>
          )}
          <Link to="/partners" className="luxury-menu-row">
            <span>{user?.userType === "partner" ? "Golfer" : "Partners"}</span><span aria-hidden="true">›</span>
          </Link>
          <Link to="/notifications" className="luxury-menu-row">
            <span>Notifications</span><span aria-hidden="true">›</span>
          </Link>
          <Link to="/account" className="luxury-menu-row">
            <span>Account</span><span aria-hidden="true">›</span>
          </Link>
          <button type="button" className="luxury-menu-row luxury-menu-button" disabled={working} onClick={() => { void signOut(); }}>
            <span>Sign out</span><span aria-hidden="true">›</span>
          </button>
        </nav>

        {error && <div className="soft-error">{error}</div>}
      </section>
    </main>
  );
}
