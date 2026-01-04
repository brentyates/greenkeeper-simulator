# Greenkeeper Simulator - Integration TODO

This file tracks the work needed to integrate all economy/management systems into a fully playable game loop.

## Deployment

**Firebase Hosting**: https://greenkeeper-96a0b.web.app

```bash
npm run build && firebase deploy --only hosting
```

## Current Status: All Core Logic Complete ✅

**What's Working:**
- Firebase Hosting: Live at https://greenkeeper-96a0b.web.app
- Economy system: Cash, transactions, loans integrated
- Employee system: Payroll, ticks, manager bonuses running
- Golfer system: Arrivals, progression, tips, satisfaction running
- Research system: Ticks, funding costs deducted
- Scenario system: Progress tracking, objective checking, win/lose detection
- Tee Time system: Slot generation, booking simulation, walk-ons, revenue tracking
- Marketing system: Campaign processing, demand multipliers
- Weather system: Dynamic weather, seasonal effects, grass moisture impact, UI display
- Day transition: Daily expenses, prestige snapshots, all counter resets
- UI: Economy panel (cash + golfers), Scenario progress panel with bar, Weather display

**Prestige System** ✅ COMPLETE (See [Prestige System](#prestige-system) section)
- ~~Phase P1: Core prestige score and star rating~~ ✅
- ~~Phase P2: Historical tracking and streaks~~ ✅
- ~~Phase P3: Amenities system~~ ✅
- ~~Phase P4: Reputation and reviews~~ ✅ (core logic complete, UI pending)
- ~~Phase P5: Exclusivity and advanced features~~ ✅ (core logic complete, UI pending)

**Tee Time System** ✅ COMPLETE (See [Tee Time System](#tee-time-system) section)
- ~~Phase T1: Core Tee Time Scheduling~~ ✅ (core logic complete, UI pending)
- ~~Phase T2: Booking System~~ ✅ (core logic complete, UI pending)
- ~~Phase T3: Spacing & Pace~~ ✅ (core logic complete, UI pending)
- ~~Phase T4: Walk-On System~~ ✅ (core logic complete, UI pending)
- ~~Phase T5: Revenue Integration~~ ✅ (core logic complete, UI pending)
- ~~Phase T6: Marketing System~~ ✅ (core logic complete, UI pending)
- ~~Phase T7: Advanced Features~~ ✅ (core logic complete, UI pending)

**UI Integration Complete:**
- [x] Employee management UI (EmployeePanel.ts)
- [x] Research UI (ResearchPanel.ts)
- [x] Day summary popup (DaySummaryPopup.ts)
- [x] Tee sheet panel (TeeSheetPanel.ts)
- [x] Marketing dashboard (MarketingDashboard.ts)
- [x] Management tabs in pause menu

**Remaining (Nice-to-Have):**
- [x] Golfer satisfaction display (in economy panel)
- [x] Keyboard shortcuts for panels (G=TeeSheet, K=Marketing, H=Employees, Y=Research, B=Equipment Store, U=Amenities, O=Walk-On Queue)
- [x] Save/load game state (auto-save at end of each day)

---

## Overview

The core logic modules are complete and tested. This TODO covers wiring them into `BabylonMain` and creating the UI layers.

### Core Logic Summary (1668 tests passing)

| Module | File | Tests | Description |
|--------|------|-------|-------------|
| Prestige | `prestige.ts` | 75 | Star rating, conditions, green fee tolerance |
| Weather | `weather.ts` | 45 | Dynamic weather, seasons, forecasting |
| Autonomous | `autonomous-equipment.ts` | 32 | Robot mowers, sprayers, spreaders |
| Amenities | `amenities.ts` | 49 | Clubhouse, facilities, services scoring |
| Reputation | `reputation.ts` | 34 | Reviews, word-of-mouth, satisfaction |
| Exclusivity | `exclusivity.ts` | 41 | Membership, awards, dress code |
| Tee Times | `tee-times.ts` | 118 | Scheduling, booking, pace of play |
| Walk-Ons | `walk-ons.ts` | 30 | Queue management, wait tolerance |
| Revenue | `tee-revenue.ts` | 50 | Green fees, cart fees, add-ons, tips |
| Marketing | `marketing.ts` | 50 | Campaigns, ROI, demand effects |
| Advanced | `advanced-tee-time.ts` | 55 | Dynamic pricing, tournaments, groups |

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
- [x] Deduct cost when refilling equipment
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
- [x] Display average satisfaction rating (in economy panel with color coding)
- [x] Show workers as colored dots on minimap (color indicates task)
- [ ] Show golfers as small markers on minimap (optional)
- [x] Add notification when golfers arrive/depart - shows count and revenue/tips

### 4.4 Course Rating Updates
- [x] Calculate course condition from grass health
- [x] Update `golferPool.rating.condition` based on grass stats
- [x] Link course rating to golfer arrival rates

---

## Phase 5: Employee System

### 5.1 Create EmployeePanel Component ✅
- [x] Create `src/babylon/ui/EmployeePanel.ts`
- [x] List current employees with name, role, skill level
- [x] Show employee status (working, on break, idle)
- [x] Display hourly wage and total payroll cost
- [x] Add hire/fire buttons

### 5.2 Hiring Interface ✅
- [x] Show hiring pool of available candidates
- [x] Display candidate stats (skills, wage)
- [x] Confirm hire with cost warning
- [x] Refresh hiring pool periodically

### 5.3 Employee Simulation
- [x] Call `tickEmployees()` in update loop
- [x] Process automatic breaks (handled by core logic)
- [x] Call `processPayroll()` each game hour
- [x] Deduct wages from economy
- [x] Apply manager bonus to golfer experience

### 5.4 Employee Visual Representation ✅

Employees should be visible on the course while working. This creates a living, dynamic environment.

#### Sprite System
- [x] Create EmployeeVisualSystem in src/babylon/systems/
- [x] Sync visual position with employee grid position
- [x] Show work equipment (mower, rake, tools) when actively working
- [x] Different body colors based on current task
- [ ] Load employee sprite assets (groundskeeper, irrigator, mechanic, etc.) - using 3D meshes instead
- [ ] Implement sprite animation state machine (idle, walking, working, on_break)

#### Visual Feedback (Future)
- [ ] Show speech bubbles for employee alerts (tired, needs supplies)
- [ ] Display work trail showing recently maintained areas
- [ ] Indicate fatigue through slower movement animation
- [ ] Show break location icons when employees on break

#### Architecture Refactoring ✅
- [x] Unify player and employee into shared MovableEntity base type (src/core/movable-entity.ts)
- [x] Common fields: gridX, gridY, path, moveProgress, efficiency
- [x] Player-specific: pendingDirection, equipmentSlot, equipmentActive (PlayerEntity)
- [x] Employee-specific: currentTask, targetX/Y, workProgress, assignedAreaId (EmployeeEntity)
- [x] Golfer-specific: currentHole, satisfaction, isWalking (GolferEntity)
- [x] Benefits: shared movement types, consistent interpolation, type guards for entity discrimination
- [x] Fixed employees racing to same work areas via claimedTargets tracking
- [x] Fixed visual timing: both player and employees use 150ms real-time interpolation
- [x] Fixed MOVE_SPEED: changed from 12 to 3 tiles/min per spec

#### Visual System Unification (Future)
- [ ] Create shared EntityVisualSystem for rendering any MovableEntity
- [ ] Move player mesh creation from BabylonMain to shared system
- [ ] Unify equipment rendering between player and employees
- [ ] Add camera following as a flag on the rendered entity

### 5.5 Employee Autonomous Work Behavior

Employees work independently based on their role and assigned area.

#### Core Work System
- [x] Create employee-work.ts with autonomous work logic
- [x] Implement task prioritization (critical overgrowth > mowing > watering > fertilizing)
- [x] Add pathfinding for employee movement to work targets
- [x] Execute work actions that modify grass state (mowing effect, watering effect)
- [x] Handle resource consumption (supply costs per task: mow=$0.25, water=$0.10, fertilize=$0.50)

#### Groundskeeper Work Priorities
- [x] Find and mow grass with height > 60
- [x] Water dry areas with moisture < 40
- [x] Fertilize depleted areas with nutrients < 30
- [x] Rake bunkers periodically
- [x] Patrol assigned area when no urgent tasks

#### Area Assignment
- [x] Define course areas (Front 9, Back 9, Greens, Bunkers, Practice Area)
- [x] Allow assigning employees to specific areas
- [x] Employees only work within their assigned area
- [x] Unassigned employees cover entire course

#### Work Execution
- [x] Track work progress per tile (0-100%)
- [x] Apply grass effects when work completes
- [x] Award experience points for completed work
- [x] Handle interrupted work (employee goes on break mid-task)

#### Integration
- [x] Connect employee work to grass simulation
- [x] Deduct maintenance supplies from economy
- [x] Update employee fatigue during work (handled by tickEmployees)
- [x] Show employee work in daily summary

---

## Phase 6: Research System

### 6.1 Create ResearchPanel Component ✅
- [x] Create `src/babylon/ui/ResearchPanel.ts`
- [x] Display tech tree by category
- [x] Show locked/available/completed status for each item
- [x] Display current research progress bar
- [x] Show research queue

### 6.2 Funding Controls ✅
- [x] Add funding level selector (none/minimum/normal/maximum)
- [x] Display cost per minute at current funding level
- [x] Show estimated time to completion

### 6.3 Research Simulation
- [x] Call `tickResearch()` in update loop
- [x] Deduct research funding cost from economy
- [x] Notify when research completes (with detailed unlock description)
- [x] Show what was unlocked (equipment, fertilizer, upgrade bonus, feature)

### 6.4 Apply Research Unlocks
- [x] Make unlocked equipment purchasable (EquipmentStorePanel.ts, keyboard shortcut: B)
- [x] Apply fertilizer effectiveness bonus from research
- [x] Add helper functions for research bonuses (getBestFertilizerEffectiveness, getEquipmentEfficiencyBonus)
- [x] Apply employee training bonus from research (reduces fatigue, boosts experience)
- [x] Enable autonomous robot equipment when unlocked (autonomous-equipment.ts, 32 tests)
- [x] Show fleet AI benefits if researched (40% breakdown rate reduction)

---

## Phase 7: Day/Night Cycle Integration

### 7.1 Day Transition Events
- [x] Trigger end-of-day summary at midnight (or configurable hour) - runs at 10 PM
- [x] Process daily expenses (utilities, base maintenance)
- [x] Reset daily golfer counters (prestige, tee times, walk-ons, golfers)
- [x] Check scenario day-based objectives (timeLimitDays in scenarios, checkTimeLimitFailed in ScenarioManager)

### 7.2 Day Summary Popup ✅
- [x] Create `src/babylon/ui/DaySummaryPopup.ts`
- [x] Show revenue breakdown (green fees, tips)
- [x] Show expense breakdown (wages, supplies, research)
- [x] Display net profit/loss for the day
- [x] Show course health change
- [x] Show golfer statistics (count, satisfaction, return rate)

### 7.3 Time-Based Events
- [x] Peak golfer hours (7-10am, 1-4pm) - arrival rates vary by hour
- [x] Twilight pricing after 4pm - integrated in green fee calculation
- [ ] Employee shift scheduling (future feature)

---

## Phase 8: Pause Menu Enhancements

### 8.1 Add Management Tabs to Pause Menu ✅
- [x] Add "Employees" tab linking to EmployeePanel
- [x] Add "Research" tab linking to ResearchPanel
- [x] Add "Tee Sheet" tab linking to TeeSheetPanel
- [x] Add "Marketing" tab linking to MarketingDashboard

### 8.2 Game Speed Controls
- [x] Pause should fully stop all simulation
- [x] Allow speed changes from pause menu (slow/fast buttons with display)
- [x] Add fast-forward (4x, 8x) for longer scenarios - speeds: 0.5x, 1x, 2x, 4x, 8x

---

## Phase 9: Save/Load System ✅

### 9.1 Extend GameState
- [x] Add economy state to saved game
- [x] Add employee roster to saved game
- [x] Add golfer pool state to saved game
- [x] Add research state to saved game
- [x] Add scenario progress to saved game
- [x] Add prestige, tee time, walk-on, revenue, marketing states
- [x] Add autonomous equipment state to saved game
- [x] Add course cells (grass health, terrain)

### 9.2 Auto-Save
- [x] Save progress at end of each game day
- [x] Save when returning to menu
- [x] Load saved state when continuing scenario (via `loadFromSave` option)
- [x] Launch screen shows save indicator (💾) on scenarios with saves
- [x] "Continue" button appears for scenarios with saved games

---

## Phase 10: Polish & Balance

### 10.1 Tutorial Scenario Guidance ✅
- [x] Add tooltips explaining each system (contextual hints in tutorial_basics scenario)
- [ ] Highlight UI elements for first-time actions (future enhancement)
- [x] Ensure tutorial scenario is completable with basic actions (verified: $600-850/day profit possible)

### 10.2 Balance Tuning ✅
- [x] Adjust green fee defaults for each course size (verified: $45/$65/$30 weekday/weekend/twilight)
- [x] Balance employee wages vs golfer revenue (verified: ~$2.5k/day profit margin)
- [x] Tune research costs and times (fixed: reduced from $50-400 to $1-8/game-minute)
- [x] Fix research funding bug - only charge when active research exists (was draining $4k+/day)
- [x] All 10 scenarios mathematically verified (48-70 golfers/day base, profit margins positive)

### 10.3 Visual Feedback
- [ ] Show golfer sprites on course (optional)
- [ ] Employee sprites at work stations (see Phase 5.4 for details)
- [ ] Equipment upgrade visual changes
- [x] Weather effects on grass simulation (rain adds moisture, heat increases loss)

### 10.4 Equipment-Based Overlay Modes
- [x] Auto-switch to relevant overlay when equipment selected (mower → height, sprinkler → moisture, spreader → nutrients)
- [x] Show color-coded need levels when equipment is active (green=OK, yellow=needs attention, red=critical) - uses existing overlay colors
- [x] Allow manual override to keep specific overlay while using equipment (Tab cycles overlay, clears auto-switch)
- [x] Restore normal view when equipment is turned off (if auto-switched)
- [x] Display legend for current overlay colors
- [ ] Add quick-action from overlay (click tile to target equipment at that location)

### 10.5 UI Polish
- [x] Main menu should use full screen without scrollbars (refactored LaunchScreen to use Grid layout)
- [ ] Ensure responsive layout for different screen sizes

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
- [x] Integrate amenity purchases with economy system (AmenityPanel.ts)

#### P3.3 Amenity Prestige Bonuses ✅
- [x] Implement `calculateAmenityScore()` → 0-1000
- [x] Sum prestige bonuses from all amenities
- [x] Max possible: ~1000 points
- [x] Integrated into master prestige formula (20% weight)

#### P3.4 Amenity UI ✅
- [x] Create amenity management panel (`src/babylon/ui/AmenityPanel.ts`)
- [x] Show available upgrades with costs
- [x] Show current amenities and their prestige contribution
- [ ] Cost/benefit tooltips showing prestige gained per dollar (future enhancement)

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
- [x] Track golfers rejected per day (prestigeState.golfersRejectedToday)

#### P4.6 Green Fee Advisor UI ✅
- [x] Display current fee vs recommended range (shown in prestige panel warning)
- [x] Show expected rejection rate if overpriced (in prestige panel)
- [x] Warning indicator when above recommended range (orange/red indicator)
- [x] Price adjustment controls (+/- buttons in prestige panel)

#### P4.7 Turn-Away Alert ✅
- [x] Show popup when golfers are being rejected (warning notification with orange color)
- [x] Display count of turn-aways today (tracked in prestigeState.golfersRejectedToday)
- [x] Calculate and show lost revenue estimate (tracked in prestigeState.revenueLostToday)

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
- [x] Integration test: prestige affects golfer demand (src/core/integration.test.ts)
- [x] Integration test: overpricing causes visible rejections (src/core/integration.test.ts)
- [x] E2E test: improve course to reach 3-star rating (tests/prestige-tests.spec.ts)
- [x] E2E test: amenity purchase increases prestige (tests/prestige-tests.spec.ts)

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
| `src/babylon/ui/AmenityPanel.ts` | Amenity management interface ✅ |
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

#### T1.4 Basic Tee Sheet UI ✅
- [x] Create `src/babylon/ui/TeeSheetPanel.ts`
- [x] Display daily tee times in time-ordered list
- [x] Show booking status icons (available, reserved, checked-in)
- [x] Display player count and revenue per slot
- [x] Add day navigation (previous/next day)

---

### Phase T2: Booking System ✅

#### T2.1 Booking Window Configuration ✅
- [x] Define `BookingWindowConfig` interface
- [x] Implement public vs member booking windows (7 vs 14 days)
- [x] Configure cancellation policy (free cancel hours, late cancel penalty)
- [x] Configure no-show policy (penalty, blacklist threshold)

#### T2.2 Reservation Demand Calculation ✅
- [x] Define `ReservationDemand` interface
- [x] Implement day-of-week multipliers (weekends higher)
- [x] Implement time-of-day multipliers (prime morning premium)
- [x] Apply prestige multiplier from prestige system
- [x] Apply weather multiplier
- [x] Calculate final booking probability

#### T2.3 Booking Simulation ✅
- [x] Implement `simulateDailyBookings()` function
- [x] Generate group sizes (70% foursomes, 15% threesomes, 10% twosomes, 5% singles)
- [x] Create bookings based on demand probability
- [x] Process cancellations and no-shows

#### T2.4 Booking Integration
- [x] Wire booking simulation to game day loop
- [x] Generate bookings for upcoming days during daily tick
- [x] Track booking metrics (booking rate, cancellations, no-shows)

---

### Phase T3: Spacing & Pace ✅

#### T3.1 Spacing Configuration ✅
- [x] Define `TeeTimeSpacing` type ('packed' 6min, 'tight' 8min, 'standard' 10min, 'comfortable' 12min, 'relaxed' 15min, 'exclusive' 20min)
- [x] Define `SpacingConfiguration` interface with impact modifiers
- [x] Implement spacing presets with revenue/reputation trade-offs

#### T3.2 Pace of Play Calculation ✅
- [x] Define `PaceOfPlayState` interface
- [x] Implement `calculatePaceOfPlay()` function
- [x] Calculate round time based on spacing, capacity, conditions, skill mix
- [x] Calculate wait time per hole
- [x] Identify backup locations (holes with waiting groups)

#### T3.3 Pace Rating System ✅
- [x] Implement pace rating tiers: 'excellent' (≤3.75h), 'good' (≤4.25h), 'acceptable' (≤4.75h), 'slow' (≤5.5h), 'terrible' (>5.5h)
- [x] Calculate satisfaction penalty based on pace
- [x] Track backup incidents

#### T3.4 Spacing Configuration UI ✅
- [x] Create spacing configuration panel (integrated into TeeSheetPanel)
- [x] Add slider or selector for spacing presets (6 options: packed to exclusive)
- [x] Show impact preview (max tee times, revenue potential, pace risk, reputation impact)
- [ ] Display backup probability warning (future)

#### T3.5 Visual Feedback
- [ ] Show groups bunching on holes when backed up
- [ ] Display frustration indicators (thought bubbles with clocks)
- [ ] Show slow play warnings in UI
- [ ] Display starter queue when groups waiting

---

### Phase T4: Walk-On System ✅

#### T4.1 Walk-On State ✅
- [x] Define `WalkOnState` interface (queue, policy, metrics)
- [x] Define `WalkOnPolicy` interface (allow walk-ons, reserved slots, pricing, queue limits)
- [x] Define `WalkOnGolfer` interface (arrival time, desired group size, wait tolerance)

#### T4.2 Walk-On Processing ✅
- [x] Implement `processWalkOns()` function
- [x] Check wait tolerance and remove golfers who give up
- [x] Record negative experience for excessive waits
- [x] Assign walk-ons to available slots
- [x] Apply walk-on premium/discount pricing

#### T4.3 Walk-On Queue UI ✅
- [x] Create walk-on queue display panel (WalkOnQueuePanel.ts, keyboard: O)
- [x] Show waiting golfers with wait times (color-coded by urgency)
- [x] Add assign/turn away buttons
- [ ] Display next available slot and estimated wait (future)
- [x] Show daily walk-on metrics (served, turned away, gave up)

#### T4.4 Walk-On Visual Feedback
- [ ] Show NPCs waiting at pro shop
- [ ] Add impatience animations (checking watches, pacing)
- [ ] Show departure animations for frustrated golfers
- [x] Track reputation hit from turn-aways (src/core/reputation.ts - trackTurnAway, resetMonthlyTurnAways)

---

### Phase T5: Revenue Integration ✅

#### T5.1 Green Fee Structure ✅
- [x] Define `GreenFeeStructure` interface
- [x] Implement weekday/weekend/twilight rates
- [x] Add prime morning premium
- [x] Implement member/guest pricing
- [x] Add dynamic pricing with demand multiplier

#### T5.2 Cart Fees ✅
- [x] Define `CartFeeStructure` interface
- [x] Implement per-person vs per-cart pricing
- [x] Add walking discount
- [x] Premium cart option
- [ ] Integrate with cart amenity system (future: UI wiring)

#### T5.3 Add-On Services ✅
- [x] Define `AddOnService` interface
- [x] Implement standard add-ons: range balls, caddie, forecaddie, club rental, GPS rental
- [x] Calculate uptake rates based on prestige
- [x] Track add-on revenue
- [x] Phase-specific offerings (booking, check-in, during round)

#### T5.4 Tips System ✅
- [x] Implement tip calculation based on service and satisfaction
- [x] Apply satisfaction modifier (happy golfers tip more)
- [x] House percentage for tip pooling
- [ ] Track tip revenue by staff category (future: staff integration)

#### T5.5 Daily Revenue Tracking ✅
- [x] Define `DailyRevenue` interface
- [x] Track all revenue streams (green fees, carts, add-ons, F&B, tips, range, lessons, events)
- [x] Calculate gross and net revenue
- [x] Revenue history and averages
- [ ] Integrate with economy system (future: UI wiring)

---

### Phase T6: Marketing System ✅

#### T6.1 Campaign Definitions ✅
- [x] Define `MarketingCampaign` interface
- [x] Implement campaign types: local_advertising, radio_campaign, social_media, golf_magazine, free_round_voucher, group_discount, twilight_special, tournament_hosting, celebrity_appearance
- [x] Configure costs, durations, effects, cooldowns
- [x] Define `GolferTargetType` for audience targeting

#### T6.2 Campaign Activation ✅
- [x] Implement `canStartCampaign()` validation
- [x] Implement `startCampaign()` with duration clamping
- [x] Implement `stopCampaign()` early termination
- [x] Track cooldowns between campaigns
- [x] Create marketing dashboard UI `src/babylon/ui/MarketingDashboard.ts`

#### T6.3 Campaign Effects ✅
- [x] Calculate combined demand multipliers
- [x] Calculate combined price elasticity effects
- [x] Track targeted golfer audiences
- [x] Support twilight-only campaigns
- [x] Support event campaigns (tournament, celebrity)

#### T6.4 Campaign Effectiveness Tracking ✅
- [x] Define `CampaignEffectiveness` interface
- [x] Track additional bookings vs baseline
- [x] Calculate ROI
- [x] Generate recommendations (highly effective, effective, marginal, ineffective)
- [x] Calculate prestige impact per campaign type
- [x] Track aggregate marketing metrics

---

### Phase T7: Advanced Features ✅

#### T7.1 Dynamic Pricing ✅
- [x] Implement demand-based pricing
- [x] Configure multiplier range (e.g., 0.8x to 1.3x)
- [x] Auto-adjust prices based on booking rate
- [x] Clamp multipliers to configured bounds

#### T7.2 Member Priority Booking ✅
- [x] Implement extended booking window for members (14 days vs 7 days)
- [x] Reserve premium slots for members
- [x] Track premium slot hours (7-10 AM)
- [x] Member-only slot reservation logic

#### T7.3 Tournament Hosting ✅
- [x] Define tournament types (club_championship, member_guest, charity_event, corporate_outing, pro_am, qualifier)
- [x] Course closure for tournament days (full or partial)
- [x] Tournament revenue calculation (entry fee × participants)
- [x] Prestige boost calculation based on participation
- [x] Schedule/cancel tournament management

#### T7.4 Group Booking Management ✅
- [x] Corporate outing handling
- [x] Group discount application (15% for 8+ golfers)
- [x] Deposit requirement tracking
- [x] Group booking lifecycle (inquiry → confirmed → deposit_paid → checked_in → completed)
- [x] Calculate slots needed for group size

---

### Tee Time System Testing

- [x] Unit tests for tee time slot generation
- [x] Unit tests for booking lifecycle (reserve, check-in, start, complete, cancel, no-show)
- [x] Unit tests for booking demand calculation
- [x] Unit tests for booking simulation
- [x] Unit tests for cancellation/no-show penalties
- [x] Unit tests for pace of play calculation
- [x] Unit tests for spacing impact preview
- [x] Unit tests for walk-on processing
- [x] Unit tests for revenue calculations
- [x] Unit tests for campaign effectiveness
- [x] Integration test: tee time spacing affects satisfaction (src/core/integration.test.ts)
- [x] Integration test: walk-on queue management (src/core/integration.test.ts)
- [x] E2E test: complete day of tee time bookings (tests/tee-time-tests.spec.ts)
- [x] E2E test: marketing campaign ROI (tests/marketing-tests.spec.ts)

---

### Tee Time File Reference

| New File to Create | Purpose |
|--------------------|---------|
| `src/core/tee-times.ts` | Core tee time scheduling logic ✅ |
| `src/core/tee-times.test.ts` | Unit tests for tee time logic ✅ |
| `src/core/walk-ons.ts` | Walk-on queue management ✅ |
| `src/core/walk-ons.test.ts` | Unit tests for walk-on logic ✅ |
| `src/core/tee-revenue.ts` | Revenue integration (fees, add-ons, tips) ✅ |
| `src/core/tee-revenue.test.ts` | Unit tests for revenue logic ✅ |
| `src/core/marketing.ts` | Marketing campaign system ✅ |
| `src/core/marketing.test.ts` | Unit tests for marketing ✅ |
| `src/core/advanced-tee-time.ts` | Dynamic pricing, member priority, tournaments, groups ✅ |
| `src/core/advanced-tee-time.test.ts` | Unit tests for advanced features ✅ |
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

- [x] Unit tests for any new logic functions (src/core/integration.test.ts - 15 tests)
- [x] E2E test: Scenario loading from URL (tests/scenario-tests.spec.ts)
- [x] E2E test: Scenario fail by running out of time (tests/scenario-tests.spec.ts)
- [x] E2E test: Scenario fail by going bankrupt (tests/scenario-tests.spec.ts)
- [x] E2E test: Management panels open with keyboard shortcuts (tests/management-panels.spec.ts)
- [x] E2E test: Employee panel functionality (tests/employee-management.spec.ts)
- [x] E2E test: Research panel functionality (tests/research-system.spec.ts)
- [x] E2E test: Progress persistence across sessions (tests/scenario-tests.spec.ts)
