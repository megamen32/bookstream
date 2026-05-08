#!/usr/bin/env bash
set -euo pipefail

PORT=3123
HOST=127.0.0.1
BASE_URL="http://${HOST}:${PORT}"
LOG_FILE="${TMPDIR:-/tmp}/bookstream-playwright-e2e.log"

npm run build >/dev/null

./node_modules/.bin/next start -p "${PORT}" -H "${HOST}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

for _ in $(seq 1 120); do
  if curl -sf "${BASE_URL}/test/feed-reader" >/dev/null; then
    BASE_URL="${BASE_URL}" playwright test
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for ${BASE_URL}/test/feed-reader" >&2
echo "Server log:" >&2
cat "${LOG_FILE}" >&2
exit 1
