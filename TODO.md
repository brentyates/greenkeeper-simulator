# Greenkeeper Simulator - Integration TODO

This file tracks the work needed to integrate all economy/management systems into a fully playable game loop.

## Current Status: Core Integration Complete ✅

**What's Working:**
- Economy system: Cash, transactions, loans integrated
- Employee system: Payroll, ticks, manager bonuses running
- Golfer system: Arrivals, progression, tips, satisfaction running
- Research system: Ticks, funding costs deducted
- Scenario system: Progress tracking, objective checking, win/lose detection
- UI: Economy panel (cash + golfers), Scenario progress panel with bar

**Next Up: Prestige System** (See [Prestige System](#prestige-system) section)
- ~~Phase P1: Core prestige score and star rating~~ ✅
- ~~Phase P2: Historical tracking and streaks~~ ✅
- ~~Phase P3: Amenities system~~ ✅
- ~~Phase P4: Reputation and reviews~~ ✅ (core logic complete, UI pending)
- ~~Phase P5: Exclusivity and advanced features~~ ✅ (core logic complete, UI pending)

**Tee Time System** (See [Tee Time System](#tee-time-system) section)
- ~~Phase T1: Core Tee Time Scheduling~~ ✅ (core logic complete, UI pending)
- Phase T2: Booking System
- Phase T3: Spacing & Pace
- Phase T4: Walk-On System
- Phase T5: Revenue Integration
- Phase T6: Marketing System
- Phase T7: Advanced Features

**Other Enhancements (Nice-to-Have):**
- Employee management UI (hire/fire, view roster)
- Research UI (tech tree, funding controls)
- Day summary popup
- Golfer satisfaction display
- Save/load game state

---

## Overview

The core logic modules are complete and tested. This TODO covers wiring them into `BabylonMain` and creating the UI layers.

---

## Phase 1: Core Game State Integration

### 1.1 Add State Instances to BabylonMain
- [x] Import all core modules in `BabylonMain.ts`
- [x] Add `economyState: EconomyState` property initialized from scenario conditions
- [x] Add `employeeRoster: EmployeeRoster` property
- [x] Add `golferPool: GolferPoolState` property
- [x] Add `researchState: ResearchState` property
- [x] Add `scenarioManager: ScenarioManager` property (initialized from `GameOptions.scenario`)
- [x] Add `weatherCondition: WeatherCondition` property for golfer simulation
- [x] Add `greenFees: GreenFeeStructure` for fee calculation

### 1.2 Initialize State from Scenario
- [x] In constructor, check if `options.scenario` exists
- [x] Initialize `economyState` with `scenario.conditions.startingCash`
- [x] Initialize `scenarioManager` with `scenario.objective` and `scenario.conditions`
- [x] Wire state updates into the game update loop (`updateEconomySystems`)
- [x] Process hourly payroll with `processPayroll()`
- [x] Process golfer arrivals with `generateArrivals()` and `addGolfer()`
- [x] Tick golfers with `tickGolfers()` and process departures/tips
- [x] Tick employees with `tickEmployees()`
- [x] Tick research with `tickResearch()` and deduct funding costs
- [x] Update scenario progress with current cash/health
- [x] Add `checkScenarioCompletion()` for win/lose detection

---

## Phase 2: Economy HUD

### 2.1 Create EconomyHUD Component
- [x] Added economy panel to `UIManager.ts` (below time panel)
- [x] Display current cash balance with `updateEconomy()` method
- [x] Show active golfer count
- [x] Color-code: green for positive, red for negative cash

### 2.2 Wire Economy to Game Events
- [x] Green fees automatically added via `generateArrivals()` in `updateEconomySystems()`
- [x] Employee wages deducted via `processPayroll()`
- [x] Research funding deducted via `tickResearch()`
- [x] Tips from departing golfers added as income
- [ ] Deduct cost when refilling equipment (future)
- [ ] Track equipment usage costs per tile (future)

---

## Phase 3: Scenario Tracking

### 3.1 Create ScenarioHUD Component
- [x] Added scenario panel to `UIManager.ts` (below economy panel)
- [x] Display objective text with progress bar
- [x] Show days elapsed / time remaining
- [x] Color-coded progress bar (red < 50%, yellow < 75%, green >= 75%)
- [x] `updateScenarioProgress()` method

### 3.2 Wire Scenario Progress Updates
- [x] Call `scenarioManager.addRevenue()` when golfers pay (in `updateEconomySystems`)
- [x] Call `scenarioManager.addGolfers()` when golfers arrive
- [x] Call `scenarioManager.addRound()` when golfers depart
- [x] Call `scenarioManager.updateProgress()` with current state
- [x] Update UI with progress toward objective

### 3.3 Win/Lose Detection
- [x] Check `scenarioManager.checkObjective()` in game loop
- [x] `checkScenarioCompletion()` method handles win/lose
- [x] Shows notification on completion/failure
- [x] Calls `gameOptions.onScenarioComplete(score)` on victory

---

## Phase 4: Golfer Simulation

### 4.1 Golfer Arrival System
- [x] Calculate arrival rate based on course rating, time of day, weather
- [x] Call `generateArrivals()` each game hour (6am-7pm)
- [x] Add arriving golfers to `golferPool`
- [x] Generate green fee revenue when golfers check in
- [x] Call `addIncome` on economyState for each golfer

### 4.2 Golfer Progression
- [x] Call `tickGolfers()` in update loop with deltaTime
- [x] Pass current course condition (from grass stats)
- [x] Pass staff quality (from employee efficiency)
- [x] Pass weather condition
- [x] Track departing golfers and their satisfaction/tips

### 4.3 Golfer UI Indicators
- [x] Show current golfer count on course (in economy panel)
- [ ] Display average satisfaction rating (optional enhancement)
- [ ] Show golfers as small markers on minimap (optional)
- [ ] Add notification when golfers arrive/depart (optional)

### 4.4 Course Rating Updates
- [x] Calculate course condition from grass health
- [x] Update `golferPool.rating.condition` based on grass stats
- [x] Link course rating to golfer arrival rates

---

## Phase 5: Employee System

### 5.1 Create EmployeePanel Component (FUTURE - UI Enhancement)
- [ ] Create `src/babylon/ui/EmployeePanel.ts`
- [ ] List current employees with name, role, skill level
- [ ] Show employee status (working, on break, idle)
- [ ] Display hourly wage and total payroll cost
- [ ] Add hire/fire buttons

### 5.2 Hiring Interface (FUTURE - UI Enhancement)
- [ ] Show hiring pool of available candidates
- [ ] Display candidate stats (skills, wage)
- [ ] Confirm hire with cost warning
- [ ] Refresh hiring pool periodically

### 5.3 Employee Simulation
- [x] Call `tickEmployees()` in update loop
- [x] Process automatic breaks (handled by core logic)
- [x] Call `processPayroll()` each game hour
- [x] Deduct wages from economy
- [x] Apply manager bonus to golfer experience

---

## Phase 6: Research System

### 6.1 Create ResearchPanel Component (FUTURE - UI Enhancement)
- [ ] Create `src/babylon/ui/ResearchPanel.ts`
- [ ] Display tech tree by category
- [ ] Show locked/available/completed status for each item
- [ ] Display current research progress bar
- [ ] Show research queue

### 6.2 Funding Controls (FUTURE - UI Enhancement)
- [ ] Add funding level selector (none/minimum/normal/maximum)
- [ ] Display cost per minute at current funding level
- [ ] Show estimated time to completion

### 6.3 Research Simulation
- [x] Call `tickResearch()` in update loop
- [x] Deduct research funding cost from economy
- [ ] Notify when research completes (optional)
- [ ] Unlock equipment/fertilizers when research completes

### 6.4 Apply Research Unlocks
- [ ] Make unlocked equipment purchasable
- [ ] Apply upgrade bonuses (efficiency, speed, etc.)
- [ ] Enable autonomous robot equipment when unlocked
- [ ] Show fleet AI benefits if researched

---

## Phase 7: Day/Night Cycle Integration

### 7.1 Day Transition Events
- [ ] Trigger end-of-day summary at midnight (or configurable hour)
- [ ] Process daily expenses (utilities, base maintenance)
- [ ] Reset daily golfer counters
- [ ] Check scenario day-based objectives

### 7.2 Day Summary Popup
- [ ] Create `src/babylon/ui/DaySummaryPopup.ts`
- [ ] Show revenue breakdown (green fees, tips)
- [ ] Show expense breakdown (wages, supplies, research)
- [ ] Display net profit/loss for the day
- [ ] Show course health change
- [ ] Show golfer statistics (count, satisfaction, return rate)

### 7.3 Time-Based Events
- [ ] Peak golfer hours (7-10am, 1-4pm)
- [ ] Twilight pricing after 4pm
- [ ] Employee shift scheduling (future feature)

---

## Phase 8: Pause Menu Enhancements

### 8.1 Add Management Tabs to Pause Menu
- [ ] Add "Employees" tab linking to EmployeePanel
- [ ] Add "Research" tab linking to ResearchPanel
- [ ] Add "Finances" tab showing transaction history
- [ ] Add "Objectives" tab showing scenario details

### 8.2 Game Speed Controls
- [ ] Pause should fully stop all simulation
- [ ] Allow speed changes from pause menu
- [ ] Add fast-forward (4x, 8x) for longer scenarios

---

## Phase 9: Save/Load System

### 9.1 Extend GameState
- [ ] Add economy state to saved game
- [ ] Add employee roster to saved game
- [ ] Add golfer pool state to saved game
- [ ] Add research state to saved game
- [ ] Add scenario progress to saved game

### 9.2 Auto-Save
- [ ] Save progress at end of each game day
- [ ] Save when returning to menu
- [ ] Load saved state when continuing scenario

---

## Phase 10: Polish & Balance

### 10.1 Tutorial Scenario Guidance
- [ ] Add tooltips explaining each system
- [ ] Highlight UI elements for first-time actions
- [ ] Ensure tutorial scenario is completable with basic actions

### 10.2 Balance Tuning
- [ ] Adjust green fee defaults for each course size
- [ ] Balance employee wages vs golfer revenue
- [ ] Tune research costs and times
- [ ] Ensure all 10 scenarios are completable

### 10.3 Visual Feedback
- [ ] Show golfer sprites on course (optional)
- [ ] Employee sprites at work stations (optional)
- [ ] Equipment upgrade visual changes
- [ ] Weather effects on grass appearance

---

## Prestige System

> Design spec: `docs/design/PRESTIGE_SYSTEM_SPEC.md`

The Prestige System is the primary determinant of green fee pricing power. It manifests as a 5-star rating backed by a sophisticated multi-factor score (0-1000).

### Phase P1: Core Prestige Score

#### P1.1 Create Core Prestige Logic ✅
- [x] Create `src/core/prestige.ts` with pure logic functions
- [x] Define `PrestigeState` interface with core scores
- [x] Define `CurrentConditionsScore` interface
- [x] Define `GreenFeeTolerance` interface
- [x] Implement `createInitialPrestigeState()` factory function

#### P1.2 Current Conditions Component (25% of score) ✅
- [x] Implement `calculateCurrentConditions()` function
- [x] Calculate average health from grass cells
- [x] Calculate green-specific health score (cells with `type: 'green'`)
- [x] Calculate fairway-specific health score
- [x] Add placeholder scores for bunker/hazard maintenance (future)
- [x] Calculate tee box health score
- [x] Compute weighted composite score (0-1000)

#### P1.3 Star Rating Display ✅
- [x] Implement `calculateStarRating(score: number)` → 0.5 to 5.0
- [x] Map score ranges: 0-99=0.5★, 100-199=1★, etc.
- [x] Create prestige tier labels: Municipal, Public, Semi-Private, Private Club, Championship

#### P1.4 Green Fee Tolerance System ✅
- [x] Define sweet spot, max tolerance, rejection threshold per tier
- [x] Implement `calculateDemandMultiplier(price, tolerance)` function
- [x] Below sweet spot: 1.0x demand
- [x] Sweet spot to rejection: gradual 0-20% reduction
- [x] Rejection to max: 80% down to 20%
- [x] Beyond max: severe rejection (down to 5%)

#### P1.5 Integrate with BabylonMain ✅
- [x] Add `prestigeState: PrestigeState` property to BabylonMain
- [x] Call `calculateCurrentConditions()` every game-hour
- [x] Update prestige score with gradual change (max +5/-15 per day)
- [x] Apply demand multiplier to golfer arrivals

#### P1.6 Prestige HUD ✅
- [x] Add prestige panel to UIManager (star display + score)
- [x] Show current star rating with half-star granularity
- [x] Display tier label (Municipal/Public/etc.)
- [x] Show score and trend indicator (color-coded)

---

### Phase P2: Historical Tracking ✅

#### P2.1 Daily Snapshots ✅
- [x] Define `DailySnapshot` interface (day, health, condition rating)
- [x] Define `HistoricalExcellenceState` interface
- [x] Implement `takeDailySnapshot()` function
- [x] Store up to 365 days of history
- [x] Calculate 30-day and 90-day rolling averages

#### P2.2 Streak Tracking ✅
- [x] Track `consecutiveExcellentDays` (health ≥ 80)
- [x] Track `consecutiveGoodDays` (health ≥ 60)
- [x] Track `longestExcellentStreak` (all-time record)
- [x] Apply streak bonuses: 7-day good (+25), 30-day good (+75), 7-day excellent (+50), 30-day excellent (+150)

#### P2.3 Consistency Score ✅
- [x] Calculate standard deviation of health over 30 days
- [x] Consistency score = 100 - (stdDev × 2)
- [x] Lower variance = higher score

#### P2.4 Recovery Penalty System ✅
- [x] Track `daysSinceLastPoorRating` (health < 40)
- [x] Track `poorDaysInLast90`
- [x] Apply recovery curve penalties: Day 1-7 (-200), 8-14 (-150), 15-30 (-100), 31-60 (-50), 61+ (no penalty)

#### P2.5 Historical Excellence Score (25% of total) ✅
- [x] Implement `calculateHistoricalExcellence()` function
- [x] Combine: rolling average (40%), consistency (25%), streak bonus (20%), recovery penalty (15%)
- [x] Integrate into master prestige formula

---

### Phase P3: Amenities System ✅

#### P3.1 Amenity State ✅
- [x] Define `AmenityState` interface with all tiers and facilities
- [x] Clubhouse tier: 0-4 (Starter Shack → Grand Clubhouse)
- [x] Pro shop tier: 0-3
- [x] Dining tier: 0-4
- [x] Facilities: driving range, putting green, chipping area, teaching academy, simulator, tour-level range
- [x] Services: caddie program, valet, bag storage, locker room, spa, concierge
- [x] Course features: cart type, beverage service, comfort stations (0-4), halfway house, signature markers, tournament tees

#### P3.2 Amenity Costs ✅
- [x] Define one-time costs for facilities
- [x] Define monthly costs for services
- [ ] Integrate amenity purchases with economy system (future: UI wiring)

#### P3.3 Amenity Prestige Bonuses ✅
- [x] Implement `calculateAmenityScore()` → 0-1000
- [x] Sum prestige bonuses from all amenities
- [x] Max possible: ~1000 points
- [x] Integrated into master prestige formula (20% weight)

#### P3.4 Amenity UI (future enhancement)
- [ ] Create amenity management panel
- [ ] Show available upgrades with costs
- [ ] Show current amenities and their prestige contribution
- [ ] Cost/benefit tooltips showing prestige gained per dollar

---

### Phase P4: Reputation System ✅

#### P4.1 Golfer Reviews ✅
- [x] Define `GolferReview` interface (overall rating, category ratings, would recommend/return)
- [x] Generate reviews when golfers depart based on satisfaction
- [x] Category ratings: conditions, pace, value, service, amenities
- [x] Store and aggregate reviews

#### P4.2 Reputation State ✅
- [x] Define `ReputationState` interface
- [x] Track total reviews, average rating (1-5), recent rating (30 days)
- [x] Calculate rating trend: rising/stable/falling
- [x] Track return golfer percentage

#### P4.3 Word-of-Mouth Effect ✅
- [x] Implement reputation multiplier based on golfer count
- [x] < 100 golfers/month: 0.8x (unknown course)
- [x] 100-500: 1.0x (establishing)
- [x] 500-1000: 1.1x (growing buzz)
- [x] 1000+: 1.2x (well-known)

#### P4.4 Reputation Score (20% of total) ✅
- [x] Implement `calculateReputationScore()` function
- [x] Combine: satisfaction (35%), return rate (25%), review score (20%), tournament history (10%), awards (10%)

#### P4.5 Turn-Away Animation
- [ ] Create golfer rejection visual feedback
- [ ] Show price check → head shake → walk away animation
- [ ] Display thought bubble ($$$, frown)
- [ ] Track golfers rejected per day

#### P4.6 Green Fee Advisor UI
- [ ] Display current fee vs recommended range
- [ ] Show expected rejection rate if overpriced
- [ ] Warning indicator when above recommended range
- [ ] "Optimize Price" suggestion button

#### P4.7 Turn-Away Alert
- [ ] Show popup when golfers are being rejected
- [ ] Display count of turn-aways today
- [ ] Calculate and show lost revenue estimate

---

### Phase P5: Exclusivity & Advanced Features ✅

#### P5.1 Exclusivity State ✅
- [x] Define `ExclusivityState` interface
- [x] Membership model: public, semi_private, private, exclusive
- [x] Membership cost, waitlist length, advance booking days
- [x] Dress code: none, casual, smart_casual, formal

#### P5.2 Exclusivity Score (10% of total) ✅
- [x] Implement `calculateExclusivityScore()` function
- [x] Base scores: public (0), semi-private (200), private (500), exclusive (800)
- [x] Modifiers: high membership cost (+100), long waitlist (+100), formal dress (+50)

#### P5.3 Awards System ✅
- [x] Define `Award` interface (id, name, date earned, prestige bonus)
- [x] Example awards: Best Municipal (+30), Top 100 Public (+100), PGA Tour Venue (+200), Major Championship Host (+300)
- [ ] Trigger awards based on achievements (prestige thresholds, golfer counts, etc.) - future: game logic integration
- [ ] Display earned awards in UI - future: UI work

#### P5.4 Tournament Hosting
- [ ] Define tournament types with prestige requirements - future: integration with tee time system
- [ ] Tournament preparation period (course must be pristine)
- [ ] Tournament hosting prestige bonus
- [ ] Media coverage → reputation boost

#### P5.5 Prestige Change Dynamics ✅
- [x] Implement gradual prestige change (target vs current)
- [x] Max daily increase: +5 points
- [x] Max daily decrease: -15 points (faster fall than rise)
- [ ] Handle prestige events (injuries, viral reviews, celebrity visits) - future: event system

---

### Prestige System Testing

- [x] Unit tests for `calculateCurrentConditions()`
- [x] Unit tests for `calculateStarRating()`
- [x] Unit tests for `calculateDemandMultiplier()`
- [x] Unit tests for historical excellence calculations
- [x] Unit tests for streak bonuses and recovery penalties
- [x] Unit tests for amenity score calculation
- [x] Unit tests for reputation score calculation
- [x] Unit tests for exclusivity score calculation
- [ ] Integration test: prestige affects golfer demand
- [ ] Integration test: overpricing causes visible rejections
- [ ] E2E test: improve course to reach 3-star rating
- [ ] E2E test: amenity purchase increases prestige

---

### Prestige File Reference

| New File to Create | Purpose |
|--------------------|---------|
| `src/core/prestige.ts` | Core prestige calculation logic ✅ |
| `src/core/prestige.test.ts` | Unit tests for prestige logic ✅ |
| `src/core/amenities.ts` | Amenity state and scoring ✅ |
| `src/core/amenities.test.ts` | Unit tests for amenities ✅ |
| `src/core/reputation.ts` | Reputation and review system ✅ |
| `src/core/reputation.test.ts` | Unit tests for reputation ✅ |
| `src/core/exclusivity.ts` | Exclusivity and awards system ✅ |
| `src/core/exclusivity.test.ts` | Unit tests for exclusivity ✅ |
| `src/babylon/ui/PrestigePanel.ts` | Star rating and breakdown display |
| `src/babylon/ui/AmenityPanel.ts` | Amenity management interface |
| `src/babylon/ui/GreenFeeAdvisor.ts` | Pricing recommendations |

---

## Tee Time System

> Design spec: `docs/design/TEE_TIME_SYSTEM_SPEC.md`

The Tee Time System is the primary revenue driver and scheduling backbone. Golfers must book tee times in advance, creating a structured flow the player must actively manage. The core tension is balancing revenue maximization vs reputation preservation.

### Phase T1: Core Tee Time Scheduling ✅

#### T1.1 Tee Time Data Structures ✅
- [x] Create `src/core/tee-times.ts` with core types
- [x] Define `TeeTime` interface (id, scheduledTime, groupSize, status, golfers, pricing)
- [x] Define `TeeTimeStatus` type ('available', 'reserved', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled')
- [x] Define `GolferBooking` interface (golferId, membershipStatus, fees, add-ons)
- [x] Implement `createInitialTeeTimeState()` factory function

#### T1.2 Operating Hours Configuration ✅
- [x] Define `CourseOperatingHours` interface
- [x] Implement seasonal hour adjustments (summer/winter)
- [x] Configure twilight start time
- [x] Calculate last tee time based on expected round duration

#### T1.3 Slot Generation ✅
- [x] Implement `generateDailySlots()` function
- [x] Calculate slots based on spacing configuration
- [x] Track slot availability and booking status

#### T1.4 Basic Tee Sheet UI
- [ ] Create `src/babylon/ui/TeeSheetPanel.ts`
- [ ] Display daily tee times in time-ordered list
- [ ] Show booking status icons (available, reserved, checked-in)
- [ ] Display player count and revenue per slot
- [ ] Add day navigation (previous/next day)

---

### Phase T2: Booking System

#### T2.1 Booking Window Configuration
- [ ] Define `BookingWindowConfig` interface
- [ ] Implement public vs member booking windows (7 vs 14 days)
- [ ] Configure cancellation policy (free cancel hours, late cancel penalty)
- [ ] Configure no-show policy (penalty, blacklist threshold)

#### T2.2 Reservation Demand Calculation
- [ ] Define `ReservationDemand` interface
- [ ] Implement day-of-week multipliers (weekends higher)
- [ ] Implement time-of-day multipliers (prime morning premium)
- [ ] Apply prestige multiplier from prestige system
- [ ] Apply weather multiplier
- [ ] Calculate final booking probability

#### T2.3 Booking Simulation
- [ ] Implement `simulateDailyBookings()` function
- [ ] Generate group sizes (70% foursomes, 15% threesomes, 10% twosomes, 5% singles)
- [ ] Create bookings based on demand probability
- [ ] Process cancellations and no-shows

#### T2.4 Booking Integration
- [ ] Wire booking simulation to game day loop
- [ ] Generate bookings for upcoming days during daily tick
- [ ] Track booking metrics (booking rate, cancellations, no-shows)

---

### Phase T3: Spacing & Pace

#### T3.1 Spacing Configuration
- [ ] Define `TeeTimeSpacing` type ('packed' 6min, 'tight' 8min, 'standard' 10min, 'comfortable' 12min, 'relaxed' 15min, 'exclusive' 20min)
- [ ] Define `SpacingConfiguration` interface with impact modifiers
- [ ] Implement spacing presets with revenue/reputation trade-offs

#### T3.2 Pace of Play Calculation
- [ ] Define `PaceOfPlayState` interface
- [ ] Implement `calculatePaceOfPlay()` function
- [ ] Calculate round time based on spacing, capacity, conditions, skill mix
- [ ] Calculate wait time per hole
- [ ] Identify backup locations (holes with waiting groups)

#### T3.3 Pace Rating System
- [ ] Implement pace rating tiers: 'excellent' (≤3.75h), 'good' (≤4.25h), 'acceptable' (≤4.75h), 'slow' (≤5.5h), 'terrible' (>5.5h)
- [ ] Calculate satisfaction penalty based on pace
- [ ] Track backup incidents

#### T3.4 Spacing Configuration UI
- [ ] Create spacing configuration panel
- [ ] Add slider or selector for spacing presets
- [ ] Show impact preview (max tee times, revenue potential, pace risk, reputation impact)
- [ ] Display backup probability warning

#### T3.5 Visual Feedback
- [ ] Show groups bunching on holes when backed up
- [ ] Display frustration indicators (thought bubbles with clocks)
- [ ] Show slow play warnings in UI
- [ ] Display starter queue when groups waiting

---

### Phase T4: Walk-On System

#### T4.1 Walk-On State
- [ ] Define `WalkOnState` interface (queue, policy, metrics)
- [ ] Define `WalkOnPolicy` interface (allow walk-ons, reserved slots, pricing, queue limits)
- [ ] Define `WalkOnGolfer` interface (arrival time, desired group size, wait tolerance)

#### T4.2 Walk-On Processing
- [ ] Implement `processWalkOns()` function
- [ ] Check wait tolerance and remove golfers who give up
- [ ] Record negative experience for excessive waits
- [ ] Assign walk-ons to available slots
- [ ] Apply walk-on premium/discount pricing

#### T4.3 Walk-On Queue UI
- [ ] Create walk-on queue display panel
- [ ] Show waiting golfers with wait times
- [ ] Add assign/turn away buttons
- [ ] Display next available slot and estimated wait
- [ ] Show daily walk-on metrics (served, turned away)

#### T4.4 Walk-On Visual Feedback
- [ ] Show NPCs waiting at pro shop
- [ ] Add impatience animations (checking watches, pacing)
- [ ] Show departure animations for frustrated golfers
- [ ] Track reputation hit from turn-aways

---

### Phase T5: Revenue Integration

#### T5.1 Green Fee Structure
- [ ] Define `GreenFeeStructure` interface
- [ ] Implement weekday/weekend/twilight rates
- [ ] Add prime morning premium
- [ ] Implement member/guest pricing

#### T5.2 Cart Fees
- [ ] Define `CartFeeStructure` interface
- [ ] Implement per-person vs per-cart pricing
- [ ] Add walking discount
- [ ] Integrate with cart amenity system

#### T5.3 Add-On Services
- [ ] Define `AddOnService` interface
- [ ] Implement standard add-ons: range balls, caddie, forecaddie, club rental, GPS rental
- [ ] Calculate uptake rates based on prestige
- [ ] Track add-on revenue

#### T5.4 Tips System
- [ ] Implement tip calculation based on service and satisfaction
- [ ] Apply satisfaction modifier (happy golfers tip more)
- [ ] Track tip revenue by staff category

#### T5.5 Daily Revenue Tracking
- [ ] Define `DailyRevenue` interface
- [ ] Track all revenue streams (green fees, carts, add-ons, F&B, tips)
- [ ] Calculate gross and net revenue
- [ ] Integrate with economy system

---

### Phase T6: Marketing System

#### T6.1 Campaign Definitions
- [ ] Define `MarketingCampaign` interface
- [ ] Implement campaign types: local_advertising, radio_campaign, social_media, golf_magazine, free_round_voucher, group_discount, twilight_special, tournament_hosting, celebrity_appearance
- [ ] Configure costs, durations, effects, cooldowns

#### T6.2 Campaign Activation
- [ ] Create marketing dashboard UI
- [ ] Show active campaigns with progress
- [ ] List available campaigns with costs and expected impact
- [ ] Add start/stop campaign controls

#### T6.3 Campaign Effects
- [ ] Apply demand multipliers during active campaigns
- [ ] Apply price elasticity effects
- [ ] Target specific golfer audiences

#### T6.4 Campaign Effectiveness Tracking
- [ ] Define `CampaignEffectiveness` interface
- [ ] Track additional bookings vs baseline
- [ ] Calculate ROI
- [ ] Generate recommendations (highly effective, effective, marginal, ineffective)
- [ ] Show campaign history with results

---

### Phase T7: Advanced Features

#### T7.1 Dynamic Pricing
- [ ] Implement demand-based pricing
- [ ] Configure multiplier range (e.g., 0.8x to 1.3x)
- [ ] Auto-adjust prices based on booking rate

#### T7.2 Member Priority Booking
- [ ] Implement extended booking window for members
- [ ] Reserve premium slots for members
- [ ] Member-only tee time blocks

#### T7.3 Tournament Hosting
- [ ] Integrate with prestige tournament requirements
- [ ] Course closure for tournament days
- [ ] Tournament revenue calculation
- [ ] Prestige boost from hosting

#### T7.4 Group Booking Management
- [ ] Corporate outing handling
- [ ] Group discount application
- [ ] Block booking for events

---

### Tee Time System Testing

- [x] Unit tests for tee time slot generation
- [x] Unit tests for booking lifecycle (reserve, check-in, start, complete, cancel, no-show)
- [ ] Unit tests for booking demand calculation
- [ ] Unit tests for pace of play calculation
- [ ] Unit tests for walk-on processing
- [ ] Unit tests for revenue calculations
- [ ] Unit tests for campaign effectiveness
- [ ] Integration test: tee time spacing affects satisfaction
- [ ] Integration test: walk-on queue management
- [ ] E2E test: complete day of tee time bookings
- [ ] E2E test: marketing campaign ROI

---

### Tee Time File Reference

| New File to Create | Purpose |
|--------------------|---------|
| `src/core/tee-times.ts` | Core tee time scheduling logic ✅ |
| `src/core/tee-times.test.ts` | Unit tests for tee time logic ✅ |
| `src/core/walk-ons.ts` | Walk-on queue management |
| `src/core/walk-ons.test.ts` | Unit tests for walk-on logic |
| `src/core/marketing.ts` | Marketing campaign system |
| `src/core/marketing.test.ts` | Unit tests for marketing |
| `src/babylon/ui/TeeSheetPanel.ts` | Main tee sheet interface |
| `src/babylon/ui/SpacingConfigPanel.ts` | Spacing configuration UI |
| `src/babylon/ui/WalkOnQueuePanel.ts` | Walk-on queue display |
| `src/babylon/ui/MarketingDashboard.ts` | Campaign management UI |
| `src/babylon/ui/PaceOfPlayAlert.ts` | Pace warning notifications |

---

## File Reference

| New File to Create | Purpose |
|--------------------|---------|
| `src/babylon/ui/EconomyHUD.ts` | Cash display, income/expense |
| `src/babylon/ui/ScenarioHUD.ts` | Objective progress, time limit |
| `src/babylon/ui/EmployeePanel.ts` | Staff management interface |
| `src/babylon/ui/ResearchPanel.ts` | Tech tree interface |
| `src/babylon/ui/DaySummaryPopup.ts` | End-of-day statistics |
| `src/babylon/ui/GolferStatus.ts` | Current golfer indicators |

| Existing File to Modify | Changes Needed |
|------------------------|----------------|
| `src/babylon/BabylonMain.ts` | Add state instances, wire update loop |
| `src/babylon/ui/UIManager.ts` | Add new HUD components |
| `src/main.ts` | Pass scenario completion handler |

---

## Testing Checklist

- [ ] Unit tests for any new logic functions
- [ ] E2E test: Complete tutorial scenario
- [ ] E2E test: Fail scenario by running out of time
- [ ] E2E test: Fail scenario by going bankrupt
- [ ] E2E test: Hire and fire employees
- [ ] E2E test: Complete a research item
- [ ] E2E test: Progress persistence across sessions
