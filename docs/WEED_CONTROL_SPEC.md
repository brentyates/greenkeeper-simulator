# Weed Control System Specification

## Overview

Weeds are unwanted plants that compete with desirable turfgrass for water, nutrients, and sunlight. They lower the visual quality of the course and affect playability. Managing weeds requires a combination of cultural practices, preventative measures, and targeted treatments.

This document outlines the weed control system as a potential future addition to the game's course maintenance mechanics.

---

## Weed Types

### Broadleaf Weeds
Characterized by wide leaves and prominent flowers/seed heads.

| Weed | Growth Pattern | Spread Rate | Visual Impact | Treatment Difficulty |
|------|----------------|-------------|---------------|---------------------|
| **Dandelion** | Taproot, rosette | Medium | High (yellow flowers) | Medium |
| **Clover** | Creeping stems | High | Medium (white flowers) | Easy |
| **Plantain** | Rosette | Low | Medium | Medium |
| **Chickweed** | Mat-forming | High | Low | Easy |
| **Ground Ivy** | Creeping | Very High | High (aromatic) | Hard |

### Grassy Weeds
Grass-like plants that blend in initially but grow differently than turfgrass.

| Weed | Growth Pattern | Spread Rate | Visual Impact | Treatment Difficulty |
|------|----------------|-------------|---------------|---------------------|
| **Crabgrass** | Annual, sprawling | Very High | High (summer) | Medium |
| **Poa Annua** | Annual bluegrass | High | Medium (spring) | Hard |
| **Quackgrass** | Rhizomes | Medium | High | Very Hard |
| **Goosegrass** | Annual, prostrate | Medium | Medium | Medium |
| **Tall Fescue** | Bunch-type | Low | High (clumpy) | Hard |

### Sedges
Grass-like but triangular stems, often in wet areas.

| Weed | Growth Pattern | Spread Rate | Visual Impact | Treatment Difficulty |
|------|----------------|-------------|---------------|---------------------|
| **Yellow Nutsedge** | Rhizomes, tubers | High | High (yellow-green) | Very Hard |
| **Purple Nutsedge** | Rhizomes, tubers | High | High | Very Hard |

---

## Weed Mechanics

### Weed Infestation System

**Per-Tile Weed State:**
```typescript
interface TileWeedState {
  weedType: WeedType | null;           // Primary weed species
  weedDensity: number;                 // 0-100 (coverage percentage)
  weedStage: 'seedling' | 'vegetative' | 'flowering' | 'seeding';
  daysInfested: number;                // Age of infestation
  resistanceLevel: number;             // 0-100 (herbicide resistance)
}
```

**Weed Establishment Factors:**
- **Poor Turf Health:** Weak grass (< 60% health) increases weed pressure
- **Low Mowing Height:** Scalping creates bare spots
- **Soil Compaction:** Favors shallow-rooted weeds
- **Over-Watering:** Encourages crabgrass and sedges
- **Under-Fertilization:** Allows weeds to outcompete grass
- **Seasonal Timing:** Spring for annual weeds, summer for warm-season weeds

**Spread Mechanics:**
- **Adjacent Tile Spread:** Each day, infested tiles have a chance to spread to neighboring tiles
- **Seed Production:** Flowering/seeding weeds dramatically increase spread rate
- **Mowing Spread:** Mowing flowering weeds spreads seeds across large areas
- **Traffic Paths:** High-traffic areas (player movement, golfer paths) spread weed seeds

### Visual Representation

**Weed Density Tiers:**
| Density | Visual Description | Gameplay Impact |
|---------|-------------------|-----------------|
| 0-10% | Occasional individual weeds | Minimal (-1 tile quality) |
| 11-30% | Scattered patches | Low (-5 tile quality, -1 prestige per 100 tiles) |
| 31-60% | Moderate infestation | Medium (-10 tile quality, -3 prestige per 100 tiles) |
| 61-100% | Heavy infestation | High (-20 tile quality, -8 prestige per 100 tiles) |

