# Golf Course Prestige System Design Specification

## Overview

The Prestige System is the primary determinant of how much players can charge for green fees while maintaining golfer demand. It functions as the course's "reputation" - a sophisticated multi-factor score that manifests to players as a simple 5-star rating.

### Core Philosophy

Inspired by RollerCoaster Tycoon's park rating and ride pricing systems:
- **High Prestige + Reasonable Fees** = Maximum golfer attendance
- **High Prestige + Premium Fees** = Moderate attendance, maximum revenue per golfer
- **Low Prestige + High Fees** = Golfers "turn away at the gate" (visible rejection animation)
- **Low Prestige + Low Fees** = Acceptable attendance, budget reputation

---

## Star Rating System (Player-Facing)

### Display: 5-Star Scale

| Stars | Label | Prestige Score | Course Archetype |
|-------|-------|----------------|------------------|
| ★☆☆☆☆ | Municipal | 0-199 | Run-down public course |
| ★★☆☆☆ | Public | 200-399 | Basic public course |
| ★★★☆☆ | Semi-Private | 400-599 | Nice regional course |
| ★★★★☆ | Private Club | 600-799 | Exclusive country club |
| ★★★★★ | Championship | 800-1000 | Tour-worthy destination |

### Conversion Formula

**Simple Formula:**
```typescript
starRating = Math.min(5.0, Math.floor(prestigeScore / 200) + ((prestigeScore % 200) >= 100 ? 0.5 : 0));
```

**Or using table:**

| Prestige Score Range | Star Rating | Display |
|---------------------|-------------|---------|
| 0-99 | 0.5 | ½★☆☆☆☆ |
| 100-199 | 1.0 | ★☆☆☆☆ |
| 200-299 | 1.5 | ★½★☆☆☆ |
| 300-399 | 2.0 | ★★☆☆☆ |
| 400-499 | 2.5 | ★★½★☆☆ |
| 500-599 | 3.0 | ★★★☆☆ |
| 600-699 | 3.5 | ★★★½★☆ |
| 700-799 | 4.0 | ★★★★☆ |
| 800-899 | 4.5 | ★★★★½★ |
| 900-1000 | 5.0 | ★★★★★ |

**Key Thresholds:**
- **4.0★ (score 700+):** Required for Regional/State tournaments (see TOURNAMENT_SYSTEM_SPEC.md)
- **5.0★ (score 800+):** Required for PGA Tour events and Major championships
- **5.0★ for 365 days:** Unlocks Tour event eligibility

---

## Prestige Score Calculation (Under the Hood)

### Master Formula

```
PrestigeScore = (
    CurrentConditions × 0.25
  + HistoricalExcellence × 0.25
  + Amenities × 0.20
  + Reputation × 0.20
  + Exclusivity × 0.10
)
```

Each component is normalized to 0-1000 scale before weighting.

---

## Component 1: Current Conditions (25%)

Real-time assessment of course quality.

### Sub-Components

| Factor | Weight | Source | Notes |
|--------|--------|--------|-------|
| Average Health | 30% | `getAverageStats().health` | 0-100 → 0-1000 |
| Green Conditions | 25% | Health of `type: 'green'` cells only | Greens matter most |
| Fairway Conditions | 20% | Health of `type: 'fairway'` cells | Primary playing surface |
| Bunker Maintenance | 10% | Bunker rake status (new mechanic) | Visual quality |
| Hazard Clarity | 10% | Water feature cleanliness (new) | Aesthetic appeal |
| Tee Box Quality | 5% | Health of `type: 'tee'` cells | First impression |

### Calculation

```typescript
interface CurrentConditionsScore {
  averageHealth: number;      // From existing grass-simulation
  greenScore: number;         // Weighted average of green cells
  fairwayScore: number;       // Weighted average of fairway cells
  bunkerScore: number;        // New: bunker maintenance level
  hazardScore: number;        // New: water feature clarity
  teeBoxScore: number;        // Tee box specific health

  composite: number;          // Weighted total (0-1000)
}
```

