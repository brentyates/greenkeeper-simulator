# Placeable Assets & Buildings System Specification

## Overview

This specification defines the unified system for all placeable entities in the game - from functional buildings like the clubhouse and maintenance sheds, to decorative items like benches and flower beds. It consolidates concepts from `amenities.ts`, `FUTURE_SYSTEMS_SPEC.md`, and `PRESTIGE_SYSTEM_SPEC.md` into a single coherent grid-based placement system.

### Design Philosophy

**"Everything on the course has a place."**

Unlike the original abstract amenity system (booleans/tiers), this system gives every facility a physical location on the course grid. Players can:
- Choose WHERE to place buildings (near holes, parking, walkways)
- See buildings render on the map
- Watch employees and golfers interact with them
- Upgrade buildings in-place with visible construction phases

### Relationship to Existing Systems

| Existing System | Status | Migration Path |
|----------------|--------|----------------|
| `amenities.ts` (abstract) | **Replace** | Migrate to `PlaceableEntity` with grid positions |
| `CellState.obstacle` | **Extend** | Keep for natural obstacles; add `PlaceableEntity` layer |
| `REFILL_STATIONS` | **Replace** | Subsumed by Maintenance Shed entities |
| Prestige bonuses | **Keep** | Buildings contribute same bonuses via placement |

---

## Entity Architecture

### Core Interface

```typescript
interface PlaceableEntity {
  id: string;                              // Unique identifier
  type: EntityType;                        // Category of entity
  variant: string;                         // Specific type within category
  tier: number;                            // Upgrade level (0 = base)

  // Position
  position: GridPosition;                  // Primary tile (anchor point)
  footprint: Footprint;                    // Multi-tile coverage
  rotation: 0 | 90 | 180 | 270;           // Orientation in degrees

  // State
  state: EntityState;
  condition: number;                       // 0-100, affects functionality
  constructionProgress: number;            // 0-100 during construction

  // Economics
  purchaseCost: number;                    // One-time cost
  monthlyUpkeep: number;                   // Recurring cost

  // Effects
  prestigeBonus: number;                   // Contribution to prestige score
  effectRadius: number;                    // Tiles affected (0 = self only)

  // Timestamps
  placedAt: number;                        // Game day placed
  lastMaintained: number;                  // Game day last serviced
}

// Edge-based entities (fences, walls) - placed on tile edges, not tile centers
interface EdgeEntity {
  id: string;
  type: 'edge';
  variant: EdgeVariant;

  // Position is tile + which edge
  position: GridPosition;                  // The tile this edge belongs to
  edge: 'north' | 'south' | 'east' | 'west';

  // State
  condition: number;

  // Economics
  purchaseCost: number;
  monthlyUpkeep: number;
  prestigeBonus: number;
}

type EdgeVariant =
  | 'wooden_fence'
  | 'metal_fence'
  | 'stone_wall'
  | 'hedge'
  | 'rope_barrier'
  | 'split_rail'
  | 'white_picket'
  | 'chain_link'
  | 'retaining_wall';

interface GridPosition {
  x: number;
  y: number;
}

interface Footprint {
  width: number;                           // Tiles in X direction
  height: number;                          // Tiles in Y direction
  blockedCells: GridPosition[];            // Relative positions that block movement
  entryPoints: GridPosition[];             // Where entities enter/exit
}

type EntityState =
  | 'planned'           // Purchased, awaiting construction
  | 'constructing'      // Under construction
  | 'operational'       // Fully functional
  | 'damaged'           // Reduced functionality
  | 'upgrading'         // Being upgraded to next tier
  | 'demolishing';      // Being removed

type EntityType =
  | 'building'          // Functional structures (clubhouse, sheds)
  | 'facility'          // Amenity structures (pro shop, restaurant)
  | 'service_point'     // On-course services (comfort station, halfway house)
  | 'practice'          // Practice facilities (range, putting green)
  | 'infrastructure'    // Support systems (cart paths, bridges)
  | 'decoration'        // Aesthetic items (benches, flowers, signs)
  | 'vegetation';       // Plantable trees and landscaping
```

---

## Entity Categories

### 1. Buildings (Core Structures)

#### Clubhouse

The central guest facility. Must exist (at minimum tier) for course operation.

| Tier | Name | Cost | Monthly | Prestige | Footprint | Capacity | Features |
|------|------|------|---------|----------|-----------|----------|----------|
| 0 | Starter Shack | $0 (default) | $100 | 0 | 2x2 | 20 | Check-in only |
| 1 | Basic Clubhouse | $50,000 | $500 | +50 | 3x3 | 50 | Restrooms, lockers |
| 2 | Full Clubhouse | $150,000 | $1,500 | +100 | 4x4 | 100 | Pro shop space, grill |
| 3 | Luxury Clubhouse | $400,000 | $4,000 | +175 | 5x5 | 200 | Restaurant, event space |
| 4 | Grand Clubhouse | $1,000,000 | $10,000 | +250 | 6x6 | 400 | Spa, ballroom, suites |

**Functional Requirements:**
- Tier 0: Required for any golfer activity
- Tier 1+: Enables locker room amenity
- Tier 2+: Required for pro shop placement inside
- Tier 3+: Required for fine dining
- Tier 4: Required for championship hosting

#### Maintenance Shed

Worker origination point and equipment storage. **Replaces REFILL_STATIONS.**

| Tier | Name | Cost | Monthly | Prestige | Footprint | Equipment Slots | Resource Storage |
|------|------|------|---------|----------|-----------|-----------------|------------------|
| 0 | Tool Shed | $5,000 | $50 | 0 | 1x1 | 2 | 500 units |
| 1 | Basic Shed | $15,000 | $150 | +5 | 2x2 | 4 | 2,000 units |
| 2 | Maintenance Building | $50,000 | $400 | +15 | 3x3 | 8 | 5,000 units |
| 3 | Operations Center | $150,000 | $1,000 | +30 | 4x4 | 16 | 15,000 units |

**Functional Requirements:**
- Employees spawn at assigned maintenance shed
- Equipment must be stored when not in use
- Player can refill resources at any shed (walk-up interaction)
- Higher tiers enable larger equipment (tractors, utility vehicles)
- Multiple sheds allow distributed operations

**Placement Rules:**
- Recommend 1 shed per 9 holes
- Cannot place on fairway, green, or hazards
- Should be accessible from cart paths

#### Cart Barn

Golf cart storage and charging station.

