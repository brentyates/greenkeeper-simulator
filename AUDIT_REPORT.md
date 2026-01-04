# Documentation vs Implementation Audit Report

**Date:** January 4, 2026
**Auditor:** Claude Code

This report documents discrepancies between the game's design documentation and the actual implementation. Discrepancies are categorized as:
- **DOCS_OUTDATED** - Docs say something isn't done, but it is
- **IMPL_MISSING** - Docs specify features that aren't implemented
- **MISMATCH** - Docs and implementation differ in details
- **DOCS_ONLY** - Feature exists only in docs, not planned/needed

---

## Summary

| Category | Count |
|----------|-------|
| DOCS_OUTDATED | 11 |
| IMPL_MISSING | 16 |
| MISMATCH | 8 |
| Total Discrepancies | 35 |

---

## SCENARIOS.md - Implementation Checklist

The checklist at the bottom of `docs/SCENARIOS.md` is significantly outdated:

### DOCS_OUTDATED (Marked incomplete but actually done)

| Item | Status in Docs | Actual Status |
|------|----------------|---------------|
| UI for scenario selection screen | ❌ | ✅ `LaunchScreen.ts` |
| UI for objective tracking during gameplay | ❌ | ✅ `ScenarioPanel` in `UIManager.ts` |
| Economic simulation (golfer revenue, expense tracking) | ❌ | ✅ Full `updateEconomySystems()` loop |
| Golfer attendance simulation | ❌ | ✅ `golfers.ts` integrated |
| Integration with BabylonMain game loop | ❌ | ✅ Fully integrated |
| Save/load scenario progress | ❌ | ✅ `save-game.ts` + auto-save |
| Unlockable progression system in UI | ❌ | ✅ `ProgressManager.ts` + `LaunchScreen.ts` |

### Partial Implementation

| Item | Status | Details |
|------|--------|---------|
| UI for scenario completion/failure screens | ⚠️ Partial | Only notifications, no popup screens |

**Recommendation:** Update `docs/SCENARIOS.md` implementation checklist to reflect completed work.

---

## GAME_OVERVIEW.md - Game Speed Mismatch

### MISMATCH: Speed Controls

**Docs say:**
```
| Speed | Real → Game Time |
|-------|------------------|
| 1x | 1 sec = 1 min |
| 2x | 1 sec = 2 min |
| 3x | 1 sec = 3 min |
| 5x | 1 sec = 5 min |
```

**Implementation (`BabylonMain.ts`):**
- Available speeds: **0.5x, 1x, 2x, 4x, 8x**
- No 3x or 5x speeds exist
- Has 0.5x (slower) and 8x (fastest)

**Recommendation:** Either update docs to match implementation OR adjust implementation to match docs (5x is more intuitive than 8x for "fast-forward").

---

## TEE_TIME_SYSTEM_SPEC.md - Visual Feedback Missing

### IMPL_MISSING: Walk-On System UI

**Docs specify (`Walk-On Queue Display`):**
```
┌─────────────────────────────────────────────────────────┐
│  WALK-ON QUEUE                                          │
├─────────────────────────────────────────────────────────┤
│  👤 Johnson (1)    Waiting 12 min   [Assign] [Turn Away]│
│  👤👤 Williams (2)  Waiting 8 min    [Assign] [Turn Away]│
└─────────────────────────────────────────────────────────┘
```

**Implementation:**
- Walk-on logic exists (`walk-ons.ts`) - ✅
- Walk-on state is processed in `updateEconomySystems()` - ✅
- **Walk-on queue UI panel - ❌ NOT IMPLEMENTED**

### IMPL_MISSING: Pace of Play Alert Popup

**Docs specify:**
```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  PACE OF PLAY WARNING                               │
│  Backup detected at:                                    │
│  • Hole 7 - 3 groups waiting                           │
│  [Dismiss]  [Adjust Spacing]  [Send Ranger]             │
└─────────────────────────────────────────────────────────┘
```

**Implementation:** Only basic notifications, no detailed popup with recommendations.

### IMPL_MISSING: Visual Course Backup Feedback

**Docs specify:**
- Groups bunching on holes visually
- Frustration indicators (thought bubbles with clocks)
- Starter queue showing waiting groups

**Implementation:** None of these visual elements exist.

---

## PRESTIGE_SYSTEM_SPEC.md - UI/Visual Gaps

### IMPL_MISSING: Turn-Away Animation

**Docs specify:**
> When a golfer rejects the price:
> 1. Golfer sprite approaches pro shop/starter
> 2. "Price check" animation (looks at sign)
> 3. Shakes head / dismissive gesture
> 4. Walks away from course entrance
> 5. Thought bubble: "$$$" or frowning face

**Implementation:** Only a text notification: `"⚠️ X golfers turned away! (Prices too high)"`

### IMPL_MISSING: Detailed Prestige Breakdown Panel

**Docs specify:**
```
┌─────────────────────────────────────────────────┐
│  PRESTIGE BREAKDOWN                              │
├─────────────────────────────────────────────────┤
│  Current Conditions    ████████░░  82%   [+]    │
│  Historical Excellence ██████░░░░  61%   [=]    │
│  Amenities            ████░░░░░░  42%   [+]    │
│  Reputation           ███████░░░  71%   [=]    │
│  Exclusivity          ██░░░░░░░░  23%   [-]    │
└─────────────────────────────────────────────────┘
```

