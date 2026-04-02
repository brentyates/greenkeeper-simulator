#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GENERATORS_DIR="$SCRIPT_DIR/generators/building"

BLENDER="${BLENDER:-blender}"

BUILDINGS=(
    clubhouse_small
    clubhouse_medium
    maintenance_shed
    cart_barn
    pump_house
    starter_hut
)

FAILED=0
SUCCEEDED=0

for building in "${BUILDINGS[@]}"; do
    echo ""
    echo "======================================================================"
    echo "  Generating: $building"
    echo "======================================================================"

    if "$BLENDER" --background --python "$GENERATORS_DIR/$building/generate.py"; then
        SUCCEEDED=$((SUCCEEDED + 1))
    else
        echo "FAILED: $building"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "======================================================================"
echo "  Results: $SUCCEEDED succeeded, $FAILED failed out of ${#BUILDINGS[@]}"
echo "======================================================================"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