### Decay Behavior
- Conditions are calculated every game-hour
- Rapid response to maintenance (mowing improves immediately)
- Neglect shows within 1-2 game days

---

## Component 2: Historical Excellence (25%)

Long-term track record of maintaining quality. This prevents "gaming" the system by only maintaining conditions during inspections.

### Sub-Components

| Factor | Weight | Description |
|--------|--------|-------------|
| Rolling Average (30 days) | 40% | Average of daily condition snapshots |
| Consistency Score | 25% | Standard deviation penalty (lower variance = better) |
| Consecutive Excellence Days | 20% | Streak bonus for maintaining ≥80 health |
| Recovery Penalty | 15% | Days since last "poor" rating (fades over 60 days) |

### Data Structure

```typescript
interface HistoricalExcellenceState {
  // Daily snapshots (keep 365 days)
  dailySnapshots: DailySnapshot[];

  // Streak tracking
  consecutiveExcellentDays: number;  // Health ≥ 80
  consecutiveGoodDays: number;       // Health ≥ 60
  longestExcellentStreak: number;    // All-time record

  // Penalty tracking
  daysSinceLastPoorRating: number;   // Health < 40
  poorDaysInLast90: number;          // Count of bad days

  // Computed scores
  rollingAverage30: number;
  rollingAverage90: number;
  consistencyScore: number;          // 100 - (stdDev × 2)
}

interface DailySnapshot {
  day: number;
  averageHealth: number;
  greenHealth: number;
  fairwayHealth: number;
  conditionRating: 'excellent' | 'good' | 'fair' | 'poor';
}
```

### Streak Bonuses

| Streak Type | Threshold | Bonus |
|-------------|-----------|-------|
| Good Day Streak | 7 consecutive | +25 points |
| Good Day Streak | 30 consecutive | +75 points |
| Excellent Day Streak | 7 consecutive | +50 points |
| Excellent Day Streak | 30 consecutive | +150 points |

### Recovery Curve
After a "poor" rating day:
- Day 1-7: -200 point penalty (recent failure)
- Day 8-14: -150 point penalty
- Day 15-30: -100 point penalty
- Day 31-60: -50 point penalty
- Day 61+: No penalty (recovered)

---

## Component 3: Amenities (20%)

Luxury features and facilities that enhance the golfer experience.

### Amenity Categories

#### Clubhouse Tier

| Level | Name | Cost | Prestige Bonus |
|-------|------|------|----------------|
| 0 | Starter Shack | Free | 0 |
| 1 | Basic Clubhouse | $50,000 | +50 |
| 2 | Full Clubhouse | $150,000 | +100 |
| 3 | Luxury Clubhouse | $400,000 | +175 |
| 4 | Grand Clubhouse | $1,000,000 | +250 |

#### Pro Shop

| Level | Name | Cost | Prestige Bonus |
|-------|------|------|----------------|
| 0 | None | - | 0 |
| 1 | Basic Pro Shop | $25,000 | +25 |
| 2 | Full Pro Shop | $75,000 | +50 |
| 3 | Premium Pro Shop | $200,000 | +100 |

#### Dining

| Level | Name | Cost | Prestige Bonus |
|-------|------|------|----------------|
| 0 | Vending Machines | $1,000 | 0 |
| 1 | Snack Bar | $15,000 | +20 |
| 2 | Grill Room | $50,000 | +50 |
| 3 | Fine Dining Restaurant | $200,000 | +100 |
| 4 | Celebrity Chef Restaurant | $500,000 | +175 |

#### Practice Facilities

| Facility | Cost | Prestige Bonus |
|----------|------|----------------|
| Driving Range | $30,000 | +30 |
| Putting Green | $10,000 | +15 |
| Chipping Area | $15,000 | +15 |
| Teaching Academy | $100,000 | +50 |
| Simulator Bay | $75,000 | +25 |
| Tour-Level Range | $250,000 | +75 |

