# Wear Patterns & Rotational Maintenance Specification

## Overview

Golf courses experience concentrated wear from repeated play in specific high-traffic areas. Professional golf course management requires rotating cup positions daily, moving tee markers regularly, and managing divot repair to distribute wear and maintain playable conditions.

This document outlines the wear pattern simulation and rotational maintenance systems that would add realistic operational management to the game.

---

## Core Concept

**The Problem:**
- Golfers always walk the same paths (tee to fairway to green)
- Cups in the same position create worn circles around the hole
- Tee markers in the same spot create concentrated divots
- High-traffic areas become compacted and thin

**The Solution:**
- **Daily cup rotation** distributes wear across the green
- **Weekly tee marker movement** prevents tee box damage
- **Traffic pattern awareness** helps predict wear zones
- **Divot repair** and **rest periods** allow turf recovery

---

## Wear Mechanics

### Tile Wear System

**Per-Tile Wear State:**
```typescript
interface TileWearState {
  trafficLevel: number;              // 0-100, cumulative traffic exposure
  divotCount: number;                // Number of unrepaired divots
  compaction: number;                // 0-100, soil compaction from foot traffic
  wearStage: 'pristine' | 'light' | 'moderate' | 'heavy' | 'damaged';

  // Recovery
  restDays: number;                  // Days since last traffic (if roped off)
  repairNeeded: boolean;             // Requires intervention
}
```

**Wear Accumulation:**
- **Golfer Footsteps:** Each golfer passage adds +1 traffic
- **Cart Traffic:** Golf carts add +3 traffic per pass
- **Employee Movement:** Workers add +0.5 traffic
- **Player Movement:** Player adds +0.2 traffic per tile

**Wear Stages:**
| Stage | Traffic Level | Visual | Gameplay Impact |
|-------|--------------|--------|-----------------|
| **Pristine** | 0-20 | Perfect turf | None |
| **Light Wear** | 21-40 | Slight thinning | -5 health |
| **Moderate Wear** | 41-70 | Visible paths, bare spots | -15 health, -2 prestige/100 tiles |
| **Heavy Wear** | 71-90 | Thin turf, mud in wet areas | -30 health, -5 prestige/100 tiles |
| **Damaged** | 91-100 | Bare dirt, unplayable | -50 health, -10 prestige/100 tiles |

### Traffic Pattern Prediction

**High-Wear Zones:**
1. **Tee Box Front:** Where golfers stand to tee off
2. **Tee Box Edges:** Entry/exit points
3. **Green Approaches:** Traffic funnels to green entrance
4. **Cup Perimeter:** 3-foot radius around hole (ball retrieval)
5. **Cart Paths:** If not paved, creates ruts
6. **Between Holes:** Transition routes (18th green → clubhouse)

**Heatmap Visualization:**
- Tab overlay shows traffic patterns
- Red = high wear zones
- Yellow = moderate traffic
- Green = light use
- Blue = no traffic (can identify underused areas)

---

## Divot System

### Divot Generation

**Divot Sources:**
- **Tee Shots:** 60% chance per golfer on tee boxes
- **Fairway Shots:** 30% chance per golfer on fairways
- **Practice Swings:** 10% chance on greens/fringes (improper etiquette)
- **Poor Technique:** Low-skill golfers create more divots

**Divot Properties:**
```typescript
interface Divot {
  position: GridPosition;
  age: number;                       // Days old
  size: 'small' | 'medium' | 'large';
  repaired: boolean;
  seedFilled: boolean;               // Professional repair (seed + sand)
  naturalHealing: number;            // 0-100, recovery progress
}
```

**Divot Accumulation Rate:**
- **9-Hole Course:** ~50-80 divots per day
- **18-Hole Course:** ~100-150 divots per day
- **Tournament Days:** 2x normal rate (more golfers)
- **Wet Conditions:** +50% divots (softer turf)

### Visual Representation

**Divot Graphics:**
- **Small Divot:** 1x1 sprite, brown dirt exposed
- **Medium Divot:** 1x2 sprite, chunk removed
- **Large Divot:** 2x2 sprite, significant bare area
- **Aging:** Divots darken over time (dirt → mud in rain)
- **Repaired:** Sand-filled divots (tan color) blend better

