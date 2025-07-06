#!/usr/bin/env bash
set -euo pipefail

echo "Running eas-build-pre-install.sh" 

if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "GOOGLE_SERVICES_JSON environment variable is missing" >&2
  exit 1
fi

OUTPUT_DIR="android/app"
mkdir -p "$OUTPUT_DIR"

echo "$GOOGLE_SERVICES_JSON" | base64 --decode > "$OUTPUT_DIR/google-services.json"

echo "google-services.json written to $OUTPUT_DIR/google-services.json"

