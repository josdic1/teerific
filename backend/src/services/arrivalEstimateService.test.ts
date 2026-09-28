import assert from "node:assert/strict";
import test from "node:test";
import type {
  LiveGolferState
} from "@teerific/shared";
import {
  googleRoutesProvider
} from "../routing/googleRoutesProvider.js";
import {
  estimateArrival
} from "./arrivalEstimateService.js";

test(
  "reuses Google route while keeping latest golf finish time",
  async () => {
    const original =
      googleRoutesProvider.computeDrivingRoute;

    let calls = 0;

    googleRoutesProvider.computeDrivingRoute =
      async () => {
        calls += 1;

        return {
          durationSeconds: 600,
          distanceMeters: 5000
        };
      };

    const now =
      new Date("2026-09-28T15:00:00.000Z");

    const state = (
      finish: string
    ): LiveGolferState => ({
      golfer: {
        id: "11111111-1111-4111-8111-111111111111",
        displayName: "Golfer"
      },
      playing: true,
      round: null,
      course: null,
      currentHole: null,
      latestLocation: null,
      holesCompleted: 0,
      totalHoles: 18,
      pace: {
        asOf: now.toISOString(),
        completedHoles: 0,
        averageCompletedHoleMinutes: null,
        currentHoleElapsedMinutes: null,
        estimatedMinutesRemaining: 60,
        estimatedFinishAt: finish,
        basis: "course_history",
        sampleSize: 1
      },
      lastUpdatedAt: now.toISOString()
    });

    const origin = {
      source: "course_departure_location" as const,
      courseId: "22222222-2222-4222-8222-222222222222",
      courseName: "Test Course",
      latitude: 40.75,
      longitude: -74.26
    };

    const target = {
      source: "viewer_current_location" as const,
      label: null,
      latitude: 40.76,
      longitude: -74.27,
      accuracyMeters: 10,
      recordedAt: now.toISOString()
    };

    try {
      const first =
        await estimateArrival({
          state:
            state(
              "2026-09-28T16:00:00.000Z"
            ),
          origin,
          target,
          now
        });

      const second =
        await estimateArrival({
          state:
            state(
              "2026-09-28T16:02:00.000Z"
            ),
          origin,
          target,
          now
        });

      assert.equal(calls, 1);

      assert.equal(
        first.status === "available"
          ? first.estimatedArrivalAt
          : null,
        "2026-09-28T16:10:00.000Z"
      );

      assert.equal(
        second.status === "available"
          ? second.estimatedArrivalAt
          : null,
        "2026-09-28T16:12:00.000Z"
      );
    } finally {
      googleRoutesProvider.computeDrivingRoute =
        original;
    }
  }
);
