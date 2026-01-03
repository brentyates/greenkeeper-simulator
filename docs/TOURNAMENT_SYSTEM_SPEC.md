# Tournament Hosting System Design Specification

## Overview

The Tournament System allows players to host professional golf tournaments once they've established a championship-caliber course. Tournaments represent the pinnacle of course prestige and provide significant revenue opportunities through sponsorships, spectators, and media exposure.

### Core Philosophy

**"A tournament is earned, not given."**

- Tournaments require sustained excellence (maintaining 5-star prestige)
- Tournament tier progresses based on course history and reputation
- Hosting a tournament is a temporary "special event mode" with unique gameplay
- Success builds legacy; failure sets back progress significantly

---

## Tournament Unlock Requirements

### Base Requirement: Sustained Excellence

To receive any tournament offer, the course must demonstrate sustained quality:

```typescript
interface TournamentEligibility {
  // Core requirement
  minimumPrestigeStars: number;           // 5.0 stars required
  consecutiveDaysAtMinimum: number;       // Days maintaining that level

  // Additional factors
  averageGolferSatisfaction: number;      // 85%+ satisfaction
  courseConditionAverage: number;         // 90%+ health average
  noMajorIncidents: boolean;              // No disasters in period

  // Facility requirements (vary by tier)
  minimumClubhouseTier: number;
  minimumAmenityScore: number;
  parkingCapacity: number;
  spectatorCapacity: number;
}
```

### Tier-Based Unlock Progression

| Tournament Tier | Prestige Required | Consecutive Days | First Available |
|-----------------|-------------------|------------------|-----------------|
| Local Amateur | 4.0 stars | 30 days | Year 1 |
| Regional Qualifier | 4.5 stars | 60 days | Year 2 |
| State Championship | 5.0 stars | 90 days | Year 3 |
| National Qualifier | 5.0 stars | 180 days | Year 4 |
| Tour Event | 5.0 stars | 365 days | Year 5+ |
| Major Championship | 5.0 stars | 730 days | Year 7+ |

---

## Tournament Tiers

### Tier 1: Local Amateur Tournament
**Unlock:** 4.0 stars for 30 consecutive days

```typescript
interface LocalAmateurTournament {
  tier: 1;
  name: "Local Amateur Championship";
  duration: 1;  // 1 day event

  // Participants
  playerCount: 60;
  spectatorCount: 100;

  // Revenue
  entryFees: 3000;           // $50/player
  sponsorshipRevenue: 2000;
  concessionRevenue: 500;
  totalPotentialRevenue: 5500;

  // Costs
  setupCost: 1000;
  operatingCost: 500;
  prizePurse: 1500;
  netPotentialProfit: 2500;

  // Prestige
  prestigeBonus: 25;         // Permanent if successful
  prestigePenalty: -50;      // If course conditions fail

  // Requirements
  minimumClubhouseTier: 1;
  requiredAmenities: [];
}
```

### Tier 2: Regional Qualifier
**Unlock:** 4.5 stars for 60 consecutive days

```typescript
interface RegionalQualifier {
  tier: 2;
  name: "Regional Qualifying Tournament";
  duration: 2;  // 2 day event

  playerCount: 120;
  spectatorCount: 500;

  entryFees: 12000;
  sponsorshipRevenue: 15000;
  concessionRevenue: 5000;
  merchandiseRevenue: 3000;
  totalPotentialRevenue: 35000;

  setupCost: 5000;
  operatingCost: 3000;
  prizePurse: 10000;
  netPotentialProfit: 17000;

  prestigeBonus: 50;
  prestigePenalty: -75;

  minimumClubhouseTier: 2;
  requiredAmenities: ["driving_range", "putting_green"];
}
```

### Tier 3: State Championship
**Unlock:** 5.0 stars for 90 consecutive days

```typescript
interface StateChampionship {
  tier: 3;
  name: "State Amateur Championship";
  duration: 3;  // 3 day event

  playerCount: 150;
  spectatorCount: 2000;

  entryFees: 22500;
  sponsorshipRevenue: 50000;
  concessionRevenue: 20000;
  merchandiseRevenue: 15000;
  broadcastRights: 10000;
  totalPotentialRevenue: 117500;

  setupCost: 15000;
  operatingCost: 10000;
  prizePurse: 25000;
  staffingBonus: 8000;
  netPotentialProfit: 59500;

  prestigeBonus: 100;
  prestigePenalty: -150;

  minimumClubhouseTier: 3;
  requiredAmenities: ["driving_range", "putting_green", "chipping_area", "media_center"];
}
```

