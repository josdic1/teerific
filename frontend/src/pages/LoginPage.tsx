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

function formatUsPhoneInput(
  raw: string,
): string {
  let digits =
    raw.replace(/\D/g, "");

  if (
    digits.length > 10 &&
    digits.startsWith("1")
  ) {
    digits =
      digits.slice(1);
  }

  digits =
    digits.slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(
      0,
      3,
    )}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(
    0,
    3,
  )}) ${digits.slice(
    3,
    6,
  )}-${digits.slice(6)}`;
}

function hasCompleteUsPhone(
  raw: string,
): boolean {
  return (
    raw.replace(/\D/g, "")
      .length === 10
  );
}

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
    trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
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

function phoneEnding(
  raw: string,
): string {
  const digits =
    raw.replace(/\D/g, "");

  return digits.slice(-4);
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
      switch (body.error) {
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
    searchParams.get("next");

  const next =
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
      ? rawNext
      : "/golf";

  const [
    step,
    setStep,
  ] = useState<Step>("phone");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    challengeId,
    setChallengeId,
  ] = useState<string | null>(
    null,
  );

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
  ] = useState<string | null>(
    null,
  );

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

          if (!response.ok) {
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

          if (cancelled) {
            return;
          }

          if (
            parsed.user
              .displayName ===
            null
          ) {
            setStep("profile");
          } else {
            navigate(
              next,
              {
                replace:
                  true,
              },
            );
          }
        } catch (caught) {
          if (!cancelled) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to check your session.",
            );
          }
        } finally {
          if (!cancelled) {
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
    setWorking(true);
    setError(null);

    try {
      const parsedInput =
        RequestPhonePinInputSchema
          .safeParse({
            phoneNumber:
              normalizePhoneNumber(
                phone,
              ),
          });

      if (!parsedInput.success) {
        throw new Error(
          "Enter a valid phone number, including area code.",
        );
      }

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
                parsedInput.data,
              ),
          },
        );

      if (!response.ok) {
        throw new Error(
          await readApiError(
            response,
          ),
        );
      }

      const result =
        RequestPhonePinResponseSchema
          .parse(
            await response.json(),
          );

      setChallengeId(
        result.challengeId,
      );

      setCode("");
      setStep("pin");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to send code.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function verifyPin() {
    if (!challengeId) {
      setError(
        "PIN challenge is missing.",
      );
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const input =
        VerifyPhonePinInputSchema
          .parse({
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

      if (!response.ok) {
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
        setStep("profile");
        return;
      }

      navigate(
        next,
        {
          replace:
            true,
        },
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to verify code.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function saveProfile() {
    setWorking(true);
    setError(null);

    try {
      const input =
        UpdateAccountInputSchema
          .parse({
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

      if (!response.ok) {
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
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save profile.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-page auth-premium-page">
        <section className="auth-premium-shell">
          <div className="brand">
            TEERIFIC
          </div>

          <div className="auth-loading">
            Checking session…
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page auth-premium-page">
      <section className="auth-premium-shell">
        <div className="brand">
          TEERIFIC
        </div>

        {step === "phone" && (
          <div className="auth-stage">
            <header className="auth-premium-hero">
              <h1>
                What’s your number?
              </h1>

              <p>
                We’ll send a 6-digit
                sign-in code.
              </p>
            </header>

            <form
              className="auth-premium-form"
              onSubmit={event => {
                event.preventDefault();
                void requestPin();
              }}
            >
              <label className="auth-minimal-field">
                <span>
                  Mobile
                </span>

                <input
                  className="auth-premium-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="(973) 271-9511"
                  value={phone}
                  onChange={event => {
                    setPhone(
                      formatUsPhoneInput(
                        event.target.value,
                      ),
                    );
                  }}
                />
              </label>

              <button
                type="submit"
                className="auth-premium-submit"
                disabled={
                  working ||
                  !hasCompleteUsPhone(
                    phone,
                  )
                }
              >
                {working
                  ? "Sending…"
                  : "Continue"}
              </button>
            </form>
          </div>
        )}

        {step === "pin" && (
          <div className="auth-stage">
            <header className="auth-premium-hero">
              <h1>
                Enter your code
              </h1>

              <p>
                Sent to ••• •••{" "}
                {phoneEnding(phone)}
              </p>
            </header>

            <form
              className="auth-premium-form"
              onSubmit={event => {
                event.preventDefault();
                void verifyPin();
              }}
            >
              <label className="auth-minimal-field auth-pin-field">
                <span>
                  6-digit code
                </span>

                <input
                  className="auth-premium-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={event => {
                    setCode(
                      event.target.value
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
                className="auth-premium-submit"
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
                className="auth-text-action"
                disabled={working}
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setChallengeId(
                    null,
                  );
                  setError(null);
                }}
              >
                Change number
              </button>
            </form>
          </div>
        )}

        {step === "profile" && (
          <div className="auth-stage">
            <header className="auth-premium-hero">
              <h1>
                What should we call you?
              </h1>

              <p>
                This is the name your
                Clubhouse will see.
              </p>
            </header>

            <form
              className="auth-premium-form"
              onSubmit={event => {
                event.preventDefault();
                void saveProfile();
              }}
            >
              <label className="auth-minimal-field">
                <span>
                  Display name
                </span>

                <input
                  className="auth-premium-name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={displayName}
                  onChange={event => {
                    setDisplayName(
                      event.target.value,
                    );
                  }}
                />
              </label>

              <button
                type="submit"
                className="auth-premium-submit"
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
          </div>
        )}

        {error && (
          <div className="auth-premium-error">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}
