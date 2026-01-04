# Tee Time System Design Specification

## Overview

The Tee Time System is the primary revenue driver and scheduling backbone of the golf course. Unlike RollerCoaster Tycoon where guests freely roam and queue for rides, golfers must book tee times in advance. This creates a structured flow that the player must actively manage.

### Core Philosophy

**"Golf is a scheduled experience, not a walk-up amusement."**

- Golfers cannot simply walk onto the course - they need reservations
- Walk-ons are possible but risky - they must hope for cancellations or no-shows
- Tee time spacing is a strategic lever: pack them tight for revenue, space them out for quality
- The balance between revenue maximization and reputation preservation is the central tension

---

## Tee Time Fundamentals

### What is a Tee Time?

A tee time is a scheduled slot when a group of golfers (1-4 players) begins their round at the first tee.

```typescript
interface TeeTime {
  id: string;
  scheduledTime: GameTime;           // Hour:minute of tee off
  groupSize: number;                 // 1-4 golfers

  status: TeeTimeStatus;
  bookingType: 'reservation' | 'walk_on' | 'member' | 'tournament';

  // Golfer details
  golfers: GolferBooking[];

  // Pricing (at time of booking)
  pricePerGolfer: number;
  totalRevenue: number;

  // Tracking
  bookedAt: GameTime;
  checkedIn: boolean;
  actualStartTime?: GameTime;        // When they actually teed off
  roundCompleted: boolean;
  completionTime?: GameTime;
}

type TeeTimeStatus =
  | 'available'      // Open for booking
  | 'reserved'       // Booked, awaiting arrival
  | 'checked_in'     // Golfers arrived, waiting to tee off
  | 'in_progress'    // Currently playing
  | 'completed'      // Round finished
  | 'no_show'        // Reserved but didn't arrive
  | 'cancelled';     // Cancelled by golfer

interface GolferBooking {
  golferId: string;
  name: string;
  membershipStatus: 'member' | 'guest' | 'public';
  greenFee: number;
  cartFee: number;
  addOns: AddOn[];                   // Caddie, range balls, etc.
}
```

### Operating Hours

```typescript
interface CourseOperatingHours {
  openTime: number;                  // Hour (0-23), e.g., 6 for 6:00 AM
  closeTime: number;                 // Hour, e.g., 20 for 8:00 PM
  lastTeeTime: number;               // Last possible tee time hour

  // Seasonal adjustments
  summerHours: { open: number; close: number; lastTee: number };
  winterHours: { open: number; close: number; lastTee: number };

  // Special days
  twilightStart: number;             // When twilight rates begin
}

// Example: Standard course
const defaultHours: CourseOperatingHours = {
  openTime: 6,                       // 6:00 AM
  closeTime: 20,                     // 8:00 PM
  lastTeeTime: 16,                   // 4:00 PM (allows ~4 hour round)

  summerHours: { open: 5, close: 21, lastTee: 17 },
  winterHours: { open: 7, close: 18, lastTee: 14 },

  twilightStart: 14,                 // 2:00 PM
};
```

---

## Tee Time Spacing System

### The Core Trade-Off

**Tighter Spacing = More Revenue, Higher Risk**
**Wider Spacing = Less Revenue, Better Experience**

This is the central strategic decision for the player.

### Spacing Options

```typescript
type TeeTimeSpacing =
  | 'packed'         // 6 minutes  - Maximum capacity, high risk
  | 'tight'          // 8 minutes  - Aggressive scheduling
  | 'standard'       // 10 minutes - Industry standard
  | 'comfortable'    // 12 minutes - Good pace
  | 'relaxed'        // 15 minutes - Premium experience
  | 'exclusive';     // 20 minutes - Ultra-luxury

interface SpacingConfiguration {
  spacing: TeeTimeSpacing;
  minutesBetween: number;
  maxDailyTeeTimes: number;          // Based on operating hours

  // Impact modifiers
  paceOfPlayPenalty: number;         // 0-1, affects satisfaction per round
  backupRiskMultiplier: number;      // Multiplier on course backup probability
  reputationModifier: number;        // Prestige points per game month (see GAME_OVERVIEW.md for time scale)

  // Revenue
  revenueMultiplier: number;         // vs standard spacing
}

const SPACING_CONFIGS: Record<TeeTimeSpacing, SpacingConfiguration> = {
  packed: {
    spacing: 'packed',
    minutesBetween: 6,
    maxDailyTeeTimes: 100,           // ~10 hour window
    paceOfPlayPenalty: 0.35,         // Adds 35% to round time
    backupRiskMultiplier: 2.5,       // 2.5x higher backup probability
    reputationModifier: -15,         // -15 prestige points per game month
    revenueMultiplier: 1.67,         // 67% more revenue potential
  },

  tight: {
    spacing: 'tight',
    minutesBetween: 8,
    maxDailyTeeTimes: 75,
    paceOfPlayPenalty: 0.20,
    backupRiskMultiplier: 1.8,
    reputationModifier: -8,          // -8 prestige points per game month
    revenueMultiplier: 1.25,
  },

  standard: {
    spacing: 'standard',
    minutesBetween: 10,
    maxDailyTeeTimes: 60,
    paceOfPlayPenalty: 0.0,          // Baseline
    backupRiskMultiplier: 1.0,       // Baseline
    reputationModifier: 0,           // Neutral
    revenueMultiplier: 1.0,          // Baseline
  },

  comfortable: {
    spacing: 'comfortable',
    minutesBetween: 12,
    maxDailyTeeTimes: 50,
    paceOfPlayPenalty: -0.10,        // Reduces round time by 10%
    backupRiskMultiplier: 0.6,
    reputationModifier: +5,          // +5 prestige points per game month
    revenueMultiplier: 0.83,
  },

  relaxed: {
    spacing: 'relaxed',
    minutesBetween: 15,
    maxDailyTeeTimes: 40,
    paceOfPlayPenalty: -0.20,        // Reduces round time by 20%
    backupRiskMultiplier: 0.3,
    reputationModifier: +12,         // +12 prestige points per game month
    revenueMultiplier: 0.67,
  },

  exclusive: {
    spacing: 'exclusive',
    minutesBetween: 20,
    maxDailyTeeTimes: 30,
    paceOfPlayPenalty: -0.30,        // Reduces round time by 30%
    backupRiskMultiplier: 0.1,       // Almost no backups
    reputationModifier: +20,         // +20 prestige points per game month
    revenueMultiplier: 0.50,
  },
};
```

