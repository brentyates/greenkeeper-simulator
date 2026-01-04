# Greenkeeper Simulator - Mobile & Accessibility Features

## Overview

Greenkeeper Simulator is now fully accessible via keyboard, mouse, and touch input. All menus and UI elements can be navigated and activated using any input method.

## Keyboard Navigation

### Launch Screen (Main Menu)
- **Arrow Keys / Tab**: Navigate through scenario cards and buttons
- **Enter / Space**: Select highlighted scenario or activate button
- **Escape**: (Future: return to previous screen)

### Pause Menu
- **Tab / Arrow Keys**: Navigate through menu options
- **Shift + Tab**: Navigate backwards
- **Enter / Space**: Activate highlighted button
- **P / Escape**: Close pause menu and resume game

### Game Controls
All existing keyboard controls remain unchanged:
- **WASD / Arrow Keys**: Move player
- **1, 2, 3**: Select equipment
- **Space**: Toggle equipment on/off
- **E**: Refill at station
- **Tab**: Cycle overlay modes
- **P / Escape**: Pause game
- **M**: Mute audio
- **+/-**: Speed up/slow down time
- **[/]**: Zoom out/in
- **T**: Toggle terrain editor
- **H**: Employee panel
- **Y**: Research panel
- **G**: Tee sheet panel
- **K**: Marketing panel
- **B**: Equipment store
- **U**: Amenities panel

## Mouse Controls

All menus and buttons support mouse interaction:
- **Click**: Select/activate elements
- **Hover**: Visual feedback on interactive elements
- **Scroll**: Navigate through scrollable lists
- **Mouse Wheel**: Zoom in/out

## Touch Controls

### Basic Touch Gestures
- **Tap**: Click/select elements
- **Swipe**: Move player (directional swipes)
- **Pinch**: Zoom in/out
- **Touch & Drag**: Pan camera or drag elements

### Touch Gestures Details
- **Single Tap**: Equivalent to mouse click - activates buttons, selects items
- **Swipe to Move**: Swipe in any direction to move the player character
  - Swipe threshold: 50 pixels
  - Supports 4 directions: up, down, left, right
- **Pinch Zoom**: Use two fingers to zoom in/out
  - Pinch outward: Zoom in
  - Pinch inward: Zoom out
- **Touch & Hold + Drag**: Pan the camera or drag UI elements

## Visual Feedback

### Focus Indicators
- **White Border**: Indicates keyboard-focused element
- **Highlight on Hover**: Mouse hover shows visual feedback
- **Button States**: Buttons change color when hovered, focused, or pressed

### Button States
- **Normal**: Default green background (#2a5a3a)
- **Hover/Focus**: Lighter green background (#3a8a5a)
- **Disabled**: Semi-transparent (50% opacity)

## Accessibility Features

### Screen Reader Support (Future Enhancement)
The foundation for screen reader support is in place with:
- Semantic structure in UI components
- Clear labels on all interactive elements
- Logical navigation order

### Keyboard-Only Operation
- Every interactive element is reachable via keyboard
- Tab order follows visual layout
- Arrow keys for list/grid navigation
- Enter/Space for activation

### Touch-Friendly Design
- Minimum button size: 45px height (following accessibility guidelines)
- Adequate spacing between interactive elements
- No reliance on hover states for critical functionality
- Touch gestures have reasonable thresholds (50px for swipes)

## Technical Implementation

### New Components

#### FocusManager (`src/babylon/ui/FocusManager.ts`)
Centralized keyboard navigation system that:
- Tracks focusable elements
- Manages focus groups (scenarios, buttons, etc.)
- Shows visual focus indicators
- Handles Tab/Arrow key navigation
- Triggers activation on Enter/Space

#### AccessibleButton (`src/babylon/ui/AccessibleButton.ts`)
Enhanced button component with:
- Keyboard support (Enter/Space activation)
- Mouse support (click, hover)
- Touch support (tap)
- Visual focus indicators
- Configurable appearance

### Enhanced Components

#### InputManager (`src/babylon/engine/InputManager.ts`)
Extended with:
- Touch event handling (touchstart, touchmove, touchend, touchcancel)
- Swipe gesture recognition
- Pinch-to-zoom gesture recognition
- Tap detection with timing threshold

#### LaunchScreen (`src/babylon/ui/LaunchScreen.ts`)
Updated with:
- Keyboard navigation for scenario selection
- Accessible buttons (Continue, New Game, Quick Play)
- Focus management integration

#### UIManager (`src/babylon/ui/UIManager.ts`)
Updated with:
- Keyboard navigation for pause menu
- Accessible menu buttons
- Focus management for all menu actions

## Best Practices Followed

1. **Progressive Enhancement**: Mouse and keyboard work as before, touch adds new capability
2. **Consistent Behavior**: Same actions work across all input methods
3. **Visual Feedback**: Clear indicators for all interaction states
4. **Error Prevention**: Reasonable thresholds prevent accidental gestures
5. **Logical Tab Order**: Navigation follows visual layout
6. **No Input Method Lock-In**: Users can switch between input methods seamlessly

## Browser Compatibility

Touch events are supported on:
- Mobile browsers (iOS Safari, Chrome Mobile, Firefox Mobile)
- Desktop browsers with touch screens
- Tablets

Keyboard navigation works on:
- All modern desktop browsers
- Browsers with keyboard input support

## Future Enhancements

Potential improvements for accessibility:
- Screen reader announcements for game state changes
- Configurable gesture sensitivity
- Alternative control schemes (e.g., one-handed mode)
- High contrast mode
- Reduced motion mode
- Customizable keyboard shortcuts
