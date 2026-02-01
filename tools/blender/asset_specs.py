"""
Asset Specifications for Greenkeeper Simulator

Defines exact dimensions and requirements for each asset type.
Used by export_glb.py for validation.
"""

# =============================================================================
# CORE UNITS
# =============================================================================
# 1 Blender unit = 1 game tile = ~1 meter
# All measurements in Blender units

TILE_SIZE = 1.0
CHARACTER_HEIGHT = 1.8  # Standard human height

# =============================================================================
# ASSET SPECIFICATIONS
# =============================================================================
# Each spec defines:
#   - height_range: (min, max) acceptable height
#   - footprint: (width, depth) base size on ground
#   - origin: where the origin point should be
#   - notes: modeling guidance

ASSET_SPECS = {
    # -------------------------------------------------------------------------
    # CHARACTERS
    # -------------------------------------------------------------------------
    "character.greenkeeper": {
        "height_range": (1.75, 1.85),
        "footprint": (0.5, 0.5),
        "origin": "base_center",  # Feet on ground, centered
        "required_animations": ["idle", "walk", "push"],
        "notes": "Main player character. Green outfit."
    },
    "character.employee": {
        "height_range": (1.70, 1.85),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "required_animations": ["idle", "walk", "push"],
        "notes": "Worker NPC. Brown/tan outfit."
    },

    # -------------------------------------------------------------------------
    # TREES - Golf course trees
    # -------------------------------------------------------------------------
    "tree.pine.small": {
        "height_range": (3.0, 4.0),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Young pine tree. Conical shape."
    },
    "tree.pine.medium": {
        "height_range": (5.0, 7.0),
        "footprint": (2.5, 2.5),
        "origin": "base_center",
        "notes": "Mature pine. Classic golf course tree."
    },
    "tree.pine.large": {
        "height_range": (8.0, 12.0),
        "footprint": (4.0, 4.0),
        "origin": "base_center",
        "notes": "Large established pine."
    },
    "tree.oak.small": {
        "height_range": (3.0, 5.0),
        "footprint": (2.0, 2.0),
        "origin": "base_center",
        "notes": "Young oak. Rounded canopy."
    },
    "tree.oak.medium": {
        "height_range": (6.0, 9.0),
        "footprint": (4.0, 4.0),
        "origin": "base_center",
        "notes": "Mature oak with spreading canopy."
    },
    "tree.oak.large": {
        "height_range": (10.0, 15.0),
        "footprint": (6.0, 6.0),
        "origin": "base_center",
        "notes": "Grand old oak. Dominant landmark tree."
    },
    "tree.palm": {
        "height_range": (4.0, 8.0),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Palm tree. Thin trunk, crown at top."
    },
    "tree.willow": {
        "height_range": (5.0, 8.0),
        "footprint": (4.0, 4.0),
        "origin": "base_center",
        "notes": "Weeping willow. Near water features."
    },
    "tree.cypress": {
        "height_range": (6.0, 12.0),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Tall narrow cypress. Good for lining fairways."
    },

    # -------------------------------------------------------------------------
    # SHRUBS & BUSHES
    # -------------------------------------------------------------------------
    "shrub.hedge": {
        "height_range": (0.8, 1.5),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Trimmed hedge section."
    },
    "shrub.flowering": {
        "height_range": (0.5, 1.2),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Ornamental flowering bush."
    },

    # -------------------------------------------------------------------------
    # EQUIPMENT
    # -------------------------------------------------------------------------
    "equipment.mower": {
        "height_range": (0.8, 1.2),
        "footprint": (0.6, 1.0),
        "origin": "base_center",
        "notes": "Push mower. Handle reaches to ~1.0 height."
    },
    "equipment.spreader": {
        "height_range": (0.6, 1.0),
        "footprint": (0.5, 0.8),
        "origin": "base_center",
        "notes": "Fertilizer/seed spreader with hopper."
    },
    "equipment.sprinkler-handheld": {
        "height_range": (0.3, 0.5),
        "footprint": (0.3, 0.5),
        "origin": "base_center",
        "notes": "Handheld sprinkler wand."
    },

    # -------------------------------------------------------------------------
    # IRRIGATION
    # -------------------------------------------------------------------------
    "irrigation.pipe-straight": {
        "height_range": (0.1, 0.2),
        "footprint": (1.0, 0.2),
        "origin": "base_center",
        "notes": "1-tile straight pipe segment."
    },
    "irrigation.pipe-corner": {
        "height_range": (0.1, 0.2),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "90-degree corner piece."
    },
    "irrigation.pipe-tee": {
        "height_range": (0.1, 0.2),
        "footprint": (1.0, 0.5),
        "origin": "base_center",
        "notes": "T-junction."
    },
    "irrigation.pipe-cross": {
        "height_range": (0.1, 0.2),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "4-way cross junction."
    },
    "irrigation.sprinkler-head": {
        "height_range": (0.1, 0.25),
        "footprint": (0.2, 0.2),
        "origin": "base_center",
        "notes": "Pop-up sprinkler head."
    },
    "irrigation.water-source": {
        "height_range": (0.3, 0.5),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "Water pump/well head."
    },

    # -------------------------------------------------------------------------
    # PROPS
    # -------------------------------------------------------------------------
    "prop.flag": {
        "height_range": (2.0, 2.5),
        "footprint": (0.1, 0.1),
        "origin": "base_center",
        "notes": "Hole flag on pole."
    },
    "prop.tee-marker": {
        "height_range": (0.2, 0.4),
        "footprint": (0.15, 0.15),
        "origin": "base_center",
        "notes": "Tee box marker."
    },
    "prop.ball": {
        "height_range": (0.04, 0.05),
        "footprint": (0.04, 0.04),
        "origin": "center",  # Centered on ball
        "notes": "Golf ball. ~42mm diameter."
    },
    "prop.bench": {
        "height_range": (0.8, 1.0),
        "footprint": (1.5, 0.6),
        "origin": "base_center",
        "notes": "Course bench for players."
    },
    "prop.trash-bin": {
        "height_range": (0.8, 1.2),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "Waste bin."
    },
    "prop.ball-washer": {
        "height_range": (0.8, 1.0),
        "footprint": (0.3, 0.3),
        "origin": "base_center",
        "notes": "Ball washer station."
    },
}


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
    return [k for k in ASSET_SPECS.keys() if k.startswith(category + ".")]