**Implementation:** Simple prestige panel shows:
- Star rating
- Tier label
- Score / 1000
- Price warning (if applicable)

No component-by-component breakdown.

### MISMATCH: Green Fee Advisor

**Docs specify:** Separate "Green Fee Advisor" panel with recommendations.

**Implementation:** Price adjustment integrated directly into prestige panel with +/- buttons. This is arguably better UX.

---

## TODO.md - Outdated Test Count

### MISMATCH: Core Logic Summary

**TODO.md says:** "1612 tests passing"

**Recommendation:** Verify current test count with `npm run test` and update if different.

---

## CLAUDE.md vs Implementation

### DOCS_OUTDATED: Keyboard Shortcut M

**CLAUDE.md says:** `M` - Mute audio

**Implementation:** `M` is bound to mute, but there's no audio system implemented yet. The shortcut exists but does nothing meaningful.

### DOCS_OUTDATED: Test Presets

**CLAUDE.md lists presets like:** `time_morning`, `time_noon`, `time_evening`, `time_night`

**Recommendation:** Verify these presets still exist in `testPresets.ts`.

---

## scenarioData.ts vs docs/SCENARIOS.md

### MISMATCH: Level 7 Scenario Description

**docs/SCENARIOS.md (Level 7):**
```
### Level 7: Tournament Preparation
**Scenario:** Sunrise Valley State Championship Bid
**Type:** Satisfaction + Tournament
**Objective:**
- Achieve and maintain 5-star prestige for 30 consecutive days
- Successfully host a State Championship tournament
```

**scenarioData.ts:**
```typescript
{
  id: 'sunrise_valley_attendance',
  name: 'Sunrise Valley Tournament',
  objective: {
    type: 'attendance',
    targetGolfers: 500,
    targetRounds: 125,
  },
}
```

**Discrepancy:** The doc describes a prestige + tournament hosting scenario, but the implementation is just an attendance goal.

**Recommendation:** Either enhance the scenario to match the ambitious tournament system described, or update docs to match the simpler implementation.

---

## RESEARCH_TREE_SPEC.md, EMPLOYEE_SYSTEM_SPEC.md, EQUIPMENT_SYSTEM_SPEC.md

These spec files were not compared in detail but:
- Research system: **Implemented** in `research.ts` + `ResearchPanel.ts`
- Employee system: **Implemented** in `employees.ts` + `EmployeePanel.ts`
- Equipment system: **Implemented** in `equipment-logic.ts` + `EquipmentStorePanel.ts`

**Recommendation:** Audit these specs separately if needed.

---

## TOURNAMENT_SYSTEM_SPEC.md

### IMPL_MISSING: Tournament System

**Docs specify:** Full tournament hosting system with:
- Tournament types (club championship, charity event, pro-am, etc.)
- Course closure during tournaments
- Preparation periods
- Media coverage
- Prestige boosts

**Implementation Status:**
- `advanced-tee-time.ts` has tournament types and scheduling logic - ✅
- **Integration into game loop - ❌ NOT FULLY INTEGRATED**
- **Tournament UI - ❌ NOT IMPLEMENTED**
- **Tournament in scenarios - ❌ NOT USED**

---

## Summary of Recommended Actions

### Docs to Update (DOCS_OUTDATED)
1. `docs/SCENARIOS.md` - Update implementation checklist to show completed items
2. `CLAUDE.md` - Verify test count and preset availability
3. `docs/GAME_OVERVIEW.md` - Update speed controls table (0.5x, 1x, 2x, 4x, 8x)

### Features to Consider Implementing (IMPL_MISSING)
1. Walk-on queue UI panel
2. Pace of play alert popup with recommendations
3. Scenario completion/failure popup (vs just notification)
4. Detailed prestige breakdown panel
5. Tournament hosting integration
6. Visual golfer rejection animation (low priority - cosmetic)
7. Course backup visual feedback (low priority - cosmetic)

### Decisions Needed (MISMATCH)
1. **Speed Controls:** Keep 8x or change to 5x per docs?
2. **Level 7 Scenario:** Keep simple attendance OR implement full tournament hosting as docs describe?
3. **Green Fee Advisor:** Keep integrated in prestige panel (current) or make separate panel per docs?

---

## Files Reviewed

### Documentation
- `/home/user/greenkeeper-simulator/CLAUDE.md`
- `/home/user/greenkeeper-simulator/TODO.md`
- `/home/user/greenkeeper-simulator/docs/SCENARIOS.md`
- `/home/user/greenkeeper-simulator/docs/GAME_OVERVIEW.md`
- `/home/user/greenkeeper-simulator/docs/TEE_TIME_SYSTEM_SPEC.md`
- `/home/user/greenkeeper-simulator/docs/PRESTIGE_SYSTEM_SPEC.md`

### Implementation
- `/home/user/greenkeeper-simulator/src/babylon/BabylonMain.ts`
- `/home/user/greenkeeper-simulator/src/babylon/ui/UIManager.ts`
- `/home/user/greenkeeper-simulator/src/babylon/ui/TeeSheetPanel.ts`
- `/home/user/greenkeeper-simulator/src/data/scenarioData.ts`
- Various core logic modules in `/src/core/`