### Tier 4: National Qualifier
**Unlock:** 5.0 stars for 180 consecutive days

```typescript
interface NationalQualifier {
  tier: 4;
  name: "National Qualifying Event";
  duration: 3;

  playerCount: 156;
  spectatorCount: 5000;

  entryFees: 39000;
  sponsorshipRevenue: 150000;
  concessionRevenue: 50000;
  merchandiseRevenue: 40000;
  broadcastRights: 75000;
  hospitalityTents: 30000;
  totalPotentialRevenue: 384000;

  setupCost: 50000;
  operatingCost: 30000;
  prizePurse: 100000;
  staffingBonus: 20000;
  securityCost: 15000;
  netPotentialProfit: 169000;

  prestigeBonus: 150;
  prestigePenalty: -200;

  minimumClubhouseTier: 4;
  requiredAmenities: [
    "driving_range", "tour_level_range", "putting_green",
    "chipping_area", "media_center", "hospitality_areas"
  ];
}
```

### Tier 5: PGA Tour Event
**Unlock:** 5.0 stars for 365 consecutive days (1 year)

```typescript
interface TourEvent {
  tier: 5;
  name: "PGA Tour Event";
  duration: 4;  // 4 day event (Thu-Sun)

  playerCount: 156;
  spectatorCount: 25000;

  // Revenue streams
  entryFees: 0;              // Tour handles entries
  sponsorshipRevenue: 500000;
  concessionRevenue: 250000;
  merchandiseRevenue: 150000;
  broadcastRights: 300000;
  hospitalityTents: 200000;
  parkingRevenue: 100000;
  totalPotentialRevenue: 1500000;

  // Costs
  setupCost: 200000;
  operatingCost: 150000;
  staffingBonus: 75000;
  securityCost: 50000;
  coursePrepCost: 100000;
  mediaInfrastructure: 80000;
  netPotentialProfit: 845000;

  prestigeBonus: 300;
  prestigePenalty: -400;

  // Special: Ongoing relationship
  annualContractValue: 500000;  // Multi-year deal possible
  tourRelationshipBonus: true;   // Easier to host future events

  minimumClubhouseTier: 4;
  requiredAmenities: [
    "driving_range", "tour_level_range", "putting_green",
    "chipping_area", "teaching_academy", "media_center",
    "hospitality_areas", "vip_parking", "broadcast_towers"
  ];
}
```

### Tier 6: Major Championship
**Unlock:** 5.0 stars for 730 consecutive days (2 years) + hosted 3+ Tour Events

```typescript
interface MajorChampionship {
  tier: 6;
  name: "Major Championship";
  duration: 7;  // Full week (practice rounds + 4 days)

  playerCount: 156;
  spectatorCount: 50000;

  // Revenue (substantial)
  sponsorshipRevenue: 2000000;
  concessionRevenue: 750000;
  merchandiseRevenue: 500000;
  broadcastRights: 1000000;
  hospitalityTents: 600000;
  parkingRevenue: 300000;
  internationalMedia: 400000;
  totalPotentialRevenue: 5550000;

  // Costs
  setupCost: 500000;
  operatingCost: 400000;
  staffingBonus: 200000;
  securityCost: 150000;
  coursePrepCost: 300000;
  mediaInfrastructure: 250000;
  netPotentialProfit: 3750000;

  prestigeBonus: 500;          // Permanent legacy bonus
  prestigePenalty: -600;       // Disaster would be catastrophic

  // Legacy effects
  permanentTitlePrefix: true;  // "Home of the [Major Name]"
  historicalPlaque: true;
  tourismBonus: 1.5;           // 50% more golfer demand permanently

  minimumClubhouseTier: 5;     // Grand Clubhouse required
  // Extensive facility requirements
}
```

---

## Tournament Event Mode