### Pace of Play Impact

When spacing is too tight, rounds take longer and golfers get frustrated:

```typescript
interface PaceOfPlayState {
  // Target round time (hours)
  targetRoundTime: number;           // e.g., 4.0 for 4 hours

  // Current conditions
  averageRoundTime: number;          // Actual average
  backupLocations: number[];         // Holes where groups are waiting
  waitTimeMinutes: number;           // Average wait per hole

  // Satisfaction impact
  paceRating: 'excellent' | 'good' | 'acceptable' | 'slow' | 'terrible';
  satisfactionPenalty: number;       // Applied to golfer satisfaction
}

function calculatePaceOfPlay(
  spacing: SpacingConfiguration,
  currentCapacity: number,           // Percentage of slots filled
  courseConditions: number,          // 0-100
  golferSkillMix: SkillDistribution
): PaceOfPlayState {
  // Base round time (4 hours standard)
  let roundTime = 4.0;

  // Spacing penalty
  roundTime += spacing.paceOfPlayPenalty;

  // High capacity increases time
  if (currentCapacity > 0.8) {
    roundTime += (currentCapacity - 0.8) * 1.5;
  }

  // Poor conditions slow play (searching for balls, etc.)
  if (courseConditions < 50) {
    roundTime += (50 - courseConditions) * 0.02;
  }

  // Skill mix matters
  roundTime += calculateSkillPenalty(golferSkillMix);

  return {
    targetRoundTime: 4.0,
    averageRoundTime: roundTime,
    backupLocations: identifyBackups(roundTime, spacing),
    waitTimeMinutes: calculateWaitTime(roundTime, spacing),
    paceRating: getPaceRating(roundTime),
    satisfactionPenalty: getSatisfactionPenalty(roundTime),
  };
}

function getPaceRating(roundTime: number): PaceOfPlayState['paceRating'] {
  if (roundTime <= 3.75) return 'excellent';
  if (roundTime <= 4.25) return 'good';
  if (roundTime <= 4.75) return 'acceptable';
  if (roundTime <= 5.5) return 'slow';
  return 'terrible';
}
```

### Visual Feedback: Course Backup

When the course backs up, the player sees it:

1. **Groups bunching on holes** - Multiple groups visible waiting on tees
2. **Frustration indicators** - Thought bubbles with clocks, angry faces
3. **Slow play warnings** - UI notification when pace exceeds threshold
4. **Starter complaints** - Starter booth shows queue of waiting groups

---

## Reservation System

### Booking Window

Golfers book tee times in advance. The booking window affects demand:

```typescript
interface BookingWindowConfig {
  // How far in advance golfers can book
  publicBookingDays: number;         // e.g., 7 days for public
  memberBookingDays: number;         // e.g., 14 days for members

  // Cancellation policy
  freeCancellationHours: number;     // Hours before tee time for free cancel
  lateCancelPenalty: number;         // Percentage of green fee charged

  // No-show policy
  noShowPenalty: number;             // Percentage charged for no-show
  noShowCountForBlacklist: number;   // After N no-shows, restrictions apply
}

const defaultBookingConfig: BookingWindowConfig = {
  publicBookingDays: 7,
  memberBookingDays: 14,
  freeCancellationHours: 24,
  lateCancelPenalty: 0.5,            // 50% charge
  noShowPenalty: 1.0,                // Full charge
  noShowCountForBlacklist: 3,
};
```

### Utilization Rates

**Critical Concept:** Not all tee time slots will be filled.

Utilization rate = (Booked slots / Available slots) determines actual revenue vs theoretical maximum.

| Course Status | Typical Utilization | Example (60 slots/day) |
|---------------|---------------------|------------------------|
| Low prestige (1-2★) | 10-15% | 6-9 tee times/day |
| Established (3★) | 20-30% | 12-18 tee times/day |
| Premium (4★) | 35-50% | 21-30 tee times/day |
| Championship (5★) | 50-70% | 30-42 tee times/day |
| 5★ + Active marketing | 70-90% | 42-54 tee times/day |
| Weekends (any rating) | +50% relative | Higher than weekday |

