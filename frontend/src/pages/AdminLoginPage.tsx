import {
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";
import {
  AdminLoginInputSchema,
  AuthResponseSchema,
} from "@teerific/shared";
import { API_BASE } from "../lib/api";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch(
          `${API_BASE}/api/auth/me`,
          { credentials: "include" },
        );

        if (response.status === 401) {
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to check admin session.");
        }

        const auth = AuthResponseSchema.parse(
          await response.json(),
        );

        if (!cancelled && auth.user.isAdmin) {
          navigate("/admin", { replace: true });
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to check admin session.",
          );
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function signIn() {
    setWorking(true);
    setError(null);

    try {
      const input = AdminLoginInputSchema.parse({
        username,
        password,
      });

      const response = await fetch(
        `${API_BASE}/api/auth/admin/login`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => null) as { error?: string } | null;

        if (body?.error === "INVALID_ADMIN_CREDENTIALS") {
          throw new Error("Invalid admin username or password.");
        }

        throw new Error("Unable to sign in as admin.");
      }

      const auth = AuthResponseSchema.parse(
        await response.json(),
      );

      if (!auth.user.isAdmin) {
        throw new Error("Admin access required.");
      }

      navigate("/admin", { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to sign in as admin.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-page auth-premium-page">
        <section className="auth-premium-shell">
          <div className="brand">TEERIFIC ADMIN</div>
          <div className="auth-loading">Checking session…</div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page auth-premium-page">
      <section className="auth-premium-shell">
        <div className="brand">TEERIFIC ADMIN</div>

        <div className="auth-stage">
          <header className="auth-premium-hero">
            <h1>Admin sign in</h1>
            <p>No phone number required.</p>
          </header>

          <form
            className="auth-premium-form"
            onSubmit={event => {
              event.preventDefault();
              void signIn();
            }}
          >
            <label className="auth-minimal-field">
              <span>Username</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
              />
            </label>

            <label className="auth-minimal-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </label>

            <button
              type="submit"
              className="auth-premium-submit"
              disabled={
                working ||
                !username.trim() ||
                !password
              }
            >
              {working ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {error && (
          <div className="auth-premium-error">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}
