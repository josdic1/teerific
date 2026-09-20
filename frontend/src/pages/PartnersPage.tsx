import {
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import {
  AuthResponseSchema,
  ClubhouseSchema,
  type Clubhouse,
  type CurrentUser,
} from "@teerific/shared";

import { API_BASE } from "../lib/api";
import {
  normalizePhoneNumber,
} from "./LoginPage";

export default function PartnersPage() {
  const navigate =
    useNavigate();
  const [user, setUser] =
    useState<CurrentUser | null>(null);
  const [clubhouse, setClubhouse] =
    useState<Clubhouse | null>(null);
  const [followedClubhouses, setFollowedClubhouses] =
    useState<Clubhouse[]>([]);
  const [phoneNumber, setPhoneNumber] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [working, setWorking] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] =
    useState<string | null>(null);
  const [editingName, setEditingName] =
    useState("");

  async function load() {
    setError(null);

    const authResponse =
      await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });

    if (!authResponse.ok) {
      throw new Error("Sign in to continue.");
    }

    const auth =
      AuthResponseSchema.parse(
        await authResponse.json(),
      );

    setUser(auth.user);

    const response =
      await fetch(`${API_BASE}/api/clubhouses`, {
        credentials: "include",
      });

    if (!response.ok) {
      throw new Error("Unable to load Clubhouse access.");
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

    setFollowedClubhouses(
      clubhouses.filter(
        item =>
          item.deactivatedAt === null &&
          item.members.some(
            member =>
              member.user.id === auth.user.id &&
              member.deactivatedAt === null,
          ),
      ),
    );
  }

  useEffect(() => {
    void load()
      .catch(caught => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load Clubhouse access.",
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

  async function signOut() {
    setWorking(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/auth/logout`,
          {
            method: "POST",
            credentials: "include",
          },
        );

      if (
        !response.ok &&
        response.status !== 401
      ) {
        throw new Error(
          "Unable to sign out.",
        );
      }

      navigate(
        "/login",
        { replace: true },
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to sign out.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function setPartnerActive(
    membershipId: string,
    active: boolean,
  ) {
    if (!clubhouse) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/clubhouses/${encodeURIComponent(
            clubhouse.id,
          )}/members/${encodeURIComponent(
            membershipId,
          )}/${active ? "reactivate" : "deactivate"}`,
          {
            method: "PATCH",
            credentials: "include",
          },
        );

      if (!response.ok) {
        throw new Error(
          active
            ? "Unable to reactivate partner."
            : "Unable to deactivate partner.",
        );
      }

      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update partner.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function savePartnerName(
    membershipId: string,
  ) {
    if (
      !clubhouse ||
      !editingName.trim()
    ) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/clubhouses/${encodeURIComponent(
            clubhouse.id,
          )}/members/${encodeURIComponent(
            membershipId,
          )}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              displayName: editingName.trim(),
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          "Unable to update partner name.",
        );
      }

      setEditingMemberId(null);
      setEditingName("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update partner name.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function removePartner(
    membershipId: string,
    displayName: string | null,
  ) {
    if (!clubhouse) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove ${displayName ?? "this partner"} from your Clubhouse?`,
      );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${API_BASE}/api/clubhouses/${encodeURIComponent(
            clubhouse.id,
          )}/members/${encodeURIComponent(
            membershipId,
          )}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );

      if (!response.ok) {
        throw new Error(
          "Unable to remove partner.",
        );
      }

      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to remove partner.",
      );
    } finally {
      setWorking(false);
    }
  }

  const isPartner =
    user?.userType === "partner";

  return (
    <main className="golf-page">
      <section className="golf-card">
        <header className="topbar">
          <Link to="/" className="brand">
            TEERIFIC
          </Link>

          <div className="topbar-actions">
            <Link
              to="/"
              className="signout-button"
            >
              Back
            </Link>

            <button
              type="button"
              className="signout-button"
              disabled={working}
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </button>

            {user && (
              <Link
                to="/menu"
                className="user-identity user-identity-link"
                title={user.displayName ?? "Account"}
              >
                <span className="user-identity-badge">
                  {(user.displayName ?? "T").trim().charAt(0).toUpperCase()}
                </span>
                <span className="user-identity-name">
                  {user.displayName ?? "Account"}
                </span>
              </Link>
            )}
          </div>
        </header>

        <div className="golf-hero">
          <div className="eyebrow">
            {isPartner ? "FOLLOWING" : "PARTNERS"}
          </div>

          <h1>
            {isPartner
              ? "Your golfer"
              : "Who can see your round?"}
          </h1>
        </div>

        {loading ? (
          <p className="muted">
            Loading…
          </p>
        ) : isPartner ? (
          <div className="hole-timeline">
            {followedClubhouses.map(item => (
              <Link
                key={item.id}
                to={`/status/${item.primary.id}`}
                className="hole-timeline-row"
              >
                <span>
                  {item.primary.displayName ?? item.name}
                </span>
                <strong>View live status</strong>
              </Link>
            ))}

            {followedClubhouses.length === 0 && (
              <p className="muted">
                You are not connected to a golfer yet.
              </p>
            )}
          </div>
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

            <div className="hole-timeline partner-list">
              {clubhouse.members.map(member => {
                const active =
                  member.deactivatedAt === null;

                const editing =
                  editingMemberId === member.id;

                return (
                  <div
                    key={member.id}
                    className="partner-record"
                  >
                    <div className="partner-record-main">
                      {editing ? (
                        <input
                          className="partner-name-input"
                          type="text"
                          maxLength={100}
                          value={editingName}
                          disabled={working}
                          onChange={event => {
                            setEditingName(
                              event.target.value,
                            );
                          }}
                        />
                      ) : (
                        <strong className="partner-record-name">
                          {member.displayName ??
                            member.user.displayName ??
                            "Partner"}
                        </strong>
                      )}

                      <span
                        className={
                          active
                            ? "partner-state partner-state-active"
                            : "partner-state"
                        }
                      >
                        {active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="partner-record-actions">
                      {editing ? (
                        <>
                          <button
                            type="button"
                            className="signout-button"
                            disabled={
                              working ||
                              !editingName.trim()
                            }
                            onClick={() => {
                              void savePartnerName(
                                member.id,
                              );
                            }}
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            className="signout-button"
                            disabled={working}
                            onClick={() => {
                              setEditingMemberId(null);
                              setEditingName("");
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="signout-button"
                          disabled={working}
                          onClick={() => {
                            setEditingMemberId(
                              member.id,
                            );
                            setEditingName(
                              member.displayName ??
                              member.user.displayName ??
                              "",
                            );
                          }}
                        >
                          Edit name
                        </button>
                      )}

                      <button
                        type="button"
                        className="signout-button"
                        disabled={working}
                        onClick={() => {
                          void setPartnerActive(
                            member.id,
                            !active,
                          );
                        }}
                      >
                        {active
                          ? "Deactivate"
                          : "Reactivate"}
                      </button>

                      <button
                        type="button"
                        className="partner-remove-button"
                        disabled={working}
                        onClick={() => {
                          void removePartner(
                            member.id,
                            member.displayName ??
                              member.user.displayName,
                          );
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              {clubhouse.members.length === 0 && (
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
