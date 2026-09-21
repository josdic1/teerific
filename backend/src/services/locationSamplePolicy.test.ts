import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LOCATION_AGE_MS,
  MAX_LOCATION_FUTURE_SKEW_MS,
  classifyLocationTimestamp
} from "./locationSamplePolicy.js";

const receivedAt =
  new Date("2026-09-21T12:00:00.000Z");

test(
  "accepts a current device fix",
  () => {
    assert.deepEqual(
      classifyLocationTimestamp(
        new Date(
          receivedAt.getTime() -
          10_000
        ),
        receivedAt
      ),
      {
        accepted:
          true
      }
    );
  }
);

test(
  "accepts the oldest permitted fix",
  () => {
    assert.deepEqual(
      classifyLocationTimestamp(
        new Date(
          receivedAt.getTime() -
          MAX_LOCATION_AGE_MS
        ),
        receivedAt
      ),
      {
        accepted:
          true
      }
    );
  }
);

test(
  "rejects an older fix",
  () => {
    assert.deepEqual(
      classifyLocationTimestamp(
        new Date(
          receivedAt.getTime() -
          MAX_LOCATION_AGE_MS -
          1
        ),
        receivedAt
      ),
      {
        accepted:
          false,
        reason:
          "too_old"
      }
    );
  }
);

test(
  "accepts the maximum future clock skew",
  () => {
    assert.deepEqual(
      classifyLocationTimestamp(
        new Date(
          receivedAt.getTime() +
          MAX_LOCATION_FUTURE_SKEW_MS
        ),
        receivedAt
      ),
      {
        accepted:
          true
      }
    );
  }
);

test(
  "rejects a future-dated fix beyond the permitted skew",
  () => {
    assert.deepEqual(
      classifyLocationTimestamp(
        new Date(
          receivedAt.getTime() +
          MAX_LOCATION_FUTURE_SKEW_MS +
          1
        ),
        receivedAt
      ),
      {
        accepted:
          false,
        reason:
          "future_dated"
      }
    );
  }
);
