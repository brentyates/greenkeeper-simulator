#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GENERATORS=(
    "$SCRIPT_DIR/generators/decorative/rock_small/generate.py"
    "$SCRIPT_DIR/generators/decorative/rock_large/generate.py"
    "$SCRIPT_DIR/generators/decorative/fountain_decorative/generate.py"
    "$SCRIPT_DIR/generators/decorative/statue/generate.py"
)

for script in "${GENERATORS[@]}"; do
    echo ""
    echo "=========================================="
    echo "Running: $script"
    echo "=========================================="
    blender --background --python "$script"
done

echo ""
echo "All decorative assets generated."
