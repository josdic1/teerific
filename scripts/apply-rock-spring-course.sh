#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$ROOT_DIR/backend/database/migrations/008_rock_spring_course.sql"

echo "Rock Spring Golf Club migration applied."