| Tier | Name | Cost | Monthly | Prestige | Footprint | Cart Capacity |
|------|------|------|---------|----------|-----------|---------------|
| 0 | Cart Shed | $10,000 | $100 | 0 | 2x2 | 10 carts |
| 1 | Cart Barn | $30,000 | $250 | +10 | 3x3 | 25 carts |
| 2 | Cart Center | $75,000 | $500 | +25 | 4x4 | 50 carts |

**Functional Requirements:**
- Determines max simultaneous cart rentals
- Higher tiers enable premium/GPS carts
- Must connect to cart path network

---

### 2. Facilities (Guest Amenities)

These are interior-based amenities that occupy space within or adjacent to the Clubhouse.

#### Pro Shop

| Tier | Name | Cost | Monthly | Prestige | Revenue Potential |
|------|------|------|---------|----------|------------------|
| 0 | None | - | - | 0 | - |
| 1 | Basic Pro Shop | $25,000 | $300 | +25 | $500/day |
| 2 | Full Pro Shop | $75,000 | $800 | +50 | $1,500/day |
| 3 | Premium Pro Shop | $200,000 | $2,000 | +100 | $4,000/day |

**Placement:** Inside Clubhouse (Tier 2+ required) or as separate 2x2 building.

#### Dining

| Tier | Name | Cost | Monthly | Prestige | Revenue Potential |
|------|------|------|---------|----------|------------------|
| 0 | Vending Machines | $1,000 | $50 | 0 | $100/day |
| 1 | Snack Bar | $15,000 | $200 | +20 | $400/day |
| 2 | Grill Room | $50,000 | $600 | +50 | $1,200/day |
| 3 | Fine Dining | $200,000 | $2,000 | +100 | $3,500/day |
| 4 | Celebrity Chef | $500,000 | $5,000 | +175 | $8,000/day |

**Placement:** Inside Clubhouse (tier requirements vary) or separate building.

---

### 3. Service Points (On-Course)

#### Comfort Station

Mid-course restroom facilities.

| Tier | Name | Cost | Monthly | Prestige | Footprint |
|------|------|------|---------|----------|-----------|
| 1 | Portable Unit | $2,000 | $50 | +5 | 1x1 |
| 2 | Basic Station | $10,000 | $150 | +10 | 2x2 |
| 3 | Deluxe Station | $25,000 | $300 | +15 | 2x2 |

**Placement Rules:**
- Maximum 4 on course
- Typically at holes 4-5 and 13-14
- Must be accessible from cart path

#### Halfway House

Food/beverage service at the turn (between holes 9 and 10).

| Tier | Name | Cost | Monthly | Prestige | Revenue |
|------|------|------|---------|----------|---------|
| 1 | Snack Shack | $20,000 | $200 | +20 | $300/day |
| 2 | Halfway House | $40,000 | $400 | +35 | $600/day |
| 3 | Turn House | $80,000 | $700 | +50 | $1,000/day |

**Placement:** Between 9th green and 10th tee.

#### Beverage Cart Depot

Hub for on-course beverage service.

| Tier | Name | Cost | Monthly | Prestige |
|------|------|------|---------|----------|
| 1 | Cart Station | $8,000 | $150 | +15 |
| 2 | Service Hub | $20,000 | $300 | +30 |

**Functional Requirements:**
- Enables "On-Course Beverage Service" amenity
- Beverage cart NPCs originate here
- Routes through course serving golfers

#### Starter's Hut

Tee time check-in and pace management.

| Tier | Name | Cost | Monthly | Prestige | Footprint |
|------|------|------|---------|----------|-----------|
| 1 | Starter Stand | $5,000 | $100 | +10 | 1x1 |
| 2 | Starter's Hut | $15,000 | $200 | +20 | 2x2 |

**Placement:** Adjacent to 1st tee box.

---

### 4. Practice Facilities

#### Driving Range

| Tier | Name | Cost | Monthly | Prestige | Footprint | Stalls |
|------|------|------|---------|----------|-----------|--------|
| 1 | Basic Range | $30,000 | $300 | +30 | 10x20 | 10 |
| 2 | Full Range | $100,000 | $700 | +50 | 15x25 | 25 |
| 3 | Tour-Level Range | $250,000 | $1,500 | +75 | 20x30 | 50 |

**Functional Requirements:**
- Generates range ball revenue
- Teaching pros can operate here
- Higher tiers include covered stalls, ball machines

#### Putting Green

| Tier | Name | Cost | Monthly | Prestige | Footprint |
|------|------|------|---------|----------|-----------|
| 1 | Practice Green | $10,000 | $100 | +15 | 5x5 |
| 2 | Championship Green | $25,000 | $200 | +25 | 8x8 |

#### Chipping Area

| Tier | Name | Cost | Monthly | Prestige | Footprint |
|------|------|------|---------|----------|-----------|
| 1 | Chipping Green | $15,000 | $150 | +15 | 4x6 |
| 2 | Short Game Area | $40,000 | $300 | +30 | 8x10 |

#### Teaching Academy

| Tier | Name | Cost | Monthly | Prestige | Revenue |
|------|------|------|---------|----------|---------|
| 1 | Lesson Area | $50,000 | $400 | +30 | $800/day |
| 2 | Teaching Academy | $100,000 | $800 | +50 | $2,000/day |

**Functional Requirements:**
- Enables lesson booking revenue stream
- Can assign teaching pro employees

#### Golf Simulator

| Tier | Name | Cost | Monthly | Prestige | Footprint | Bays |
|------|------|------|---------|----------|-----------|------|
| 1 | Single Simulator | $75,000 | $300 | +25 | 2x3 | 1 |
| 2 | Simulator Center | $200,000 | $700 | +50 | 4x6 | 4 |

---

### 5. Infrastructure

#### Cart Path

Linear infrastructure connecting areas.

| Type | Cost/Tile | Monthly/Tile | Prestige |
|------|-----------|--------------|----------|
| Gravel Path | $50 | $1 | 0 |
| Asphalt Path | $150 | $3 | +0.5/10 tiles |
| Premium Path | $300 | $5 | +1/10 tiles |

**Placement:** Paint tool, auto-connects tiles.

#### Bridge

Crosses water hazards or elevation changes.

| Tier | Name | Cost | Monthly | Prestige | Span |
|------|------|------|---------|----------|------|
| 1 | Wooden Bridge | $5,000 | $50 | +10 | 3 tiles |
| 2 | Stone Bridge | $15,000 | $100 | +25 | 5 tiles |
| 3 | Decorative Bridge | $30,000 | $150 | +50 | 5 tiles |