When hosting a tournament, the game enters a special "Tournament Mode" for the event duration.

### Pre-Tournament Preparation (7-14 days before)

```typescript
interface TournamentPreparation {
  // Course preparation
  requiredHealthLevel: 95;           // All areas must be pristine
  requiredGreenSpeed: 12.5;          // Stimpmeter reading
  requiredFairwayHeight: 0.5;        // Inches

  // Setup activities
  galleryRopes: boolean;             // Install spectator barriers
  scoringTents: boolean;             // Electronic scoring setup
  grandstands: number;               // Seating structures
  concessionStands: number;
  merchandiseTents: number;
  mediaCenter: boolean;
  broadcastTowers: number;

  // Staff requirements
  volunteersNeeded: number;
  securityNeeded: number;
  marshalsNeeded: number;

  // Daily inspections
  dailyInspections: InspectionResult[];
  passedInspection: boolean;
}
```

### During Tournament

The tournament runs for its duration (1-7 days depending on tier).

#### Gameplay Changes

| Normal Mode | Tournament Mode |
|-------------|-----------------|
| Regular tee times | No public tee times |
| Normal spectator count | Massive spectator influx |
| Standard revenue | Concession/merch focus |
| Self-directed maintenance | Inspected maintenance |
| Normal prestige decay | Amplified prestige impact |

#### Real-Time Course Monitoring

```typescript
interface TournamentCourseState {
  // Live conditions
  liveGreenHealth: number[];         // Per-green health
  liveGreenSpeed: number[];          // Per-green stimp
  fairwayCondition: number;
  roughCondition: number;
  bunkerCondition: number;

  // Issues
  activeIssues: CourseIssue[];       // Brown spots, divots, etc.
  issueResolutionTime: number;       // Must fix within N minutes

  // Weather impacts
  currentWeather: WeatherCondition;
  weatherDamageRisk: number;
  irrigationNeeded: boolean;

  // Inspection status
  lastInspection: GameTime;
  inspectionGrade: 'A' | 'B' | 'C' | 'F';
  warnings: string[];
}

interface CourseIssue {
  id: string;
  type: 'divot' | 'ball_mark' | 'brown_spot' | 'wet_spot' | 'debris';
  location: GridPosition;
  severity: 'minor' | 'moderate' | 'severe';
  visibleOnBroadcast: boolean;       // Severe = camera will show it
  timeToFix: number;                  // Minutes required
  prestigeImpact: number;            // If not fixed
}
```

#### Spectator Simulation

```typescript
interface SpectatorState {
  totalSpectators: number;
  spectatorsByArea: Map<CourseArea, number>;

  // Satisfaction factors
  viewingQuality: number;            // Can they see the action?
  concessionWaitTime: number;        // Line wait in minutes
  restroomAccess: number;            // Adequate facilities?
  weatherComfort: number;            // Shade, water available?

  // Revenue generation
  averageSpendPerSpectator: number;
  currentConcessionRevenue: number;
  currentMerchandiseRevenue: number;

  // Issues
  overcrowdedAreas: CourseArea[];
  spectatorComplaints: number;
}
```

#### Revenue During Tournament

```typescript
interface TournamentRevenue {
  // Pre-collected
  sponsorshipsPaid: number;          // Collected before event
  hospitalitySold: number;           // Corporate tent packages

  // Daily revenue
  dailyGateRevenue: number;          // Ticket sales
  dailyConcessionRevenue: number;    // Food & beverage
  dailyMerchandiseRevenue: number;   // Pro shop, event merch
  dailyParkingRevenue: number;

  // Post-event
  broadcastRoyalties: number;        // TV rights payment
  photoLicensing: number;            // Media rights

  // Totals
  totalGrossRevenue: number;
  totalCosts: number;
  netProfit: number;
}
```

### Post-Tournament Effects

#### Success Outcomes

```typescript
interface TournamentSuccess {
  // Prestige effects
  immediatePrestigeBonus: number;
  permanentPrestigeIncrease: number;

  // Reputation effects
  mediaExposure: number;             // Reach in viewers
  positiveReviews: number;
  socialMediaMentions: number;

  // Business effects
  golferDemandIncrease: number;      // % increase for 90 days
  greenFeeToleranceIncrease: number; // Can charge more
  sponsorInterestLevel: number;      // Future sponsorship multiplier

  // Progression
  nextTierUnlocked: boolean;
  tourRelationshipLevel: number;     // Affects future invitations
}
```