**Density Thresholds:**
| Divot Count (per 100 tiles) | Visual Impact | Prestige Penalty |
|-----------------------------|---------------|------------------|
| 0-5 | Occasional divots | None |
| 6-15 | Noticeable damage | -2 |
| 16-30 | Poor conditions | -5 |
| 31+ | Unacceptable | -10 |

---

## Cup Rotation System

### Why Rotate Cups?

**Wear Concentration:**
- Golfers walk directly to the cup from all directions
- Repeated foot traffic in 3-4 foot radius around hole
- Turf compaction from standing, bending, ball retrieval
- High-wear "donut" forms around cup within 7 days

**Benefits of Rotation:**
- Distributes wear across entire green surface
- Allows previous cup area to recover
- Provides variety for regular golfers
- Different pin positions create different shot challenges

### Rotation Mechanics

**Pin Position Slots:**
Each green has 3-6 pre-defined pin positions (from hole design):
- **Front Left** (easy)
- **Front Right** (medium)
- **Center** (easy)
- **Back Left** (hard)
- **Back Center** (medium)
- **Back Right** (hard)

**Rotation Schedule:**
```typescript
interface CupRotation {
  currentPinPosition: string;        // Active pin position ID
  daysSinceChange: number;           // Days at current position
  rotationPattern: string[];         // Planned sequence
  wearLevels: Map<string, number>;   // Wear per position
}
```

**Rotation Frequency:**
- **Daily (Professional):** Tournament courses, high-end facilities
- **Every 2-3 Days (Standard):** Most public courses
- **Weekly (Casual):** Low-budget or low-traffic courses

**Rotation Strategies:**
| Strategy | Pattern | Benefit |
|----------|---------|---------|
| **Sequential** | Front → Middle → Back → repeat | Simple, predictable |
| **Difficulty Rotation** | Easy → Medium → Hard → repeat | Balanced challenge |
| **Wear-Based** | Move to least-worn position | Optimal turf health |
| **Random** | Random selection | Maximum variety |

### Gameplay Implementation

**Manual Cup Change:**
1. Select green
2. Choose new pin position from available slots
3. Employee (or player) travels to green
4. **Time Required:** 5 minutes per green
5. Old position begins recovery (wear reduces by 10/day)

**Automated Rotation (Research Unlock):**
- Assign employee as "Cup Setter"
- Set rotation schedule (daily/every 2 days/weekly)
- Employee automatically rotates cups each morning
- Can override manually for tournaments

**UI Indicators:**
- 📍 Icon over green shows current pin position
- ⚠️ Warning if cup hasn't been moved in 7+ days
- Heatmap shows wear around each pin position
- Calendar shows rotation history

---

## Tee Marker Rotation

### Why Move Tee Markers?

**Concentrated Wear:**
- Golfers stand in same 2x3 tile area repeatedly
- Divots accumulate at tee marker positions
- Tee box becomes pockmarked with bare spots
- Uneven wear makes tee box unlevel and ugly

**Benefits of Movement:**
- Distributes divots across entire tee box surface
- Maintains level teeing ground
- Prevents permanent damage
- Tee boxes look well-maintained

### Rotation Mechanics

**Tee Box Zones:**
Each tee box divided into 6-9 zones:
```
[1] [2] [3]
[4] [5] [6]  ← 2x3 tee box grid
[7] [8] [9]
```

**Marker Position:**
```typescript
interface TeeMarkerPosition {
  teeBoxId: string;
  currentZone: number;               // 1-9
  daysSinceMove: number;
  wearLevels: Map<number, number>;   // Wear per zone
}
```

**Movement Frequency:**
- **Every 2-3 Days (Professional):** Championship courses
- **Weekly (Standard):** Most public courses
- **Bi-Weekly (Casual):** Low-budget courses

**Movement Strategy:**
- Move to zone with lowest wear
- Avoid recently used zones (< 7 days ago)
- Rotate through all zones before repeating
- Consider yardage requirements (forward markers farther forward)

### Gameplay Implementation

**Manual Marker Move:**
1. Select tee box
2. Choose new zone position
3. Employee moves physical markers
4. **Time Required:** 2 minutes per tee box
5. Old zone begins recovery

**Automated Rotation:**
- Assign employee as "Tee Setter"
- Set movement schedule
- Employee moves markers each morning
- Typically combined with cup rotation duties

**UI Indicators:**
- Tee box shows wear heatmap (if selected)
- ⚠️ Warning if markers haven't moved in 14+ days
- Visual wear visible on tee box tiles

---

