# Golf Course Levels & Scenarios System

This document explains the level progression and scenario system for Greenkeeper Simulator.

## Overview

The game features a RollerCoaster Tycoon-style progression system where players advance through increasingly challenging golf courses with different objectives. Players start with a small 3-hole course and work their way up to managing a massive 27-hole resort.

## Course Progression

### 1. Pine Valley Starter (3 holes, Par 12)
**Size:** 30×50 tiles
**Description:** A small beginner course perfect for learning the basics of greenkeeping.

### 2. Meadowbrook Nine (9 holes, Par 36)
**Size:** 60×80 tiles
**Description:** A standard 9-hole course with varied terrain and elevation changes.

### 3. Sunrise Valley - Hole 1 (18 holes, Par 72)
**Size:** 50×38 tiles
**Description:** The original single-hole demonstration course, now part of an 18-hole layout.

### 4. Royal Highlands Championship (18 holes, Par 72)
**Size:** 90×120 tiles
**Description:** A prestigious championship course with challenging water hazards and strategic bunkers.

### 5. Grand Summit Resort (27 holes, Par 108)
**Size:** 100×140 tiles
**Description:** The ultimate test - a massive resort course with dramatic elevation changes and signature holes.

## Scenario Types

### Economic Scenarios
Focus on financial performance:
- **Target Profit:** Earn a specific profit (revenue - expenses)
- **Target Revenue:** Generate total revenue amount
- **Target Cash:** Accumulate cash on hand

### Attendance Scenarios
Focus on attracting golfers:
- **Target Golfers:** Attract a certain number of total golfers
- **Target Rounds:** Host a specific number of rounds played

### Satisfaction Scenarios
Focus on course quality:
- **Target Rating:** Achieve and maintain a course rating
- **Maintain Duration:** Keep rating above target for consecutive days

### Restoration Scenarios
Focus on improving neglected courses:
- **Target Health:** Restore course health to a specific level
- **Target Condition:** Achieve "Excellent", "Good", "Fair", or "Poor" rating

### Tournament Scenarios
Focus on hosting professional events (see [Tournament System Spec](TOURNAMENT_SYSTEM_SPEC.md)):
- **Prestige Requirement:** Maintain 5-star prestige for a duration
- **Event Hosting:** Successfully host and manage the tournament
- **Course Preparation:** Meet strict condition standards during event

## Scenario Progression Path

### Level 1: Tutorial
**Scenario:** Welcome to Greenkeeping
**Course:** Pine Valley Starter (3-hole)
**Type:** Economic
**Objective:** Earn $2,000 profit
**Time Limit:** 30 days
**Starting Cash:** $5,000
**Difficulty:** Beginner

Learn basic maintenance operations on a small course with slower grass growth.

---

### Level 2: First Restoration
**Scenario:** Meadowbrook Restoration
**Course:** Meadowbrook Nine (9-hole)
**Type:** Restoration
**Objective:** Restore health to 75+ (Good condition)
**Time Limit:** 45 days
**Starting Cash:** $8,000
**Starting Health:** 35 (Poor)
**Difficulty:** Intermediate

Take a neglected 9-hole course and bring it back to life.

---

### Level 3: Building Attendance
**Scenario:** Meadowbrook Grand Opening
**Course:** Meadowbrook Nine (9-hole)
**Type:** Attendance
**Objective:** Host 100 rounds, attract 400 golfers
**Time Limit:** 60 days
**Starting Cash:** $10,000
**Difficulty:** Intermediate

Now that the course is restored, attract golfers to establish your reputation.

---

### Level 4: Championship Profits
**Scenario:** Royal Highlands Profit Challenge
**Course:** Royal Highlands Championship (18-hole)
**Type:** Economic
**Objective:** Earn $15,000 profit
**Time Limit:** 90 days
**Starting Cash:** $12,000
**Special:** 1.3× costs, 1.5× revenue
**Difficulty:** Advanced

Manage a prestigious championship course with higher costs but higher revenue potential.

---

### Level 5: Excellence Standard
**Scenario:** Royal Highlands Excellence
**Course:** Royal Highlands Championship (18-hole)
**Type:** Satisfaction
**Objective:** Maintain 85+ rating for 7 consecutive days
**Time Limit:** 60 days
**Starting Cash:** $15,000
**Difficulty:** Advanced

Prove your mastery by maintaining excellence for a full week.

---

### Level 6: Revenue Drive
**Scenario:** Sunrise Valley Revenue Drive
**Course:** Sunrise Valley (18-hole)
**Type:** Economic
**Objective:** Generate $25,000 in total revenue
**Time Limit:** 75 days
**Starting Cash:** $10,000
**Difficulty:** Advanced

Focus purely on revenue generation without profit constraints.

---

### Level 7: Tournament Preparation
**Scenario:** Sunrise Valley State Championship Bid
**Course:** Sunrise Valley (18-hole)
**Type:** Satisfaction + Tournament
**Objective:**
- Achieve and maintain 5-star prestige for 30 consecutive days
- Successfully host a State Championship tournament
**Time Limit:** 120 days
**Starting Cash:** $20,000
**Starting Prestige:** 4.0 stars
**Difficulty:** Advanced

The State Golf Association is considering your course for their championship. First, prove your excellence by maintaining 5-star prestige for a full month, then successfully host the tournament when the offer arrives.

**Tournament Details:**
- Event Duration: 3 days
- Expected Spectators: 2,000
- Required Facilities: Clubhouse Tier 3, Driving Range, Media Center
- Preparation Period: 14 days before event
- Success Criteria: Maintain 95%+ course health, no major issues during play

