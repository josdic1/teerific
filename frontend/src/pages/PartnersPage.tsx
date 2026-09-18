import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  AuthResponseSchema,
  ClubhouseSchema,
  type Clubhouse,
} from "@teerific/shared";

import { API_BASE } from "../lib/api";
import {
  normalizePhoneNumber,
} from "./LoginPage";

export default function PartnersPage() {
  const [clubhouse, setClubhouse] =
    useState<Clubhouse | null>(null);
  const [phoneNumber, setPhoneNumber] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [working, setWorking] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function load() {
    setError(null);

    const authResponse =
      await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });

    if (!authResponse.ok) {
      throw new Error("Sign in to manage partners.");
    }

    const auth =
      AuthResponseSchema.parse(
        await authResponse.json(),
      );

    const response =
      await fetch(`${API_BASE}/api/clubhouses`, {
        credentials: "include",
      });

    if (!response.ok) {
      throw new Error("Unable to load partners.");
    }

    const payload =
      await response.json() as {
        clubhouses: unknown[];
      };

    const clubhouses =
      payload.clubhouses.map(item =>
        ClubhouseSchema.parse(item),
      );

    setClubhouse(
      clubhouses.find(
        item =>
          item.primary.id === auth.user.id &&
          item.deactivatedAt === null,
      ) ?? null,
    );
  }

  useEffect(() => {
    void load()
      .catch(caught => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load partners.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function addPartner() {
    if (!clubhouse || !phoneNumber.trim()) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/clubhouses/${encodeURIComponent(
            clubhouse.id,
          )}/members`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              phoneNumber:
                normalizePhoneNumber(phoneNumber),
            }),
          },
        );

      if (!response.ok) {
        const payload =
          await response.json().catch(() => null) as {
            error?: string;
          } | null;

        if (payload?.error === "USER_NOT_FOUND") {
          throw new Error(
            "That phone number does not have a Teerific account yet.",
          );
        }

        if (
          payload?.error ===
          "CLUBHOUSE_MEMBER_ALREADY_EXISTS"
        ) {
          throw new Error(
            "That partner is already in your Clubhouse.",
          );
        }

        throw new Error(
          payload?.error ?? "Unable to add partner.",
        );
      }

      setPhoneNumber("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to add partner.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="golf-page">
      <section className="golf-card">
        <header className="topbar">
          <Link to="/golf" className="brand">
            TEERIFIC
          </Link>

          <Link
            to="/golf"
            className="signout-button"
          >
            Back
          </Link>
        </header>

        <div className="golf-hero">
          <div className="eyebrow">
            PARTNERS
          </div>

          <h1>
            Who can see your round?
          </h1>
        </div>

        {loading ? (
          <p className="muted">
            Loading partners…
          </p>
        ) : clubhouse ? (
          <>
            <div className="course-confirmation">
              <input
                type="tel"
                value={phoneNumber}
                placeholder="Partner phone number"
                disabled={working}
                onChange={event => {
                  setPhoneNumber(event.target.value);
                }}
              />

              <button
                type="button"
                className="primary-button"
                disabled={
                  working || !phoneNumber.trim()
                }
                onClick={() => {
                  void addPartner();
                }}
              >
                {working
                  ? "Adding…"
                  : "Add Partner"}
              </button>
            </div>

            <div className="hole-timeline">
              {clubhouse.members
                .filter(
                  member =>
                    member.deactivatedAt === null,
                )
                .map(member => (
                  <div
                    key={member.id}
                    className="hole-timeline-row"
                  >
                    <span>
                      {member.user.displayName}
                    </span>

                    <strong>
                      Active
                    </strong>
                  </div>
                ))}

              {clubhouse.members.filter(
                member =>
                  member.deactivatedAt === null,
              ).length === 0 && (
                <p className="muted">
                  No partners yet.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="muted">
            No active Clubhouse found.
          </p>
        )}

        {error && (
          <div className="soft-error">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}
