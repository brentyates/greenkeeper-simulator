"""
Asset Specifications for Greenkeeper Simulator

Complete manifest of ALL assets needed for the game.
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
#   - required_animations: list of animation names (for animated assets)
#   - notes: modeling guidance

ASSET_SPECS = {
    # =========================================================================
    # CHARACTERS
    # =========================================================================
    "character.greenkeeper": {
        "height_range": (1.75, 1.85),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "required_animations": ["idle", "walk", "push"],
        "notes": "Main player character. Green polo shirt, khaki pants."
    },
    "character.employee": {
        "height_range": (1.70, 1.85),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "required_animations": ["idle", "walk", "push"],
        "notes": "Generic worker NPC. Brown/tan work clothes."
    },
    "character.golfer.male": {
        "height_range": (1.70, 1.85),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "required_animations": ["idle", "walk", "swing"],
        "notes": "Male golfer. Polo shirt, slacks, golf cap."
    },
    "character.golfer.female": {
        "height_range": (1.60, 1.75),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "required_animations": ["idle", "walk", "swing"],
        "notes": "Female golfer. Polo shirt, skirt or slacks, visor."
    },

    # =========================================================================
    # TREES
    # =========================================================================
    "tree.pine.small": {
        "height_range": (3.0, 4.0),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Young pine tree. Conical shape, sparse branches."
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
        "notes": "Young oak. Rounded canopy starting to form."
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
        "notes": "Palm tree. Thin trunk, frond crown at top."
    },
    "tree.willow": {
        "height_range": (5.0, 8.0),
        "footprint": (4.0, 4.0),
        "origin": "base_center",
        "notes": "Weeping willow. Drooping branches, near water."
    },
    "tree.cypress": {
        "height_range": (6.0, 12.0),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Tall narrow cypress. Good for lining fairways."
    },
    "tree.maple.small": {
        "height_range": (3.0, 5.0),
        "footprint": (2.0, 2.0),
        "origin": "base_center",
        "notes": "Young maple. Rounded canopy."
    },
    "tree.maple.medium": {
        "height_range": (6.0, 9.0),
        "footprint": (4.0, 4.0),
        "origin": "base_center",
        "notes": "Mature maple. Fall color potential."
    },
    "tree.birch": {
        "height_range": (5.0, 8.0),
        "footprint": (2.0, 2.0),
        "origin": "base_center",
        "notes": "White bark birch. Slender, elegant."
    },
    "tree.magnolia": {
        "height_range": (4.0, 7.0),
        "footprint": (3.0, 3.0),
        "origin": "base_center",
        "notes": "Southern magnolia. Broad leaves, white flowers."
    },
    "tree.dogwood": {
        "height_range": (3.0, 5.0),
        "footprint": (2.5, 2.5),
        "origin": "base_center",
        "notes": "Flowering dogwood. Spring blooms."
    },

    # =========================================================================
    # SHRUBS & BUSHES
    # =========================================================================
    "shrub.hedge": {
        "height_range": (0.8, 1.5),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Trimmed boxwood hedge section."
    },
    "shrub.hedge.tall": {
        "height_range": (1.8, 2.5),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Tall privacy hedge section."
    },
    "shrub.flowering.azalea": {
        "height_range": (0.6, 1.2),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Azalea bush. Pink/white flowers."
    },
    "shrub.flowering.rhododendron": {
        "height_range": (1.0, 2.0),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Rhododendron. Large flower clusters."
    },
    "shrub.ornamental.grass": {
        "height_range": (0.5, 1.2),
        "footprint": (0.8, 0.8),
        "origin": "base_center",
        "notes": "Ornamental fountain grass clump."
    },
    "shrub.juniper": {
        "height_range": (0.4, 0.8),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Low spreading juniper groundcover."
    },

    # =========================================================================
    # FLOWERS & GROUNDCOVER
    # =========================================================================
    "flower.bed.mixed": {
        "height_range": (0.2, 0.4),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Mixed annual flower bed section."
    },
    "flower.bed.roses": {
        "height_range": (0.5, 1.0),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "Rose bush grouping."
    },
    "flower.planter": {
        "height_range": (0.6, 0.8),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "Decorative planter with flowers."
    },

    # =========================================================================
    # EQUIPMENT - HANDHELD
    # =========================================================================
    "equipment.mower.push": {
        "height_range": (0.8, 1.2),
        "footprint": (0.5, 0.8),
        "origin": "base_center",
        "notes": "Push reel mower. Handle height ~1.0m."
    },
    "equipment.spreader": {
        "height_range": (0.8, 1.1),
        "footprint": (0.5, 0.6),
        "origin": "base_center",
        "notes": "Walk-behind broadcast spreader."
    },
    "equipment.sprinkler.handheld": {
        "height_range": (0.3, 0.5),
        "footprint": (0.2, 0.8),
        "origin": "base_center",
        "notes": "Handheld sprinkler wand with hose."
    },
    "equipment.rake": {
        "height_range": (1.4, 1.6),
        "footprint": (0.4, 0.1),
        "origin": "base_center",
        "notes": "Bunker rake. Long handle, wide head."
    },
    "equipment.aerator.manual": {
        "height_range": (0.9, 1.1),
        "footprint": (0.3, 0.3),
        "origin": "base_center",
        "notes": "Manual core aerator tool."
    },
    "equipment.trimmer": {
        "height_range": (1.0, 1.3),
        "footprint": (0.3, 0.3),
        "origin": "base_center",
        "notes": "String trimmer/weed whacker."
    },
    "equipment.blower": {
        "height_range": (0.4, 0.6),
        "footprint": (0.3, 0.5),
        "origin": "base_center",
        "notes": "Backpack leaf blower."
    },
    "equipment.edger": {
        "height_range": (0.9, 1.1),
        "footprint": (0.2, 0.4),
        "origin": "base_center",
        "notes": "Lawn edger tool."
    },

    # =========================================================================
    # EQUIPMENT - VEHICLES
    # =========================================================================
    "vehicle.mower.riding": {
        "height_range": (1.2, 1.6),
        "footprint": (1.2, 2.0),
        "origin": "base_center",
        "notes": "Ride-on lawn mower. Seated operator."
    },
    "vehicle.mower.fairway": {
        "height_range": (1.4, 1.8),
        "footprint": (2.0, 3.0),
        "origin": "base_center",
        "notes": "Large fairway mower with multiple reels."
    },
    "vehicle.mower.greens": {
        "height_range": (1.0, 1.4),
        "footprint": (1.0, 1.8),
        "origin": "base_center",
        "notes": "Precision greens mower. Walking or riding."
    },
    "vehicle.cart.golf": {
        "height_range": (1.6, 1.9),
        "footprint": (1.2, 2.4),
        "origin": "base_center",
        "notes": "Standard 2-person golf cart with bag rack."
    },
    "vehicle.cart.utility": {
        "height_range": (1.4, 1.8),
        "footprint": (1.3, 2.8),
        "origin": "base_center",
        "notes": "Utility cart with cargo bed."
    },
    "vehicle.tractor": {
        "height_range": (2.0, 2.5),
        "footprint": (1.8, 3.5),
        "origin": "base_center",
        "notes": "Small grounds maintenance tractor."
    },
    "vehicle.aerator.ride": {
        "height_range": (1.4, 1.8),
        "footprint": (1.5, 2.5),
        "origin": "base_center",
        "notes": "Ride-on core aerator machine."
    },
    "vehicle.sprayer": {
        "height_range": (1.5, 2.0),
        "footprint": (1.5, 3.0),
        "origin": "base_center",
        "notes": "Ride-on sprayer with tank."
    },

    # =========================================================================
    # IRRIGATION
    # =========================================================================
    "irrigation.pipe.straight": {
        "height_range": (0.1, 0.2),
        "footprint": (1.0, 0.2),
        "origin": "base_center",
        "notes": "1-tile straight pipe segment. Blue PVC look."
    },
    "irrigation.pipe.corner": {
        "height_range": (0.1, 0.2),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "90-degree corner elbow."
    },
    "irrigation.pipe.tee": {
        "height_range": (0.1, 0.2),
        "footprint": (1.0, 0.5),
        "origin": "base_center",
        "notes": "T-junction fitting."
    },
    "irrigation.pipe.cross": {
        "height_range": (0.1, 0.2),
        "footprint": (1.0, 1.0),
        "origin": "base_center",
        "notes": "4-way cross junction."
    },
    "irrigation.sprinkler.popup": {
        "height_range": (0.05, 0.15),
        "footprint": (0.15, 0.15),
        "origin": "base_center",
        "notes": "Pop-up sprinkler head (retracted state)."
    },
    "irrigation.sprinkler.rotor": {
        "height_range": (0.1, 0.2),
        "footprint": (0.2, 0.2),
        "origin": "base_center",
        "notes": "Rotor sprinkler head for large areas."
    },
    "irrigation.valve.box": {
        "height_range": (0.1, 0.15),
        "footprint": (0.4, 0.3),
        "origin": "base_center",
        "notes": "In-ground valve box cover."
    },
    "irrigation.water.source": {
        "height_range": (0.4, 0.6),
        "footprint": (0.6, 0.6),
        "origin": "base_center",
        "notes": "Water pump/well head housing."
    },
    "irrigation.water.tank": {
        "height_range": (1.5, 2.0),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Water storage tank."
    },

    # =========================================================================
    # COURSE FEATURES - HOLES
    # =========================================================================
    "course.flag": {
        "height_range": (2.0, 2.5),
        "footprint": (0.1, 0.1),
        "origin": "base_center",
        "notes": "Hole flag on fiberglass pole. Flag at top."
    },
    "course.cup": {
        "height_range": (0.1, 0.15),
        "footprint": (0.12, 0.12),
        "origin": "base_center",
        "notes": "Hole cup liner. 4.25 inch diameter."
    },
    "course.tee.marker.red": {
        "height_range": (0.15, 0.25),
        "footprint": (0.1, 0.1),
        "origin": "base_center",
        "notes": "Red tee marker. Forward tees."
    },
    "course.tee.marker.white": {
        "height_range": (0.15, 0.25),
        "footprint": (0.1, 0.1),
        "origin": "base_center",
        "notes": "White tee marker. Middle tees."
    },
    "course.tee.marker.blue": {
        "height_range": (0.15, 0.25),
        "footprint": (0.1, 0.1),
        "origin": "base_center",
        "notes": "Blue tee marker. Championship tees."
    },
    "course.tee.marker.gold": {
        "height_range": (0.15, 0.25),
        "footprint": (0.1, 0.1),
        "origin": "base_center",
        "notes": "Gold tee marker. Senior/forward tees."
    },
    "course.yardage.marker.100": {
        "height_range": (0.3, 0.5),
        "footprint": (0.2, 0.2),
        "origin": "base_center",
        "notes": "100-yard marker post."
    },
    "course.yardage.marker.150": {
        "height_range": (0.3, 0.5),
        "footprint": (0.2, 0.2),
        "origin": "base_center",
        "notes": "150-yard marker post."
    },
    "course.yardage.marker.200": {
        "height_range": (0.3, 0.5),
        "footprint": (0.2, 0.2),
        "origin": "base_center",
        "notes": "200-yard marker post."
    },
    "course.ball": {
        "height_range": (0.04, 0.05),
        "footprint": (0.04, 0.04),
        "origin": "center",
        "notes": "Golf ball. 42.67mm diameter."
    },
    "course.bunker.rake": {
        "height_range": (1.4, 1.6),
        "footprint": (0.4, 0.1),
        "origin": "base_center",
        "notes": "Bunker rake (same as equipment.rake, placed in bunker)."
    },

    # =========================================================================
    # COURSE FEATURES - AMENITIES
    # =========================================================================
    "amenity.bench": {
        "height_range": (0.8, 1.0),
        "footprint": (1.5, 0.6),
        "origin": "base_center",
        "notes": "Wooden course bench. 2-3 person seating."
    },
    "amenity.trash.bin": {
        "height_range": (0.9, 1.1),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "Outdoor trash receptacle."
    },
    "amenity.ball.washer": {
        "height_range": (0.9, 1.1),
        "footprint": (0.3, 0.3),
        "origin": "base_center",
        "notes": "Ball washer on post with towel."
    },
    "amenity.drinking.fountain": {
        "height_range": (0.9, 1.1),
        "footprint": (0.4, 0.4),
        "origin": "base_center",
        "notes": "Outdoor drinking fountain."
    },
    "amenity.cooler": {
        "height_range": (0.8, 1.0),
        "footprint": (0.4, 0.4),
        "origin": "base_center",
        "notes": "Beverage cooler station."
    },
    "amenity.shelter.small": {
        "height_range": (2.5, 3.0),
        "footprint": (3.0, 3.0),
        "origin": "base_center",
        "notes": "Small rain shelter. Open sides, roof."
    },
    "amenity.restroom": {
        "height_range": (2.8, 3.5),
        "footprint": (3.0, 4.0),
        "origin": "base_center",
        "notes": "On-course restroom building."
    },
    "amenity.snack.bar": {
        "height_range": (2.5, 3.0),
        "footprint": (4.0, 3.0),
        "origin": "base_center",
        "notes": "Halfway house / snack bar building."
    },

    # =========================================================================
    # BUILDINGS
    # =========================================================================
    "building.clubhouse.small": {
        "height_range": (4.0, 6.0),
        "footprint": (12.0, 8.0),
        "origin": "base_center",
        "notes": "Small clubhouse. Pro shop, basic amenities."
    },
    "building.clubhouse.medium": {
        "height_range": (5.0, 8.0),
        "footprint": (20.0, 15.0),
        "origin": "base_center",
        "notes": "Medium clubhouse. Restaurant, locker rooms."
    },
    "building.clubhouse.large": {
        "height_range": (6.0, 10.0),
        "footprint": (30.0, 20.0),
        "origin": "base_center",
        "notes": "Large clubhouse. Full amenities, event space."
    },
    "building.maintenance.shed": {
        "height_range": (3.0, 4.0),
        "footprint": (6.0, 8.0),
        "origin": "base_center",
        "notes": "Maintenance equipment storage building."
    },
    "building.cart.barn": {
        "height_range": (3.0, 4.0),
        "footprint": (10.0, 6.0),
        "origin": "base_center",
        "notes": "Golf cart storage barn."
    },
    "building.pump.house": {
        "height_range": (2.0, 2.5),
        "footprint": (2.5, 2.5),
        "origin": "base_center",
        "notes": "Irrigation pump house."
    },
    "building.starter.hut": {
        "height_range": (2.5, 3.0),
        "footprint": (2.5, 2.5),
        "origin": "base_center",
        "notes": "Starter shack at first tee."
    },

    # =========================================================================
    # DECORATIVE & LANDSCAPE
    # =========================================================================
    "decor.rock.small": {
        "height_range": (0.2, 0.4),
        "footprint": (0.4, 0.4),
        "origin": "base_center",
        "notes": "Small decorative boulder."
    },
    "decor.rock.medium": {
        "height_range": (0.5, 0.8),
        "footprint": (0.8, 0.8),
        "origin": "base_center",
        "notes": "Medium landscape boulder."
    },
    "decor.rock.large": {
        "height_range": (1.0, 1.5),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Large accent boulder."
    },
    "decor.rock.cluster": {
        "height_range": (0.4, 0.8),
        "footprint": (1.5, 1.5),
        "origin": "base_center",
        "notes": "Cluster of small to medium rocks."
    },
    "decor.fountain": {
        "height_range": (1.0, 2.0),
        "footprint": (2.0, 2.0),
        "origin": "base_center",
        "notes": "Decorative water fountain."
    },
    "decor.statue": {
        "height_range": (1.5, 2.5),
        "footprint": (0.8, 0.8),
        "origin": "base_center",
        "notes": "Decorative statue on pedestal."
    },
    "decor.sundial": {
        "height_range": (0.8, 1.2),
        "footprint": (0.6, 0.6),
        "origin": "base_center",
        "notes": "Ornamental sundial on pedestal."
    },

    # =========================================================================
    # FENCING & BOUNDARIES
    # =========================================================================
    "fence.wood.section": {
        "height_range": (1.0, 1.2),
        "footprint": (2.0, 0.1),
        "origin": "base_center",
        "notes": "Wooden split-rail fence section (2m)."
    },
    "fence.wood.post": {
        "height_range": (1.0, 1.3),
        "footprint": (0.15, 0.15),
        "origin": "base_center",
        "notes": "Fence post for corners/ends."
    },
    "fence.white.section": {
        "height_range": (1.0, 1.2),
        "footprint": (2.0, 0.1),
        "origin": "base_center",
        "notes": "White vinyl fence section."
    },
    "fence.chain.section": {
        "height_range": (1.5, 2.0),
        "footprint": (2.0, 0.1),
        "origin": "base_center",
        "notes": "Chain link fence section."
    },
    "fence.rope.post": {
        "height_range": (0.8, 1.0),
        "footprint": (0.1, 0.1),
        "origin": "base_center",
        "notes": "Rope barrier post (for cart paths, etc)."
    },

    # =========================================================================
    # BRIDGES & PATHS
    # =========================================================================
    "bridge.wood.small": {
        "height_range": (0.8, 1.2),
        "footprint": (2.0, 4.0),
        "origin": "base_center",
        "notes": "Small wooden footbridge over creek."
    },
    "bridge.wood.medium": {
        "height_range": (1.0, 1.5),
        "footprint": (3.0, 6.0),
        "origin": "base_center",
        "notes": "Medium cart bridge."
    },
    "bridge.stone": {
        "height_range": (1.2, 2.0),
        "footprint": (4.0, 8.0),
        "origin": "base_center",
        "notes": "Decorative stone arch bridge."
    },
    "path.sign.directional": {
        "height_range": (1.0, 1.4),
        "footprint": (0.3, 0.3),
        "origin": "base_center",
        "notes": "Directional sign post (to holes, clubhouse)."
    },
    "path.sign.rules": {
        "height_range": (1.2, 1.6),
        "footprint": (0.5, 0.1),
        "origin": "base_center",
        "notes": "Course rules sign."
    },

    # =========================================================================
    # WATER FEATURES
    # =========================================================================
    "water.fountain.aerator": {
        "height_range": (0.1, 0.2),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "Floating pond aerator/fountain base."
    },
    "water.dock.small": {
        "height_range": (0.3, 0.5),
        "footprint": (2.0, 4.0),
        "origin": "base_center",
        "notes": "Small wooden dock/pier."
    },
    "water.bulkhead.section": {
        "height_range": (0.5, 0.8),
        "footprint": (2.0, 0.3),
        "origin": "base_center",
        "notes": "Pond edge bulkhead/retaining wall section."
    },

    # =========================================================================
    # WILDLIFE & NATURE (optional decorative)
    # =========================================================================
    "wildlife.bird.bath": {
        "height_range": (0.7, 1.0),
        "footprint": (0.5, 0.5),
        "origin": "base_center",
        "notes": "Decorative bird bath."
    },
    "wildlife.birdhouse": {
        "height_range": (0.3, 0.4),
        "footprint": (0.2, 0.2),
        "origin": "base_center",
        "notes": "Birdhouse (mounts on post)."
    },
    "wildlife.duck.decoy": {
        "height_range": (0.2, 0.3),
        "footprint": (0.3, 0.2),
        "origin": "base_center",
        "notes": "Decorative duck for ponds."
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
