#!/usr/bin/env bash
set -euo pipefail

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GENERATORS="$SCRIPT_DIR/generators/course"

ASSETS=(
    flag
    tee_marker_red
    tee_marker_white
    tee_marker_blue
    tee_marker_gold
    bunker_rake
    yardage_100
    yardage_150
    yardage_200
    ball
    cup
)

FAILED=0

for asset in "${ASSETS[@]}"; do
    echo ""
    echo "========================================"
    echo "Generating: course/$asset"
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