---

### 6. Decorations

Aesthetic items that contribute to prestige and course atmosphere.

#### Seating

| Item | Cost | Monthly | Prestige | Footprint |
|------|------|---------|----------|-----------|
| Stone Bench | $500 | $5 | +2 | 1x1 |
| Wooden Bench | $300 | $3 | +1 | 1x1 |
| Covered Bench | $1,500 | $10 | +5 | 1x2 |
| Gazebo | $5,000 | $30 | +15 | 2x2 |

#### Water Features

| Item | Cost | Monthly | Prestige | Footprint |
|------|------|---------|----------|-----------|
| Drinking Fountain | $1,000 | $20 | +3 | 1x1 |
| Decorative Fountain | $10,000 | $100 | +25 | 2x2 |
| Water Feature | $25,000 | $200 | +50 | 3x3 |

#### Landscaping

| Item | Cost | Monthly | Prestige | Footprint |
|------|------|---------|----------|-----------|
| Flower Bed | $500 | $25 | +5 | 1x1 |
| Planter Box | $300 | $15 | +3 | 1x1 |
| Rock Garden | $2,000 | $10 | +8 | 2x2 |

#### Signage

| Item | Cost | Monthly | Prestige | Footprint |
|------|------|---------|----------|-----------|
| Hole Marker | $200 | $2 | +1 | 1x1 |
| Yardage Sign | $150 | $2 | +1 | 1x1 |
| Course Sign | $2,000 | $10 | +10 | 1x2 |
| Entrance Monument | $10,000 | $50 | +30 | 2x2 |

---

### 7. Edge Entities (Fences, Walls)

Edge-based items are placed along tile edges rather than occupying tile centers. This allows fencing around areas without blocking the tile itself.

#### Fences

| Variant | Cost/Edge | Monthly | Prestige | Notes |
|---------|-----------|---------|----------|-------|
| Split Rail | $25 | $0.50 | +0.5 | Rustic, low barrier |
| White Picket | $40 | $1 | +1 | Classic look |
| Wooden Fence | $50 | $1 | +1 | Standard barrier |
| Chain Link | $30 | $0.50 | 0 | Functional, no prestige |
| Metal Fence | $100 | $2 | +2 | Durable, upscale |
| Ornamental Iron | $200 | $3 | +5 | Premium appearance |

#### Walls

| Variant | Cost/Edge | Monthly | Prestige | Notes |
|---------|-----------|---------|----------|-------|
| Low Stone Wall | $75 | $1 | +2 | Decorative boundary |
| Retaining Wall | $150 | $2 | +1 | Functional for elevation changes |
| Brick Wall | $200 | $2 | +3 | Formal appearance |

#### Hedges (Edge-Based)

| Variant | Cost/Edge | Monthly | Prestige | Growth Time |
|---------|-----------|---------|----------|-------------|
| Low Hedge | $30 | $2 | +1 | 14 days |
| Tall Hedge | $50 | $3 | +2 | 30 days |
| Sculpted Hedge | $100 | $5 | +4 | 45 days |

#### Barriers

| Variant | Cost/Edge | Monthly | Prestige | Notes |
|---------|-----------|---------|----------|-------|
| Rope Barrier | $20 | $0.50 | +0.5 | Temporary/event use |
| Stanchion | $50 | $1 | +1 | Queue management |

#### Placement UI

Edge placement uses a different interaction than tile placement:
1. Select edge item from build menu
2. Hover over tile - highlights available edges
3. Click specific edge to place
4. Drag along edges to place continuous runs (auto-connects)

#### Use Cases

- **Course boundaries**: Fence off out-of-bounds areas
- **Cart path edges**: Guide cart traffic
- **Practice area enclosure**: Fence driving range
- **Decorative borders**: Stone walls around clubhouse
- **Queue management**: Rope barriers at starter's hut

---

### 8. Vegetation (Plantable)

Unlike natural obstacles (which come with the course), these are plantable landscaping items.

| Item | Cost | Monthly | Prestige | Growth Time | Mature Size |
|------|------|---------|----------|-------------|-------------|
| Ornamental Tree | $500 | $5 | +3 | 30 days | 1x1 |
| Flowering Tree | $800 | $10 | +5 | 45 days | 1x1 |
| Hedge Row | $200/tile | $3/tile | +2/5 tiles | 14 days | 1xN |
| Topiary | $1,500 | $20 | +8 | 60 days | 1x1 |
| Mature Tree | $2,000 | $5 | +5 | Instant | 1x1 |

**Growth Mechanics:**
- Planted items start small, grow to full size over time
- Condition degrades without maintenance
- Dead plants have negative prestige impact until removed

---

### 9. Parking & Entrance

The arrival experience - where golfers enter and park.

#### Course Entrance

| Tier | Name | Cost | Monthly | Prestige | Features |
|------|------|------|---------|----------|----------|
| 0 | Gravel Drive | $0 | $50 | 0 | Basic access road |
| 1 | Paved Entrance | $15,000 | $200 | +15 | Signage, landscaping |
| 2 | Grand Entrance | $50,000 | $500 | +40 | Gate house, monument sign |
| 3 | Resort Entry | $150,000 | $1,500 | +100 | Staffed gate, fountain, valet circle |

#### Parking Lots

| Size | Spaces | Cost | Monthly | Prestige | Footprint |
|------|--------|------|---------|----------|-----------|
| Small | 20 | $10,000 | $100 | +5 | 8x10 |
| Medium | 50 | $25,000 | $250 | +10 | 12x15 |
| Large | 100 | $50,000 | $500 | +20 | 20x20 |
| Overflow | 150 | $30,000 | $300 | 0 | 25x25 (gravel) |

**Parking Features (add-ons):**

| Feature | Cost | Monthly | Prestige |
|---------|------|---------|----------|
| Covered Parking | +$500/space | +$10/space | +0.5/space |
| EV Charging | $5,000/station | $50/station | +5/station |
| Bag Drop Area | $8,000 | $100 | +10 |
| Valet Stand | $3,000 | $200 | +15 |
| Cart Staging | $5,000 | $50 | +5 |

**Functional Impact:**
- Parking capacity limits max golfers (unless overflow/valet)
- Bag drop improves golfer satisfaction
- Valet required for 4+ star prestige

---

### 10. Pedestrian Paths

Separate from cart paths - for golfers walking between areas.

