import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthResponseSchema, type CurrentUser } from "@teerific/shared";
import { API_BASE } from "../lib/api";

export default function AccountPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(async response => {
        if (!response.ok) throw new Error("Sign in to continue.");
        const auth = AuthResponseSchema.parse(await response.json());
        setUser(auth.user);
        setName(auth.user.displayName ?? "");
      })
      .catch(caught => setError(caught instanceof Error ? caught.message : "Unable to load account."));
  }, []);

  async function save() {
    if (!user || !user.userType || user.userType === "admin" || !name.trim()) return;
    setWorking(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), userType: user.userType }),
      });
      if (!response.ok) throw new Error("Unable to save name.");
      const auth = AuthResponseSchema.parse(await response.json());
      setUser(auth.user);
      setName(auth.user.displayName ?? "");
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save name.");
    } finally {
      setWorking(false);
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
          <div className="eyebrow">ACCOUNT</div>
          <h1>Your details</h1>
        </div>

        <div className="luxury-form">
          <label className="luxury-field">
            <span>Name</span>
            <input value={name} maxLength={100} disabled={working || user?.userType === "admin"} onChange={event => setName(event.target.value)} />
          </label>
          <div className="luxury-static-row">
            <span>Phone</span>
            <strong>{user?.phoneNumber ?? "—"}</strong>
          </div>
        </div>

        {user?.userType !== "admin" && (
          <button className="primary-button luxury-save" type="button" disabled={working || !name.trim()} onClick={() => { void save(); }}>
            {working ? "Saving…" : "Save"}
          </button>
        )}
        {saved && <p className="luxury-confirmation">Saved.</p>}
        {error && <div className="soft-error">{error}</div>}
      </section>
    </main>
  );
}
