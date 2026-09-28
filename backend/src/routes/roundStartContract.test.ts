import assert from "node:assert/strict";
import test from "node:test";
import {
  StartRoundInputSchema
} from "@teerific/shared";

const location = {
  sampleId:
    "11111111-1111-4111-8111-111111111111",
  latitude: 40.75,
  longitude: -74.26,
  accuracyMeters: 10,
  altitudeMeters: null,
  speedMetersPerSecond: null,
  headingDegrees: null,
  recordedAt:
    new Date().toISOString()
};

test(
  "manual round start requires location",
  () => {
    assert.equal(
      StartRoundInputSchema.safeParse({
        courseDetectionMethod:
          "manual",
        courseId:
          "22222222-2222-4222-8222-222222222222"
      }).success,
      false
    );
  }
);

test(
  "manual round start accepts full location",
  () => {
    assert.equal(
      StartRoundInputSchema.safeParse({
        courseDetectionMethod:
          "manual",
        courseId:
          "22222222-2222-4222-8222-222222222222",
        location
      }).success,
      true
    );
  }
);