| Type | Cost/Tile | Monthly | Prestige | Notes |
|------|-----------|---------|----------|-------|
| Dirt Trail | $10 | $0.50 | 0 | Natural, low maintenance |
| Gravel Walk | $25 | $1 | +0.2 | Casual courses |
| Paved Walk | $50 | $2 | +0.5 | Standard |
| Stone Walk | $100 | $3 | +1 | Premium appearance |
| Covered Walk | $200 | $5 | +2 | Weather protection |

**Use Cases:**
- Clubhouse to first tee
- 9th green to 10th tee (the turn)
- 18th green back to clubhouse
- Parking lot to pro shop
- Between practice facilities

**Path Connections:**
Paths auto-connect to buildings and other paths. System validates golfer can reach all required areas.

---

### 11. Path Utilities (Small Items)

Small functional/decorative items placed along paths or at specific locations.

#### Ball Care

| Item | Cost | Monthly | Prestige | Placement |
|------|------|---------|----------|-----------|
| Ball Washer | $150 | $5 | +1 | Tee boxes |
| Club Cleaner | $200 | $5 | +1 | Tee boxes, greens |
| Divot Mix Station | $100 | $10 | +1 | Tee boxes |
| Seed/Sand Bottle | $50 | $5 | +0.5 | Cart paths |

#### Hydration

| Item | Cost | Monthly | Prestige | Placement |
|------|------|---------|----------|-----------|
| Water Cooler | $300 | $20 | +2 | Tee boxes, paths |
| Drinking Fountain | $1,000 | $30 | +3 | Paths, near buildings |
| Ice Water Station | $500 | $40 | +3 | Premium courses |

#### Information

| Item | Cost | Monthly | Prestige | Placement |
|------|------|---------|----------|-----------|
| Yardage Marker | $100 | $2 | +0.5 | Fairways (150, 100, 50) |
| Hole Sign | $200 | $2 | +1 | Tee boxes |
| Course Map | $500 | $5 | +2 | Starter, turn |
| Rules Sign | $150 | $2 | +0.5 | Entrance, tees |
| GPS Yardage Post | $400 | $10 | +2 | Throughout course |

#### Convenience

| Item | Cost | Monthly | Prestige | Placement |
|------|------|---------|----------|-----------|
| Trash Can | $100 | $5 | +0.5 | Everywhere |
| Ball Retriever | $200 | $5 | +1 | Near hazards |
| Bag Stand | $150 | $2 | +1 | Tee boxes, greens |
| Umbrella Stand | $300 | $5 | +2 | Tee boxes |
| Towel Dispenser | $400 | $15 | +2 | Premium courses |

---

### 12. Land & Expansion

Like RCT's land purchase system - buy adjacent land to expand the course.

#### Land Types

| Type | Cost/Tile | Notes |
|------|-----------|-------|
| Open Field | $100 | Easy to develop |
| Wooded | $200 | Trees included, clearing optional |
| Wetland | $50 | Restricted development, habitat bonus |
| Rocky | $150 | Requires grading |
| Premium View | $500 | Scenic overlook, prestige bonus |

#### Expansion Process

```
1. View available land parcels (highlighted on map edge)
2. Select parcel to see details (size, terrain, cost)
3. Purchase parcel → Land added to course bounds
4. Develop as desired (new holes, facilities, parking)
```

#### Parcel Sizes

| Size | Typical Cost | Can Add |
|------|--------------|---------|
| Small (20x20) | $40k-100k | 1 hole, small building |
| Medium (40x40) | $160k-400k | 2-3 holes, practice facility |
| Large (60x60) | $360k-900k | Full 9-hole expansion |

#### Restrictions

- Cannot purchase land already owned by competitors
- Some parcels have zoning restrictions (no buildings, preserve trees)
- Wetland development may require permits ($10k + 30 day wait)
- Historic sites cannot be modified

---

### 13. Hole Ratings

Like RCT's excitement/intensity/nausea, holes have quality ratings.

#### Rating Categories

```typescript
interface HoleRating {
  difficulty: number;      // 1-10, how hard to par
  enjoyment: number;       // 1-10, how fun to play
  scenicValue: number;     // 1-10, visual appeal
  memorability: number;    // 1-10, signature hole potential
  condition: number;       // 1-10, maintenance quality
}
```

#### Difficulty Factors

| Factor | Impact |
|--------|--------|
| Length | Longer = harder |
| Hazards | Water, bunkers add difficulty |
| Green contour | Undulating = harder |
| Elevation change | Hills add difficulty |
| Wind exposure | Open = harder |
| Fairway width | Narrow = harder |
| Green size | Smaller = harder |

#### Enjoyment Factors

| Factor | Impact |
|--------|--------|
| Variety | Risk/reward options |
| Flow | Natural progression |
| Pace | Not waiting on every shot |
| Scenery | Views, landscaping |
| Condition | Well-maintained |
| Fairness | Difficult but not unfair |

#### Rating Effects

| Rating | Effect |
|--------|--------|
| Difficulty 8+ | "Championship" designation eligible |
| Enjoyment 8+ | Higher golfer satisfaction |
| Scenic 8+ | Photo spot, marketing value |
| Memorability 9+ | "Signature Hole" status, +25 prestige |
| All ratings 7+ | "Well-Designed Hole" bonus |

#### Signature Holes

Holes with memorability 9+ become signature holes:
- Featured in marketing materials
- Higher photo opportunity
- Can be named (e.g., "Amen Corner", "Hell's Half Acre")
- Significant prestige bonus

---

### 14. Visual Themes (Placeholder)

> **Note:** Visual themes are part of a larger system involving grass varieties, sand types, architectural styles, and more. This section is a placeholder for future expansion.

#### Theme Categories

| Category | Options |
|----------|---------|
| Grass Type | Bentgrass, Bermuda, Zoysia, Fescue, Poa |
| Sand Style | White silica, tan, brown, crusite shell |
| Architecture | Traditional, Modern, Links, Tropical, Desert |
| Landscaping | Formal, Natural, Minimalist, Lush |

#### Theme Packs (Future)

- **Links Style**: Fescue grass, pot bunkers, minimal trees, coastal vegetation
- **Augusta Style**: Azaleas, dogwoods, pristine fairways, white sand
- **Desert Style**: Desert landscaping, waste areas, brown tones
- **Tropical Style**: Palm trees, lush vegetation, white sand, water features
- **Mountain Style**: Elevation, rock features, evergreens, natural rough