#### Services

| Service | Monthly Cost | Prestige Bonus |
|---------|--------------|----------------|
| Caddie Program | $5,000/mo | +40 |
| Elite Caddie Program | $15,000/mo | +100 |
| Valet Parking | $3,000/mo | +30 |
| Bag Storage | $2,000/mo | +15 |
| Locker Room (Basic) | $1,000/mo | +10 |
| Locker Room (Premium) | $5,000/mo | +40 |
| Spa Services | $8,000/mo | +50 |
| Concierge | $4,000/mo | +35 |

#### Course Features

| Feature | Cost | Prestige Bonus |
|---------|------|----------------|
| GPS Carts | $50,000 | +25 |
| Luxury Carts | $100,000 | +50 |
| On-Course Beverage Service | $3,000/mo | +30 |
| Comfort Stations (per) | $10,000 | +10 (max 4) |
| Halfway House | $40,000 | +35 |
| Signature Hole Markers | $5,000 | +10 |
| Tournament Tees | $20,000 | +20 |

### Amenity Score Calculation

```typescript
interface AmenityState {
  clubhouseTier: 0 | 1 | 2 | 3 | 4;
  proShopTier: 0 | 1 | 2 | 3;
  diningTier: 0 | 1 | 2 | 3 | 4;

  facilities: {
    drivingRange: boolean;
    puttingGreen: boolean;
    chippingArea: boolean;
    teachingAcademy: boolean;
    simulatorBay: boolean;
    tourLevelRange: boolean;
  };

  services: {
    caddieProgram: 'none' | 'basic' | 'elite';
    valetParking: boolean;
    bagStorage: boolean;
    lockerRoom: 'none' | 'basic' | 'premium';
    spaServices: boolean;
    concierge: boolean;
  };

  courseFeatures: {
    cartType: 'standard' | 'gps' | 'luxury';
    beverageService: boolean;
    comfortStations: number;      // 0-4
    halfwayHouse: boolean;
    signatureMarkers: boolean;
    tournamentTees: boolean;
  };
}

// Maximum possible amenity score: ~1000 points
// Typical municipal course: 50-100 points
// Typical private club: 400-600 points
// Championship resort: 800-1000 points
```

---

## Component 4: Reputation (20%)

Public perception based on golfer experiences and word-of-mouth.

### Sub-Components

| Factor | Weight | Source |
|--------|--------|--------|
| Average Satisfaction | 35% | `GolferStats.averageSatisfaction` |
| Return Rate | 25% | `GolferStats.returnRate` |
| Review Score | 20% | Aggregated golfer reviews (new) |
| Tournament History | 10% | Events hosted (new) |
| Awards & Recognition | 10% | Achievements earned (new) |

### Golfer Reviews System

```typescript
interface GolferReview {
  odlferld: string;
  date: number;              // Game day
  overallRating: number;     // 1-5 stars

  categoryRatings: {
    conditions: number;      // 1-5
    pace: number;            // 1-5
    value: number;           // 1-5
    service: number;         // 1-5
    amenities: number;       // 1-5
  };

  wouldRecommend: boolean;
  wouldReturn: boolean;
}

interface ReputationState {
  // Review aggregates
  totalReviews: number;
  averageRating: number;           // 1-5 scale
  recentRating: number;            // Last 30 days
  ratingTrend: 'rising' | 'stable' | 'falling';

  // Satisfaction tracking
  lifetimeSatisfaction: number;    // Weighted average
  recentSatisfaction: number;      // Last 30 days

  // Loyalty
  returnGolferPercentage: number;
  membershipDemand: number;        // 0-100, for future membership system

  // Events
  tournamentsHosted: number;
  majorEventsHosted: number;       // High-profile events

  // Awards (examples)
  awards: Award[];
}

interface Award {
  id: string;
  name: string;
  dateEarned: number;
  prestigeBonus: number;
  // Examples:
  // - "Best Municipal Course" (+30)
  // - "Top 100 Public Courses" (+100)
  // - "PGA Tour Venue" (+200)
  // - "Major Championship Host" (+300)
}
```

