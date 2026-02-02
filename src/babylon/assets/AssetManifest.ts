/**
 * Complete Asset Manifest for Greenkeeper Simulator
 *
 * SINGLE SOURCE OF TRUTH for all game assets.
 * Blender tools read from generated JSON (npm run assets:manifest)
 */

// Core units - 1 unit = 1 game tile = ~1 meter
export const TILE_SIZE = 1.0;
export const CHARACTER_HEIGHT = 1.8;

export interface AssetSpec {
  path: string;
  heightRange: [number, number];
  footprint: [number, number]; // [width, depth]
  origin: "base_center" | "center";
  animations?: string[];
  notes: string;
}

export const ASSET_MANIFEST: Record<string, AssetSpec> = {
  // ===========================================================================
  // CHARACTERS
  // ===========================================================================
  "character.greenkeeper": {
    path: "/assets/models/characters/greenkeeper.glb",
    heightRange: [1.75, 1.85],
    footprint: [0.5, 0.5],
    origin: "base_center",
    animations: ["idle", "walk", "push"],
    notes: "Main player character. Green polo shirt, khaki pants.",
  },
  "character.employee": {
    path: "/assets/models/characters/employee.glb",
    heightRange: [1.70, 1.85],
    footprint: [0.5, 0.5],
    origin: "base_center",
    animations: ["idle", "walk", "push"],
    notes: "Generic worker NPC. Brown/tan work clothes.",
  },
  "character.golfer.male": {
    path: "/assets/models/characters/golfer_male.glb",
    heightRange: [1.70, 1.85],
    footprint: [0.5, 0.5],
    origin: "base_center",
    animations: ["idle", "walk", "swing"],
    notes: "Male golfer. Polo shirt, slacks, golf cap.",
  },
  "character.golfer.female": {
    path: "/assets/models/characters/golfer_female.glb",
    heightRange: [1.60, 1.75],
    footprint: [0.5, 0.5],
    origin: "base_center",
    animations: ["idle", "walk", "swing"],
    notes: "Female golfer. Polo shirt, skirt or slacks, visor.",
  },

  // ===========================================================================
  // TREES
  // ===========================================================================
  "tree.pine.small": {
    path: "/assets/models/trees/pine_small.glb",
    heightRange: [3.0, 4.0],
    footprint: [1.5, 1.5],
    origin: "base_center",
    notes: "Young pine tree. Conical shape, sparse branches.",
  },
  "tree.pine.medium": {
    path: "/assets/models/trees/pine_medium.glb",
    heightRange: [5.0, 7.0],
    footprint: [2.5, 2.5],
    origin: "base_center",
    notes: "Mature pine. Classic golf course tree.",
  },
  "tree.pine.large": {
    path: "/assets/models/trees/pine_large.glb",
    heightRange: [8.0, 12.0],
    footprint: [4.0, 4.0],
    origin: "base_center",
    notes: "Large established pine.",
  },
  "tree.oak.small": {
    path: "/assets/models/trees/oak_small.glb",
    heightRange: [3.0, 5.0],
    footprint: [2.0, 2.0],
    origin: "base_center",
    notes: "Young oak. Rounded canopy starting to form.",
  },
  "tree.oak.medium": {
    path: "/assets/models/trees/oak_medium.glb",
    heightRange: [6.0, 9.0],
    footprint: [4.0, 4.0],
    origin: "base_center",
    notes: "Mature oak with spreading canopy.",
  },
  "tree.oak.large": {
    path: "/assets/models/trees/oak_large.glb",
    heightRange: [10.0, 15.0],
    footprint: [6.0, 6.0],
    origin: "base_center",
    notes: "Grand old oak. Dominant landmark tree.",
  },
  "tree.palm": {
    path: "/assets/models/trees/palm.glb",
    heightRange: [4.0, 8.0],
    footprint: [1.0, 1.0],
    origin: "base_center",
    notes: "Palm tree. Thin trunk, frond crown at top.",
  },
  "tree.willow": {
    path: "/assets/models/trees/willow.glb",
    heightRange: [5.0, 8.0],
    footprint: [4.0, 4.0],
    origin: "base_center",
    notes: "Weeping willow. Drooping branches, near water.",
  },
  "tree.cypress": {
    path: "/assets/models/trees/cypress.glb",
    heightRange: [6.0, 12.0],
    footprint: [1.5, 1.5],
    origin: "base_center",
    notes: "Tall narrow cypress. Good for lining fairways.",
  },
  "tree.maple.small": {
    path: "/assets/models/trees/maple_small.glb",
    heightRange: [3.0, 5.0],
    footprint: [2.0, 2.0],
    origin: "base_center",
    notes: "Young maple. Rounded canopy.",
  },
  "tree.maple.medium": {
    path: "/assets/models/trees/maple_medium.glb",
    heightRange: [6.0, 9.0],
    footprint: [4.0, 4.0],
    origin: "base_center",
    notes: "Mature maple. Fall color potential.",
  },
  "tree.birch": {
    path: "/assets/models/trees/birch.glb",
    heightRange: [5.0, 8.0],
    footprint: [2.0, 2.0],
    origin: "base_center",
    notes: "White bark birch. Slender, elegant.",
  },
  "tree.magnolia": {
    path: "/assets/models/trees/magnolia.glb",
    heightRange: [4.0, 7.0],
    footprint: [3.0, 3.0],
    origin: "base_center",
    notes: "Southern magnolia. Broad leaves, white flowers.",
  },
  "tree.dogwood": {
    path: "/assets/models/trees/dogwood.glb",
    heightRange: [3.0, 5.0],
    footprint: [2.5, 2.5],
    origin: "base_center",
    notes: "Flowering dogwood. Spring blooms.",
  },

  // ===========================================================================
  // SHRUBS
  // ===========================================================================
  "shrub.hedge": {
    path: "/assets/models/shrubs/hedge.glb",
    heightRange: [0.8, 1.5],
    footprint: [1.0, 1.0],
    origin: "base_center",
    notes: "Trimmed boxwood hedge section.",
  },
  "shrub.hedge.tall": {
    path: "/assets/models/shrubs/hedge_tall.glb",
    heightRange: [1.8, 2.5],
    footprint: [1.0, 1.0],
    origin: "base_center",
    notes: "Tall privacy hedge section.",
  },
  "shrub.flowering.azalea": {
    path: "/assets/models/shrubs/azalea.glb",
    heightRange: [0.6, 1.2],
    footprint: [1.0, 1.0],
    origin: "base_center",
    notes: "Azalea bush. Pink/white flowers.",
  },
  "shrub.flowering.rhododendron": {
    path: "/assets/models/shrubs/rhododendron.glb",
    heightRange: [1.0, 2.0],
    footprint: [1.5, 1.5],
    origin: "base_center",
    notes: "Rhododendron. Large flower clusters.",
  },
  "shrub.ornamental.grass": {
    path: "/assets/models/shrubs/ornamental_grass.glb",
    heightRange: [0.5, 1.2],
    footprint: [0.8, 0.8],
    origin: "base_center",
    notes: "Ornamental fountain grass clump.",
  },
  "shrub.juniper": {
    path: "/assets/models/shrubs/juniper.glb",
    heightRange: [0.4, 0.8],
    footprint: [1.5, 1.5],
    origin: "base_center",
    notes: "Low spreading juniper groundcover.",
  },

  // ===========================================================================
  // FLOWERS
  // ===========================================================================
  "flower.bed.mixed": {
    path: "/assets/models/flowers/bed_mixed.glb",
    heightRange: [0.2, 0.4],
    footprint: [1.0, 1.0],
    origin: "base_center",
    notes: "Mixed annual flower bed section.",
  },
  "flower.bed.roses": {
    path: "/assets/models/flowers/bed_roses.glb",
    heightRange: [0.5, 1.0],
    footprint: [1.0, 1.0],
    origin: "base_center",
    notes: "Rose bush grouping.",
  },
  "flower.planter": {
    path: "/assets/models/flowers/planter.glb",
    heightRange: [0.6, 0.8],
    footprint: [0.5, 0.5],
    origin: "base_center",
    notes: "Decorative planter with flowers.",
  },

  // ===========================================================================
  // EQUIPMENT - HANDHELD
  // ===========================================================================
  "equipment.mower.push": {
    path: "/assets/models/equipment/mower_push.glb",
    heightRange: [0.8, 1.2],
    footprint: [0.5, 0.8],
    origin: "base_center",
    notes: "Push reel mower. Handle height ~1.0m.",
  },
  "equipment.spreader": {
    path: "/assets/models/equipment/spreader.glb",
    heightRange: [0.8, 1.1],
    footprint: [0.5, 0.6],
    origin: "base_center",
    notes: "Walk-behind broadcast spreader.",
  },
  "equipment.sprinkler.handheld": {
    path: "/assets/models/equipment/sprinkler_handheld.glb",
    heightRange: [0.3, 0.5],
    footprint: [0.2, 0.8],
    origin: "base_center",
    notes: "Handheld sprinkler wand with hose.",
  },
  "equipment.rake": {
    path: "/assets/models/equipment/rake.glb",
    heightRange: [1.4, 1.6],
    footprint: [0.4, 0.1],
    origin: "base_center",
    notes: "Bunker rake. Long handle, wide head.",
  },
  "equipment.aerator.manual": {
    path: "/assets/models/equipment/aerator_manual.glb",
    heightRange: [0.9, 1.1],
    footprint: [0.3, 0.3],
    origin: "base_center",
    notes: "Manual core aerator tool.",
  },
  "equipment.trimmer": {
    path: "/assets/models/equipment/trimmer.glb",
    heightRange: [1.0, 1.3],
    footprint: [0.3, 0.3],
    origin: "base_center",
    notes: "String trimmer/weed whacker.",
  },
  "equipment.blower": {
    path: "/assets/models/equipment/blower.glb",
    heightRange: [0.4, 0.6],
    footprint: [0.3, 0.5],
    origin: "base_center",
    notes: "Backpack leaf blower.",
  },
  "equipment.edger": {
    path: "/assets/models/equipment/edger.glb",
    heightRange: [0.9, 1.1],
    footprint: [0.2, 0.4],
    origin: "base_center",
    notes: "Lawn edger tool.",
  },

  // ===========================================================================
  // VEHICLES
  // ===========================================================================
  "vehicle.mower.riding": {
    path: "/assets/models/vehicles/mower_riding.glb",
    heightRange: [1.2, 1.6],
    footprint: [1.2, 2.0],
    origin: "base_center",
    notes: "Ride-on lawn mower. Seated operator.",
  },
  "vehicle.mower.fairway": {
    path: "/assets/models/vehicles/mower_fairway.glb",
    heightRange: [1.4, 1.8],
    footprint: [2.0, 3.0],
    origin: "base_center",
    notes: "Large fairway mower with multiple reels.",
  },
  "vehicle.mower.greens": {
    path: "/assets/models/vehicles/mower_greens.glb",
    heightRange: [1.0, 1.4],
    footprint: [1.0, 1.8],
    origin: "base_center",
    notes: "Precision greens mower. Walking or riding.",
  },
  "vehicle.cart.golf": {
    path: "/assets/models/vehicles/cart_golf.glb",
    heightRange: [1.6, 1.9],
    footprint: [1.2, 2.4],
    origin: "base_center",
    notes: "Standard 2-person golf cart with bag rack.",
  },
  "vehicle.cart.utility": {
    path: "/assets/models/vehicles/cart_utility.glb",
    heightRange: [1.4, 1.8],
    footprint: [1.3, 2.8],
    origin: "base_center",
    notes: "Utility cart with cargo bed.",
  },
  "vehicle.tractor": {
    path: "/assets/models/vehicles/tractor.glb",
    heightRange: [2.0, 2.5],
    footprint: [1.8, 3.5],
    origin: "base_center",
    notes: "Small grounds maintenance tractor.",
  },
  "vehicle.aerator.ride": {
    path: "/assets/models/vehicles/aerator_ride.glb",
    heightRange: [1.4, 1.8],
    footprint: [1.5, 2.5],
    origin: "base_center",
    notes: "Ride-on core aerator machine.",
  },
  "vehicle.sprayer": {
    path: "/assets/models/vehicles/sprayer.glb",
    heightRange: [1.5, 2.0],
    footprint: [1.5, 3.0],
    origin: "base_center",
    notes: "Ride-on sprayer with tank.",
  },

  // ===========================================================================
  // IRRIGATION
  // ===========================================================================
  "irrigation.pipe.straight": {
    path: "/assets/models/irrigation/pipe_straight.glb",
    heightRange: [0.1, 0.2],
    footprint: [1.0, 0.2],
    origin: "base_center",
    notes: "1-tile straight pipe segment. Blue PVC look.",
  },
  "irrigation.pipe.corner": {
    path: "/assets/models/irrigation/pipe_corner.glb",
    heightRange: [0.1, 0.2],
    footprint: [0.5, 0.5],
    origin: "base_center",
    notes: "90-degree corner elbow.",
  },
  "irrigation.pipe.tee": {
    path: "/assets/models/irrigation/pipe_tee.glb",
    heightRange: [0.1, 0.2],
    footprint: [1.0, 0.5],
    origin: "base_center",
    notes: "T-junction fitting.",
  },
  "irrigation.pipe.cross": {
    path: "/assets/models/irrigation/pipe_cross.glb",
    heightRange: [0.1, 0.2],
    footprint: [1.0, 1.0],
    origin: "base_center",
    notes: "4-way cross junction.",
  },
  "irrigation.sprinkler.popup": {
    path: "/assets/models/irrigation/sprinkler_popup.glb",
    heightRange: [0.05, 0.15],
    footprint: [0.15, 0.15],
    origin: "base_center",
    notes: "Pop-up sprinkler head (retracted state).",
  },
  "irrigation.sprinkler.rotor": {
    path: "/assets/models/irrigation/sprinkler_rotor.glb",
    heightRange: [0.1, 0.2],
    footprint: [0.2, 0.2],
    origin: "base_center",
    notes: "Rotor sprinkler head for large areas.",
  },
  "irrigation.valve.box": {
    path: "/assets/models/irrigation/valve_box.glb",
    heightRange: [0.1, 0.15],
    footprint: [0.4, 0.3],
    origin: "base_center",
    notes: "In-ground valve box cover.",
  },
  "irrigation.water.source": {
    path: "/assets/models/irrigation/water_source.glb",
    heightRange: [0.4, 0.6],
    footprint: [0.6, 0.6],
    origin: "base_center",
    notes: "Water pump/well head housing.",
  },
  "irrigation.water.tank": {
    path: "/assets/models/irrigation/water_tank.glb",
    heightRange: [1.5, 2.0],
    footprint: [1.5, 1.5],
    origin: "base_center",
    notes: "Water storage tank.",
  },

  // ===========================================================================
  // COURSE FEATURES
  // ===========================================================================
  "course.flag": {
    path: "/assets/models/course/flag.glb",
    heightRange: [2.0, 2.5],
    footprint: [0.1, 0.1],
    origin: "base_center",
    notes: "Hole flag on fiberglass pole. Flag at top.",
  },
  "course.cup": {
    path: "/assets/models/course/cup.glb",
    heightRange: [0.1, 0.15],
    footprint: [0.12, 0.12],
    origin: "base_center",
    notes: "Hole cup liner. 4.25 inch diameter.",
  },
  "course.tee.marker.red": {
    path: "/assets/models/course/tee_marker_red.glb",
    heightRange: [0.15, 0.25],
    footprint: [0.1, 0.1],
    origin: "base_center",
    notes: "Red tee marker. Forward tees.",
  },
  "course.tee.marker.white": {
    path: "/assets/models/course/tee_marker_white.glb",
    heightRange: [0.15, 0.25],
    footprint: [0.1, 0.1],
    origin: "base_center",
    notes: "White tee marker. Middle tees.",
  },
  "course.tee.marker.blue": {
    path: "/assets/models/course/tee_marker_blue.glb",
    heightRange: [0.15, 0.25],
    footprint: [0.1, 0.1],
    origin: "base_center",
    notes: "Blue tee marker. Championship tees.",
  },
  "course.tee.marker.gold": {
    path: "/assets/models/course/tee_marker_gold.glb",
    heightRange: [0.15, 0.25],
    footprint: [0.1, 0.1],
    origin: "base_center",
    notes: "Gold tee marker. Senior/forward tees.",
  },
  "course.yardage.marker.100": {
    path: "/assets/models/course/yardage_100.glb",
    heightRange: [0.3, 0.5],
    footprint: [0.2, 0.2],
    origin: "base_center",
    notes: "100-yard marker post.",
  },
  "course.yardage.marker.150": {
    path: "/assets/models/course/yardage_150.glb",
    heightRange: [0.3, 0.5],
    footprint: [0.2, 0.2],
    origin: "base_center",
    notes: "150-yard marker post.",
  },
  "course.yardage.marker.200": {
    path: "/assets/models/course/yardage_200.glb",
    heightRange: [0.3, 0.5],
    footprint: [0.2, 0.2],
    origin: "base_center",
    notes: "200-yard marker post.",
  },
  "course.ball": {
    path: "/assets/models/course/ball.glb",
    heightRange: [0.04, 0.05],
    footprint: [0.04, 0.04],
    origin: "center",
    notes: "Golf ball. 42.67mm diameter.",
  },
  "course.bunker.rake": {
    path: "/assets/models/course/bunker_rake.glb",
    heightRange: [1.4, 1.6],
    footprint: [0.4, 0.1],
    origin: "base_center",
    notes: "Bunker rake placed in sand.",
  },

  // ===========================================================================
  // AMENITIES
  // ===========================================================================
  "amenity.bench": {
    path: "/assets/models/amenities/bench.glb",
    heightRange: [0.8, 1.0],
    footprint: [1.5, 0.6],
    origin: "base_center",
    notes: "Wooden course bench. 2-3 person seating.",
  },
  "amenity.trash.bin": {
    path: "/assets/models/amenities/trash_bin.glb",
    heightRange: [0.9, 1.1],
    footprint: [0.5, 0.5],
    origin: "base_center",
    notes: "Outdoor trash receptacle.",
  },
  "amenity.ball.washer": {
    path: "/assets/models/amenities/ball_washer.glb",
    heightRange: [0.9, 1.1],
    footprint: [0.3, 0.3],
    origin: "base_center",
    notes: "Ball washer on post with towel.",
  },
  "amenity.drinking.fountain": {
    path: "/assets/models/amenities/drinking_fountain.glb",
    heightRange: [0.9, 1.1],
    footprint: [0.4, 0.4],
    origin: "base_center",
    notes: "Outdoor drinking fountain.",
  },
  "amenity.cooler": {
    path: "/assets/models/amenities/cooler.glb",
    heightRange: [0.8, 1.0],
    footprint: [0.4, 0.4],
    origin: "base_center",
    notes: "Beverage cooler station.",
  },
  "amenity.shelter.small": {
    path: "/assets/models/amenities/shelter_small.glb",
    heightRange: [2.5, 3.0],
    footprint: [3.0, 3.0],
    origin: "base_center",
    notes: "Small rain shelter. Open sides, roof.",
  },
  "amenity.restroom": {
    path: "/assets/models/amenities/restroom.glb",
    heightRange: [2.8, 3.5],
    footprint: [3.0, 4.0],
    origin: "base_center",
    notes: "On-course restroom building.",
  },
  "amenity.snack.bar": {
    path: "/assets/models/amenities/snack_bar.glb",
    heightRange: [2.5, 3.0],
    footprint: [4.0, 3.0],
    origin: "base_center",
    notes: "Halfway house / snack bar building.",
  },

  // ===========================================================================
  // BUILDINGS
  // ===========================================================================
  "building.clubhouse.small": {
    path: "/assets/models/buildings/clubhouse_small.glb",
    heightRange: [4.0, 6.0],
    footprint: [12.0, 8.0],
    origin: "base_center",
    notes: "Small clubhouse. Pro shop, basic amenities.",
  },
  "building.clubhouse.medium": {
    path: "/assets/models/buildings/clubhouse_medium.glb",
    heightRange: [5.0, 8.0],
    footprint: [20.0, 15.0],
    origin: "base_center",
    notes: "Medium clubhouse. Restaurant, locker rooms.",
  },
  "building.clubhouse.large": {
    path: "/assets/models/buildings/clubhouse_large.glb",
    heightRange: [6.0, 10.0],
    footprint: [30.0, 20.0],
    origin: "base_center",
    notes: "Large clubhouse. Full amenities, event space.",
  },
  "building.maintenance.shed": {
    path: "/assets/models/buildings/maintenance_shed.glb",
    heightRange: [3.0, 4.0],
    footprint: [6.0, 8.0],
    origin: "base_center",
    notes: "Maintenance equipment storage building.",
  },
  "building.cart.barn": {
    path: "/assets/models/buildings/cart_barn.glb",
    heightRange: [3.0, 4.0],
    footprint: [10.0, 6.0],
    origin: "base_center",
    notes: "Golf cart storage barn.",
  },
  "building.pump.house": {
    path: "/assets/models/buildings/pump_house.glb",
    heightRange: [2.0, 2.5],
    footprint: [2.5, 2.5],
    origin: "base_center",
    notes: "Irrigation pump house.",
  },
  "building.starter.hut": {
    path: "/assets/models/buildings/starter_hut.glb",
    heightRange: [2.5, 3.0],
    footprint: [2.5, 2.5],
    origin: "base_center",
    notes: "Starter shack at first tee.",
  },

  // ===========================================================================
  // DECORATIVE
  // ===========================================================================
  "decor.rock.small": {
    path: "/assets/models/decor/rock_small.glb",
    heightRange: [0.2, 0.4],
    footprint: [0.4, 0.4],
    origin: "base_center",
    notes: "Small decorative boulder.",
  },
  "decor.rock.medium": {
    path: "/assets/models/decor/rock_medium.glb",
    heightRange: [0.5, 0.8],
    footprint: [0.8, 0.8],
    origin: "base_center",
    notes: "Medium landscape boulder.",
  },
  "decor.rock.large": {
    path: "/assets/models/decor/rock_large.glb",
    heightRange: [1.0, 1.5],
    footprint: [1.5, 1.5],
    origin: "base_center",
    notes: "Large accent boulder.",
  },
  "decor.rock.cluster": {
    path: "/assets/models/decor/rock_cluster.glb",
    heightRange: [0.4, 0.8],
    footprint: [1.5, 1.5],
    origin: "base_center",
    notes: "Cluster of small to medium rocks.",
  },
  "decor.fountain": {
    path: "/assets/models/decor/fountain.glb",
    heightRange: [1.0, 2.0],
    footprint: [2.0, 2.0],
    origin: "base_center",
    notes: "Decorative water fountain.",
  },
  "decor.statue": {
    path: "/assets/models/decor/statue.glb",
    heightRange: [1.5, 2.5],
    footprint: [0.8, 0.8],
    origin: "base_center",
    notes: "Decorative statue on pedestal.",
  },
  "decor.sundial": {
    path: "/assets/models/decor/sundial.glb",
    heightRange: [0.8, 1.2],
    footprint: [0.6, 0.6],
    origin: "base_center",
    notes: "Ornamental sundial on pedestal.",
  },

  // ===========================================================================
  // FENCING
  // ===========================================================================
  "fence.wood.section": {
    path: "/assets/models/fencing/wood_section.glb",
    heightRange: [1.0, 1.2],
    footprint: [2.0, 0.1],
    origin: "base_center",
    notes: "Wooden split-rail fence section (2m).",
  },
  "fence.wood.post": {
    path: "/assets/models/fencing/wood_post.glb",
    heightRange: [1.0, 1.3],
    footprint: [0.15, 0.15],
    origin: "base_center",
    notes: "Fence post for corners/ends.",
  },
  "fence.white.section": {
    path: "/assets/models/fencing/white_section.glb",
    heightRange: [1.0, 1.2],
    footprint: [2.0, 0.1],
    origin: "base_center",
    notes: "White vinyl fence section.",
  },
  "fence.chain.section": {
    path: "/assets/models/fencing/chain_section.glb",
    heightRange: [1.5, 2.0],
    footprint: [2.0, 0.1],
    origin: "base_center",
    notes: "Chain link fence section.",
  },
  "fence.rope.post": {
    path: "/assets/models/fencing/rope_post.glb",
    heightRange: [0.8, 1.0],
    footprint: [0.1, 0.1],
    origin: "base_center",
    notes: "Rope barrier post (for cart paths, etc).",
  },

  // ===========================================================================
  // BRIDGES & PATHS
  // ===========================================================================
  "bridge.wood.small": {
    path: "/assets/models/bridges/wood_small.glb",
    heightRange: [0.8, 1.2],
    footprint: [2.0, 4.0],
    origin: "base_center",
    notes: "Small wooden footbridge over creek.",
  },
  "bridge.wood.medium": {
    path: "/assets/models/bridges/wood_medium.glb",
    heightRange: [1.0, 1.5],
    footprint: [3.0, 6.0],
    origin: "base_center",
    notes: "Medium cart bridge.",
  },
  "bridge.stone": {
    path: "/assets/models/bridges/stone.glb",
    heightRange: [1.2, 2.0],
    footprint: [4.0, 8.0],
    origin: "base_center",
    notes: "Decorative stone arch bridge.",
  },
  "path.sign.directional": {
    path: "/assets/models/paths/sign_directional.glb",
    heightRange: [1.0, 1.4],
    footprint: [0.3, 0.3],
    origin: "base_center",
    notes: "Directional sign post (to holes, clubhouse).",
  },
  "path.sign.rules": {
    path: "/assets/models/paths/sign_rules.glb",
    heightRange: [1.2, 1.6],
    footprint: [0.5, 0.1],
    origin: "base_center",
    notes: "Course rules sign.",
  },

  // ===========================================================================
  // WATER FEATURES
  // ===========================================================================
  "water.fountain.aerator": {
    path: "/assets/models/water/fountain_aerator.glb",
    heightRange: [0.1, 0.2],
    footprint: [0.5, 0.5],
    origin: "base_center",
    notes: "Floating pond aerator/fountain base.",
  },
  "water.dock.small": {
    path: "/assets/models/water/dock_small.glb",
    heightRange: [0.3, 0.5],
    footprint: [2.0, 4.0],
    origin: "base_center",
    notes: "Small wooden dock/pier.",
  },
  "water.bulkhead.section": {
    path: "/assets/models/water/bulkhead_section.glb",
    heightRange: [0.5, 0.8],
    footprint: [2.0, 0.3],
    origin: "base_center",
    notes: "Pond edge bulkhead/retaining wall section.",
  },

  // ===========================================================================
  // WILDLIFE
  // ===========================================================================
  "wildlife.bird.bath": {
    path: "/assets/models/wildlife/bird_bath.glb",
    heightRange: [0.7, 1.0],
    footprint: [0.5, 0.5],
    origin: "base_center",
    notes: "Decorative bird bath.",
  },
  "wildlife.birdhouse": {
    path: "/assets/models/wildlife/birdhouse.glb",
    heightRange: [0.3, 0.4],
    footprint: [0.2, 0.2],
    origin: "base_center",
    notes: "Birdhouse (mounts on post).",
  },
  "wildlife.duck.decoy": {
    path: "/assets/models/wildlife/duck_decoy.glb",
    heightRange: [0.2, 0.3],
    footprint: [0.3, 0.2],
    origin: "base_center",
    notes: "Decorative duck for ponds.",
  },
};

// Type for asset IDs
export type AssetId = keyof typeof ASSET_MANIFEST;

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

export function getAssetSpec(assetId: AssetId): AssetSpec {
  return ASSET_MANIFEST[assetId];
}

export function getAssetPath(assetId: AssetId): string {
  return ASSET_MANIFEST[assetId].path;
}

// Total asset count
export const ASSET_COUNT = Object.keys(ASSET_MANIFEST).length;