Themes affect:
- Available vegetation options
- Building architectural style
- Sand/bunker appearance
- Color palette
- Prestige bonuses for cohesive design

*Full specification to be developed in separate VISUAL_THEMES_SPEC.md*

---

## Hole Construction System

Like building a rollercoaster in RCT, players can design and build golf holes. A hole is a composite of placeable elements that together define playable golf.

### Hole Components

A complete hole consists of:

```typescript
interface HoleDefinition {
  holeNumber: number;
  par: 3 | 4 | 5;
  handicapIndex: number;              // 1-18, difficulty ranking

  teeBoxes: PlacedTeeBox[];           // Multiple tees per hole
  fairwayPath: GridPosition[];        // Defines intended play corridor
  green: PlacedGreen;                 // The putting surface
  pinPositions: PinPosition[];        // Multiple pin placements on green

  // Auto-calculated
  yardages: Map<string, number>;      // Per tee box: "Championship" -> 445
}

interface PlacedTeeBox {
  id: string;
  name: string;                       // "Championship", "Back", "Middle", "Forward"
  position: GridPosition;
  elevation: number;
  rotation: 0 | 90 | 180 | 270;       // Facing direction toward fairway
  footprint: { width: 2, height: 3 }; // Standard tee box size
  condition: number;
  tier: 0 | 1 | 2;                    // Quality level
}

interface PlacedGreen {
  id: string;
  position: GridPosition;             // Anchor point
  shape: GreenShape;                  // Predefined shapes or custom
  size: 'small' | 'medium' | 'large' | 'championship';
  elevation: number;
  contour: 'flat' | 'subtle' | 'undulating' | 'severe';
  condition: number;
  tier: 0 | 1 | 2;                    // Quality level
}

type GreenShape =
  | 'circular'
  | 'oval'
  | 'kidney'
  | 'figure_eight'
  | 'L_shaped'
  | 'custom';

interface PinPosition {
  id: string;
  name: string;                       // "Front Left", "Back Right", "Center"
  localPosition: { x: number, y: number }; // Relative to green anchor
  difficulty: 'easy' | 'medium' | 'hard';
}
```

### Building a Hole (Construction Flow)

Similar to RCT coaster building:

```
1. START HOLE
   └─ Select "Add Hole" from build menu
   └─ Assigns next available hole number

2. PLACE TEE BOXES
   └─ Place Championship tee first (defines max yardage)
   └─ Place additional tees (Back, Middle, Forward)
   └─ Each tee auto-calculates yardage to green
   └─ Tees must be placed on valid terrain (flat, non-hazard)

3. DEFINE FAIRWAY PATH (optional but recommended)
   └─ Paint tool to mark intended play corridor
   └─ Helps with yardage calculation and course rating
   └─ AI uses this for golfer pathfinding

4. PLACE GREEN
   └─ Select green size and shape
   └─ Place on course (becomes putting surface)
   └─ Terrain auto-converts to green type
   └─ Must be reachable from all tee boxes

5. SET PIN POSITIONS
   └─ Place 3-6 pin positions on green
   └─ System suggests positions, player can adjust
   └─ Each position rated for difficulty

6. FINALIZE HOLE
   └─ System calculates par suggestion based on yardage
   └─ Player confirms or adjusts par
   └─ Hole becomes playable
```

### Tee Box Tiers

| Tier | Name | Cost | Prestige | Features |
|------|------|------|----------|----------|
| 0 | Basic Tee | $2,000 | +2 | Flat surface, basic markers |
| 1 | Standard Tee | $5,000 | +5 | Leveled, proper drainage, yardage markers |
| 2 | Championship Tee | $15,000 | +15 | Premium turf, sponsor signage, ball washers |

### Green Sizes & Costs

| Size | Footprint | Cost | Monthly | Prestige |
|------|-----------|------|---------|----------|
| Small | 4x4 | $10,000 | $200 | +10 |
| Medium | 6x6 | $20,000 | $350 | +20 |
| Large | 8x8 | $35,000 | $500 | +35 |
| Championship | 10x10 | $60,000 | $800 | +60 |

### Green Contour Options

| Contour | Cost Modifier | Maintenance | Prestige | Notes |
|---------|--------------|-------------|----------|-------|
| Flat | 1.0x | Easy | +0 | Beginner-friendly |
| Subtle | 1.2x | Moderate | +5 | Standard play |
| Undulating | 1.5x | Difficult | +15 | Challenging reads |
| Severe | 2.0x | Very Difficult | +25 | Championship-level |

### Yardage Calculation

Yardage auto-calculates based on tee-to-pin distance:

```typescript
function calculateYardage(tee: PlacedTeeBox, green: PlacedGreen): number {
  const dx = green.position.x - tee.position.x;
  const dy = green.position.y - tee.position.y;
  const gridDistance = Math.sqrt(dx * dx + dy * dy);

  // courseData.yardsPerGrid defines scale (default: 2 yards per grid)
  return Math.round(gridDistance * yardsPerGrid);
}
```

### Par Suggestion

Based on yardage (standard USGA guidelines):

| Yardage (Men) | Suggested Par |
|---------------|---------------|
| < 250 | Par 3 |
| 250 - 470 | Par 4 |
| > 470 | Par 5 |

| Yardage (Women) | Suggested Par |
|-----------------|---------------|
| < 210 | Par 3 |
| 210 - 400 | Par 4 |
| > 400 | Par 5 |

Player can override if terrain/hazards justify different par.

### Hole Validation

Before a hole is playable, system validates:

- [ ] At least one tee box placed
- [ ] Green placed and reachable
- [ ] At least one pin position set
- [ ] Par assigned
- [ ] No impossible shots (cliff blocking, etc.)
- [ ] Yardage within reasonable range for par

### Modifying Existing Holes

Holes can be modified after construction:

| Action | Cost | Time | Course Impact |
|--------|------|------|---------------|
| Move tee box | 50% of original | 3 days | Hole closed |
| Move green | 75% of original | 7 days | Hole closed |
| Add pin position | $500 | Instant | None |
| Change contour | 100% of upgrade | 14 days | Hole closed |
| Delete hole | No refund | 7 days | Reduces course capacity |

### Integration with Existing HoleData

The current `HoleData` interface in `golf-logic.ts` becomes the runtime representation:

```typescript
// Existing interface (keep for compatibility)
interface HoleData {
  holeNumber: number;
  par: number;
  teeBoxes: TeeBox[];
  pinPosition: PinPosition;
  green: GreenBounds;
  idealPath: PathPoint[];
  hazards: Hazard[];
}

// New: HoleDefinition is the editable/placeable version
// HoleData is generated from HoleDefinition for gameplay
function generateHoleData(definition: HoleDefinition): HoleData {
  return {
    holeNumber: definition.holeNumber,
    par: definition.par,
    teeBoxes: definition.teeBoxes.map(convertToTeeBox),
    pinPosition: definition.pinPositions[0], // Active pin
    green: calculateGreenBounds(definition.green),
    idealPath: generateIdealPath(definition),
    hazards: findHazardsOnHole(definition)
  };
}
```

---

## Construction System

### Purchase Flow

```
1. Open Build Menu (B key or UI button)
2. Select Category → Select Item → Select Tier
3. Preview Mode: Ghost outline follows cursor
4. Validate Placement:
   - Footprint clear of obstacles/buildings
   - Terrain type allowed
   - Budget available
   - Prerequisites met
5. Confirm Placement: Deduct cost, spawn construction site
6. Construction Phase: Progress 0→100 over time
7. Operational: Entity becomes functional
```

### Construction Time

| Entity Type | Base Construction Time |
|-------------|----------------------|
| Small decoration | Instant |
| Large decoration | 1 day |
| Service point | 3 days |
| Practice facility | 7 days |
| Small building | 5 days |
| Large building | 14 days |
| Major building (Clubhouse) | 30 days |

**Modifiers:**
- +25% per tier above base
- -50% if "Rush Construction" purchased ($25% surcharge)
- Weather delays (rain adds +1 day per occurrence)

### Upgrade Flow

```
1. Select existing building
2. View upgrade options (next tier, costs, benefits)
3. Validate Footprint Expansion:
   - Higher tiers have larger footprints
   - Must have clear space around building for expansion
   - If blocked: "Cannot upgrade - insufficient space"
4. Confirm Upgrade: Deduct cost, state → 'upgrading'
5. Construction Phase: Building remains partially functional
6. Complete: State → 'operational', new tier active, larger footprint
```

**Footprint Growth on Upgrade:**

Buildings grow physically when upgraded:

| Building | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|----------|--------|--------|--------|--------|--------|
| Clubhouse | 2x2 | 3x3 | 4x4 | 5x5 | 6x6 |
| Maintenance Shed | 1x1 | 2x2 | 3x3 | 4x4 | - |
| Cart Barn | - | 2x2 | 3x3 | 4x4 | - |

The anchor point (original placement tile) remains fixed. Expansion occurs outward from the anchor. Before upgrading, the system checks if expansion tiles are:
- Within course bounds
- Not occupied by other entities
- Valid terrain (rough only)

**No Relocation:**

Buildings cannot be moved once placed. To change location:
1. Demolish existing building (lose it entirely, 10% salvage value)
2. Wait for demolition to complete
3. Place new building at desired location
4. Wait for construction to complete

This prevents exploiting the system by skipping construction time through "instant relocation."

### Demolition

```
1. Select existing entity
2. Choose "Demolish"
3. Confirm (no refund, or 10% salvage for buildings)
4. Demolition Phase: 1-7 days based on size
5. Complete: Entity removed, tile cleared
```

---

## Placement Validation

### Terrain Restrictions

| Entity Type | Allowed Terrain | Prohibited |
|-------------|-----------------|------------|
| Building | Rough only | Fairway, Green, Bunker, Water, Tee |
| Service Point | Rough | Fairway, Green, Bunker, Water |
| Practice | Rough (creates own terrain) | Green, Water |
| Decoration | Rough, Fairway edge | Green, Bunker, Water |
| Vegetation | Rough, Fairway edge | Green, Bunker, Water |
| Cart Path | Any except Water, Bunker | Water, Bunker |
| Bridge | Over Water | Must span water |

### Clearance Rules

- Buildings require 1-tile clearance from other buildings
- Cannot overlap existing entities
- Cannot block essential paths (starter to 1st tee, etc.)
- Maximum slope: Buildings require flat ground (elevation variance ≤1)

### Unique vs Multiple Buildings

Some buildings are **unique** (only one per course), others can have **multiple** instances:

| Entity | Limit | Rationale |
|--------|-------|-----------|
| Clubhouse | 1 | Central guest hub - upgrade in-place |
| Cart Barn | 1 | Central cart storage - upgrade in-place |
| Pro Shop | 1 | Single retail operation |
| Starter's Hut | 1 | One first tee |
| Halfway House | 1 | One turn location |
| Maintenance Shed | Multiple | Distribute across large courses |
| Comfort Station | 4 max | Mid-course restrooms |
| Beverage Cart Depot | Multiple | Service hubs |
| Practice Facilities | Multiple | Can have multiple ranges, greens |
| Decorations | Unlimited | Benches, flowers, signs |
| Vegetation | Unlimited | Trees, hedges |

**Upgrade vs Place:**
- **Unique buildings**: Click existing → Upgrade button → In-place transformation
- **Multiple buildings**: Can place additional OR upgrade existing ones

### Prerequisites

| Entity | Requires |
|--------|----------|
| Pro Shop (interior) | Clubhouse Tier 2+ |
| Fine Dining | Clubhouse Tier 3+ |
| Premium Cart | Cart Barn Tier 2+ |
| Teaching Academy | Driving Range |
| Beverage Service | Beverage Cart Depot |
| Tournament Hosting | Clubhouse Tier 4 |

---

## Condition & Maintenance

### Condition Decay

All entities have a condition value (0-100) that affects functionality:

| Condition | Status | Functionality | Visual |
|-----------|--------|---------------|--------|
| 80-100 | Excellent | 100% | Clean, new appearance |
| 60-79 | Good | 100% | Minor wear |
| 40-59 | Fair | 75% | Visible wear, needs attention |
| 20-39 | Poor | 50% | Degraded, affects prestige |
| 1-19 | Critical | 25% | Failing, negative prestige |
| 0 | Broken | 0% | Non-functional, major penalty |

**Decay Rate:**
- Base: -1 condition/day
- Heavy use (buildings with golfer traffic): -2/day
- Weather exposure (outdoor items): +0.5/day during rain
- Neglect multiplier: No maintenance in 30 days = 2x decay

### Maintenance Actions

Employees with appropriate skills can maintain entities:

| Action | Skill Required | Time | Effect |
|--------|---------------|------|--------|
| Clean | Groundskeeper | 10 min | +10 condition (max 80) |
| Repair | Mechanic | 30 min | +25 condition (max 90) |
| Full Service | Mechanic | 2 hr | +50 condition (max 100) |

**Auto-Maintenance:**
- Assigned employees automatically maintain entities in their area
- Priority: Critical > Poor > Fair > Good
- Maintenance costs supplies from budget

---

## Integration Points

### Economy Integration

```typescript
// On entity placement
economy.addExpense({
  type: 'construction',
  amount: entity.purchaseCost,
  category: 'facilities',
  description: `Build ${entity.variant}`
});

// Monthly upkeep (processed daily as 1/30 of monthly)
economy.addExpense({
  type: 'upkeep',
  amount: entity.monthlyUpkeep / 30,
  category: 'maintenance',
  description: `${entity.variant} upkeep`
});

// Revenue from revenue-generating entities
economy.addIncome({
  type: 'facilities',
  amount: calculateDailyRevenue(entity),
  category: 'amenities',
  description: `${entity.variant} sales`
});
```

### Prestige Integration

Entities contribute to the Amenities component of prestige (20% of total):

```typescript
function calculateTotalAmenityPrestige(entities: PlaceableEntity[]): number {
  let total = 0;
  for (const entity of entities) {
    if (entity.state === 'operational') {
      // Full prestige contribution
      total += entity.prestigeBonus;
    } else if (entity.state === 'constructing') {
      // No contribution during construction
      total += 0;
    } else if (entity.condition < 40) {
      // Reduced or negative for poor condition
      total += entity.prestigeBonus * (entity.condition / 100);
    }
  }
  return total;
}
```

### Employee Integration

- Employees spawn at assigned Maintenance Shed
- Work areas can be defined relative to buildings
- Service staff assigned to specific service points
- Teaching pros assigned to Teaching Academy/Range

### Golfer Integration

- Golfers visit Clubhouse at start/end of round
- Use Comfort Stations based on proximity during round
- Visit Halfway House at turn
- Interact with Beverage Cart on course
- Use Practice Facilities before round (affects satisfaction)

---

## Course Data Integration

All placeable entities (buildings, trees, decorations) are stored in a single `entities[]` array in the course data. This replaces the current `obstacles[]` array and uses the same format for both scenario starting state and saved games.

### Unified Course Data Structure

```typescript
interface CourseData {
  name: string;
  width: number;
  height: number;
  par: number;                      // Total course par (sum of hole pars)
  yardsPerGrid: number;             // Scale: yards per grid tile (default: 2)

  // Terrain
  layout: number[][];               // Terrain types per tile
  elevation: number[][];            // Height map

  // Placeable content
  entities: PlaceableEntity[];      // Tile-based: buildings, trees, decorations
  edges: EdgeEntity[];              // Edge-based: fences, walls, hedges
  holes: HoleDefinition[];          // Golf holes: tees, greens, pins

  // Legacy (deprecated, migrate to holes[])
  holeData?: HoleData;
}
```