### Word-of-Mouth Multiplier

Reputation spreads based on golfer count:
- < 100 golfers/month: 0.8x reputation effect (unknown course)
- 100-500 golfers/month: 1.0x (establishing reputation)
- 500-1000 golfers/month: 1.1x (growing buzz)
- 1000+ golfers/month: 1.2x (well-known destination)

---

## Component 5: Exclusivity (10%)

Perceived exclusivity and "elite" status.

### Sub-Components

| Factor | Weight | Description |
|--------|--------|-------------|
| Membership Type | 40% | Public vs private vs exclusive |
| Price Point | 25% | Higher prices = more exclusive feel |
| Booking Difficulty | 20% | Waitlists, advance booking requirements |
| Dress Code | 15% | Strictness of dress code |

### Membership Model

```typescript
type MembershipModel =
  | 'public'           // Anyone can play
  | 'semi_private'     // Members + public tee times
  | 'private'          // Members + guests only
  | 'exclusive'        // Members only, invitation required

interface ExclusivityState {
  membershipModel: MembershipModel;
  membershipCost: number;          // Annual fee
  waitlistLength: number;          // Months to join
  advanceBookingDays: number;      // How far ahead can book

  dressCode: 'none' | 'casual' | 'smart_casual' | 'formal';

  // Derived score
  exclusivityScore: number;        // 0-1000
}
```

### Exclusivity Scoring

| Membership Model | Base Score |
|------------------|------------|
| Public | 0 |
| Semi-Private | 200 |
| Private | 500 |
| Exclusive | 800 |

Additional modifiers:
- Membership cost > $25,000/year: +100
- Waitlist > 1 year: +100
- Formal dress code: +50
- Celebrity members: +50 (event-based)

---

## Green Fee Tolerance System

The core economic mechanic - how prestige affects pricing power.

### Base Green Fee Tolerance

Each prestige tier has a "sweet spot" and maximum tolerance:

| Stars | Sweet Spot | Max Tolerance | Rejection Starts |
|-------|------------|---------------|------------------|
| 1★ | $15 | $35 | $25 |
| 2★ | $35 | $65 | $50 |
| 3★ | $65 | $120 | $90 |
| 4★ | $120 | $250 | $175 |
| 5★ | $200 | $500+ | $350 |

### Tolerance Calculation

```typescript
interface GreenFeeTolerance {
  sweetSpot: number;        // Optimal price (max attendance)
  maxTolerance: number;     // Absolute ceiling
  rejectionThreshold: number; // Where turn-aways begin

  // Calculated demand curve
  getDemandMultiplier(price: number): number;
}

function calculateDemandMultiplier(
  price: number,
  tolerance: GreenFeeTolerance
): number {
  if (price <= tolerance.sweetSpot) {
    // Below sweet spot: full demand, possibly leaving money on table
    return 1.0;
  } else if (price <= tolerance.rejectionThreshold) {
    // Slight price sensitivity
    const ratio = (price - tolerance.sweetSpot) /
                  (tolerance.rejectionThreshold - tolerance.sweetSpot);
    return 1.0 - (ratio * 0.2);  // Up to 20% reduction
  } else if (price <= tolerance.maxTolerance) {
    // Significant rejection zone
    const ratio = (price - tolerance.rejectionThreshold) /
                  (tolerance.maxTolerance - tolerance.rejectionThreshold);
    return 0.8 - (ratio * 0.6);  // 80% down to 20%
  } else {
    // Beyond max: severe rejection
    return Math.max(0.05, 0.2 - ((price - tolerance.maxTolerance) / 100) * 0.15);
  }
}
```

### Golfer Turn-Away Animation