## Divot Repair

### Repair Methods

#### 1. Player/Golfer Self-Repair (Passive)
**Golfers repair their own divots (sometimes):**
- **Repair Rate:** 30-60% based on course etiquette rating
- **Method:** Replace divot or fill with seed/sand mix
- **Effectiveness:** 50% (casual repair, better than nothing)
- **Cost:** Free (if divot mix stations provided)

**Boosting Golfer Repair Rate:**
- Place divot mix stations at tee boxes (+20% repair rate)
- Signage reminding golfers (+10% repair rate)
- Ranger enforcement (+15% repair rate)
- Course with high prestige = respectful golfers (+10% rate)

#### 2. Employee Manual Repair
**Dedicated divot repair task:**
- **Employee Role:** Groundskeeper or specialist
- **Task:** "Repair divots on [area]"
- **Speed:** ~20 divots per hour (walking, filling, tamping)
- **Effectiveness:** 80% (proper seed/sand mix, tamped)
- **Cost:** Labor time + materials

**Materials Required:**
- **Divot Mix:** 50% sand, 50% seed blend
- **Cost:** $0.10 per divot repair
- **Storage:** Requires divot mix supply (bulk purchase)

#### 3. Mechanical Divot Fill (Research Unlock)
**Ride-on divot filler:**
- **Equipment:** Tow-behind spreader for divot mix
- **Speed:** Entire course in 2 hours
- **Effectiveness:** 70% (fast but less precise)
- **Cost:** $8,500 equipment + $30 per application
- **Unlock:** Research "Advanced Turf Equipment"

### Divot Healing

**Natural Recovery (Unrepaired):**
- **Bare Divot:** 30-60 days to fully heal (very slow)
- **Appearance:** Brown scar visible for weeks
- **Weather Impact:** Rain speeds healing (+20%), drought slows (-50%)

**Repaired Divot:**
- **Seed/Sand Fill:** 14-21 days to green up
- **Appearance:** Tan sand visible for 7 days, then grass emerges
- **Success Rate:** 80% in ideal conditions

**Optimal Conditions:**
- Adequate moisture
- Warm temperatures (60-80°F)
- Regular mowing blends repaired areas
- Fertilization accelerates growth

---

## Rest and Recovery

### Roped-Off Areas

**Purpose:**
- Allow heavily worn areas to recover
- Prevent further traffic damage
- Accelerate healing with reduced compaction

**Mechanics:**
```typescript
interface RestArea {
  tiles: GridPosition[];
  startDate: number;
  plannedDuration: number;           // Days
  recoveryRate: number;              // Wear reduction per day
  alternateRoute: boolean;           // Can golfers play around it?
}
```

**Recovery Rate:**
- **Roped Off:** -15 wear per day
- **Roped Off + Overseeded:** -20 wear per day
- **Roped Off + Aerated + Overseeded:** -30 wear per day

**Gameplay Impact:**
- Closing tee boxes requires alternate tees (affects yardage)
- Closing greens requires temporary greens (affects prestige)
- Closing high-traffic paths forces rerouting
- Golfers may complain about closures (satisfaction -5%)

### Temporary Greens/Tees

**When to Use:**
- Permanent green/tee under renovation
- Severe wear requires extended rest (> 14 days)
- Seasonal closure (winter kill recovery)

**Temporary Setup:**
- **Temporary Green:** Smaller, flat area near real green
- **Prestige Impact:** -15 (golfers dislike temporary greens)
- **Cost:** $500 setup + $20/day maintenance
- **Duration:** Typically 2-4 weeks

**Strategic Use:**
- Rotate one hole at a time to temporary setup
- Allows aggressive recovery on permanent surfaces
- Balances course availability vs. long-term quality

---

## Integration with Existing Systems

### Employee System

**New Task Types:**
```typescript
type MaintenanceTask =
  | 'rotate_cups'           // Daily cup position changes
  | 'move_tee_markers'      // Weekly tee marker movement
  | 'repair_divots'         // Manual divot filling
  | 'rope_off_area'         // Set up rest zones
  | 'remove_ropes'          // Reopen recovered areas
  | 'temporary_green_setup' // Install temporary putting surface
```

**Specialized Roles:**
- **Cup/Tee Setter:** Dedicated to daily rotation (0.5 FTE)
- **Divot Repair Specialist:** Focuses on high-traffic areas (1 FTE on busy courses)

