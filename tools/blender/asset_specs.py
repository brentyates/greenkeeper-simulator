"""
Asset Specifications for Greenkeeper Simulator

This module reads from the generated JSON manifest (asset_manifest.json).
The TypeScript file (src/babylon/assets/AssetManifest.ts) is the SINGLE SOURCE OF TRUTH.

To regenerate the JSON: npm run assets:manifest
"""

import json
import os

# Path to generated JSON manifest
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MANIFEST_PATH = os.path.join(SCRIPT_DIR, "asset_manifest.json")


def _load_manifest():
    """Load the asset manifest from JSON."""
    if not os.path.exists(MANIFEST_PATH):
        raise FileNotFoundError(
            f"Asset manifest not found at {MANIFEST_PATH}\n"
            "Run 'npm run assets:manifest' to generate it from TypeScript."
        )

    with open(MANIFEST_PATH, 'r') as f:
        return json.load(f)


# Load manifest on module import
_MANIFEST = None

def _get_manifest():
    """Lazy-load the manifest."""
    global _MANIFEST
    if _MANIFEST is None:
        _MANIFEST = _load_manifest()
    return _MANIFEST


# Expose constants
@property
def TILE_SIZE():
    return _get_manifest()["constants"]["tile_size"]

@property
def CHARACTER_HEIGHT():
    return _get_manifest()["constants"]["character_height"]


# For backwards compatibility, expose ASSET_SPECS dict
# This converts from the JSON format back to the original format
def _get_asset_specs():
    """Get asset specs in the original format."""
    manifest = _get_manifest()
    specs = {}
    for asset_id, spec in manifest["assets"].items():
        specs[asset_id] = {
            "path": spec["path"],
            "height_range": tuple(spec["height_range"]),
            "footprint": tuple(spec["footprint"]),
            "origin": spec["origin"],
            "notes": spec.get("notes", ""),
        }
        if spec.get("animations"):
            specs[asset_id]["required_animations"] = spec["animations"]
    return specs


# Lazily computed ASSET_SPECS for backwards compatibility
class _AssetSpecsProxy:
    """Proxy class that lazily loads ASSET_SPECS."""
    _specs = None

    def __getitem__(self, key):
        if self._specs is None:
            self._specs = _get_asset_specs()
        return self._specs[key]

    def __contains__(self, key):
        if self._specs is None:
            self._specs = _get_asset_specs()
        return key in self._specs

    def get(self, key, default=None):
        if self._specs is None:
            self._specs = _get_asset_specs()
        return self._specs.get(key, default)

    def keys(self):
        if self._specs is None:
            self._specs = _get_asset_specs()
        return self._specs.keys()

    def values(self):
        if self._specs is None:
            self._specs = _get_asset_specs()
        return self._specs.values()

    def items(self):
        if self._specs is None:
            self._specs = _get_asset_specs()
        return self._specs.items()

    def __iter__(self):
        if self._specs is None:
            self._specs = _get_asset_specs()
        return iter(self._specs)


ASSET_SPECS = _AssetSpecsProxy()


def get_spec(asset_id: str) -> dict | None:
    """Get specification for an asset ID."""
    return ASSET_SPECS.get(asset_id)


def validate_dimensions(asset_id: str, height: float, width: float, depth: float) -> list[str]:
    """
    Validate asset dimensions against spec.
    Returns list of error messages (empty if valid).
    """
    spec = get_spec(asset_id)
    if not spec:
        return [f"Unknown asset ID: {asset_id}"]

    errors = []

    # Check height
    min_h, max_h = spec["height_range"]
    if height < min_h or height > max_h:
        errors.append(
            f"Height {height:.2f} out of range [{min_h:.2f}, {max_h:.2f}]"
        )

    # Check footprint
    max_w, max_d = spec["footprint"]
    if width > max_w * 1.1:  # 10% tolerance
        errors.append(f"Width {width:.2f} exceeds max footprint {max_w:.2f}")
    if depth > max_d * 1.1:
        errors.append(f"Depth {depth:.2f} exceeds max footprint {max_d:.2f}")

    return errors


def list_assets_by_category(category: str) -> list[str]:
    """List all asset IDs in a category (e.g., 'tree', 'equipment')."""
    prefix = category + "."
    return sorted([k for k in ASSET_SPECS.keys() if k.startswith(prefix)])


def list_all_categories() -> list[str]:
    """List all unique asset categories."""
    categories = set()
    for key in ASSET_SPECS.keys():
        cat = key.split(".")[0]
        categories.add(cat)
    return sorted(categories)


def print_manifest():
    """Print the complete asset manifest."""
    categories = list_all_categories()
    total = 0

    print("=" * 70)
    print("GREENKEEPER SIMULATOR - COMPLETE ASSET MANIFEST")
    print(f"Source: {MANIFEST_PATH}")
    print("=" * 70)

    for cat in categories:
        assets = list_assets_by_category(cat)
        print(f"\n{cat.upper()} ({len(assets)} assets)")
        print("-" * 40)
        for asset_id in assets:
            spec = ASSET_SPECS[asset_id]
            h = spec["height_range"]
            print(f"  {asset_id}")
            print(f"    Height: {h[0]:.1f}-{h[1]:.1f}m  |  {spec.get('notes', '')[:40]}")
        total += len(assets)

    print("\n" + "=" * 70)
    print(f"TOTAL: {total} assets")
    print("=" * 70)


if __name__ == "__main__":
    print_manifest()