**Revenue Impact Example:**
- **Theoretical Max:** 60 slots × 4 golfers × $55 × 30 days = $396,000/month
- **Actual (3★ course at 25%):** 15 slots × 3.5 golfers × $55 × 30 days = $86,625/month
- **See ECONOMY_SYSTEM_SPEC.md** for complete revenue projections by game stage

### Reservation Demand Calculation

```typescript
interface ReservationDemand {
  // Base demand (from prestige, marketing, season, etc.)
  baseDemand: number;

  // Time-based modifiers
  dayOfWeekMultiplier: number;       // Weekends higher
  timeOfDayMultiplier: number;       // Prime time premium
  seasonMultiplier: number;          // Peak season boost
  weatherMultiplier: number;         // Good weather = more demand

  // Course-specific
  prestigeMultiplier: number;        // From prestige system
  pricingMultiplier: number;         // Price elasticity
  marketingMultiplier: number;       // Active campaigns

  // Competition
  competitionMultiplier: number;     // Nearby courses (future)

  // Final booking probability
  bookingProbability: number;
}

function calculateSlotDemand(
  slot: TeeTime,
  courseState: CourseState,
  marketingState: MarketingState
): ReservationDemand {
  // Base demand from prestige
  const baseDemand = getBaseDemandFromPrestige(courseState.prestige);

  // Day of week (1.0 = weekday baseline)
  const dayOfWeek = {
    0: 1.3,  // Sunday
    1: 0.7,  // Monday
    2: 0.8,  // Tuesday
    3: 0.9,  // Wednesday
    4: 0.9,  // Thursday
    5: 1.1,  // Friday
    6: 1.4,  // Saturday
  }[slot.scheduledTime.dayOfWeek];

  // Time of day
  const hour = slot.scheduledTime.hour;
  const timeOfDay =
    hour < 7 ? 0.6 :                 // Early bird
    hour < 10 ? 1.3 :                // Prime morning
    hour < 12 ? 1.1 :                // Late morning
    hour < 14 ? 0.9 :                // Midday
    hour < 16 ? 1.0 :                // Afternoon
    0.7;                             // Twilight

  // ... combine all multipliers

  return {
    baseDemand,
    dayOfWeekMultiplier: dayOfWeek,
    timeOfDayMultiplier: timeOfDay,
    // ... etc
    bookingProbability: calculateFinalProbability(/* ... */),
  };
}
```

### Booking Simulation

Each day, the game simulates golfers making reservations:

```typescript
function simulateDailyBookings(
  date: GameDate,
  courseState: CourseState,
  existingBookings: TeeTime[]
): TeeTime[] {
  const availableSlots = getAvailableSlots(date, existingBookings);
  const newBookings: TeeTime[] = [];

  for (const slot of availableSlots) {
    const demand = calculateSlotDemand(slot, courseState);

    // Check if someone books this slot
    if (Math.random() < demand.bookingProbability) {
      // Determine group size (weighted toward 4-somes)
      const groupSize = selectGroupSize();

      // Create booking
      const booking = createBooking(slot, groupSize, demand);
      newBookings.push(booking);
    }
  }

  return newBookings;
}

function selectGroupSize(): number {
  const roll = Math.random();
  if (roll < 0.05) return 1;         // 5% singles
  if (roll < 0.15) return 2;         // 10% twosomes
  if (roll < 0.30) return 3;         // 15% threesomes
  return 4;                          // 70% foursomes
}
```

---

## Walk-On System

### Philosophy

Walk-ons provide flexibility but no guarantees. This creates interesting player dynamics:

- **Low prestige courses**: Rely more on walk-ons to fill slots
- **High prestige courses**: Mostly reservations, walk-ons are rare

### Walk-On Mechanics

```typescript
interface WalkOnState {
  // Current walk-on queue
  waitingGolfers: WalkOnGolfer[];

  // Walk-on policy
  policy: WalkOnPolicy;

  // Success tracking
  walkOnsServedToday: number;
  walkOnsTurnedAwayToday: number;
  averageWaitTime: number;
}

interface WalkOnPolicy {
  // Is walk-on allowed?
  allowWalkOns: boolean;

  // Slot allocation
  reserveWalkOnSlots: number;        // Slots held for walk-ons per hour

  // Pricing
  walkOnPremium: number;             // e.g., 1.1 = 10% premium
  walkOnDiscount: number;            // e.g., 0.9 = 10% discount to fill

  // Queue management
  maxQueueSize: number;              // Max people waiting
  maxWaitMinutes: number;            // After this, they leave
}

interface WalkOnGolfer {
  golferId: string;
  arrivalTime: GameTime;
  desiredGroupSize: number;
  priceFlexibility: number;          // 0-1, willingness to pay premium
  waitTolerance: number;             // Minutes willing to wait

  // Status
  status: 'waiting' | 'assigned' | 'gave_up' | 'turned_away';
  assignedSlot?: TeeTime;
}
```

### Walk-On Processing

