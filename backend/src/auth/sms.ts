import twilio from "twilio";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function client() {
  return twilio(
    requiredEnv("TWILIO_ACCOUNT_SID"),
    requiredEnv("TWILIO_AUTH_TOKEN")
  );
}

function serviceSid(): string {
  return requiredEnv("TWILIO_VERIFY_SERVICE_SID");
}

export async function sendPhonePinSms(
  phoneNumber: string
): Promise<void> {
  await client().verify.v2
    .services(serviceSid())
    .verifications.create({
      to: phoneNumber,
      channel: "sms"
    });
}

export async function verifyPhonePinSms(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  try {
    const result =
      await client().verify.v2
        .services(serviceSid())
        .verificationChecks.create({
          to: phoneNumber,
          code
        });

    return result.status === "approved";
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404
    ) {
      return false;
    }

    throw error;
  }
}
