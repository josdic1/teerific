import assert from "node:assert/strict";
import test from "node:test";
import type {
  QueryResult,
  QueryResultRow
} from "pg";
import type {
  LocationUpdateInput
} from "@teerific/shared";
import type {
  DbExecutor
} from "../db/transaction.js";

process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/test";

const {
  recordLocationSample
} = await import(
  "./locationRepository.js"
);

const ROUND_ID =
  "11111111-1111-4111-8111-111111111111";

const USER_ID =
  "22222222-2222-4222-8222-222222222222";

const COURSE_ID =
  "33333333-3333-4333-8333-333333333333";

const SAMPLE_ID =
  "44444444-4444-4444-8444-444444444444";

const LOCATION_ID =
  "55555555-5555-4555-8555-555555555555";

function queryResult<R extends QueryResultRow>(
  rows: R[]
): QueryResult<R> {
  return {
    command:
      "SELECT",
    rowCount:
      rows.length,
    oid:
      0,
    fields:
      [],
    rows
  };
}

function locationInput(
  overrides:
    Partial<LocationUpdateInput> = {}
): LocationUpdateInput {
  return {
    sampleId:
      SAMPLE_ID,
    latitude:
      41.204,
    longitude:
      -73.643,
    accuracyMeters:
      5,
    altitudeMeters:
      null,
    speedMetersPerSecond:
      1.5,
    headingDegrees:
      90,
    recordedAt:
      new Date().toISOString(),
    ...overrides
  };
}

function activeRoundRow() {
  return {
    id:
      ROUND_ID,
    course_id:
      COURSE_ID,
    ended_at:
      null
  };
}

function storedLocationRow(
  input: LocationUpdateInput
) {
  return {
    id:
      LOCATION_ID,
    round_id:
      ROUND_ID,
    client_sample_id:
      input.sampleId,
    detected_hole_id:
      null,
    latitude:
      input.latitude,
    longitude:
      input.longitude,
    accuracy_meters:
      input.accuracyMeters,
    altitude_meters:
      input.altitudeMeters,
    speed_meters_per_second:
      input.speedMetersPerSecond,
    heading_degrees:
      input.headingDegrees,
    recorded_at:
      new Date(input.recordedAt),
    created_at:
      new Date()
  };
}

test(
  "records one fresh unique fix",
  async () => {
    const input =
      locationInput();

    const statements:
      string[] =
      [];

    const db: DbExecutor = {
      async query<R extends QueryResultRow>(
        text: string
      ): Promise<QueryResult<R>> {
        statements.push(text);

        if (
          text.includes(
            "FROM rounds"
          )
        ) {
          return queryResult([
            activeRoundRow()
          ]) as unknown as QueryResult<R>;
        }

        if (
          text.includes(
            "duplicate_reason"
          )
        ) {
          return queryResult(
            []
          ) as QueryResult<R>;
        }

        if (
          text.includes(
            "FROM holes"
          ) ||
          text.includes(
            "SELECT\n          detected_hole_id"
          )
        ) {
          return queryResult(
            []
          ) as QueryResult<R>;
        }

        if (
          text.includes(
            "INSERT INTO location_samples"
          )
        ) {
          return queryResult([
            storedLocationRow(
              input
            )
          ]) as unknown as QueryResult<R>;
        }

        throw new Error(
          `Unexpected query: ${text}`
        );
      }
    };

    const result =
      await recordLocationSample(
        ROUND_ID,
        USER_ID,
        input,
        db
      );

    assert.equal(
      result.type,
      "recorded"
    );

    assert.equal(
      statements.filter(
        statement =>
          statement.includes(
            "INSERT INTO location_samples ("
          )
      ).length,
      1
    );
  }
);