```typescript
function processWalkOns(
  currentTime: GameTime,
  walkOnQueue: WalkOnGolfer[],
  availableSlots: TeeTime[],
  policy: WalkOnPolicy
): WalkOnResult {
  const results: WalkOnResult = {
    assigned: [],
    gaveUp: [],
    stillWaiting: [],
  };

  for (const golfer of walkOnQueue) {
    const waitTime = currentTime.diff(golfer.arrivalTime);

    // Check if they've waited too long
    if (waitTime > golfer.waitTolerance) {
      golfer.status = 'gave_up';
      results.gaveUp.push(golfer);

      // This hurts reputation!
      recordNegativeExperience(golfer, 'excessive_wait');
      continue;
    }

    // Try to find a slot
    const slot = findSuitableSlot(golfer, availableSlots, policy);

    if (slot) {
      golfer.status = 'assigned';
      golfer.assignedSlot = slot;
      results.assigned.push(golfer);

      // Remove slot from available
      availableSlots = availableSlots.filter(s => s.id !== slot.id);
    } else {
      results.stillWaiting.push(golfer);
    }
  }

  return results;
}
```

### Walk-On Visual Feedback

Players see walk-ons waiting:

1. **Golfers at pro shop** - NPCs visibly waiting in the shop/lobby
2. **Queue length indicator** - "3 walk-ons waiting"
3. **Impatience animations** - Checking watches, pacing
4. **Departure animations** - Frustrated golfers leaving (reputation hit)

---

## Integration with Prestige System

### Tee Time Spacing Affects Prestige

```typescript
function calculateTeeTimePrestigeImpact(
  spacing: SpacingConfiguration,
  paceOfPlay: PaceOfPlayState,
  walkOnMetrics: WalkOnMetrics
): number {
  let impact = 0;

  // Spacing directly affects reputation component
  impact += spacing.reputationModifier * 100;  // -15 to +20 points

  // Pace of play satisfaction
  const paceImpact = {
    'excellent': +15,
    'good': +5,
    'acceptable': 0,
    'slow': -20,
    'terrible': -50,
  }[paceOfPlay.paceRating];
  impact += paceImpact;

  // Walk-on experience
  if (walkOnMetrics.turnAwayRate > 0.3) {
    impact -= 25;  // Too many turned away
  }
  if (walkOnMetrics.averageWaitTime > 30) {
    impact -= 15;  // Long waits hurt reputation
  }

  return impact;
}
```

### Golfer Satisfaction from Tee Times

```typescript
interface TeeTimeSatisfactionFactors {
  // Booking experience
  bookingEase: number;               // How easy to get desired time
  priceValue: number;                // Price vs prestige match

  // Day of play
  checkInExperience: number;         // Smooth check-in process
  startTimePunctuality: number;      // Did they start on time?

  // Round experience
  paceOfPlay: number;                // Round duration vs expectation
  courseConditions: number;          // From existing system
  serviceQuality: number;            // Staff, amenities
}

function calculateTeeTimeSatisfaction(
  booking: TeeTime,
  actualExperience: RoundExperience
): number {
  let satisfaction = 0;

  // Started on time? (+/- 10 minutes tolerance)
  const startDelay = actualExperience.actualStartTime - booking.scheduledTime;
  if (Math.abs(startDelay) <= 10) {
    satisfaction += 10;
  } else if (startDelay > 20) {
    satisfaction -= 20 - (startDelay - 20);  // -20 to -50
  }

  // Pace of play
  const expectedRound = 4.0 * 60;    // 4 hours in minutes
  const actualRound = actualExperience.roundDuration;
  const paceDeviation = (actualRound - expectedRound) / expectedRound;

  if (paceDeviation <= 0) {
    satisfaction += 15;               // Faster than expected = great
  } else if (paceDeviation <= 0.1) {
    satisfaction += 5;                // Slightly slow = acceptable
  } else if (paceDeviation <= 0.25) {
    satisfaction -= 10;               // Noticeably slow
  } else {
    satisfaction -= 30;               // Way too slow
  }

  // ... other factors

  return clamp(satisfaction, -50, 50);
}
```

---

## Revenue Streams

### Primary: Green Fees

```typescript
interface GreenFeeStructure {
  // Base rates (modified by prestige tolerance)
  weekdayRate: number;
  weekendRate: number;
  twilightRate: number;              // After twilightStart

  // Time-based pricing
  primeMorningPremium: number;       // e.g., 1.2 = 20% more for 7-10 AM

  // Membership pricing (see PRESTIGE_SYSTEM_SPEC.md - Membership Tiers for full details)
  memberRate: number;                // Discount for members (typically 20-40% off public rate)
  guestOfMemberRate: number;         // Guest discount (typically 10-20% off public rate)

  // Dynamic pricing (optional advanced feature)
  dynamicPricingEnabled: boolean;
  demandMultiplierRange: [number, number];  // e.g., [0.8, 1.3]
}
```

### Secondary: Cart Fees

```typescript
interface CartFeeStructure {
  // Per person vs per cart
  pricingModel: 'per_person' | 'per_cart';

  // Rates
  standardCartFee: number;           // e.g., $20 per person
  walkingDiscount: number;           // Discount for walking

  // Cart types (if luxury carts owned)
  premiumCartFee?: number;           // GPS/luxury cart premium

  // Policies
  cartRequired: boolean;             // Some courses require carts
  cartIncluded: boolean;             // Some bundle cart with green fee
}
```

### Tertiary: Add-On Services