**Visual Rendering:**
- Dandelions: Yellow flower sprites on fairways/roughs
- Crabgrass: Light-green, coarse texture patches
- Clover: White flower clusters
- Poa Annua: Lighter green seed heads in spring
- Nutsedge: Taller, yellow-green blades standing out

---

## Weed Control Methods

### 1. Cultural Control (Preventative)
**No direct cost, prevents establishment**

| Practice | Effect | Implementation |
|----------|--------|----------------|
| **Proper Mowing Height** | Dense turf crowds out weeds | Maintain species-appropriate height |
| **Adequate Fertilization** | Vigorous grass outcompetes weeds | Follow fertilizer schedule |
| **Core Aeration** | Reduces compaction | Annual/bi-annual treatment |
| **Overseeding** | Fills bare spots | Fall application |
| **Proper Watering** | Deep roots, less weed pressure | Infrequent, deep watering |

### 2. Pre-Emergent Herbicides (Preventative)
**Applied before weed seeds germinate**

| Product | Target Weeds | Application Window | Cost | Duration |
|---------|--------------|-------------------|------|----------|
| **Prodiamine** | Crabgrass, annual weeds | Early spring | $$$ | 4-6 months |
| **Dithiopyr** | Crabgrass (post-emergent too) | Spring | $$$$ | 3-5 months |
| **Pendimethalin** | Annual grasses, broadleaf | Spring/Fall | $$ | 3-4 months |

