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
- Phase P4: Reputation and reviews
- Phase P5: Exclusivity and advanced features

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

### Phase P4: Reputation System

#### P4.1 Golfer Reviews
- [ ] Define `GolferReview` interface (overall rating, category ratings, would recommend/return)
- [ ] Generate reviews when golfers depart based on satisfaction
- [ ] Category ratings: conditions, pace, value, service, amenities
- [ ] Store and aggregate reviews

#### P4.2 Reputation State
- [ ] Define `ReputationState` interface
- [ ] Track total reviews, average rating (1-5), recent rating (30 days)
- [ ] Calculate rating trend: rising/stable/falling
- [ ] Track return golfer percentage

#### P4.3 Word-of-Mouth Effect
- [ ] Implement reputation multiplier based on golfer count
- [ ] < 100 golfers/month: 0.8x (unknown course)
- [ ] 100-500: 1.0x (establishing)
- [ ] 500-1000: 1.1x (growing buzz)
- [ ] 1000+: 1.2x (well-known)

#### P4.4 Reputation Score (20% of total)
- [ ] Implement `calculateReputationScore()` function
- [ ] Combine: satisfaction (35%), return rate (25%), review score (20%), tournament history (10%), awards (10%)

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

### Phase P5: Exclusivity & Advanced Features

#### P5.1 Exclusivity State
- [ ] Define `ExclusivityState` interface
- [ ] Membership model: public, semi_private, private, exclusive
- [ ] Membership cost, waitlist length, advance booking days
- [ ] Dress code: none, casual, smart_casual, formal

#### P5.2 Exclusivity Score (10% of total)
- [ ] Implement `calculateExclusivityScore()` function
- [ ] Base scores: public (0), semi-private (200), private (500), exclusive (800)
- [ ] Modifiers: high membership cost (+100), long waitlist (+100), formal dress (+50)

#### P5.3 Awards System
- [ ] Define `Award` interface (id, name, date earned, prestige bonus)
- [ ] Example awards: Best Municipal (+30), Top 100 Public (+100), PGA Tour Venue (+200), Major Championship Host (+300)
- [ ] Trigger awards based on achievements (prestige thresholds, golfer counts, etc.)
- [ ] Display earned awards in UI

#### P5.4 Tournament Hosting
- [ ] Define tournament types with prestige requirements
- [ ] Tournament preparation period (course must be pristine)
- [ ] Tournament hosting prestige bonus
- [ ] Media coverage → reputation boost

#### P5.5 Prestige Change Dynamics
- [ ] Implement gradual prestige change (target vs current)
- [ ] Max daily increase: +5 points
- [ ] Max daily decrease: -15 points (faster fall than rise)
- [ ] Handle prestige events (injuries, viral reviews, celebrity visits)

---

### Prestige System Testing

- [x] Unit tests for `calculateCurrentConditions()`
- [x] Unit tests for `calculateStarRating()`
- [x] Unit tests for `calculateDemandMultiplier()`
- [x] Unit tests for historical excellence calculations
- [x] Unit tests for streak bonuses and recovery penalties
- [x] Unit tests for amenity score calculation
- [ ] Unit tests for reputation score calculation
- [ ] Integration test: prestige affects golfer demand
- [ ] Integration test: overpricing causes visible rejections
- [ ] E2E test: improve course to reach 3-star rating
- [ ] E2E test: amenity purchase increases prestige

---

### Prestige File Reference

| New File to Create | Purpose |
|--------------------|---------|
| `src/core/prestige.ts` | Core prestige calculation logic |
| `src/core/prestige.test.ts` | Unit tests for prestige logic |
| `src/core/amenities.ts` | Amenity state and scoring |
| `src/core/reputation.ts` | Reputation and review system |
| `src/babylon/ui/PrestigePanel.ts` | Star rating and breakdown display |
| `src/babylon/ui/AmenityPanel.ts` | Amenity management interface |
| `src/babylon/ui/GreenFeeAdvisor.ts` | Pricing recommendations |

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