```typescript
interface AddOnService {
  id: string;
  name: string;
  price: number;

  // When offered
  offeredAtBooking: boolean;
  offeredAtCheckIn: boolean;
  offeredDuringRound: boolean;

  // Uptake rate (base probability golfer purchases)
  baseUptakeRate: number;

  // Prestige modifier (higher prestige = more uptake)
  prestigeUptakeBonus: number;
}

const STANDARD_ADDONS: AddOnService[] = [
  {
    id: 'range_balls',
    name: 'Range Balls',
    price: 10,
    offeredAtBooking: true,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.3,
    prestigeUptakeBonus: 0.1,
  },
  {
    id: 'caddie',
    name: 'Caddie Service',
    price: 75,
    offeredAtBooking: true,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.05,
    prestigeUptakeBonus: 0.15,        // Much higher at prestige courses
  },
  {
    id: 'forecaddie',
    name: 'Forecaddie (Group)',
    price: 50,
    offeredAtBooking: true,
    offeredAtCheckIn: false,
    offeredDuringRound: false,
    baseUptakeRate: 0.08,
    prestigeUptakeBonus: 0.10,
  },
  {
    id: 'club_rental',
    name: 'Club Rental',
    price: 60,
    offeredAtBooking: true,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.08,
    prestigeUptakeBonus: 0.02,
  },
  {
    id: 'gps_rental',
    name: 'GPS Device Rental',
    price: 15,
    offeredAtBooking: false,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.15,
    prestigeUptakeBonus: 0.05,
  },
];
```

### Tips System

Golfers can tip staff, creating additional revenue:

```typescript
interface TipSystem {
  // Staff categories that receive tips
  tippableStaff: ('caddie' | 'cart_attendant' | 'beverage_cart' | 'pro_shop')[];

  // Tip calculation
  baseTipPercentage: number;         // e.g., 0.15 = 15% of service
  satisfactionModifier: number;      // Happy golfers tip more

  // Tip pooling
  tipPooling: boolean;               // Share tips among staff
  housePercentage: number;           // Course takes a cut (0 = none)
}

function calculateTips(
  services: ServiceRendered[],
  golferSatisfaction: number
): number {
  let totalTips = 0;

  for (const service of services) {
    const baseTip = service.cost * 0.15;

    // Satisfaction modifier: -50 to +50 satisfaction maps to 0.5x to 1.5x
    const satisfactionMod = 1 + (golferSatisfaction / 100);

    totalTips += baseTip * satisfactionMod;
  }

  return totalTips;
}
```

### Concessions & Food/Beverage

```typescript
interface ConcessionRevenue {
  // Locations
  locations: ConcessionLocation[];

  // Per-golfer spending (based on amenity level)
  averageSpendPerGolfer: number;

  // Factors
  roundDurationModifier: number;     // Longer rounds = more spending
  weatherModifier: number;           // Hot weather = more drinks
  satisfactionModifier: number;      // Happy golfers spend more
}

interface ConcessionLocation {
  type: 'pro_shop' | 'snack_bar' | 'beverage_cart' | 'halfway_house' | 'clubhouse_bar' | 'restaurant';

  // Revenue potential
  averageTransaction: number;
  transactionsPerGolfer: number;     // Average purchases per round

  // Operating costs
  staffCost: number;
  inventoryCost: number;

  // Margin
  profitMargin: number;              // e.g., 0.4 = 40% margin
}
```

### Revenue Summary

```typescript
interface DailyRevenue {
  // Tee time related
  greenFees: number;
  cartFees: number;
  addOnServices: number;

  // Hospitality
  foodAndBeverage: number;
  proShopSales: number;
  tips: number;

  // Other
  lessonFees: number;                // If teaching academy
  practiceRangeFees: number;         // If not included
  eventFees: number;                 // Tournament hosting

  // Totals
  grossRevenue: number;
  operatingCosts: number;
  netRevenue: number;
}
```

---

## Marketing System

### Campaign Types

Inspired by RollerCoaster Tycoon's marketing campaigns:

```typescript
interface MarketingCampaign {
  id: string;
  type: CampaignType;
  name: string;
  description: string;

  // Cost
  dailyCost: number;
  setupCost: number;

  // Duration
  minDuration: number;               // Days
  maxDuration: number;
  currentDuration: number;

  // Effects
  demandMultiplier: number;          // e.g., 1.3 = 30% more bookings
  targetAudience: GolferType[];      // Who it attracts
  priceElasticityEffect: number;     // Can charge more/less?

  // Limitations
  cooldownDays: number;              // Days before can run again
  maxConcurrent: number;             // How many at once
}

type CampaignType =
  | 'local_advertising'
  | 'radio_campaign'
  | 'social_media'
  | 'golf_magazine'
  | 'free_round_voucher'
  | 'group_discount'
  | 'twilight_special'
  | 'stay_and_play'
  | 'tournament_hosting'
  | 'celebrity_appearance';
```

### Available Campaigns

