import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  AuthResponseSchema,
  RequestPhonePinInputSchema,
  RequestPhonePinResponseSchema,
  UpdateAccountInputSchema,
  VerifyPhonePinInputSchema,
} from "@teerific/shared";

import { API_BASE } from "../lib/api";


type Step =
  | "phone"
  | "pin"
  | "profile";

function normalizePhoneNumber(
  raw: string,
): string {
  const trimmed =
    raw.trim();

  if (
    trimmed.startsWith("+")
  ) {
    return (
      "+" +
      trimmed
        .slice(1)
        .replace(/\D/g, "")
    );
  }

  const digits =
    trimmed.replace(
      /\D/g,
      "",
    );

  if (
    digits.length === 10
  ) {
    return `+1${digits}`;
  }

  if (
    digits.length === 11 &&
    digits.startsWith("1")
  ) {
    return `+${digits}`;
  }

  return trimmed;
}

async function readApiError(
  response: Response,
): Promise<string> {
  try {
    const body =
      await response.json() as {
        error?: unknown;
      };

    if (
      typeof body.error ===
      "string"
    ) {
      switch (
        body.error
      ) {
        case "INVALID_OR_EXPIRED_PIN":
          return "That code is invalid or expired.";

        case "INVALID_REQUEST":
          return "Please check the information and try again.";

        default:
          return body.error;
      }
    }
  } catch {
    // Fall through.
  }

  return `Request failed (${response.status}).`;
}

export default function LoginPage() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] = useSearchParams();

  const rawNext =
    searchParams.get(
      "next",
    );

  const next =
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
      ? rawNext
      : "/golf";

  const [
    step,
    setStep,
  ] = useState<Step>(
    "phone",
  );

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    challengeId,
    setChallengeId,
  ] = useState<
    string | null
  >(null);

  const [
    code,
    setCode,
  ] = useState("");

  const [
    displayName,
    setDisplayName,
  ] = useState("");

  const [
    working,
    setWorking,
  ] = useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  useEffect(
    () => {
      let cancelled =
        false;

      async function checkSession() {
        try {
          const response =
            await fetch(
              `${API_BASE}/api/auth/me`,
              {
                credentials:
                  "include",
              },
            );

          if (
            response.status ===
            401
          ) {
            return;
          }

          if (
            !response.ok
          ) {
            throw new Error(
              await readApiError(
                response,
              ),
            );
          }

          const parsed =
            AuthResponseSchema.parse(
              await response.json(),
            );

          if (
            cancelled
          ) {
            return;
          }

          if (
            parsed.user
              .displayName ===
            null
          ) {
            setStep(
              "profile",
            );
          } else {
            navigate(
              next,
              {
                replace:
                  true,
              },
            );
          }
        } catch (
          caught
        ) {
          if (
            !cancelled
          ) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to check your session.",
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setCheckingSession(
              false,
            );
          }
        }
      }

      void checkSession();

      return () => {
        cancelled =
          true;
      };
    },
    [
      navigate,
      next,
    ],
  );

  async function requestPin() {
    setWorking(
      true,
    );

    setError(
      null,
    );

    try {
      const input =
        RequestPhonePinInputSchema.parse({
          phoneNumber:
            normalizePhoneNumber(
              phone,
            ),
        });

      const response =
        await fetch(
          `${API_BASE}/api/auth/pin/request`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                input,
              ),
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      const result =
        RequestPhonePinResponseSchema.parse(
          await response.json(),
        );

      setChallengeId(
        result.challengeId,
      );

      setStep(
        "pin",
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to send code.",
      );
    } finally {
      setWorking(
        false,
      );
    }
  }

  async function verifyPin() {
    if (
      !challengeId
    ) {
      setError(
        "PIN challenge is missing.",
      );

      return;
    }

    setWorking(
      true,
    );

    setError(
      null,
    );

    try {
      const input =
        VerifyPhonePinInputSchema.parse({
          challengeId,

          code,
        });

      const response =
        await fetch(
          `${API_BASE}/api/auth/pin/verify`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                input,
              ),
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      const result =
        AuthResponseSchema.parse(
          await response.json(),
        );

      if (
        result.user
          .displayName ===
        null
      ) {
        setStep(
          "profile",
        );

        return;
      }

      navigate(
        next,
        {
          replace:
            true,
        },
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to verify code.",
      );
    } finally {
      setWorking(
        false,
      );
    }
  }

  async function saveProfile() {
    setWorking(
      true,
    );

    setError(
      null,
    );

    try {
      const input =
        UpdateAccountInputSchema.parse({
          displayName,
        });

      const response =
        await fetch(
          `${API_BASE}/api/auth/me`,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                input,
              ),
          },
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      AuthResponseSchema.parse(
        await response.json(),
      );

      navigate(
        next,
        {
          replace:
            true,
        },
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save profile.",
      );
    } finally {
      setWorking(
        false,
      );
    }
  }

  if (
    checkingSession
  ) {
    return (
      <main className="golf-page">
        <section className="golf-card">
          <div className="brand">
            TEERIFIC
          </div>

          <p className="muted">
            Checking session…
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="golf-page">
      <section className="golf-card">
        <div className="brand">
          TEERIFIC
        </div>

        {step ===
          "phone" && (
          <>
            <div className="golf-hero">
              <div className="eyebrow">
                SIGN IN
              </div>

              <h1>
                Your phone
              </h1>

              <p className="muted">
                We’ll send you a 6-digit sign-in code.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={event => {
                event.preventDefault();
                void requestPin();
              }}
            >
              <label className="auth-field">
                <span>
                  Phone number
                </span>

                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="(973) 555-0123"
                  value={phone}
                  onChange={event => {
                    setPhone(
                      event.target.value,
                    );
                  }}
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  working
                }
              >
                {working
                  ? "Sending…"
                  : "Send code"}
              </button>
            </form>
          </>
        )}

        {step ===
          "pin" && (
          <>
            <div className="golf-hero">
              <div className="eyebrow">
                VERIFY
              </div>

              <h1>
                Enter code
              </h1>

              <p className="muted">
                Enter the 6-digit code sent to your phone.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={event => {
                event.preventDefault();
                void verifyPin();
              }}
            >
              <label className="auth-field">
                <span>
                  Code
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={event => {
                    setCode(
                      event.target
                        .value
                        .replace(
                          /\D/g,
                          "",
                        )
                        .slice(
                          0,
                          6,
                        ),
                    );
                  }}
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  working ||
                  code.length !== 6
                }
              >
                {working
                  ? "Signing in…"
                  : "Sign in"}
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={
                  working
                }
                onClick={() => {
                  setStep(
                    "phone",
                  );

                  setCode("");
                  setChallengeId(
                    null,
                  );
                  setError(
                    null,
                  );
                }}
              >
                Use another number
              </button>
            </form>
          </>
        )}

        {step ===
          "profile" && (
          <>
            <div className="golf-hero">
              <div className="eyebrow">
                PROFILE
              </div>

              <h1>
                What should we call you?
              </h1>

              <p className="muted">
                This is the name your Clubhouse will see.
              </p>
            </div>

            <form
              className="auth-form"
              onSubmit={event => {
                event.preventDefault();
                void saveProfile();
              }}
            >
              <label className="auth-field">
                <span>
                  Display name
                </span>

                <input
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={
                    displayName
                  }
                  onChange={event => {
                    setDisplayName(
                      event.target.value,
                    );
                  }}
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  working ||
                  !displayName.trim()
                }
              >
                {working
                  ? "Saving…"
                  : "Continue"}
              </button>
            </form>
          </>
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