#### Failure Outcomes

Tournament failure (course conditions drop, major issues) has severe consequences:

```typescript
interface TournamentFailure {
  // Prestige damage
  immediatePrestigeLoss: number;     // Large immediate hit
  prestigeRecoveryDays: number;      // How long to rebuild

  // Reputation damage
  negativeMediaCoverage: number;
  golferDemandDecrease: number;      // % decrease for 180 days

  // Business effects
  sponsorTrustLoss: number;          // Harder to get future sponsors
  tourRelationshipDamage: number;    // May be banned from tier

  // Lock-out period
  monthsUntilNextTournament: number; // Can't host for N months
}
```

---

## Tournament Offer System

Tournaments are offered to the player; they don't apply for them.

### Offer Triggers

```typescript
function checkTournamentOffer(
  courseState: CourseState,
  tournamentHistory: TournamentHistory
): TournamentOffer | null {
  // Check eligibility for each tier (highest first)
  for (const tier of TOURNAMENT_TIERS.reverse()) {
    if (meetsEligibility(courseState, tier)) {
      // Random chance based on reputation
      const offerChance = calculateOfferChance(
        courseState.prestige,
        tournamentHistory,
        tier
      );

      if (Math.random() < offerChance) {
        return generateTournamentOffer(tier);
      }
    }
  }

  return null;
}

interface TournamentOffer {
  tournamentTier: number;
  tournamentName: string;
  proposedDate: GameDate;           // Usually 30-60 days out

  // Deal terms
  guaranteedMinimum: number;        // Minimum payment
  revenueSharingPercentage: number; // Player's cut

  // Requirements
  preparationRequirements: string[];
  facilityRequirements: string[];

  // Decision
  responseDeadline: GameDate;       // Must accept/decline by
}
```

### Offer Frequency

| Tournament Tier | Offer Frequency | After Successful Host |
|-----------------|-----------------|----------------------|
| Local Amateur | Every 60 days | Every 45 days |
| Regional | Every 90 days | Every 60 days |
| State | Every 180 days | Every 120 days |
| National | Every 365 days | Every 270 days |
| Tour Event | By invitation only | Annual contract option |
| Major | By invitation only | Multi-year rotation |

---

## UI/UX Design