```typescript
const MARKETING_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'local_newspaper',
    type: 'local_advertising',
    name: 'Local Newspaper Ad',
    description: 'Advertise in local newspapers to attract nearby golfers.',
    dailyCost: 100,
    setupCost: 0,
    minDuration: 7,
    maxDuration: 30,
    currentDuration: 0,
    demandMultiplier: 1.15,
    targetAudience: ['casual', 'regular'],
    priceElasticityEffect: 0,
    cooldownDays: 0,
    maxConcurrent: 2,
  },
  {
    id: 'radio_spot',
    type: 'radio_campaign',
    name: 'Radio Advertising',
    description: 'Regional radio spots to reach a wider audience.',
    dailyCost: 300,
    setupCost: 500,
    minDuration: 14,
    maxDuration: 60,
    currentDuration: 0,
    demandMultiplier: 1.25,
    targetAudience: ['casual', 'regular', 'avid'],
    priceElasticityEffect: 0,
    cooldownDays: 14,
    maxConcurrent: 1,
  },
  {
    id: 'social_media_push',
    type: 'social_media',
    name: 'Social Media Campaign',
    description: 'Targeted social media advertising for golf enthusiasts.',
    dailyCost: 150,
    setupCost: 200,
    minDuration: 7,
    maxDuration: 90,
    currentDuration: 0,
    demandMultiplier: 1.20,
    targetAudience: ['casual', 'regular', 'young_professional'],
    priceElasticityEffect: -0.05,    // Attracts price-sensitive crowd
    cooldownDays: 7,
    maxConcurrent: 2,
  },
  {
    id: 'golf_magazine_feature',
    type: 'golf_magazine',
    name: 'Golf Magazine Feature',
    description: 'Premium placement in regional golf magazine. Attracts serious golfers.',
    dailyCost: 500,
    setupCost: 2000,
    minDuration: 30,
    maxDuration: 90,
    currentDuration: 0,
    demandMultiplier: 1.35,
    targetAudience: ['avid', 'serious', 'high_handicap'],
    priceElasticityEffect: 0.10,     // Can charge more
    cooldownDays: 60,
    maxConcurrent: 1,
  },
  {
    id: 'free_round_voucher',
    type: 'free_round_voucher',
    name: 'Free Round Vouchers',
    description: 'Distribute free round vouchers. Great for new customer acquisition.',
    dailyCost: 0,                    // Cost is in lost revenue
    setupCost: 0,
    minDuration: 7,
    maxDuration: 30,
    currentDuration: 0,
    demandMultiplier: 2.0,           // Huge demand increase
    targetAudience: ['new_golfer', 'casual', 'lapsed'],
    priceElasticityEffect: -0.30,    // Very price sensitive
    cooldownDays: 90,
    maxConcurrent: 1,
    // Special: voucher redemption tracked separately
  },
  {
    id: 'group_discount',
    type: 'group_discount',
    name: 'Group Booking Discount',
    description: '15% off for groups of 8 or more. Great for corporate outings.',
    dailyCost: 0,
    setupCost: 0,
    minDuration: 14,
    maxDuration: 365,
    currentDuration: 0,
    demandMultiplier: 1.4,           // More group bookings
    targetAudience: ['corporate', 'social_group'],
    priceElasticityEffect: -0.15,    // Discount eats margin
    cooldownDays: 0,
    maxConcurrent: 1,
  },
  {
    id: 'twilight_special',
    type: 'twilight_special',
    name: 'Twilight Special',
    description: 'Heavily discounted twilight rates to fill afternoon slots.',
    dailyCost: 0,
    setupCost: 0,
    minDuration: 7,
    maxDuration: 365,
    currentDuration: 0,
    demandMultiplier: 1.6,           // Twilight slots fill better
    targetAudience: ['budget', 'casual', 'after_work'],
    priceElasticityEffect: -0.25,
    cooldownDays: 0,
    maxConcurrent: 1,
    // Special: only affects twilight time slots
  },
  {
    id: 'tournament_hosting',
    type: 'tournament_hosting',
    name: 'Host Tournament',
    description: 'Host a local tournament. One-time event with lasting reputation effects.',
    dailyCost: 0,
    setupCost: 5000,
    minDuration: 1,
    maxDuration: 1,
    currentDuration: 0,
    demandMultiplier: 0,             // Course is closed for event
    targetAudience: [],
    priceElasticityEffect: 0,
    cooldownDays: 30,
    maxConcurrent: 1,
    // Special: generates event revenue and prestige boost
  },
  {
    id: 'celebrity_appearance',
    type: 'celebrity_appearance',
    name: 'Celebrity Pro Appearance',
    description: 'Book a celebrity golfer for a day. Huge publicity boost!',
    dailyCost: 0,
    setupCost: 25000,
    minDuration: 1,
    maxDuration: 3,
    currentDuration: 0,
    demandMultiplier: 1.5,
    targetAudience: ['all'],
    priceElasticityEffect: 0.20,     // Premium pricing accepted
    cooldownDays: 180,
    maxConcurrent: 1,
    // Special: significant prestige boost for duration
  },
];
```

### Campaign Effectiveness

```typescript
interface CampaignEffectiveness {
  // Tracking
  campaignId: string;
  startDate: GameDate;
  endDate: GameDate;

  // Results
  additionalBookings: number;
  revenueGenerated: number;
  costIncurred: number;

  // ROI
  returnOnInvestment: number;

  // Prestige impact
  prestigeChange: number;

  // Recommendations
  recommendation: 'highly_effective' | 'effective' | 'marginal' | 'ineffective';
}

function evaluateCampaign(
  campaign: MarketingCampaign,
  baselineMetrics: DailyMetrics,
  campaignMetrics: DailyMetrics[]
): CampaignEffectiveness {
  // Compare booking rates during campaign to baseline
  const baselineDaily = baselineMetrics.bookingsPerDay;
  const campaignAvg = average(campaignMetrics.map(m => m.bookingsPerDay));

  const additionalBookings = (campaignAvg - baselineDaily) * campaign.currentDuration;
  const revenue = additionalBookings * courseState.averageGreenFee;
  const cost = campaign.setupCost + (campaign.dailyCost * campaign.currentDuration);

  const roi = (revenue - cost) / cost;

  return {
    campaignId: campaign.id,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    additionalBookings,
    revenueGenerated: revenue,
    costIncurred: cost,
    returnOnInvestment: roi,
    prestigeChange: calculatePrestigeFromCampaign(campaign),
    recommendation: getRecommendation(roi),
  };
}
```