When a golfer rejects the price:
1. Golfer sprite approaches pro shop/starter
2. "Price check" animation (looks at sign)
3. Shakes head / dismissive gesture
4. Walks away from course entrance
5. Thought bubble: "$$$" or frowning face

This provides **visible feedback** that prices are too high for current prestige.

### Demand Factors Beyond Price

```typescript
interface DemandCalculation {
  basedemand: number;           // From golfer spawning system

  multipliers: {
    priceMultiplier: number;    // From tolerance calculation
    weatherMultiplier: number;  // Bad weather reduces demand
    seasonMultiplier: number;   // Peak vs off-season
    dayOfWeek: number;          // Weekends higher
    competitionMultiplier: number; // Future: nearby courses
    reputationMultiplier: number;  // Word-of-mouth effect
  };

  finalDemand: number;
}
```

---

## Prestige Change Dynamics

### How Prestige Changes Over Time

Prestige is **not instant** - it has momentum and lag.

```typescript
interface PrestigeChangeState {
  currentScore: number;          // Display value
  targetScore: number;           // Calculated "true" value
  velocity: number;              // Change rate per day

  // Change is gradual
  maxDailyIncrease: 5;           // Can gain max 5 points/day
  maxDailyDecrease: 15;          // Can lose up to 15 points/day (faster fall)
}
```

### Recovery vs Decline Asymmetry

**Prestige is easier to lose than gain:**
- Maximum daily increase: +5 points
- Maximum daily decrease: -15 points
- Rationale: "It takes years to build a reputation and moments to destroy it"

### Prestige Events

Sudden prestige impacts:

| Event | Impact | Duration |
|-------|--------|----------|
| Health drops below 30% | -50 immediate | Permanent until recovered |
| Golfer injury (hazard) | -30 immediate | Fades over 30 days |
| Tournament hosted | +20 | Permanent |
| Major tournament | +50 | Permanent |
| Celebrity visit | +10 | Fades over 14 days |
| Bad review goes viral | -40 | Fades over 60 days |
| Award earned | +varies | Permanent |
| Clubhouse upgrade | +varies | Permanent |

---

## UI/UX Design

### Main Display

```
┌─────────────────────────────────┐
│  COURSE PRESTIGE                │
│  ★★★★☆  (3.5 Stars)            │
│  "Semi-Private"                 │
│                                 │
│  Score: 547 / 1000              │
│  ▲ Trending Up (+3 this week)   │
└─────────────────────────────────┘
```

### Detailed Breakdown Panel

```
┌─────────────────────────────────────────────────┐
│  PRESTIGE BREAKDOWN                              │
├─────────────────────────────────────────────────┤
│  Current Conditions    ████████░░  82%   [+]    │
│  Historical Excellence ██████░░░░  61%   [=]    │
│  Amenities            ████░░░░░░  42%   [+]    │
│  Reputation           ███████░░░  71%   [=]    │
│  Exclusivity          ██░░░░░░░░  23%   [-]    │
├─────────────────────────────────────────────────┤
│  Combined Score: 547                             │
│  Next Star at: 600                              │
│  Points needed: 53                              │
└─────────────────────────────────────────────────┘
```

### Green Fee Advisor

```
┌─────────────────────────────────────────────────┐
│  GREEN FEE ADVISOR                              │
├─────────────────────────────────────────────────┤
│  Your Prestige: ★★★☆☆ (2.8 stars)              │
│                                                  │
│  Current Green Fee: $85                          │
│  Recommended Range: $45 - $80                    │
│                                                  │
│  ⚠️  Price is ABOVE recommended range           │
│  Expected rejection rate: ~25%                   │
│                                                  │
│  [Optimize Price]  [Keep Current]               │
└─────────────────────────────────────────────────┘
```

### Turn-Away Indicator

When golfers reject the course:

```
┌─────────────────────────────────┐
│  ⚠️ PRICING ALERT               │
│  12 golfers turned away today   │
│  Lost revenue: ~$1,020          │
│                                 │
│  Consider lowering green fees   │
│  or improving prestige          │
└─────────────────────────────────┘
```

---

## Data Persistence

### State Structure

```typescript
interface PrestigeState {
  // Core scores
  currentScore: number;
  targetScore: number;
  starRating: number;            // 0.5 to 5.0

  // Component states
  currentConditions: CurrentConditionsScore;
  historicalExcellence: HistoricalExcellenceState;
  amenities: AmenityState;
  reputation: ReputationState;
  exclusivity: ExclusivityState;

  // Green fee state
  greenFee: number;
  tolerance: GreenFeeTolerance;

  // Metrics
  golfersToday: number;
  golfersRejectedToday: number;
  revenueToday: number;
  revenueLostToday: number;

  // History
  dailyPrestigeHistory: DailyPrestigeSnapshot[];
}

interface DailyPrestigeSnapshot {
  day: number;
  score: number;
  starRating: number;
  golferCount: number;
  rejectionCount: number;
  revenue: number;
  greenFee: number;
}
```

### Integration with GameState

```typescript
// Addition to existing GameState
interface GameState {
  // ... existing fields
  prestige: PrestigeState;
}
```

---

## Balance Considerations

### Early Game (Years 1-2)
- Start at 1-star (municipal level)
- Focus on conditions to build base prestige
- Amenities are expensive - prioritize basics
- Green fees: $15-30 range

### Mid Game (Years 3-5)
- Push toward 3-star territory
- Balance amenity investment vs operations
- Historical excellence starts compounding
- Green fees: $50-100 range viable

### Late Game (Years 5+)
- 4-5 stars achievable with investment
- Exclusive membership options unlock
- Tournament hosting becomes viable
- Green fees: $150+ sustainable

### Failure States
- Prolonged neglect: Prestige crashes, recovery takes months
- Overpricing: Visible rejection, revenue spiral
- Underinvestment: Stagnation at 2-3 stars

---

## Future Expansion Hooks

### Membership System
- Monthly dues revenue
- Member satisfaction tracking
- Waiting list management
- Member events

### Tournament Hosting
- Tournament requirements (prestige minimums)
- Preparation period (course must be pristine)
- Media coverage (reputation boost)
- Prize money investment

### Course Architect
- Hole redesigns affect prestige
- Signature holes add prestige
- Famous architect partnerships

### Regional Competition
- Nearby courses affect demand
- Regional rankings
- "Best in State" awards

### Seasons & Weather
- Seasonal prestige adjustments
- Weather damage events
- Off-season maintenance importance

---

## Implementation Priority

### Phase 1: Core Prestige Score
1. Prestige score calculation
2. Star rating display
3. Basic component tracking
4. Green fee tolerance system

### Phase 2: Historical Tracking
1. Daily snapshots
2. Streak bonuses
3. Recovery penalties
4. Trend indicators

### Phase 3: Amenities
1. Clubhouse upgrades
2. Basic services
3. Amenity UI
4. Cost/benefit tooltips

### Phase 4: Reputation
1. Golfer reviews
2. Word-of-mouth effects
3. Turn-away animations
4. Advisor panel

### Phase 5: Advanced Features
1. Tournament hosting
2. Awards system
3. Exclusivity options
4. Regional competition

---

## Summary

The Prestige System transforms green fee pricing from a simple number into a strategic decision:

1. **Visible as 5 stars** - Simple to understand at a glance
2. **Deep underneath** - 5 major components, dozens of factors
3. **Historical memory** - Can't game it with last-minute fixes
4. **Clear feedback** - Golfers visibly reject overpriced courses
5. **Investment paths** - Multiple ways to improve (conditions, amenities, service)
6. **Asymmetric risk** - Easy to damage, slow to rebuild
7. **Economic core** - Directly ties to revenue and sustainability

This creates the satisfying RCT-style loop of: invest → improve → charge more → reinvest.
