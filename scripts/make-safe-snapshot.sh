#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Refuse to create a snapshot if source changes are not committed.
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo "STOP: repository has uncommitted or untracked files."
  echo "Commit or remove them before creating a canonical snapshot."
  git status --short
  exit 1
fi

# Backstop: refuse to archive if a secret-like file somehow became tracked.
TRACKED_SECRETS="$(
  git ls-files |
  grep -E '(^|/)\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$' |
  grep -vE '(^|/)\.env(\.[^.]+)?\.example$|(^|/)\.env\.example$' \
  || true
)"

if [[ -n "$TRACKED_SECRETS" ]]; then
  echo "STOP: secret-like files are tracked by Git:"
  echo "$TRACKED_SECRETS"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
COMMIT="$(git rev-parse --short HEAD)"
OUT="$HOME/Downloads/teerific-working-${STAMP}-${COMMIT}.tar.gz"

# git archive includes committed files only.
# Ignored .env files cannot enter this archive.
git archive \
  --format=tar.gz \
  --output="$OUT" \
  HEAD

echo "✓ Safe snapshot created:"
echo "$OUT"
echo
echo "✓ Archive contains committed Git files only"
echo "✓ .env and private keys excluded"