---

## UI/UX Design

### Tee Sheet View (Main Scheduling Interface)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TEE SHEET - Saturday, June 15                          [◀ Day] [Day ▶]│
├─────────────────────────────────────────────────────────────────────────┤
│  Time    │ Players │ Status      │ Revenue  │ Notes                    │
├──────────┼─────────┼─────────────┼──────────┼──────────────────────────┤
│  6:00 AM │ ████    │ ✓ Checked In│ $340     │ Smith foursome           │
│  6:10 AM │ ████    │ ✓ Checked In│ $340     │ Jones group              │
│  6:20 AM │ ███░    │ ⏱ Reserved  │ $255     │ Online booking           │
│  6:30 AM │ ████    │ ⏱ Reserved  │ $340     │ Member + guests          │
│  6:40 AM │ ██░░    │ ⏱ Reserved  │ $170     │ Twosome                  │
│  6:50 AM │ ░░░░    │ ○ Available │ --       │                          │
│  7:00 AM │ ████    │ ⏱ Reserved  │ $380     │ Corporate outing         │
│  7:10 AM │ ░░░░    │ ○ Available │ --       │                          │
│  ...     │         │             │          │                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Today's Summary:                                                       │
│  Booked: 42/60 slots (70%)    Expected Revenue: $12,450                │
│  Walk-ons waiting: 3          Weather: ☀️ Clear                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Spacing Configuration Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TEE TIME SPACING CONFIGURATION                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Current Spacing: [STANDARD - 10 min]                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ◀ ═══════════════════●═══════════════════════════════════ ▶    │   │
│  │   PACKED  TIGHT  STANDARD  COMFORTABLE  RELAXED  EXCLUSIVE     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  IMPACT PREVIEW                                                  │   │
│  ├──────────────────────┬──────────────────────────────────────────┤   │
│  │  Max Daily Tee Times │  60                                      │   │
│  │  Revenue Potential   │  ████████░░ 100% (baseline)              │   │
│  │  Pace of Play Risk   │  ██░░░░░░░░ Low                          │   │
│  │  Reputation Impact   │  ████████░░ Neutral                      │   │
│  │  Backup Probability  │  ██░░░░░░░░ 15%                          │   │
│  └──────────────────────┴──────────────────────────────────────────┘   │
│                                                                          │
│  ⚠️  Warning: Tighter spacing increases revenue but risks reputation    │
│                                                                          │
│  [Apply Changes]  [Cancel]                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Walk-On Queue Display

```
┌─────────────────────────────────────────────────────────┐
│  WALK-ON QUEUE                                          │
├─────────────────────────────────────────────────────────┤
│  👤 Johnson (1)    Waiting 12 min   [Assign] [Turn Away]│
│  👤👤 Williams (2)  Waiting 8 min    [Assign] [Turn Away]│
│  👤👤👤👤 Chen (4)    Waiting 3 min    [Assign] [Turn Away]│
├─────────────────────────────────────────────────────────┤
│  Next available slot: 10:40 AM (30 min wait)            │
│  Walk-ons served today: 7                               │
│  Walk-ons turned away: 2                                │
└─────────────────────────────────────────────────────────┘
```

### Marketing Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MARKETING CAMPAIGNS                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ACTIVE CAMPAIGNS                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📰 Local Newspaper Ad                                          │   │
│  │  Day 5 of 14  │  Cost: $100/day  │  Bookings: +12%             │   │
│  │  [█████░░░░░░░░░]                               [Stop Campaign] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  AVAILABLE CAMPAIGNS                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📻 Radio Advertising           $300/day + $500 setup          │   │
│  │  Expected impact: +25% bookings                    [Start]      │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  📱 Social Media Campaign       $150/day + $200 setup          │   │
│  │  Expected impact: +20% bookings                    [Start]      │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  🎟️ Free Round Vouchers         (lost revenue)                 │   │
│  │  Expected impact: +100% new visitors               [Start]      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  CAMPAIGN HISTORY                                                        │
│  Last campaign: Radio (14 days) - ROI: +180% ✓ Highly Effective         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pace of Play Alert

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  PACE OF PLAY WARNING                               │
├─────────────────────────────────────────────────────────┤
│  Current average round: 4 hours 45 minutes              │
│  Target: 4 hours                                        │
│                                                          │
│  Backup detected at:                                    │
│  • Hole 7 - 3 groups waiting                           │
│  • Hole 12 - 2 groups waiting                          │
│                                                          │
│  Golfer satisfaction impact: -15%                       │
│                                                          │
│  RECOMMENDATIONS:                                        │
│  • Consider widening tee time spacing                   │
│  • Send ranger to clear backup                          │
│  • Offer drink voucher to waiting groups                │
│                                                          │
│  [Dismiss]  [Adjust Spacing]  [Send Ranger]             │
└─────────────────────────────────────────────────────────┘
```

---

## Data Persistence

### Tee Time State

```typescript
interface TeeTimeSystemState {
  // Configuration
  spacingConfig: SpacingConfiguration;
  operatingHours: CourseOperatingHours;
  bookingConfig: BookingWindowConfig;
  walkOnPolicy: WalkOnPolicy;