**Note:** The `holes[]` array contains `HoleDefinition` objects which are the editable/placeable representation. At runtime, these are converted to `HoleData` objects for gameplay. See [Hole Construction System](#hole-construction-system) for details.

**Migration from `obstacles[]`:**

The current `obstacles[]` array becomes entities:
```typescript
// Old format
obstacles: [
  { x: 4, y: 1, type: 2 },  // type 2 = pine tree
]

// New format
entities: [
  {
    id: 'tree_4_1',
    type: 'vegetation',
    variant: 'pine_tree',
    tier: 0,
    position: { x: 4, y: 1 },
    footprint: { width: 1, height: 1, blockedCells: [{ x: 0, y: 0 }], entryPoints: [] },
    rotation: 0,
    state: 'operational',
    condition: 100,
    constructionProgress: 100,
    purchaseCost: 0,      // Pre-existing, no cost
    monthlyUpkeep: 5,
    prestigeBonus: 3,
    effectRadius: 0,
    placedAt: 0,
    lastMaintained: 0
  },
  // ... buildings, decorations, etc.
]
```

### Scenario Starting State

When a scenario loads, `courseData.entities[]` IS the starting state. No separate "defaults" needed.

| Scenario Type | Starting Entities |
|---------------|-------------------|
| Tutorial | Tier 0 clubhouse, Tier 0 shed, basic trees |
| Standard | Tier 1 clubhouse, Tier 1 shed, trees, starter's hut |
| Restoration | Tier 2 clubhouse (damaged), neglected facilities |
| Championship | Tier 3 clubhouse, full practice facilities, landscaping |
| Resort | Tier 4 everything, extensive decorations |

### Save/Load Consistency

- **Starting scenario**: Load `courseData.entities[]`
- **Saving game**: Write current `entities[]` to save file
- **Loading save**: Replace `entities[]` with saved state

Same data structure throughout. No special handling needed.

### Placement Guidelines (for course designers)

| Building | Recommended Location |
|----------|---------------------|
| Clubhouse | Near course entrance, close to 1st tee and 18th green |
| Maintenance Shed | Behind clubhouse or service area, away from golfer paths |
| Cart Barn | Between clubhouse and 1st tee |
| Starter's Hut | Adjacent to 1st tee box |
| Halfway House | Between 9th green and 10th tee |

---

## Data Persistence

### Save Structure

```typescript
interface PlaceableEntityState {
  entities: PlaceableEntity[];
  constructionQueue: ConstructionJob[];
  totalInvested: number;          // Lifetime facility spending
  facilitiesUnlocked: string[];   // Unlocked building types
}

interface ConstructionJob {
  entityId: string;
  type: 'construction' | 'upgrade' | 'demolition';
  progress: number;
  daysRemaining: number;
  rushOrder: boolean;
}
```

### Migration from Abstract Amenities

For existing saves using `amenities.ts`:

```typescript
function migrateAmenityState(old: AmenityState): PlaceableEntity[] {
  const entities: PlaceableEntity[] = [];

  // Convert clubhouse tier to placed building
  if (old.clubhouseTier > 0) {
    entities.push(createClubhouse(old.clubhouseTier, defaultClubhousePosition));
  }

  // Convert boolean facilities to placed buildings
  if (old.facilities.drivingRange) {
    entities.push(createDrivingRange(1, defaultRangePosition));
  }

  // ... etc for all facilities

  return entities;
}
```

---

## UI Design

### Build Menu

```
┌─────────────────────────────────────────────────────┐
│  BUILD MENU                                    [X]  │
├─────────────────────────────────────────────────────┤
│  [Buildings] [Facilities] [Services] [Practice]    │
│  [Infrastructure] [Decorations] [Vegetation]       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  BUILDINGS                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Clubhouse   │ │ Maint Shed  │ │ Cart Barn   │  │
│  │ [Tier 1-4]  │ │ [Tier 0-3]  │ │ [Tier 0-2]  │  │
│  │ $50k-$1M    │ │ $5k-$150k   │ │ $10k-$75k   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Selected: Maintenance Shed (Tier 1)               │
│  Cost: $15,000    Monthly: $150    Prestige: +5    │
│  Size: 2x2        Build Time: 5 days               │
│                                                     │
│  [Cancel]                              [Place →]   │
└─────────────────────────────────────────────────────┘
```

### Placement Preview

When placing an entity:
- Ghost outline shows footprint
- Green = valid placement
- Red = invalid (with reason tooltip)
- Entry points highlighted
- Effect radius shown (if applicable)

### Entity Info Panel

When selecting a placed entity:

```
┌─────────────────────────────────────────────────────┐
│  MAINTENANCE SHED (Tier 2)                         │
│  ★★☆☆ Operations Center                            │
├─────────────────────────────────────────────────────┤
│  Condition: ████████░░ 82%  [Maintenance]          │
│  Status: Operational                                │
│                                                     │
│  Equipment Slots: 6/8 used                          │
│  Resource Storage: 3,450/5,000                      │
│  Workers Assigned: 3                                │
│                                                     │
│  Monthly Upkeep: $400                               │
│  Prestige Bonus: +15                                │
├─────────────────────────────────────────────────────┤
│  [Upgrade to Tier 3]  $100,000                     │
│  [Assign Workers]  [Demolish]                      │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Entity System
- [ ] Define `PlaceableEntity` interface and types
- [ ] Create `EntityManager` class with CRUD operations
- [ ] Implement grid-based placement validation
- [ ] Add entity state machine (construction, operational, etc.)
- [ ] Create save/load serialization

### Phase 2: Building Implementation
- [ ] Implement Maintenance Shed (replace REFILL_STATIONS)
- [ ] Implement Clubhouse tiers
- [ ] Implement Cart Barn
- [ ] Connect buildings to existing systems

### Phase 3: Visual Rendering
- [ ] Create building sprites/models for each tier
- [ ] Implement construction animation (scaffolding)
- [ ] Add condition-based visual degradation
- [ ] Render footprint on terrain

### Phase 4: Facilities & Services
- [ ] Implement Pro Shop, Dining
- [ ] Implement Comfort Stations, Halfway House
- [ ] Implement Starter's Hut
- [ ] Connect to golfer flow

### Phase 5: Practice Facilities
- [ ] Implement Driving Range with terrain generation
- [ ] Implement Practice Greens
- [ ] Implement Teaching Academy
- [ ] Add revenue generation

### Phase 6: Decorations & Vegetation
- [ ] Implement decoration placement
- [ ] Implement plantable vegetation with growth
- [ ] Add prestige calculations for decorations

### Phase 7: UI & Polish
- [ ] Build menu implementation
- [ ] Placement preview system
- [ ] Entity info panels
- [ ] Upgrade flow UI

### Phase 8: Migration
- [ ] Migrate existing `amenities.ts` to entity system
- [ ] Update prestige calculations
- [ ] Update scenario conditions
- [ ] Test backward compatibility

---

## Appendix: Full Entity Reference

### Quick Reference Table

| Entity | Category | Min Cost | Max Cost | Prestige Range | Footprint |
|--------|----------|----------|----------|----------------|-----------|
| Clubhouse | Building | $0 | $1,000,000 | 0-250 | 2x2 to 6x6 |
| Maintenance Shed | Building | $5,000 | $150,000 | 0-30 | 1x1 to 4x4 |
| Cart Barn | Building | $10,000 | $75,000 | 0-25 | 2x2 to 4x4 |
| Pro Shop | Facility | $25,000 | $200,000 | 25-100 | 2x2 or interior |
| Dining | Facility | $1,000 | $500,000 | 0-175 | Interior |
| Comfort Station | Service | $2,000 | $25,000 | 5-15 | 1x1 to 2x2 |
| Halfway House | Service | $20,000 | $80,000 | 20-50 | 2x2 to 3x3 |
| Beverage Depot | Service | $8,000 | $20,000 | 15-30 | 2x2 |
| Starter's Hut | Service | $5,000 | $15,000 | 10-20 | 1x1 to 2x2 |
| Driving Range | Practice | $30,000 | $250,000 | 30-75 | 10x20 to 20x30 |
| Putting Green | Practice | $10,000 | $25,000 | 15-25 | 5x5 to 8x8 |
| Chipping Area | Practice | $15,000 | $40,000 | 15-30 | 4x6 to 8x10 |
| Teaching Academy | Practice | $50,000 | $100,000 | 30-50 | 3x4 |
| Golf Simulator | Practice | $75,000 | $200,000 | 25-50 | 2x3 to 4x6 |
| Cart Path | Infra | $50/tile | $300/tile | 0-0.1/tile | 1xN |
| Bridge | Infra | $5,000 | $30,000 | 10-50 | 3-5 tiles |
| Bench | Decoration | $300 | $1,500 | 1-5 | 1x1 to 1x2 |
| Fountain | Decoration | $1,000 | $25,000 | 3-50 | 1x1 to 3x3 |
| Flower Bed | Decoration | $500 | $500 | 5 | 1x1 |
| Signage | Decoration | $150 | $10,000 | 1-30 | 1x1 to 2x2 |
| Ornamental Tree | Vegetation | $500 | $2,000 | 3-5 | 1x1 |
| Hedge | Vegetation | $200/tile | $200/tile | 0.4/tile | 1xN |

---

## Summary

This specification unifies all placeable content into a single coherent system:

1. **Grid-Based Placement** - Every entity has a physical location
2. **Tiered Progression** - Buildings upgrade in-place
3. **Construction Phases** - Visible building process
4. **Condition System** - Maintenance affects functionality
5. **Economy Integration** - Costs, upkeep, and revenue
6. **Prestige Integration** - Buildings contribute to course rating
7. **Employee Integration** - Workers interact with buildings
8. **Golfer Integration** - Guests use facilities

The system replaces the abstract `amenities.ts` approach while preserving all its gameplay effects, now enhanced with physical presence on the course.
