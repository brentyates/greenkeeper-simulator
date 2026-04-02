#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GENERATORS=(
    "$SCRIPT_DIR/generators/characters/golfer_male/generate.py"
    "$SCRIPT_DIR/generators/characters/golfer_female/generate.py"
)

for script in "${GENERATORS[@]}"; do
    echo ""
    echo "=========================================="
    echo "Running: $script"
    echo "=========================================="
    blender --background --python "$script"
done

echo ""
echo "All character assets generated."