  // Pricing
  greenFeeStructure: GreenFeeStructure;
  cartFeeStructure: CartFeeStructure;
  addOnServices: AddOnService[];

  // Current state
  teeTimes: Map<GameDate, TeeTime[]>;     // Bookings by date
  walkOnQueue: WalkOnGolfer[];

  // Marketing
  activeCampaigns: MarketingCampaign[];
  campaignHistory: CampaignEffectiveness[];

  // Metrics
  dailyMetrics: Map<GameDate, DailyTeeTimeMetrics>;

  // Pace of play
  currentPaceOfPlay: PaceOfPlayState;
}

interface DailyTeeTimeMetrics {
  date: GameDate;

  // Bookings
  slotsAvailable: number;
  slotsBooked: number;
  bookingRate: number;

  // Golfers
  totalGolfers: number;
  walkOnsServed: number;
  walkOnsTurnedAway: number;
  noShows: number;
  cancellations: number;

  // Revenue
  greenFeeRevenue: number;
  cartRevenue: number;
  addOnRevenue: number;
  fbRevenue: number;
  tipRevenue: number;
  totalRevenue: number;

  // Experience
  averagePaceOfPlay: number;
  averageSatisfaction: number;
  backupIncidents: number;

  // Pricing
  averageGreenFee: number;
  averageRevenuePerGolfer: number;
}
```

### Integration with GameState

```typescript
interface GameState {
  // ... existing fields from prestige spec
  prestige: PrestigeState;

  // New tee time system
  teeTimeSystem: TeeTimeSystemState;

  // Cross-system connections
  golferSatisfaction: SatisfactionMetrics;
}
```

---

## Balance Considerations

### The Spacing Dilemma

This is the core strategic tension. Examples:

**Aggressive Strategy (Packed/Tight)**
- Max revenue potential: $15,000/day
- Pace of play risk: HIGH
- After 30 days of packed scheduling:
  - Reputation drops 10-15%
  - Reviews mention "slow play"
  - Booking demand starts declining
  - Recovery takes 60+ days of good service

**Conservative Strategy (Relaxed/Exclusive)**
- Revenue potential: $7,500/day (50% of packed)
- Pace of play: EXCELLENT
- After 30 days:
  - Reputation increases 5-10%
  - Reviews praise "no waiting"
  - Premium pricing becomes viable
  - Higher prestige unlocks

**Optimal Strategy (Standard + Smart Management)**
- Revenue potential: $10,000/day
- Pace of play: GOOD
- With active rangers and good course conditions:
  - Stable reputation
  - Room to tighten for peak periods
  - Sustainable long-term

### Revenue vs Prestige Trade-offs

| Approach | Short-term Revenue | Long-term Prestige | Sustainability |
|----------|-------------------|-------------------|----------------|
| Pack 'em in | +67% | -15%/month | Unsustainable |
| Standard | Baseline | Neutral | Sustainable |
| Premium spacing | -33% | +10%/month | Builds value |

### Marketing ROI Guidelines

| Campaign | Best For | Expected ROI | Prestige Impact |
|----------|----------|--------------|-----------------|
| Local ads | Filling slow days | 150-200% | Neutral |
| Social media | New golfers | 100-150% | Slight negative |
| Golf magazine | Premium image | 80-120% | Positive |
| Free vouchers | New acquisition | 0-50% | Negative if overused |
| Group discount | Corporate | 100-150% | Neutral |
| Tournament | Prestige boost | 50-100% | Very positive |
| Celebrity | Major boost | 100-200% | Very positive |

---

## Implementation Priority

### Phase 1: Core Tee Time Scheduling
1. Tee time data structure
2. Operating hours configuration
3. Basic tee sheet UI
4. Slot availability tracking

### Phase 2: Booking System
1. Reservation simulation
2. Booking demand calculation
3. Cancellation/no-show handling
4. Booking window configuration

### Phase 3: Spacing & Pace
1. Spacing configuration UI
2. Pace of play calculation
3. Backup detection
4. Visual feedback (groups waiting)

### Phase 4: Walk-On System
1. Walk-on queue
2. Assignment logic
3. Walk-on UI
4. Frustration/departure mechanics

### Phase 5: Revenue Integration
1. Green fee calculation
2. Cart fee handling
3. Add-on services
4. Daily revenue tracking

### Phase 6: Marketing System
1. Campaign definitions
2. Campaign activation UI
3. Effectiveness tracking
4. Campaign history/analytics

### Phase 7: Advanced Features
1. Dynamic pricing
2. Member priority booking
3. Tournament hosting
4. Group booking management

---

## Summary

The Tee Time System creates a strategic layer where players must balance:

1. **Revenue vs Reputation** - Tight spacing maximizes bookings but hurts satisfaction
2. **Reservations vs Walk-ons** - Structured vs flexible access
3. **Marketing Investment** - Spend to boost demand, but track ROI
4. **Pace Management** - Active intervention to prevent course backups

This creates the core business simulation loop:
**Schedule → Fill → Manage Pace → Satisfy → Build Reputation → Charge More → Reinvest**

The system directly feeds into the Prestige System, as golfer satisfaction from their booking experience and round pace significantly impacts course reputation over time.