### Tournament Offer Notification

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏆 TOURNAMENT OFFER RECEIVED                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  The State Golf Association has selected your course to host:           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                   │   │
│  │   STATE AMATEUR CHAMPIONSHIP                                     │   │
│  │   June 15-17, Year 4                                             │   │
│  │                                                                   │   │
│  │   Players: 150          Spectators: ~2,000                       │   │
│  │   Duration: 3 days      Prize Purse: $25,000                     │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  PROJECTED FINANCIALS                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Revenue:        $117,500                                        │   │
│  │  Costs:          -$58,000                                        │   │
│  │  ─────────────────────────                                       │   │
│  │  Net Profit:     $59,500                                         │   │
│  │                                                                   │   │
│  │  Prestige Bonus: +100 points (if successful)                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  REQUIREMENTS                                                            │
│  ✓ Clubhouse Tier 3 or higher                                          │
│  ✓ Driving Range                                                        │
│  ✓ Putting Green                                                        │
│  ✓ Chipping Area                                                        │
│  ⚠ Media Center (needs upgrade - $50,000)                              │
│                                                                          │
│  Response deadline: April 1, Year 4 (45 days)                           │
│                                                                          │
│  [Accept Tournament]  [Decline]  [View Details]                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tournament Preparation Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏆 STATE AMATEUR CHAMPIONSHIP - PREPARATION                            │
│     Event Date: June 15-17 (23 days remaining)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  COURSE CONDITIONS                           Target │ Current │ Status  │
│  ───────────────────────────────────────────────────────────────────    │
│  Green Health                                  95%  │   97%   │   ✓     │
│  Green Speed (Stimp)                          12.5  │   11.8  │   ⚠     │
│  Fairway Health                                95%  │   94%   │   ⚠     │
│  Fairway Height                               0.5"  │  0.55"  │   ⚠     │
│  Bunker Condition                              90%  │   92%   │   ✓     │
│  Rough Consistency                             85%  │   88%   │   ✓     │
│                                                                          │
│  INFRASTRUCTURE SETUP                                          Progress │
│  ───────────────────────────────────────────────────────────────────    │
│  Gallery Ropes                                           [████████░░] 80%│
│  Scoring Tent                                            [██████████]100%│
│  Grandstands (x3)                                        [████░░░░░░] 40%│
│  Concession Stands (x8)                                  [░░░░░░░░░░]  0%│
│  Merchandise Tent                                        [██████░░░░] 60%│
│  Media Center                                            [██████████]100%│
│                                                                          │
│  STAFFING                                       Needed │ Hired │ Status │
│  ───────────────────────────────────────────────────────────────────    │
│  Volunteers                                       150  │   89  │   ⚠     │
│  Security Personnel                                40  │   40  │   ✓     │
│  Course Marshals                                   36  │   20  │   ⚠     │
│  Medical Staff                                      8  │    8  │   ✓     │
│                                                                          │
│  DAILY INSPECTION: Tomorrow 6:00 AM                                      │
│  Inspector will check: Greens, Tees, Bunkers                            │
│                                                                          │
│  [View Full Checklist]  [Hire Staff]  [Order Supplies]                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Live Tournament Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏆 STATE AMATEUR CHAMPIONSHIP - DAY 2 OF 3                             │
│     Round 2 in Progress | 11:42 AM | 68°F Sunny                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  LIVE COURSE STATUS                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🟢 Greens: 97% | Stimp: 12.4 | Speed: TOURNAMENT READY         │   │
│  │  🟢 Fairways: 96% | Cut: 0.5" | Striping: EXCELLENT             │   │
│  │  🟡 Bunkers: 91% | 2 rakes deployed to fix Hole 7               │   │
│  │  🟢 Rough: 89% | Consistent throughout                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ACTIVE ISSUES                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ⚠ Hole 12 Green: Ball marks need repair (3 crew en route)      │   │
│  │  ⚠ Hole 4 Bunker: Footprints visible (marshal dispatched)       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  SPECTATORS                                     REVENUE TODAY            │
│  ┌───────────────────────┐                     ┌────────────────────┐   │
│  │  Current: 1,847       │                     │  Gate:    $18,470  │   │
│  │  Peak: 2,100          │                     │  Food:    $12,340  │   │
│  │  Satisfaction: 87%    │                     │  Merch:   $8,920   │   │
│  │                       │                     │  ──────────────    │   │
│  │  ⚠ Hole 18 crowded   │                     │  Today:   $39,730  │   │
│  └───────────────────────┘                     └────────────────────┘   │
│                                                                          │
│  LEADERBOARD (Top 5)                                                     │
│  1. J. Smith    -8  (Hole 14)                                           │
│  2. M. Johnson  -7  (Hole 16)                                           │
│  3. T. Williams -6  (Hole 11)                                           │
│  4. R. Brown    -5  (Hole 15)                                           │
│  5. K. Davis    -5  (Hole 12)                                           │
│                                                                          │
│  [Course Map]  [Dispatch Crew]  [View All Issues]  [Revenue Details]    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Post-Tournament Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏆 TOURNAMENT COMPLETE - STATE AMATEUR CHAMPIONSHIP                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        ⭐⭐⭐⭐⭐                                 │   │
│  │                    OUTSTANDING SUCCESS                           │   │
│  │                                                                   │   │
│  │  "One of the finest conditioned courses we've played all year"   │   │
│  │                        - Tournament Director                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  FINANCIAL SUMMARY                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  REVENUE                          │  COSTS                       │   │
│  │  ─────────────────────────────────┼─────────────────────────    │   │
│  │  Gate Revenue:        $54,200     │  Setup:         $15,000     │   │
│  │  Concessions:         $23,400     │  Operations:    $10,000     │   │
│  │  Merchandise:         $18,900     │  Prize Purse:   $25,000     │   │
│  │  Sponsorships:        $50,000     │  Staffing:      $8,000      │   │
│  │  Broadcast:           $10,000     │                              │   │
│  │  ─────────────────────────────────┼─────────────────────────    │   │
│  │  TOTAL:              $156,500     │  TOTAL:         $58,000     │   │
│  │                                   │                              │   │
│  │                     NET PROFIT: $98,500                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  REPUTATION EFFECTS                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Prestige Bonus:              +100 points (permanent)            │   │
│  │  Golfer Demand Increase:      +15% for 90 days                   │   │
│  │  Green Fee Tolerance:         +$12 premium acceptable            │   │
│  │  Media Exposure:              847,000 reached                    │   │
│  │  Tour Relationship:           +1 level (Regional → State)        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  NEXT OPPORTUNITY                                                        │
│  You may now be considered for NATIONAL QUALIFIER events.               │
│  Maintain 5-star prestige for 180 days to receive offers.              │
│                                                                          │
│  [View Detailed Report]  [Share Achievement]  [Continue]                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Tournament State