### Research Tree Additions

**Wear Management Branch:**
```
├─ Efficient Cup Rotation (Tier 1)
│  └─ 400 points: Reduces cup change time by 50%
│
├─ Divot Management (Tier 2)
│  ├─ 600 points: +20% golfer self-repair rate
│  └─ 700 points: Mechanical divot filler unlocked
│
├─ Traffic Analysis (Tier 3)
│  ├─ 1000 points: Wear prediction overlay
│  └─ 1200 points: Automated rotation suggestions
│
└─ Turf Recovery Optimization (Tier 4)
   ├─ 1800 points: +50% recovery rate for rested areas
   └─ 2000 points: Temporary green quality improvement
```

### Equipment Additions

| Equipment | Function | Cost | Unlock |
|-----------|----------|------|--------|
| **Cup Cutter** | Changes cup positions | $400 | Start |
| **Divot Mix Cart** | Manual divot repair | $800 | Start |
| **Mechanical Divot Filler** | Tow-behind spreader | $8,500 | Research |
| **Rope & Stakes** | Mark rest areas | $200 | Start |
| **Temporary Green Kit** | Setup alternate putting surfaces | $2,000 | Research |

### Economy Integration

**Costs:**
- **Cup Rotation:** Labor only (~$15/green at $30/hr wage)
- **Tee Marker Movement:** Labor only (~$5/tee box)
- **Divot Repair Materials:** $0.10 per divot
- **Roped-Off Areas:** Lost revenue (fewer playable holes)
- **Temporary Greens:** $500 setup + $20/day

**Revenue Impact:**
- **Poor Conditions (Heavy Wear):** -20% golfer arrivals
- **Unrepaired Divots:** -10% golfer satisfaction
- **Temporary Greens:** -10% green fees (reduced value perception)
- **Well-Maintained Course:** +5% prestige → more golfers

### Prestige System Integration

**Wear Penalties:**
- **Heavy Wear on Greens:** -10 prestige per green
- **Divot-Scarred Tee Boxes:** -5 prestige per hole
- **Visible Bare Spots:** -3 prestige per 100 tiles
- **Temporary Greens:** -15 prestige per hole

**Maintenance Bonuses:**
- **Daily Cup Rotation:** +3 prestige (shows attention to detail)
- **Pristine Tee Boxes:** +2 prestige per hole
- **Well-Maintained Paths:** +5 prestige
- **Quick Divot Repair:** +2 prestige (responsive management)

### Golfer System Integration

**Golfer Behavior:**
- **Divot Creation Rate:** Based on skill level
  - Beginners: 80% chance per tee shot
  - Average: 60% chance
  - Skilled: 40% chance
- **Self-Repair Rate:** Based on course prestige + etiquette
- **Complaints:** Golfers mention divots/wear in reviews

**Satisfaction Impact:**
- **Smooth Tee Boxes:** +5 satisfaction
- **Divot-Filled Greens:** -10 satisfaction (ball deflection)
- **Worn Paths:** -5 satisfaction (muddy, uneven)

---

## Gameplay Strategies

### Early Game
- **Manual Everything:** Player or single employee handles rotation
- **Prioritize Greens:** Cup rotation more important than tee markers
- **Reactive Divot Repair:** Only fix worst areas
- **Accept Some Wear:** Focus budget on grass health

### Mid Game
- **Hire Cup/Tee Setter:** Automate daily rotation
- **Establish Patterns:** Set rotation schedules
- **Divot Mix Stations:** Encourage golfer self-repair
- **Monitor Wear:** Use overlay to identify problem zones

### Late Game
- **Fully Automated:** Research unlocks + dedicated staff
- **Preventative Management:** Rotate before wear accumulates
- **Strategic Rest:** Proactively rope off areas during low season
- **Mechanical Solutions:** Divot filler for efficiency

---

## Visual Feedback & UI

### Wear Overlay Mode

**Press Tab to cycle overlays:**
- Normal → Moisture → Nutrients → Height → Weeds → **Wear** → Normal

**Wear Overlay Colors:**
| Color | Wear Level | Meaning |
|-------|------------|---------|
| Dark Green | 0-20 | Pristine condition |
| Light Green | 21-40 | Light traffic, no concern |
| Yellow | 41-70 | Moderate wear, monitor |
| Orange | 71-90 | Heavy wear, action needed |
| Red | 91-100 | Damaged, requires rest/repair |