**Mechanics:**
- Must be applied BEFORE weeds germinate (timing is critical)
- Creates a chemical barrier in top 1-2" of soil
- Prevents seedling root development
- Does NOT kill existing weeds
- Requires watering to activate
- Prevents grass seeding too (don't overseed for 3-4 months)

**Gameplay:**
- Early spring decision: apply pre-emergent or allow overseeding?
- Missed application window = reactive (expensive) herbicides later
- Weather affects timing (soil temperature triggers)

### 3. Post-Emergent Herbicides (Reactive)
**Applied to actively growing weeds**

#### Broadleaf Herbicides
| Product | Target | Selectivity | Cost | Speed | Re-entry Time |
|---------|--------|-------------|------|-------|---------------|
| **2,4-D** | Dandelion, plantain | Selective (safe on grass) | $ | 1-2 weeks | 24-48 hours |
| **Triclopyr** | Clover, ground ivy | Selective | $$ | 2-3 weeks | 24-48 hours |
| **Dicamba** | Broadleaf weeds | Selective | $$ | 1-2 weeks | 24-48 hours |
| **MCPP** | Chickweed, clover | Selective | $ | 2-3 weeks | 24-48 hours |

#### Grassy Weed Herbicides
| Product | Target | Selectivity | Cost | Speed | Notes |
|---------|--------|-------------|------|-------|-------|
| **Quinclorac** | Crabgrass | Selective (safe on cool-season) | $$$ | 2-3 weeks | Not safe on bermuda |
| **Fenoxaprop** | Annual grasses | Selective | $$$ | 2-4 weeks | Post-emergent only |
| **Sethoxydim** | Grassy weeds | Selective (safe on cool-season) | $$$$ | 3-4 weeks | Slow but effective |

#### Sedge Herbicides
| Product | Target | Selectivity | Cost | Speed | Notes |
|---------|--------|-------------|------|-------|-------|
| **Halosulfuron** | Nutsedge | Selective | $$$$ | 3-4 weeks | Multiple apps needed |
| **Sulfentrazone** | Yellow nutsedge | Selective | $$$$$ | 2-3 weeks | Expensive |

#### Non-Selective Herbicides
| Product | Target | Speed | Cost | Notes |
|---------|--------|-------|------|-------|
| **Glyphosate** | Everything (total vegetation) | 1-2 weeks | $ | Kills grass too - renovation only |

**Mechanics:**
- **Application Timing:** Must apply during active growth (spring-summer)
- **Temperature Windows:** 50-85°F for best results
- **Re-treatment:** Many weeds need 2-3 applications
- **Resistance Buildup:** Repeated use increases resistance
- **Course Closure:** Re-entry restrictions during/after application
- **Rain Washoff:** Must avoid rain for 4-24 hours after application
- **Mixing:** Can combine products for broader spectrum

**Gameplay Considerations:**
- **Spot Treatment:** Target individual weeds (cheaper, precise)
- **Broadcast Application:** Treat entire area (faster, expensive)
- **Timing Risk:** Bad timing = wasted money and no control
- **Weather Dependency:** Rain or extreme temps ruin effectiveness
- **Resistance Management:** Rotating products prevents resistance

### 4. Manual Removal
**Hand-weeding or mechanical removal**

| Method | Cost | Effectiveness | Speed | Labor Requirement |
|--------|------|---------------|-------|-------------------|
| **Hand-Pulling** | Free (labor only) | High (if done right) | Very Slow | Very High |
| **Weed Popper Tool** | $ (one-time) | High for taproots | Slow | High |
| **String Trimmer** | $ (equipment) | Low (cosmetic only) | Medium | Medium |

**Mechanics:**
- Early-stage weeds (seedling) are easiest to remove
- Must remove entire root system (especially taproots)
- Labor-intensive but no chemical cost
- Can assign employees to manual weeding
- Effective for low-density infestations (< 10% coverage)
- Damages turf if done carelessly (divots)

---

## Integration with Existing Systems

### Research Tree Additions

**Herbicide Technology Branch:**
```
├─ Basic Herbicides (Tier 1)
│  ├─ 2,4-D Broadleaf Control (300 points)
│  └─ Basic Pre-Emergent (400 points)
│
├─ Advanced Herbicides (Tier 2)
│  ├─ Selective Grassy Weed Control (700 points)
│  ├─ Sedge Control (800 points)
│  └─ Combination Products (600 points)
│
├─ Precision Application (Tier 3)
│  ├─ Spot Sprayer Equipment (1000 points)
│  ├─ GPS-Guided Spraying (1500 points)
│  └─ Weed Mapping Technology (1200 points)
│
└─ Integrated Weed Management (Tier 4)
   ├─ Disease-Resistant Varieties (2000 points)
   ├─ Biological Control Agents (2200 points)
   └─ Robotic Weed Identification (2500 points)
```

### Equipment Additions

**New Equipment:**
| Equipment | Function | Capacity | Cost | Unlock Requirement |
|-----------|----------|----------|------|-------------------|
| **Backpack Sprayer** | Manual spot spraying | 4 gallons | $800 | Start |
| **Boom Sprayer** | Broadcast application | 50 gallons | $8,500 | Research: Advanced Herbicides |
| **Spot Sprayer** | GPS-targeted spots | 20 gallons | $15,000 | Research: Precision Application |
| **Weed Popper** | Manual removal tool | N/A | $50 | Start |

### Employee Skills

**Weed Control Specialist:**
- **Skill:** Herbicide Application
- **Training Cost:** $500
- **Effect:** +25% herbicide effectiveness, -20% waste
- **Unlock:** Research "Advanced Herbicides"

### Economy Integration

**Costs:**
- **Pre-Emergent Application:** $50-100 per acre
- **Post-Emergent Spot Treatment:** $5-20 per treatment
- **Broadcast Post-Emergent:** $80-150 per acre
- **Manual Removal:** Labor cost only (slow)
- **Equipment:** One-time purchase + refill costs

**Revenue Impact:**
- Heavy weed infestation lowers prestige → fewer golfers → lower revenue
- Golfer complaints about course conditions
- Potential for negative reviews/reputation damage

### Scenario Objectives

**Weed-Related Objectives:**
- "Reduce weed coverage to < 5% on all fairways"
- "Eliminate crabgrass before the summer tournament"
- "Control dandelion infestation without closing the course"
- "Implement pre-emergent program for the entire course"

---

## Gameplay Strategies

### Early Game
- **Reactive Only:** Hand-pull visible weeds, no herbicide budget
- **Accept Some Weeds:** Focus on high-visibility areas (greens, tee boxes)
- **Cultural Practices:** Proper mowing/fertilizing prevents establishment

### Mid Game
- **Pre-Emergent Program:** Spring applications prevent summer crabgrass
- **Selective Post-Emergent:** Spot-treat problem areas
- **Hire Specialist:** Train employee for herbicide application
- **Monitoring:** Regular scouting to catch infestations early

### Late Game
- **Integrated Management:** Combine cultural, preventative, and reactive
- **GPS Technology:** Precision application reduces waste
- **Resistant Varieties:** Research better grass varieties
- **Preventative Focus:** Shift from reactive to preventative (cheaper long-term)

---

## Visual Feedback & UI

### Weed Overlay Mode
**Press Tab to cycle overlays:**
- **Normal** → **Moisture** → **Nutrients** → **Height** → **Weeds** → **Normal**

**Weed Overlay Colors:**
| Color | Meaning |
|-------|---------|
| Dark Green | No weeds (0-5%) |
| Yellow-Green | Low infestation (6-20%) |
| Yellow | Moderate infestation (21-50%) |
| Orange | Heavy infestation (51-80%) |
| Red | Severe infestation (81-100%) |

### HUD Indicators
- **Weed Pressure Alert:** "⚠️ Crabgrass detected on Hole 7 fairway"
- **Treatment Reminders:** "Pre-emergent window closing in 3 days"
- **Herbicide Inventory:** Display available products and quantities

### Notifications
- "Dandelions are flowering - mowing will spread seeds!"
- "Pre-emergent application successful. Protection for 120 days."
- "Heavy rain washed off herbicide treatment. Re-application needed."

---

## Implementation Priority

**Status:** Not yet implemented

**Recommended Priority:** **Tier 2** (after core systems, alongside disease/pests)

**Rationale:**
- High thematic fit (golf course management)
- Adds strategic decision-making (preventative vs. reactive)
- Visual impact (weeds are highly visible to players)
- Complements existing systems (fertilizer, water, employees)
- Medium implementation complexity

**Dependencies:**
- Tile state expansion (add weed properties)
- Equipment system (sprayers)
- Research tree expansion
- Visual assets (weed sprites/overlays)
- Employee skill system

---

## Design Considerations

### Balancing Challenge vs. Tedium
- **Avoid:** Clicking individual weeds constantly
- **Prefer:** Strategic decisions about programs and timing
- **Automation:** Allow employees to execute weed control plans

### Realism vs. Gameplay
- **Realistic:** Herbicide timing, weather dependency, resistance
- **Simplified:** Instant application (not multi-day spray operations)
- **Abstracted:** Product names (use generic "pre-emergent" not brand names)

### Interaction with Disease System
When both systems exist:
- Stressed turf (from disease) is more susceptible to weeds
- Herbicide stress can make turf more vulnerable to disease
- Integrated management becomes critical
- Timing conflicts (can't apply both treatments simultaneously)

---

## Related Systems

- **Course Maintenance:** Core grass simulation and tile health
- **Research Tree:** Unlocking herbicide technologies
- **Equipment:** Sprayers and application methods
- **Economy:** Treatment costs and revenue impact
- **Employees:** Specialist skills and task assignment
- **Scenarios:** Weed control objectives and challenges

---

## Future Enhancements

**Organic/Natural Control:**
- Corn gluten meal (natural pre-emergent)
- Vinegar-based herbicides
- Manual cultivation
- Goose grazing (real golf course practice!)

**Advanced Mechanics:**
- Herbicide drift to adjacent areas
- Groundwater contamination concerns
- Organic certification scenarios
- Integrated Pest Management (IPM) approach

**Seasonal Variation:**
- Cool-season weeds (winter annuals)
- Warm-season weeds (summer annuals)
- Perennial weed lifecycles

---

## Conclusion

Weed control is a fundamental aspect of golf course maintenance that creates meaningful strategic choices:
- **Preventative vs. Reactive:** Invest early or pay later?
- **Selective vs. Broadcast:** Precision or efficiency?
- **Chemical vs. Cultural:** Quick fix or sustainable management?
- **Timing Decisions:** Weather windows and application schedules

Adding weeds to the game enhances realism, increases strategic depth, and provides visual feedback for course quality. Combined with the disease/pest system, it creates a comprehensive turf management simulation that rewards planning, observation, and adaptive decision-making.