```typescript
interface TournamentState {
  // Current status
  activeTournament: ActiveTournament | null;
  pendingOffer: TournamentOffer | null;

  // History
  tournamentHistory: CompletedTournament[];
  totalTournamentsHosted: number;
  successfulTournaments: number;
  failedTournaments: number;

  // Progression
  highestTierAchieved: number;
  tourRelationshipLevel: number;    // 0-10
  majorChampionshipEligible: boolean;

  // Eligibility tracking
  consecutiveFiveStarDays: number;
  lastPrestigeCheck: GameDate;

  // Lockouts
  lockoutEndDate: GameDate | null;
  lockoutReason: string | null;
}

interface ActiveTournament {
  tier: number;
  name: string;
  startDate: GameDate;
  endDate: GameDate;
  currentDay: number;

  // Preparation
  preparationComplete: boolean;
  preparationChecklist: PreparationItem[];

  // Live state
  courseConditions: TournamentCourseState;
  spectatorState: SpectatorState;
  revenueState: TournamentRevenue;
  issues: CourseIssue[];

  // Scoring
  currentGrade: 'A' | 'B' | 'C' | 'F';
  inspectionsPassed: number;
  inspectionsFailed: number;
}

interface CompletedTournament {
  tier: number;
  name: string;
  date: GameDate;
  success: boolean;
  grade: 'A' | 'B' | 'C' | 'F';
  netProfit: number;
  prestigeChange: number;
  spectatorCount: number;
  notableEvents: string[];
}
```

---

## Implementation Priority

### Phase 1: Tournament Offers
1. Eligibility tracking (prestige duration)
2. Offer generation system
3. Offer UI and accept/decline flow
4. Basic tournament calendar

### Phase 2: Preparation Mode
1. Preparation checklist system
2. Infrastructure setup mechanics
3. Staff hiring for events
4. Inspection system

### Phase 3: Tournament Execution
1. Special "tournament mode" game state
2. No public tee times during event
3. Spectator simulation
4. Live course monitoring

### Phase 4: Revenue & Feedback
1. Multi-stream revenue tracking
2. Real-time revenue display
3. Issue detection and resolution
4. Post-tournament summary

### Phase 5: Progression System
1. Tier advancement
2. Tour relationship tracking
3. Historical legacy effects
4. Major championship path

### Phase 6: Advanced Features
1. Multi-year contracts
2. Tournament branding
3. Weather contingencies
4. Television broadcast simulation

---

## Summary

The Tournament System provides:

1. **Aspirational Goal** - Hosting a Major is the ultimate achievement
2. **Progressive Unlocks** - Start small, build to PGA Tour events
3. **Unique Gameplay** - Tournament mode feels different from daily operations
4. **Risk/Reward** - High profit potential but severe failure penalties
5. **Legacy Building** - Successful tournaments permanently enhance the course

The key design principles:
- **Earned, not given** - Must demonstrate sustained excellence
- **High stakes** - Failure has real consequences
- **Visible progress** - Clear path from local amateur to major championship
- **Integrated systems** - Requires mastery of prestige, maintenance, and facilities

Tournaments represent the intersection of all game systems: prestige must be high, conditions must be perfect, facilities must be adequate, and active management is required during the event.