test(
  "returns the accepted row when sample identity is replayed",
  async () => {
    const input =
      locationInput();

    const statements:
      string[] =
      [];

    const db: DbExecutor = {
      async query<R extends QueryResultRow>(
        text: string
      ): Promise<QueryResult<R>> {
        statements.push(text);

        if (
          text.includes(
            "FROM rounds"
          )
        ) {
          return queryResult([
            activeRoundRow()
          ]) as unknown as QueryResult<R>;
        }

        if (
          text.includes(
            "duplicate_reason"
          )
        ) {
          return queryResult([
            {
              ...storedLocationRow(
                input
              ),
              duplicate_reason:
                "duplicate_sample_id"
            }
          ]) as unknown as QueryResult<R>;
        }

        if (
          text.includes(
            "INSERT INTO location_sample_rejections"
          )
        ) {
          return queryResult(
            []
          ) as QueryResult<R>;
        }

        throw new Error(
          `Unexpected query: ${text}`
        );
      }
    };

    const result =
      await recordLocationSample(
        ROUND_ID,
        USER_ID,
        input,
        db
      );

    assert.equal(
      result.type,
      "duplicate"
    );

    if (
      result.type ===
      "duplicate"
    ) {
      assert.equal(
        result.reason,
        "duplicate_sample_id"
      );
      assert.equal(
        result.sample.id,
        LOCATION_ID
      );
    }

    assert.equal(
      statements.some(
        statement =>
          statement.includes(
            "INSERT INTO location_samples ("
          )
      ),
      false
    );
  }
);

test(
  "rejects the same device fix timestamp even with a new sample identity",
  async () => {
    const input =
      locationInput({
        sampleId:
          "66666666-6666-4666-8666-666666666666"
      });

    const acceptedInput = {
      ...input,
      sampleId:
        SAMPLE_ID
    };

    const statements:
      string[] =
      [];

    const db: DbExecutor = {
      async query<R extends QueryResultRow>(
        text: string
      ): Promise<QueryResult<R>> {
        statements.push(text);

        if (
          text.includes(
            "FROM rounds"
          )
        ) {
          return queryResult([
            activeRoundRow()
          ]) as unknown as QueryResult<R>;
        }

        if (
          text.includes(
            "duplicate_reason"
          )
        ) {
          return queryResult([
            {
              ...storedLocationRow(
                acceptedInput
              ),
              duplicate_reason:
                "duplicate_recorded_at"
            }
          ]) as unknown as QueryResult<R>;
        }

        if (
          text.includes(
            "INSERT INTO location_sample_rejections"
          )
        ) {
          return queryResult(
            []
          ) as QueryResult<R>;
        }

        throw new Error(
          `Unexpected query: ${text}`
        );
      }
    };

    const result =
      await recordLocationSample(
        ROUND_ID,
        USER_ID,
        input,
        db
      );

    assert.equal(
      result.type,
      "duplicate"
    );

    if (
      result.type ===
      "duplicate"
    ) {
      assert.equal(
        result.reason,
        "duplicate_recorded_at"
      );
      assert.equal(
        result.sample.sampleId,
        SAMPLE_ID
      );
    }

    assert.equal(
      statements.some(
        statement =>
          statement.includes(
            "INSERT INTO location_samples ("
          )
      ),
      false
    );
  }
);

test(
  "rejects a stale fix before hole detection",
  async () => {
    const input =
      locationInput({
        recordedAt:
          new Date(
            Date.now() -
            6 * 60 * 1000
          ).toISOString()
      });

    const statements:
      string[] =
      [];

    const db: DbExecutor = {
      async query<R extends QueryResultRow>(
        text: string
      ): Promise<QueryResult<R>> {
        statements.push(text);

        if (
          text.includes(
            "FROM rounds"
          )
        ) {
          return queryResult([
            activeRoundRow()
          ]) as unknown as QueryResult<R>;
        }

        if (
          text.includes(
            "INSERT INTO location_sample_rejections"
          )
        ) {
          return queryResult(
            []
          ) as QueryResult<R>;
        }

        throw new Error(
          `Unexpected query: ${text}`
        );
      }
    };

    const result =
      await recordLocationSample(
        ROUND_ID,
        USER_ID,
        input,
        db
      );

    assert.deepEqual(
      result,
      {
        type:
          "stale",
        reason:
          "too_old"
      }
    );

    assert.equal(
      statements.some(
        statement =>
          statement.includes(
            "FROM holes"
          )
      ),
      false
    );
  }
);
