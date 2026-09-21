import type {
  LocationSampleRejectionReason
} from "@teerific/shared";

export const MAX_LOCATION_AGE_MS =
  5 * 60 * 1000;

export const MAX_LOCATION_FUTURE_SKEW_MS =
  60 * 1000;

export type LocationTimestampDecision =
  | {
      accepted: true;
    }
  | {
      accepted: false;
      reason:
        Extract<
          LocationSampleRejectionReason,
          "too_old" | "future_dated"
        >;
    };

export function classifyLocationTimestamp(
  recordedAt: Date,
  receivedAt: Date
): LocationTimestampDecision {
  const ageMilliseconds =
    receivedAt.getTime() -
    recordedAt.getTime();

  if (
    ageMilliseconds >
    MAX_LOCATION_AGE_MS
  ) {
    return {
      accepted:
        false,
      reason:
        "too_old"
    };
  }

  if (
    ageMilliseconds <
    -MAX_LOCATION_FUTURE_SKEW_MS
  ) {
    return {
      accepted:
        false,
      reason:
        "future_dated"
    };
  }

  return {
    accepted:
      true
  };
}