### HUD Indicators

**Rotation Warnings:**
- "⚠️ Hole 7 cup hasn't been moved in 8 days"
- "⚠️ Tee boxes on Holes 3, 5, 9 need marker movement"
- "📍 Daily cup rotation complete (18/18 greens)"

**Divot Alerts:**
- "🔧 342 unrepaired divots on course"
- "🔧 Hole 12 tee box has 23 divots (action recommended)"

**Wear Notifications:**
- "⛔ Hole 5 green approach is heavily worn (consider rest period)"
- "✅ Rested area (Hole 2 tee box) has recovered to 85% health"

---

## Implementation Priority

**Status:** Not yet implemented

**Recommended Priority:** **Tier 2** (high thematic fit, medium complexity)

**Rationale:**
- Core golf course management mechanic
- High visibility (wear is obvious to players)
- Creates daily operational tasks
- Adds strategic planning (rest vs. revenue)
- Integrates with existing systems (employees, golfers, prestige)

**Dependencies:**
- Per-tile wear state tracking
- Golfer traffic simulation
- Employee task system expansion
- Visual assets (divots, wear patterns)
- UI overlays for wear visualization

**Phased Implementation:**
1. **Phase 1:** Wear accumulation and visual feedback
2. **Phase 2:** Cup rotation and tee marker movement
3. **Phase 3:** Divot generation and repair
4. **Phase 4:** Rest/recovery and temporary surfaces

---

## Design Considerations

### Balancing Realism vs. Tedium

**Avoid:**
- Clicking individual divots to repair (too micro)
- Forced daily cup rotation (feels like homework)
- Instant wear catastrophe (too punishing)

**Prefer:**
- Strategic decisions about rotation schedules
- Automated systems with oversight
- Gradual wear that rewards planning
- Visual feedback that makes impact clear

### Difficulty Scaling

**Easy Mode:**
- Slower wear accumulation
- Higher golfer self-repair rate
- Automated rotation available early
- Longer grace periods before penalties

**Hard Mode:**
- Rapid wear (realistic rates)
- Low golfer etiquette (more divots, less self-repair)
- Expensive rotation labor
- Prestige penalties hit harder

### Seasonal Considerations

**Spring:**
- Wet soil = more divots
- Fast growth = quick divot healing
- High traffic as season begins

**Summer:**
- Dry conditions = slower healing
- Peak traffic = maximum wear
- Heat stress compounds wear damage

**Fall:**
- Moderate conditions
- Overseeding repairs summer wear
- Traffic remains high

**Winter:**
- Minimal traffic (course may close)
- Recovery period for worn areas
- Opportunity for aggressive rest/repair

---

## Related Systems

- **Golfer Simulation:** Traffic generation and divot creation
- **Employee System:** Task assignment and automation
- **Prestige System:** Wear penalties and maintenance bonuses
- **Research Tree:** Efficiency upgrades and automation
- **Equipment:** Specialized tools for rotation and repair
- **Economy:** Labor costs, material costs, revenue impacts
- **Course Design:** Predefined pin positions and tee box zones

---

## Future Enhancements

**Advanced Traffic Analysis:**
- Machine learning predicts wear hotspots
- Suggests optimal rotation patterns
- Alerts before wear becomes severe

**Weather Integration:**
- Rain creates mud in worn areas
- Frost delays healing
- Extreme heat accelerates wear

**Tournament Preparation:**
- Special rotation protocols for events
- Pre-tournament divot blitzes
- Post-tournament recovery plans

**Historical Data:**
- Track wear patterns over seasons
- Identify chronic problem areas
- Long-term planning for redesigns

---

## Conclusion

Wear patterns and rotational maintenance represent the **daily operational reality** of golf course management. Superintendents spend significant time:
- Planning cup positions to balance challenge and turf health
- Moving tee markers to prevent concentrated wear
- Repairing divots to maintain playing quality
- Managing traffic to distribute impact

Adding these systems creates:
- **Daily Tasks:** Cup rotation, tee marker movement
- **Strategic Decisions:** When to rest areas vs. keep playing
- **Reactive Management:** Divot repair and wear monitoring
- **Long-Term Planning:** Rotation patterns and recovery schedules

This enhances realism, adds operational depth, and rewards attentive management. Combined with existing systems (grass health, employees, economy), it creates a comprehensive turf management simulation where small daily decisions compound into course-wide quality outcomes.
