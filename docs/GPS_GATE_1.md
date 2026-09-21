# GPS Gate 1 — Sample Integrity

## Invariant

One device location fix can create at most one accepted location sample for a round.

Each fix now carries:

- `sampleId`: client-generated UUID used for safe retries
- `recordedAt`: timestamp created by Core Location or the browser
- `receivedAt`: timestamp assigned when PostgreSQL accepts the sample

The database independently prevents two accepted rows with either the same `(round_id, client_sample_id)` or `(round_id, recorded_at)`.

## Freshness policy

- Accept fixes up to 5 minutes old.
- Allow at most 60 seconds of future clock skew.
- Preserve rejected attempts in `location_sample_rejections`.
- Preserve pre-migration duplicates in that rejection table before removing them from canonical `location_samples`.

## API outcomes

`POST /api/rounds/:id/location-samples` returns:

- `201 { outcome: "recorded", sample }`
- `200 { outcome: "duplicate", reason, sample }`
- `200 { outcome: "stale", reason, sample: null }`

A retry uses the same `sampleId`. The iPhone retries network failures and server errors up to three times. If the first request succeeded but its response was lost, the retry returns the original accepted row rather than inserting another.

## Diagnostics

The backend emits one JSON log event per attempt:

```json
{
  "event": "teerific.location_sample",
  "receivedAt": "...",
  "roundId": "...",
  "sampleId": "...",
  "recordedAt": "...",
  "outcome": "recorded | duplicate | stale",
  "reason": "..."
}
```

Debug iPhone builds log the fix timestamp, coordinate, accuracy, sample identity, retries, HTTP status, and API outcome. Production builds do not print coordinates.

## Deployment order

This is an intentional contract migration, not a compatibility shim.

1. Back up the production database.
2. Apply `007_location_sample_integrity.sql`.
3. Deploy the backend and frontend from the same commit.
4. Build and install the matching iPhone app.
5. Confirm `npm run check` passes from a clean checkout.
6. Run the controlled iPhone field check in the master checklist.

Do not deploy the new backend while an older iPhone build is still expected to upload samples: older builds do not send `sampleId` and will correctly receive `400 INVALID_REQUEST`.

## Local automated check

Run:

```bash
npm run check
```

This runs type checking, nine focused GPS checks, and production builds. It does not replace applying the migration to a disposable PostgreSQL database or testing Core Location on a physical iPhone.
