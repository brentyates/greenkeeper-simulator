# UI PANELS

Babylon.js GUI panels using `@babylonjs/gui`.

## STRUCTURE
```
ui/
├── UIManager.ts (1486 lines)    # HUD, overlays, panel orchestration
├── LaunchScreen.ts              # Scenario selection menu
├── EmployeePanel.ts             # Staff roster, hiring
├── ResearchPanel.ts             # Tech tree display
├── TeeSheetPanel.ts             # Booking schedule
├── MarketingDashboard.ts        # Campaigns
├── EquipmentStorePanel.ts       # Purchase equipment
├── AmenityPanel.ts              # Upgrades
├── DaySummaryPopup.ts           # End-of-day stats
├── TerrainEditorUI.ts           # Editor toolbar
├── WalkOnQueuePanel.ts          # Walk-on golfer queue
├── IrrigationToolbar.ts         # Irrigation controls
├── IrrigationInfoPanel.ts       # Pipe/sprinkler info
├── UserManual.ts                # In-game help
├── PopupUtils.ts                # Shared popup utilities
├── AccessibleButton.ts          # A11y button wrapper
└── FocusManager.ts              # Keyboard focus handling
```

## CONVENTIONS

### Panel Pattern
All panels follow same structure:
1. Create container in constructor
2. `show()` / `hide()` methods
3. `dispose()` for cleanup
4. Use `PopupUtils.createBasePopup()` for modals

### Babylon.js GUI
Uses `AdvancedDynamicTexture` for UI layer.
```typescript
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
```

### Panel Visibility
Panels managed through `UIManager`:
- `toggleEmployeePanel()`, `toggleResearchPanel()`, etc.
- Only one popup open at a time (modal behavior)

## WHERE TO LOOK

| Task | File |
|------|------|
| Add HUD element | `UIManager.ts` |
| New management panel | Copy `EmployeePanel.ts` pattern |
| Modal popup | Use `PopupUtils.createBasePopup()` |
| Keyboard shortcuts | `FocusManager.ts` |

## KEYBOARD BINDINGS
Defined in `BabylonMain.ts` `setupInputCallbacks()`:
- H: Employee panel
- Y: Research panel
- G: Tee sheet
- K: Marketing
- B: Equipment store
- U: Amenities