**Special Mechanics:**
- Regular tee times suspended during tournament
- Revenue from sponsorships, concessions, and merchandise instead
- Course inspections occur daily during preparation and event
- Potential profit: $50,000+ if successful

---

### Level 8: Ultimate Restoration
**Scenario:** Grand Summit Restoration
**Course:** Grand Summit Resort (27-hole)
**Type:** Restoration
**Objective:** Restore health to 85+ (Excellent condition)
**Time Limit:** 120 days
**Starting Cash:** $20,000
**Starting Health:** 25 (Severely neglected)
**Special:** 1.5× costs
**Difficulty:** Expert

The massive Grand Summit Resort has been severely neglected. Restore all 27 holes to excellent condition.

---

### Level 9: Sustained Excellence
**Scenario:** Grand Summit Excellence
**Course:** Grand Summit Resort (27-hole)
**Type:** Satisfaction
**Objective:** Maintain 90+ rating for 14 consecutive days
**Time Limit:** 90 days
**Starting Cash:** $25,000
**Special:** 1.4× costs
**Difficulty:** Expert

Maintain peak condition for two weeks straight on the largest course in the game.

---

### Level 10: Grand Finale
**Scenario:** Grand Summit Grand Finale
**Course:** Grand Summit Resort (27-hole)
**Type:** Economic
**Objective:** Earn $50,000 profit
**Time Limit:** 150 days
**Starting Cash:** $30,000
**Special:** 1.3× costs, 2.0× revenue
**Difficulty:** Expert

The ultimate challenge combining all skills: manage the massive resort profitably while maintaining excellence.

## Using the Scenario System

### Basic Usage

```typescript
import { ScenarioManager } from './core/scenario';
import { getScenarioById } from './data/scenarioData';
import { ALL_COURSES } from './data/courseData';

// Load a scenario
const scenarioDef = getScenarioById('tutorial_basics');
const course = ALL_COURSES[scenarioDef.courseId];

// Create scenario manager
const scenario = new ScenarioManager(
  scenarioDef.objective,
  scenarioDef.conditions
);

// During gameplay, update progress
scenario.addRevenue(150);  // Golfer paid green fee
scenario.addExpense(50);   // Equipment refill cost
scenario.incrementDay();   // Day ended

// Check if objective is met
const result = scenario.checkObjective();
if (result.completed) {
  console.log('Scenario complete!', result.message);
}
if (result.failed) {
  console.log('Scenario failed!', result.message);
}

// Get current progress
const progress = scenario.getProgress();
console.log(`Cash: $${progress.currentCash}`);
console.log(`Health: ${progress.currentHealth}`);
console.log(`Objective Progress: ${result.progress}%`);
```

### Tracking Course Health

```typescript
// Update course health from grass cell states
const cells: CellState[][] = grassSystem.getAllCells();
scenario.updateCourseHealth(cells);

// For satisfaction objectives, check rating streak
scenario.checkSatisfactionStreak(85);  // Check if above 85 rating
```

### Managing Progression

```typescript
import { getUnlockedScenarios, getNextScenario } from './data/scenarioData';

// Get scenarios player can access
const completedIds = ['tutorial_basics', 'meadowbrook_restoration'];
const unlocked = getUnlockedScenarios(completedIds);

// Get next scenario in progression
const next = getNextScenario('meadowbrook_restoration');
console.log(next?.name); // "Meadowbrook Grand Opening"
```

## Implementation Checklist

The following components are ready for integration:

- [x] Core scenario logic (`src/core/scenario.ts`)
- [x] Unit tests for scenario manager (`src/core/scenario.test.ts`)
- [x] Multiple golf course layouts (`src/data/courseData.ts`)
  - [x] 3-hole beginner course
  - [x] 9-hole intermediate course
  - [x] 18-hole championship course
  - [x] 18-hole original course
  - [x] 27-hole resort course
- [x] Scenario definitions (`src/data/scenarioData.ts`)
- [ ] UI for scenario selection screen
- [ ] UI for objective tracking during gameplay
- [ ] UI for scenario completion/failure screens
- [ ] Economic simulation (golfer revenue, expense tracking)
- [ ] Golfer attendance simulation
- [ ] Integration with BabylonMain game loop
- [ ] Save/load scenario progress
- [ ] Unlockable progression system in UI

## Next Steps

To integrate this system into the game:

1. **Add Economic System:** Track revenue and expenses in BabylonMain
   - Green fees from golfers
   - Equipment refill costs
   - Maintenance costs

2. **Add Golfer Simulation:** Simulate golfers playing rounds
   - Golfer arrival based on course health/rating
   - Round completion tracking
   - Revenue generation

3. **Integrate ScenarioManager into BabylonMain:**
   - Create scenario manager instance
   - Update progress each game day
   - Check win/lose conditions
   - Show objectives in UI

4. **Create Scenario Selection UI:**
   - Show unlocked scenarios
   - Display scenario details and objectives
   - Allow player to start scenarios

5. **Add Progress Persistence:**
   - Save completed scenarios
   - Save current scenario progress
   - Track unlocked scenarios

## Testing

All scenario logic is fully tested:

```bash
npm run test -- src/core/scenario.test.ts
```

Test coverage includes:
- Economic objectives (profit, revenue, cash)
- Attendance objectives (golfers, rounds)
- Satisfaction objectives (rating, streaks)
- Restoration objectives (health, condition)
- Time limit failures
- Cost/revenue multipliers
- Progress tracking
- Reset functionality

---

**Note:** This system is ready to use but requires UI and game integration to be fully playable. The core logic, course layouts, and scenario definitions are complete and tested.
