#!/usr/bin/env bash
# Serves the built VitePress docs locally and checks every internal link for 404s.
# Requires: python3, curl
# Usage: ./scripts/check-docs-links.sh

set -euo pipefail

DIST="${DIST:-docs/.vitepress/dist}"
PORT="${PORT:-4173}"

if [ ! -d "$DIST" ]; then
  echo "Building docs first..."
  npm run docs:build
fi

# Start Python's built-in HTTP server (fast, no npm required)
python3 -m http.server "$PORT" --directory "$DIST" 2>/dev/null &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null || true' EXIT

# Poll until ready (up to 5s)
BASE_URL="http://localhost:$PORT"
for _ in $(seq 1 20); do
  if curl -s -o /dev/null "$BASE_URL" 2>/dev/null; then break; fi
  sleep 0.25
done

FAILED=0
CHECKED=0

echo "Checking links under $BASE_URL ..."

while IFS= read -r -d '' html_file; do
  rel="${html_file#$DIST}"
  url="http://localhost:$PORT${rel}"
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  CHECKED=$((CHECKED + 1))
  if [ "$status" != "200" ]; then
    echo "FAIL [$status] $url"
    FAILED=$((FAILED + 1))
  else
    echo "OK   [$status] $url"
  fi
done < <(find "$DIST" -name "*.html" -print0)

echo ""
echo "Checked $CHECKED pages — $FAILED failures."
[ "$FAILED" -eq 0 ]
