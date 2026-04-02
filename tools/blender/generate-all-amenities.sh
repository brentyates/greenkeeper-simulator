#!/usr/bin/env bash
set -euo pipefail

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GENERATORS="$SCRIPT_DIR/generators/amenity"

ASSETS=(
    bench
    trash_bin
    ball_washer
    drinking_fountain
    cooler
    shelter_small
    restroom
    snack_bar
)

FAILED=0

for asset in "${ASSETS[@]}"; do
    echo ""
    echo "========================================"
    echo "Generating: amenity/$asset"
    echo "========================================"
    if "$BLENDER" --background --python "$GENERATORS/$asset/generate.py" 2>&1; then
        echo "OK: $asset"
    else
        echo "FAILED: $asset"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "========================================"
echo "Done. ${#ASSETS[@]} assets attempted, $FAILED failed."
echo "========================================"

exit $FAILED
