import { Scene } from '@babylonjs/core/scene';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Ellipse } from '@babylonjs/gui/2D/controls/ellipse';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { Vector2WithInfo } from '@babylonjs/gui/2D/math2D';
import { UI_THEME } from './UITheme';

import { PrestigeState, getStarDisplay, TIER_LABELS } from '../../core/prestige';
import { OverlayMode } from '../../core/terrain';
import { FocusManager } from './FocusManager';
import { AccessibleButton, createAccessibleButton } from './AccessibleButton';
import { createOverlayPopup, createPopupHeader, createSectionDivider, POPUP_COLORS } from './PopupUtils';
import { uiAutomationBridge } from '../../automation/UIAutomationBridge';

export type GroundInteractionMode =
  | 'view'
  | 'inspect'
  | 'dispatch_mow'
  | 'dispatch_water'
  | 'dispatch_fertilize'
  | 'dispatch_rake';

const RIGHT_HUD_TOP = {
  time: 10,
  camera: 100,
} as const;
const RIGHT_HUD_GAP = 12;

export class UIManager {
  private advancedTexture: AdvancedDynamicTexture;
  private focusManager: FocusManager;
  private pauseMenuButtons: AccessibleButton[] = [];

  private healthBar!: Rectangle;
  private healthText!: TextBlock;
  private moistureBar!: Rectangle;
  private moistureText!: TextBlock;
  private nutrientsBar!: Rectangle;
  private nutrientsText!: TextBlock;


  private dayText!: TextBlock;
  private timeText!: TextBlock;
  private weatherText!: TextBlock;
  private weatherIcon!: TextBlock;
  private cameraPanel!: Rectangle;
  private cameraHeadingText: TextBlock | null = null;
  private cameraTiltText: TextBlock | null = null;

  private fuelBar: Rectangle | null = null;
  private fuelText: TextBlock | null = null;
  private waterBar: Rectangle | null = null;
  private waterText: TextBlock | null = null;
  private fertBar: Rectangle | null = null;
  private fertText: TextBlock | null = null;

  private scoreText!: TextBlock;
  private objectiveText!: TextBlock;
  private activityPanel!: Rectangle;
  private activityEntries: TextBlock[] = [];
  private activityMessages: Array<{ text: string; color: string }> = [];
  private scorePanel!: Rectangle;

  private cashText!: TextBlock;
  private golfersText!: TextBlock;
  private satisfactionText!: TextBlock;
  private economyPanel!: Rectangle;

  private scenarioPanel!: Rectangle;
  private scenarioTitleText!: TextBlock;
  private scenarioProgressBar!: Rectangle;
  private scenarioProgressFill!: Rectangle;
  private scenarioProgressText!: TextBlock;
  private daysRemainingText!: TextBlock;
  private buildPanel!: Rectangle;
  private buildModeText!: TextBlock;
  private buildHintText!: TextBlock;

  private prestigeStarsText!: TextBlock;
  private prestigeTierText!: TextBlock;
  private prestigeScoreText!: TextBlock;
  private prestigePriceWarning!: TextBlock;

  private operationsPanel!: Rectangle;
  private operationsCrewText!: TextBlock;
  private operationsCoverageText!: TextBlock;
  private operationsDemandText!: TextBlock;
  private operationsResearchText!: TextBlock;
  private operationsAutomationText!: TextBlock;
  private operationsIrrigationText!: TextBlock;
  private operationsPriorityText!: TextBlock;
  private inspectHoverPanel!: Rectangle;
  private inspectHoverTitle!: TextBlock;
  private inspectHoverDetail!: TextBlock;
  private inspectHoverHint!: TextBlock;

  private minimapContainer!: Rectangle;
  private minimapPlayerDot!: Ellipse;
  private minimapMapArea!: Rectangle;
  private minimapWorkerDots: Ellipse[] = [];
  private minimapRobotDots: Ellipse[] = [];
  private minimapGolferDots: Ellipse[] = [];
  private minimapWorldWidth = 1;
  private minimapWorldHeight = 1;

  private notificationContainer!: StackPanel;
  private scenarioFailureOverlay!: Rectangle;
  private scenarioFailureTitle!: TextBlock;
  private scenarioFailureBody!: TextBlock;
  private scenarioFailureRetryButton: Rectangle | null = null;
  private scenarioFailureMenuButton: Rectangle | null = null;

  private pauseOverlay!: Rectangle;
  private pauseHeaderCloseButton: Button | null = null;
  private pauseResumeButton: Rectangle | null = null;
  private pauseSaveButton: Rectangle | null = null;
  private pauseRestartButton: Rectangle | null = null;
  private pauseMenuButton: Rectangle | null = null;
  private pauseSpeedDownButton: Rectangle | null = null;
  private pauseSpeedUpButton: Rectangle | null = null;
  private speedText!: TextBlock;
  private onResume?: () => void;
  private onRestart?: () => void;
  private onMainMenu?: () => void;
  private onSave?: () => void;
  private onEmployees?: () => void;
  private onResearch?: () => void;
  private onTeeSheet?: () => void;
  private onTerrainEditor?: () => void;
  private onHoleBuilder?: () => void;
  private onAssetBuilder?: () => void;
  private onEquipmentStore?: () => void;
  private onAmenityPanel?: () => void;
  private onCourseLayout?: () => void;
  private onSpeedChange?: (delta: number) => void;
  private onPriceChange?: (delta: number) => void;
  private onMinimapNavigate?: (worldX: number, worldZ: number) => void;
  private onCameraRotate?: (delta: number) => void;
  private onCameraTilt?: (delta: number) => void;
  private onCameraReset?: () => void;
  private onCameraHeadingPreset?: (headingDegrees: number) => void;
  private onCameraTiltPreset?: (tiltDegrees: number) => void;

  private currentPriceText!: TextBlock;

  private overlayLegend!: Rectangle;
  private overlayLegendTitle!: TextBlock;
  private overlayLegendGradient!: Rectangle;
  private overlayLegendLowLabel!: TextBlock;
  private overlayLegendHighLabel!: TextBlock;
  private groundModeButtons = new Map<GroundInteractionMode, Rectangle>();
  private groundModeTexts = new Map<GroundInteractionMode, TextBlock>();
  private activeGroundMode: GroundInteractionMode = 'view';
  private onGroundModeChange?: (mode: GroundInteractionMode) => void;
  private readonly minimapPixelWidth = 152;
  private readonly minimapPixelHeight = 88;

  constructor(scene: Scene) {
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
    this.focusManager = new FocusManager(scene);

    this.createCourseStatusPanel();
    this.createGroundModeRail();
    this.createTimePanel();
    this.createCameraPanel();
    this.createEconomyPanel();
    this.createScenarioPanel();
    this.createBuildPanel();
    this.createOperationsPanel();
    this.createInspectHoverPanel();
    // Resources panel removed — no player equipment
    this.createScorePanel();
    this.createMinimap();
    this.createNotificationArea();
    this.createScenarioFailureOverlay();
    this.createPauseOverlay();
    this.createOverlayLegend();
    this.layoutRightHudPanels();
  }

  private getPanelPixelHeight(panel: Rectangle): number {
    if (typeof panel.height === 'number') {
      return panel.height;
    }
    return parseFloat(panel.height ?? '0') || 0;
  }

  private layoutRightHudPanels(): void {
    if (!this.cameraPanel || !this.economyPanel || !this.scenarioPanel || !this.buildPanel || !this.operationsPanel) {
      return;
    }

    let top = RIGHT_HUD_TOP.camera;
    const panels = [
      this.cameraPanel,
      this.economyPanel,
      this.scenarioPanel.isVisible ? this.scenarioPanel : null,
      this.buildPanel.isVisible ? this.buildPanel : null,
      this.operationsPanel,
    ];

    for (const panel of panels) {
      if (!panel) continue;
      panel.top = `${top}px`;
      top += this.getPanelPixelHeight(panel) + RIGHT_HUD_GAP;
    }
  }

  private createGroundModeRail(): void {
    const rail = new Rectangle('groundModeRail');
    rail.width = '88px';
    rail.height = '366px';
    rail.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    rail.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    rail.left = '10px';
    rail.top = '132px';
    rail.cornerRadius = UI_THEME.radii.panel;
    rail.background = UI_THEME.colors.surfaces.hudElevated;
    rail.color = UI_THEME.colors.border.default;
    rail.thickness = 2;
    rail.shadowColor = UI_THEME.colors.effects.shadow;
    rail.shadowBlur = 12;
    rail.shadowOffsetY = 4;
    this.advancedTexture.addControl(rail);

    const stack = new StackPanel('groundModeRailStack');
    stack.width = '72px';
    stack.paddingTop = '8px';
    rail.addControl(stack);

    const title = new TextBlock('groundModeRailTitle');
    title.text = 'MANAGE';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s10;
    title.fontFamily = UI_THEME.typography.fontFamily;
    title.height = '16px';
    stack.addControl(title);

    const inspectButton = new Rectangle('groundMode_inspect');
    inspectButton.width = '72px';
    inspectButton.height = '30px';
    inspectButton.cornerRadius = UI_THEME.radii.scale.r5;
    inspectButton.thickness = 2;
    inspectButton.color = UI_THEME.colors.border.info;
    inspectButton.background = UI_THEME.colors.border.info;
    inspectButton.paddingTop = '4px';
    inspectButton.isPointerBlocker = true;
    stack.addControl(inspectButton);

    const inspectText = new TextBlock('groundModeText_inspect');
    inspectText.text = 'Turf';
    inspectText.color = UI_THEME.colors.surfaces.backdrop;
    inspectText.fontSize = UI_THEME.typography.scale.s10;
    inspectText.fontFamily = UI_THEME.typography.fontFamily;
    inspectText.fontWeight = 'bold';
    inspectText.isPointerBlocker = false;
    inspectButton.addControl(inspectText);

    inspectButton.onPointerClickObservable.add(() => {
      const next = this.activeGroundMode === 'inspect' ? 'view' : 'inspect';
      this.setGroundMode(next, true);
    });
    inspectButton.metadata = { accent: UI_THEME.colors.border.info };
    this.groundModeButtons.set('inspect', inspectButton);
    this.groundModeTexts.set('inspect', inspectText);
    uiAutomationBridge.register({
      id: 'hud.mode.inspect',
      label: 'Turf',
      role: 'button',
      getControl: () => inspectButton,
      isVisible: () => inspectButton.isVisible,
      onActivate: () => {
        const next = this.activeGroundMode === 'inspect' ? 'view' : 'inspect';
        this.setGroundMode(next, true);
      },
    });

    const makeMgmtBtn = (id: string, label: string, onClick: () => void) => {
      const button = createAccessibleButton({
        label,
        width: '72px',
        height: '26px',
        fontSize: 10,
        backgroundColor: UI_THEME.colors.action.neutral.normal,
        borderColor: UI_THEME.colors.border.default,
        onClick,
      });
      button.control.paddingTop = '4px';
      stack.addControl(button.control);
      uiAutomationBridge.register({
        id: `hud.manage.${id}`,
        label,
        role: 'button',
        getControl: () => button.control,
        isVisible: () => button.control.isVisible,
        onActivate: onClick,
      });
    };

    makeMgmtBtn('crew', 'Crew  H', () => this.onEmployees?.());
    makeMgmtBtn('research', 'Research  Y', () => this.onResearch?.());
    makeMgmtBtn('tee_sheet', 'Tee Sheet  G', () => this.onTeeSheet?.());
    makeMgmtBtn('fleet', 'Fleet  B', () => this.onEquipmentStore?.());
    makeMgmtBtn('amenities', 'Amenities  U', () => this.onAmenityPanel?.());
    makeMgmtBtn('terrain', 'Shaper  T', () => this.onTerrainEditor?.());
    makeMgmtBtn('holes', 'Holes  J', () => this.onHoleBuilder?.());
    makeMgmtBtn('assets', 'Assets  K', () => this.onAssetBuilder?.());
    makeMgmtBtn('layout', 'Layout  L', () => this.onCourseLayout?.());

    const footer = new TextBlock('groundModeRailHint');
    footer.text = 'Review turf conditions here, run operations, then open Shaper or Holes when the course needs editing.';
    footer.color = UI_THEME.colors.text.muted;
    footer.fontSize = UI_THEME.typography.scale.s8;
    footer.fontFamily = UI_THEME.typography.fontFamily;
    footer.height = '48px';
    footer.textWrapping = true;
    footer.paddingTop = '8px';
    stack.addControl(footer);

    this.refreshGroundModeButtons();
  }

  private refreshGroundModeButtons(): void {
    this.groundModeButtons.forEach((button, mode) => {
      const selected = mode === this.activeGroundMode;
      const accent = (button.metadata as { accent: string }).accent;
      button.background = selected ? accent : UI_THEME.colors.surfaces.hudInset;
      button.color = selected ? accent : UI_THEME.colors.border.muted;
      button.thickness = selected ? 2 : 1;
      const text = this.groundModeTexts.get(mode);
      if (text) {
        text.color = selected ? UI_THEME.colors.surfaces.backdrop : UI_THEME.colors.text.secondary;
        text.fontWeight = selected ? 'bold' : 'normal';
      }
    });
  }

  private applyHudPanelStyle(panel: Rectangle, elevated: boolean = false): void {
    panel.cornerRadius = UI_THEME.radii.panel;
    panel.color = elevated ? UI_THEME.colors.border.strong : UI_THEME.colors.border.default;
    panel.thickness = 2;
    panel.background = elevated ? UI_THEME.colors.surfaces.hudElevated : UI_THEME.colors.surfaces.hud;
    panel.shadowColor = UI_THEME.colors.effects.shadow;
    panel.shadowBlur = 12;
    panel.shadowOffsetY = 4;
  }

  private createCourseStatusPanel(): void {
    const panel = new Rectangle('courseStatusPanel');
    panel.width = '232px';
    panel.height = '114px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.left = '10px';
    panel.top = '10px';
    this.applyHudPanelStyle(panel, true);
    this.advancedTexture.addControl(panel);

    const stack = new StackPanel('courseStack');
    stack.paddingTop = '9px';
    stack.paddingLeft = '12px';
    panel.addControl(stack);

    const title = new TextBlock('courseTitle');
    title.text = 'COURSE STATUS';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s11;
    title.fontFamily = UI_THEME.typography.fontFamily;
    title.height = '18px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(title);

    const { bar: hBar, text: hText } = this.createStatBar('Health', '#00ff00');
    this.healthBar = hBar;
    this.healthText = hText;
    stack.addControl(this.createStatRow('❤️', 'Health', hBar, hText, '#cccccc'));

    const { bar: mBar, text: mText } = this.createStatBar('Moisture', '#0088ff');
    this.moistureBar = mBar;
    this.moistureText = mText;
    stack.addControl(this.createStatRow('💧', 'Moisture', mBar, mText, '#88ccff'));

    const { bar: nBar, text: nText } = this.createStatBar('Nutrients', '#00ff00');
    this.nutrientsBar = nBar;
    this.nutrientsText = nText;
    stack.addControl(this.createStatRow('🌱', 'Nutrients', nBar, nText, '#88ff88'));
  }

  private createStatBar(name: string, color: string): { bar: Rectangle; text: TextBlock } {
    const bar = new Rectangle(`${name}Bar`);
    bar.width = '82px';
    bar.height = '10px';
    bar.cornerRadius = UI_THEME.radii.scale.r2;
    bar.background = color;
    bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    const text = new TextBlock(`${name}Text`);
    text.text = '100%';
    text.color = color;
    text.fontSize = UI_THEME.typography.scale.s11;
    text.fontFamily = UI_THEME.typography.fontFamily;

    return { bar, text };
  }

  private createStatRow(icon: string, label: string, bar: Rectangle, text: TextBlock, labelColor: string): Grid {
    const grid = new Grid(`${label}Row`);
    grid.height = '24px';
    grid.width = '210px';
    grid.addColumnDefinition(20, true);
    grid.addColumnDefinition(60, true);
    grid.addColumnDefinition(88, true);
    grid.addColumnDefinition(42, true);

    const iconText = new TextBlock();
    iconText.text = icon;
    iconText.fontSize = UI_THEME.typography.scale.s12;
    grid.addControl(iconText, 0, 0);

    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = labelColor;
    labelText.fontSize = UI_THEME.typography.scale.s11;
    labelText.fontFamily = UI_THEME.typography.fontFamily;
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(labelText, 0, 1);

    const barContainer = new Rectangle();
    barContainer.width = '82px';
    barContainer.height = '10px';
    barContainer.cornerRadius = UI_THEME.radii.scale.r2;
    barContainer.background = UI_THEME.colors.surfaces.hudInset;
    barContainer.color = UI_THEME.colors.border.muted;
    barContainer.thickness = 1;
    barContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    barContainer.addControl(bar);
    grid.addControl(barContainer, 0, 2);

    text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    grid.addControl(text, 0, 3);

    return grid;
  }


  private createTimePanel(): void {
    const panel = new Rectangle('timePanel');
    panel.width = '92px';
    panel.height = '86px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.left = '-10px';
    panel.top = '10px';
    this.applyHudPanelStyle(panel, true);
    this.advancedTexture.addControl(panel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    panel.addControl(stack);

    const dayRow = new StackPanel();
    dayRow.isVertical = false;
    dayRow.height = '18px';
    stack.addControl(dayRow);

    this.weatherIcon = new TextBlock();
    this.weatherIcon.text = '☀️';
    this.weatherIcon.fontSize = UI_THEME.typography.scale.s13;
    this.weatherIcon.width = '20px';
    dayRow.addControl(this.weatherIcon);

    this.dayText = new TextBlock('dayText');
    this.dayText.text = 'Day 1';
    this.dayText.color = UI_THEME.colors.text.primary;
    this.dayText.fontSize = UI_THEME.typography.scale.s12;
    this.dayText.fontFamily = UI_THEME.typography.fontFamily;
    this.dayText.width = '58px';
    this.dayText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    dayRow.addControl(this.dayText);

    this.timeText = new TextBlock('timeText');
    this.timeText.text = '6:00 AM';
    this.timeText.color = UI_THEME.colors.text.accent;
    this.timeText.fontSize = UI_THEME.typography.scale.s14;
    this.timeText.fontFamily = UI_THEME.typography.fontFamily;
    this.timeText.height = '20px';
    stack.addControl(this.timeText);

    this.weatherText = new TextBlock('weatherText');
    this.weatherText.text = 'Sunny 72°F';
    this.weatherText.color = UI_THEME.colors.text.info;
    this.weatherText.fontSize = UI_THEME.typography.scale.s10;
    this.weatherText.fontFamily = UI_THEME.typography.fontFamily;
    this.weatherText.height = '16px';
    stack.addControl(this.weatherText);

    const speedBg = new Rectangle();
    speedBg.width = '40px';
    speedBg.height = '18px';
    speedBg.cornerRadius = UI_THEME.radii.scale.r3;
    speedBg.background = UI_THEME.colors.surfaces.hudInset;
    speedBg.color = UI_THEME.colors.border.default;
    speedBg.thickness = 1;
    stack.addControl(speedBg);

    const speedText = new TextBlock();
    speedText.text = '1x';
    speedText.color = UI_THEME.colors.text.success;
    speedText.fontSize = UI_THEME.typography.scale.s11;
    speedBg.addControl(speedText);
  }

  private createCameraPanel(): void {
    this.cameraPanel = new Rectangle('cameraPanel');
    this.cameraPanel.width = '170px';
    this.cameraPanel.height = '174px';
    this.cameraPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.cameraPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.cameraPanel.left = '-10px';
    this.cameraPanel.top = `${RIGHT_HUD_TOP.camera}px`;
    this.applyHudPanelStyle(this.cameraPanel);
    this.advancedTexture.addControl(this.cameraPanel);

    const stack = new StackPanel('cameraStack');
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    this.cameraPanel.addControl(stack);

    const title = new TextBlock('cameraTitle');
    title.text = 'CAMERA';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s10;
    title.height = '14px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(title);

    this.cameraHeadingText = new TextBlock('cameraHeading');
    this.cameraHeadingText.text = 'Head 225°';
    this.cameraHeadingText.color = UI_THEME.colors.text.primary;
    this.cameraHeadingText.fontSize = UI_THEME.typography.scale.s11;
    this.cameraHeadingText.height = '16px';
    this.cameraHeadingText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.cameraHeadingText);

    this.cameraTiltText = new TextBlock('cameraTilt');
    this.cameraTiltText.text = 'Tilt 55°';
    this.cameraTiltText.color = UI_THEME.colors.text.info;
    this.cameraTiltText.fontSize = UI_THEME.typography.scale.s10;
    this.cameraTiltText.height = '16px';
    this.cameraTiltText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.cameraTiltText);

    const buttonRow = new StackPanel('cameraButtons');
    buttonRow.isVertical = false;
    buttonRow.height = '24px';
    buttonRow.paddingTop = '4px';
    stack.addControl(buttonRow);

    const makeButton = (label: string, onClick: () => void) => {
      const button = createAccessibleButton({
        label,
        width: '38px',
        height: '22px',
        fontSize: 10,
        backgroundColor: UI_THEME.colors.action.neutral.normal,
        borderColor: UI_THEME.colors.border.default,
        onClick,
      });
      button.control.thickness = 1;
      buttonRow.addControl(button.control);
    };

    makeButton('L', () => this.onCameraRotate?.(-Math.PI / 4));
    makeButton('R', () => this.onCameraRotate?.(Math.PI / 4));
    makeButton('Up', () => this.onCameraTilt?.(-Math.PI / 18));
    makeButton('Dn', () => this.onCameraTilt?.(Math.PI / 18));

    const makePresetButton = (
      row: StackPanel,
      label: string,
      width: string,
      onClick: () => void,
    ) => {
      const button = createAccessibleButton({
        label,
        width,
        height: '22px',
        fontSize: 9,
        backgroundColor: UI_THEME.colors.action.neutral.normal,
        borderColor: UI_THEME.colors.border.default,
        onClick,
      });
      button.control.thickness = 1;
      row.addControl(button.control);
    };

    const headingRow = new StackPanel('cameraHeadingPresets');
    headingRow.isVertical = false;
    headingRow.height = '24px';
    headingRow.paddingTop = '4px';
    stack.addControl(headingRow);

    makePresetButton(headingRow, 'NW', '36px', () => this.onCameraHeadingPreset?.(225));
    makePresetButton(headingRow, 'NE', '36px', () => this.onCameraHeadingPreset?.(315));
    makePresetButton(headingRow, 'SE', '36px', () => this.onCameraHeadingPreset?.(45));
    makePresetButton(headingRow, 'SW', '36px', () => this.onCameraHeadingPreset?.(135));

    const tiltRow = new StackPanel('cameraTiltPresets');
    tiltRow.isVertical = false;
    tiltRow.height = '24px';
    tiltRow.paddingTop = '4px';
    stack.addControl(tiltRow);

    makePresetButton(tiltRow, 'Low', '48px', () => this.onCameraTiltPreset?.(35));
    makePresetButton(tiltRow, 'Mid', '48px', () => this.onCameraTiltPreset?.(55));
    makePresetButton(tiltRow, 'High', '48px', () => this.onCameraTiltPreset?.(70));

    const resetButton = createAccessibleButton({
      label: 'Reset',
      width: '154px',
      height: '22px',
      fontSize: 10,
      backgroundColor: UI_THEME.colors.action.neutral.normal,
      borderColor: UI_THEME.colors.border.default,
      onClick: () => this.onCameraReset?.(),
    });
    resetButton.control.paddingTop = '4px';
    stack.addControl(resetButton.control);

    const hint = new TextBlock('cameraHint');
    hint.text = 'Home/End turn  Ins/Del tilt  \\ reset';
    hint.color = UI_THEME.colors.text.muted;
    hint.fontSize = UI_THEME.typography.scale.s8;
    hint.height = '20px';
    hint.textWrapping = true;
    hint.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(hint);
  }

  private createEconomyPanel(): void {
    this.economyPanel = new Rectangle('economyPanel');
    this.economyPanel.width = '170px';
    this.economyPanel.height = '128px';
    this.economyPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.economyPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.economyPanel.left = '-10px';
    this.economyPanel.top = '0px';
    this.applyHudPanelStyle(this.economyPanel);
    this.advancedTexture.addControl(this.economyPanel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    this.economyPanel.addControl(stack);

    const title = new TextBlock('clubStatusTitle');
    title.text = 'CLUB STATUS';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s10;
    title.height = '14px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(title);

    const cashRow = new StackPanel();
    cashRow.isVertical = false;
    cashRow.height = '20px';
    stack.addControl(cashRow);

    const cashIcon = new TextBlock();
    cashIcon.text = '💵';
    cashIcon.fontSize = UI_THEME.typography.scale.s14;
    cashIcon.width = '24px';
    cashRow.addControl(cashIcon);

    this.cashText = new TextBlock('cashText');
    this.cashText.text = '$10,000';
    this.cashText.color = UI_THEME.colors.text.success;
    this.cashText.fontSize = UI_THEME.typography.scale.s14;
    this.cashText.fontFamily = UI_THEME.typography.fontFamily;
    this.cashText.width = '112px';
    this.cashText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    cashRow.addControl(this.cashText);

    const golfersRow = new StackPanel();
    golfersRow.isVertical = false;
    golfersRow.height = '18px';
    stack.addControl(golfersRow);

    const golferIcon = new TextBlock();
    golferIcon.text = '🏌️';
    golferIcon.fontSize = UI_THEME.typography.scale.s13;
    golferIcon.width = '24px';
    golfersRow.addControl(golferIcon);

    this.golfersText = new TextBlock('golfersText');
    this.golfersText.text = '0 golfers';
    this.golfersText.color = UI_THEME.colors.text.secondary;
    this.golfersText.fontSize = UI_THEME.typography.scale.s11;
    this.golfersText.fontFamily = UI_THEME.typography.fontFamily;
    this.golfersText.width = '112px';
    this.golfersText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    golfersRow.addControl(this.golfersText);

    const satisfactionRow = new StackPanel();
    satisfactionRow.isVertical = false;
    satisfactionRow.height = '18px';
    stack.addControl(satisfactionRow);

    const satisfactionIcon = new TextBlock();
    satisfactionIcon.text = '😊';
    satisfactionIcon.fontSize = UI_THEME.typography.scale.s13;
    satisfactionIcon.width = '24px';
    satisfactionRow.addControl(satisfactionIcon);

    this.satisfactionText = new TextBlock('satisfactionText');
    this.satisfactionText.text = '-- rating';
    this.satisfactionText.color = UI_THEME.colors.text.warning;
    this.satisfactionText.fontSize = UI_THEME.typography.scale.s11;
    this.satisfactionText.fontFamily = UI_THEME.typography.fontFamily;
    this.satisfactionText.width = '112px';
    this.satisfactionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    satisfactionRow.addControl(this.satisfactionText);

    this.prestigeStarsText = new TextBlock('prestigeStars');
    this.prestigeStarsText.text = '★☆☆☆☆';
    this.prestigeStarsText.color = UI_THEME.colors.text.accent;
    this.prestigeStarsText.fontSize = UI_THEME.typography.scale.s13;
    this.prestigeStarsText.height = '16px';
    this.prestigeStarsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigeStarsText);

    const prestigeRow = new StackPanel();
    prestigeRow.isVertical = false;
    prestigeRow.height = '16px';
    stack.addControl(prestigeRow);

    this.prestigeTierText = new TextBlock('prestigeTier');
    this.prestigeTierText.text = 'Municipal';
    this.prestigeTierText.color = UI_THEME.colors.text.secondary;
    this.prestigeTierText.fontSize = UI_THEME.typography.scale.s10;
    this.prestigeTierText.width = '78px';
    this.prestigeTierText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    prestigeRow.addControl(this.prestigeTierText);

    this.prestigeScoreText = new TextBlock('prestigeScore');
    this.prestigeScoreText.text = '100 / 1000';
    this.prestigeScoreText.color = UI_THEME.colors.text.muted;
    this.prestigeScoreText.fontSize = UI_THEME.typography.scale.s9;
    this.prestigeScoreText.width = '70px';
    this.prestigeScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    prestigeRow.addControl(this.prestigeScoreText);

    this.prestigePriceWarning = new TextBlock('prestigePriceWarning');
    this.prestigePriceWarning.text = '';
    this.prestigePriceWarning.color = UI_THEME.colors.text.warning;
    this.prestigePriceWarning.fontSize = UI_THEME.typography.scale.s9;
    this.prestigePriceWarning.height = '14px';
    this.prestigePriceWarning.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigePriceWarning);

    const priceRow = new StackPanel();
    priceRow.isVertical = false;
    priceRow.height = '18px';
    stack.addControl(priceRow);

    const minusBtn = Button.CreateSimpleButton('priceMinusBtn', '-');
    minusBtn.width = '22px';
    minusBtn.height = '18px';
    minusBtn.cornerRadius = UI_THEME.radii.scale.r3;
    minusBtn.background = UI_THEME.colors.action.neutral.normal;
    minusBtn.color = UI_THEME.colors.text.primary;
    minusBtn.fontSize = UI_THEME.typography.scale.s12;
    minusBtn.thickness = 0;
    minusBtn.onPointerClickObservable.add(() => this.onPriceChange?.(-5));
    minusBtn.onPointerEnterObservable.add(() => { minusBtn.background = UI_THEME.colors.action.neutral.hover; });
    minusBtn.onPointerOutObservable.add(() => { minusBtn.background = UI_THEME.colors.action.neutral.normal; });
    priceRow.addControl(minusBtn);

    this.currentPriceText = new TextBlock('currentPrice');
    this.currentPriceText.text = '$25';
    this.currentPriceText.color = UI_THEME.colors.text.success;
    this.currentPriceText.fontSize = UI_THEME.typography.scale.s11;
    this.currentPriceText.width = '50px';
    this.currentPriceText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    priceRow.addControl(this.currentPriceText);

    const plusBtn = Button.CreateSimpleButton('pricePlusBtn', '+');
    plusBtn.width = '22px';
    plusBtn.height = '18px';
    plusBtn.cornerRadius = UI_THEME.radii.scale.r3;
    plusBtn.background = UI_THEME.colors.action.neutral.normal;
    plusBtn.color = UI_THEME.colors.text.primary;
    plusBtn.fontSize = UI_THEME.typography.scale.s12;
    plusBtn.thickness = 0;
    plusBtn.onPointerClickObservable.add(() => this.onPriceChange?.(5));
    plusBtn.onPointerEnterObservable.add(() => { plusBtn.background = UI_THEME.colors.action.neutral.hover; });
    plusBtn.onPointerOutObservable.add(() => { plusBtn.background = UI_THEME.colors.action.neutral.normal; });
    priceRow.addControl(plusBtn);

    const feeLabel = new TextBlock();
    feeLabel.text = '/18';
    feeLabel.color = UI_THEME.colors.text.secondary;
    feeLabel.fontSize = UI_THEME.typography.scale.s9;
    feeLabel.width = '22px';
    feeLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    priceRow.addControl(feeLabel);
  }

  private createScenarioPanel(): void {
    this.scenarioPanel = new Rectangle('scenarioPanel');
    this.scenarioPanel.width = '170px';
    this.scenarioPanel.height = '86px';
    this.scenarioPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.scenarioPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.scenarioPanel.left = '-10px';
    this.scenarioPanel.top = '0px';
    this.scenarioPanel.isVisible = false;
    this.applyHudPanelStyle(this.scenarioPanel);
    this.advancedTexture.addControl(this.scenarioPanel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    this.scenarioPanel.addControl(stack);

    this.scenarioTitleText = new TextBlock('scenarioTitle');
    this.scenarioTitleText.text = 'OBJECTIVE';
    this.scenarioTitleText.color = UI_THEME.colors.text.secondary;
    this.scenarioTitleText.fontSize = UI_THEME.typography.scale.s10;
    this.scenarioTitleText.height = '14px';
    this.scenarioTitleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.scenarioTitleText);

    this.scenarioProgressText = new TextBlock('scenarioProgress');
    this.scenarioProgressText.text = 'Earn $50,000';
    this.scenarioProgressText.color = UI_THEME.colors.text.primary;
    this.scenarioProgressText.fontSize = UI_THEME.typography.scale.s11;
    this.scenarioProgressText.height = '18px';
    this.scenarioProgressText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.scenarioProgressText);

    this.scenarioProgressBar = new Rectangle('scenarioProgressBar');
    this.scenarioProgressBar.width = '150px';
    this.scenarioProgressBar.height = '12px';
    this.scenarioProgressBar.cornerRadius = UI_THEME.radii.scale.r2;
    this.scenarioProgressBar.color = UI_THEME.colors.border.muted;
    this.scenarioProgressBar.thickness = 1;
    this.scenarioProgressBar.background = UI_THEME.colors.surfaces.hudInset;
    stack.addControl(this.scenarioProgressBar);

    this.scenarioProgressFill = new Rectangle('scenarioProgressFill');
    this.scenarioProgressFill.width = '0%';
    this.scenarioProgressFill.height = '100%';
    this.scenarioProgressFill.background = UI_THEME.colors.legacy.c_44aa44;
    this.scenarioProgressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.scenarioProgressBar.addControl(this.scenarioProgressFill);

    this.daysRemainingText = new TextBlock('daysRemaining');
    this.daysRemainingText.text = '';
    this.daysRemainingText.color = UI_THEME.colors.text.secondary;
    this.daysRemainingText.fontSize = UI_THEME.typography.scale.s10;
    this.daysRemainingText.height = '16px';
    this.daysRemainingText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.daysRemainingText);
  }

  private createBuildPanel(): void {
    this.buildPanel = new Rectangle('buildPanel');
    this.buildPanel.width = '170px';
    this.buildPanel.height = '76px';
    this.buildPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.buildPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.buildPanel.left = '-10px';
    this.buildPanel.top = '0px';
    this.buildPanel.isVisible = false;
    this.applyHudPanelStyle(this.buildPanel, true);
    this.advancedTexture.addControl(this.buildPanel);

    const stack = new StackPanel('buildStack');
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    this.buildPanel.addControl(stack);

    const title = new TextBlock('buildTitle');
    title.text = 'BUILD MODE';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s10;
    title.height = '14px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(title);

    this.buildModeText = new TextBlock('buildModeText');
    this.buildModeText.text = 'Terrain Shaper';
    this.buildModeText.color = UI_THEME.colors.text.primary;
    this.buildModeText.fontSize = UI_THEME.typography.scale.s11;
    this.buildModeText.height = '18px';
    this.buildModeText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.buildModeText);

    this.buildHintText = new TextBlock('buildHintText');
    this.buildHintText.text = 'T landforms  J holes  K assets';
    this.buildHintText.color = UI_THEME.colors.text.info;
    this.buildHintText.fontSize = UI_THEME.typography.scale.s10;
    this.buildHintText.height = '30px';
    this.buildHintText.textWrapping = true;
    this.buildHintText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.buildHintText);
  }

  private createOperationsPanel(): void {
    this.operationsPanel = new Rectangle('operationsPanel');
    this.operationsPanel.width = '170px';
    this.operationsPanel.height = '142px';
    this.operationsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.operationsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.operationsPanel.left = '-10px';
    this.operationsPanel.top = '0px';
    this.applyHudPanelStyle(this.operationsPanel);
    this.advancedTexture.addControl(this.operationsPanel);

    const stack = new StackPanel('operationsStack');
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    this.operationsPanel.addControl(stack);

    const title = new TextBlock('operationsTitle');
    title.text = 'OPERATIONS';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s10;
    title.height = '14px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(title);

    this.operationsCrewText = new TextBlock('operationsCrew');
    this.operationsCrewText.text = 'Crew 0 active / 0 idle';
    this.operationsCrewText.color = UI_THEME.colors.text.secondary;
    this.operationsCrewText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsCrewText.height = '16px';
    this.operationsCrewText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsCrewText);

    this.operationsCoverageText = new TextBlock('operationsCoverage');
    this.operationsCoverageText.text = 'Zones 0/0 staffed | 0 bots';
    this.operationsCoverageText.color = UI_THEME.colors.text.info;
    this.operationsCoverageText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsCoverageText.height = '16px';
    this.operationsCoverageText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsCoverageText);

    this.operationsDemandText = new TextBlock('operationsDemand');
    this.operationsDemandText.text = 'Tee 0/0';
    this.operationsDemandText.color = UI_THEME.colors.text.secondary;
    this.operationsDemandText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsDemandText.height = '16px';
    this.operationsDemandText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsDemandText);

    this.operationsResearchText = new TextBlock('operationsResearch');
    this.operationsResearchText.text = 'Research idle';
    this.operationsResearchText.color = UI_THEME.colors.text.muted;
    this.operationsResearchText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsResearchText.height = '16px';
    this.operationsResearchText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsResearchText);

    this.operationsAutomationText = new TextBlock('operationsAutomation');
    this.operationsAutomationText.text = 'Bots 0 active / 0 down';
    this.operationsAutomationText.color = UI_THEME.colors.text.secondary;
    this.operationsAutomationText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsAutomationText.height = '16px';
    this.operationsAutomationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsAutomationText);

    this.operationsIrrigationText = new TextBlock('operationsIrrigation');
    this.operationsIrrigationText.text = 'Water 0 dry / 0 leaks';
    this.operationsIrrigationText.color = UI_THEME.colors.text.info;
    this.operationsIrrigationText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsIrrigationText.height = '16px';
    this.operationsIrrigationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsIrrigationText);

    this.operationsPriorityText = new TextBlock('operationsPriority');
    this.operationsPriorityText.text = 'Priority: Course holding steady';
    this.operationsPriorityText.color = UI_THEME.colors.text.muted;
    this.operationsPriorityText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsPriorityText.height = '36px';
    this.operationsPriorityText.textWrapping = true;
    this.operationsPriorityText.lineSpacing = '2px';
    this.operationsPriorityText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsPriorityText);
  }

  private createInspectHoverPanel(): void {
    this.inspectHoverPanel = new Rectangle('inspectHoverPanel');
    this.inspectHoverPanel.width = '240px';
    this.inspectHoverPanel.height = '78px';
    this.inspectHoverPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.inspectHoverPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.inspectHoverPanel.top = '10px';
    this.applyHudPanelStyle(this.inspectHoverPanel, true);
    this.inspectHoverPanel.isVisible = false;
    this.inspectHoverPanel.background = 'rgba(19, 36, 28, 0.94)';
    this.inspectHoverPanel.color = UI_THEME.colors.border.info;
    this.advancedTexture.addControl(this.inspectHoverPanel);

    const stack = new StackPanel('inspectHoverStack');
    stack.width = '216px';
    stack.paddingTop = '7px';
    this.inspectHoverPanel.addControl(stack);

    this.inspectHoverTitle = new TextBlock('inspectHoverTitle');
    this.inspectHoverTitle.text = 'Inspect target';
    this.inspectHoverTitle.color = UI_THEME.colors.text.accent;
    this.inspectHoverTitle.fontSize = UI_THEME.typography.scale.s12;
    this.inspectHoverTitle.fontWeight = 'bold';
    this.inspectHoverTitle.height = '18px';
    this.inspectHoverTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.inspectHoverTitle);

    this.inspectHoverDetail = new TextBlock('inspectHoverDetail');
    this.inspectHoverDetail.text = '';
    this.inspectHoverDetail.color = UI_THEME.colors.text.secondary;
    this.inspectHoverDetail.fontSize = UI_THEME.typography.scale.s10;
    this.inspectHoverDetail.height = '30px';
    this.inspectHoverDetail.textWrapping = true;
    this.inspectHoverDetail.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.inspectHoverDetail);

    this.inspectHoverHint = new TextBlock('inspectHoverHint');
    this.inspectHoverHint.text = '';
    this.inspectHoverHint.color = UI_THEME.colors.text.info;
    this.inspectHoverHint.fontSize = UI_THEME.typography.scale.s9;
    this.inspectHoverHint.height = '14px';
    this.inspectHoverHint.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.inspectHoverHint);
  }

  private createScorePanel(): void {
    const panel = new Rectangle('scorePanel');
    this.scorePanel = panel;
    panel.width = '94px';
    panel.height = '34px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = '10px';
    panel.top = '-102px';
    this.applyHudPanelStyle(panel);
    panel.isVisible = false;
    this.advancedTexture.addControl(panel);

    const row = new StackPanel();
    row.isVertical = false;
    panel.addControl(row);

    const trophy = new TextBlock();
    trophy.text = '🏆';
    trophy.fontSize = UI_THEME.typography.scale.s16;
    trophy.width = '24px';
    row.addControl(trophy);

    this.scoreText = new TextBlock('scoreText');
    this.scoreText.text = '0';
    this.scoreText.color = UI_THEME.colors.text.accent;
    this.scoreText.fontSize = UI_THEME.typography.scale.s14;
    this.scoreText.fontFamily = UI_THEME.typography.fontFamily;
    this.scoreText.width = '58px';
    row.addControl(this.scoreText);
  }

  private createMinimap(): void {
    this.minimapContainer = new Rectangle('minimapContainer');
    this.minimapContainer.width = '186px';
    this.minimapContainer.height = '136px';
    this.minimapContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.minimapContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.minimapContainer.left = '-10px';
    this.minimapContainer.top = '-10px';
    this.applyHudPanelStyle(this.minimapContainer, true);
    this.minimapContainer.isPointerBlocker = true;
    this.advancedTexture.addControl(this.minimapContainer);

    const header = new Rectangle();
    header.width = '164px';
    header.height = '18px';
    header.background = UI_THEME.colors.surfaces.hudInset;
    header.cornerRadius = UI_THEME.radii.scale.r3;
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.top = '5px';
    this.minimapContainer.addControl(header);

    const headerText = new TextBlock();
    headerText.text = 'COURSE MAP';
    headerText.color = UI_THEME.colors.text.primary;
    headerText.fontSize = UI_THEME.typography.scale.s10;
    headerText.fontFamily = UI_THEME.typography.fontFamily;
    header.addControl(headerText);

    this.minimapMapArea = new Rectangle('mapArea');
    this.minimapMapArea.width = '152px';
    this.minimapMapArea.height = '88px';
    this.minimapMapArea.background = '#214f2a';
    this.minimapMapArea.cornerRadius = UI_THEME.radii.scale.r3;
    this.minimapMapArea.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.minimapMapArea.top = '-26px';
    this.minimapMapArea.color = UI_THEME.colors.border.default;
    this.minimapMapArea.thickness = 1;
    this.minimapMapArea.isPointerBlocker = true;
    this.minimapMapArea.onPointerUpObservable.add((pointerInfo: Vector2WithInfo) => {
      const width = this.minimapMapArea.widthInPixels;
      const height = this.minimapMapArea.heightInPixels;
      if (width <= 0 || height <= 0) return;

      const left = this.minimapMapArea.centerX - width / 2;
      const top = this.minimapMapArea.centerY - height / 2;
      const localX = pointerInfo.x - left;
      const localY = pointerInfo.y - top;
      const normalizedX = Math.max(0, Math.min(1, localX / width));
      const normalizedY = Math.max(0, Math.min(1, localY / height));
      this.onMinimapNavigate?.(
        normalizedX * this.minimapWorldWidth,
        normalizedY * this.minimapWorldHeight
      );
    });
    this.minimapContainer.addControl(this.minimapMapArea);

    this.minimapPlayerDot = new Ellipse('playerDot');
    this.minimapPlayerDot.width = '8px';
    this.minimapPlayerDot.height = '8px';
    this.minimapPlayerDot.thickness = 1;
    this.minimapPlayerDot.color = '#e8f2ff';
    this.minimapPlayerDot.background = '#f7fbff';
    this.minimapPlayerDot.isVisible = true;
    this.minimapPlayerDot.isPointerBlocker = false;
    this.minimapMapArea.addControl(this.minimapPlayerDot);

    const legend = new StackPanel('mapLegend');
    legend.isVertical = false;
    legend.height = '14px';
    legend.width = '156px';
    legend.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    legend.top = '-8px';
    this.minimapContainer.addControl(legend);

    const legendText = new TextBlock('legendText');
    legendText.text = 'Crew orange  Bots blue  Golfers white';
    legendText.color = UI_THEME.colors.text.muted;
    legendText.fontSize = UI_THEME.typography.scale.s8;
    legendText.fontFamily = UI_THEME.typography.fontFamily;
    legendText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    legend.addControl(legendText);
  }

  private createNotificationArea(): void {
    this.activityPanel = new Rectangle('activityPanel');
    this.activityPanel.width = '248px';
    this.activityPanel.height = '138px';
    this.activityPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.activityPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.activityPanel.left = '10px';
    this.activityPanel.top = '-10px';
    this.applyHudPanelStyle(this.activityPanel);
    this.advancedTexture.addControl(this.activityPanel);

    this.notificationContainer = new StackPanel('notificationContainer');
    this.notificationContainer.width = '224px';
    this.notificationContainer.paddingTop = '8px';
    this.notificationContainer.paddingLeft = '10px';
    this.notificationContainer.paddingRight = '10px';
    this.activityPanel.addControl(this.notificationContainer);

    const title = new TextBlock('activityTitle');
    title.text = 'ACTIVITY';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s10;
    title.fontFamily = UI_THEME.typography.fontFamily;
    title.height = '14px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.notificationContainer.addControl(title);

    this.objectiveText = new TextBlock('objectiveText');
    this.objectiveText.text = 'Quiet log';
    this.objectiveText.color = UI_THEME.colors.text.muted;
    this.objectiveText.fontSize = UI_THEME.typography.scale.s9;
    this.objectiveText.height = '14px';
    this.objectiveText.isVisible = true;
    this.objectiveText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.notificationContainer.addControl(this.objectiveText);

    for (let index = 0; index < 4; index++) {
      const entry = new TextBlock(`activityEntry_${index}`);
      entry.text = index === 0 ? 'No recent events' : '';
      entry.color = index === 0 ? UI_THEME.colors.text.muted : UI_THEME.colors.text.secondary;
      entry.fontSize = UI_THEME.typography.scale.s9;
      entry.fontFamily = UI_THEME.typography.fontFamily;
      entry.height = '22px';
      entry.textWrapping = true;
      entry.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.notificationContainer.addControl(entry);
      this.activityEntries.push(entry);
    }
  }

  private createScenarioFailureOverlay(): void {
    const popupWidth = 460;
    const contentWidth = popupWidth - 36;
    const fullWidth = `${contentWidth}px`;
    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'scenarioFailure',
      width: popupWidth,
      height: 332,
      colors: {
        border: UI_THEME.colors.text.warning,
        background: UI_THEME.colors.surfaces.panel,
        title: UI_THEME.colors.text.warning,
      },
      padding: 18,
    });
    this.scenarioFailureOverlay = overlay;

    createPopupHeader(stack, {
      title: 'Scenario Failed',
      titleColor: UI_THEME.colors.text.warning,
      width: contentWidth,
      onClose: () => this.onRestart?.(),
      closeLabel: 'Retry',
    });

    this.scenarioFailureTitle = new TextBlock('scenarioFailureTitle');
    this.scenarioFailureTitle.text = 'Course operations broke down';
    this.scenarioFailureTitle.color = UI_THEME.colors.text.primary;
    this.scenarioFailureTitle.fontSize = UI_THEME.typography.scale.s22;
    this.scenarioFailureTitle.fontWeight = 'bold';
    this.scenarioFailureTitle.fontFamily = UI_THEME.typography.fontFamily;
    this.scenarioFailureTitle.height = '34px';
    this.scenarioFailureTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.scenarioFailureTitle);

    this.scenarioFailureBody = new TextBlock('scenarioFailureBody');
    this.scenarioFailureBody.text = 'The club missed its objective.';
    this.scenarioFailureBody.color = UI_THEME.colors.text.secondary;
    this.scenarioFailureBody.fontSize = UI_THEME.typography.scale.s13;
    this.scenarioFailureBody.fontFamily = UI_THEME.typography.fontFamily;
    this.scenarioFailureBody.height = '86px';
    this.scenarioFailureBody.textWrapping = true;
    this.scenarioFailureBody.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.scenarioFailureBody);

    const note = new TextBlock('scenarioFailureNote');
    note.text = 'Review the objective panel, then restart or return to the menu.';
    note.color = UI_THEME.colors.text.muted;
    note.fontSize = UI_THEME.typography.scale.s11;
    note.fontFamily = UI_THEME.typography.fontFamily;
    note.height = '32px';
    note.textWrapping = true;
    note.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(note);

    const actionGrid = new Grid('scenarioFailureActions');
    actionGrid.width = fullWidth;
    actionGrid.height = '46px';
    actionGrid.paddingTop = '12px';
    actionGrid.addColumnDefinition(0.5);
    actionGrid.addColumnDefinition(0.5);
    actionGrid.addRowDefinition(1);
    stack.addControl(actionGrid);

    const retryBtn = createAccessibleButton({
      label: '↺ Retry Scenario',
      width: '198px',
      height: '38px',
      fontSize: 14,
      backgroundColor: UI_THEME.colors.action.primary.normal,
      borderColor: UI_THEME.colors.launch.selectedBorder,
      onClick: () => this.onRestart?.(),
      focusGroup: 'scenario-failure',
    }, this.focusManager);
    this.scenarioFailureRetryButton = retryBtn.control;
    actionGrid.addControl(retryBtn.control, 0, 0);

    const menuBtn = createAccessibleButton({
      label: '⌂ Return To Menu',
      width: '198px',
      height: '38px',
      fontSize: 14,
      backgroundColor: UI_THEME.colors.action.neutral.normal,
      borderColor: UI_THEME.colors.border.default,
      onClick: () => this.onMainMenu?.(),
      focusGroup: 'scenario-failure',
    }, this.focusManager);
    this.scenarioFailureMenuButton = menuBtn.control;
    actionGrid.addControl(menuBtn.control, 0, 1);

    const isVisible = () => this.scenarioFailureOverlay?.isVisible ?? false;
    uiAutomationBridge.register({
      id: 'scenario_failure.retry',
      label: 'Retry Scenario',
      role: 'button',
      getControl: () => this.scenarioFailureRetryButton,
      isVisible,
      isEnabled: () => this.scenarioFailureRetryButton !== null,
      onActivate: () => this.onRestart?.(),
    });
    uiAutomationBridge.register({
      id: 'scenario_failure.menu',
      label: 'Return To Menu',
      role: 'button',
      getControl: () => this.scenarioFailureMenuButton,
      isVisible,
      isEnabled: () => this.scenarioFailureMenuButton !== null,
      onActivate: () => this.onMainMenu?.(),
    });
  }

  private createPauseOverlay(): void {
    const POPUP_W = 400;
    const CONTENT_W = POPUP_W - 36;
    const W = `${CONTENT_W}px`;

    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'pause',
      width: POPUP_W,
      height: 330,
      colors: POPUP_COLORS.green,
      padding: 18,
    });
    this.pauseOverlay = overlay;

    createPopupHeader(stack, {
      title: '⏸ PAUSED',
      width: CONTENT_W,
      onClose: () => this.onResume?.(),
      closeLabel: 'Skip',
      onCloseButtonCreated: (button) => {
        this.pauseHeaderCloseButton = button;
      },
    });

    const resumeBtn = createAccessibleButton({
      label: '▶ Resume',
      width: W,
      height: '40px',
      fontSize: 16,
      backgroundColor: UI_THEME.colors.action.primary.normal,
      borderColor: UI_THEME.colors.launch.selectedBorder,
      onClick: () => this.onResume?.(),
      focusGroup: 'pause-menu'
    }, this.focusManager);
    resumeBtn.control.paddingTop = '10px';
    stack.addControl(resumeBtn.control);
    this.pauseMenuButtons.push(resumeBtn);
    this.pauseResumeButton = resumeBtn.control;

    const secondaryRow = new Grid('secondaryActions');
    secondaryRow.width = W;
    secondaryRow.height = '42px';
    secondaryRow.paddingTop = '6px';
    secondaryRow.addColumnDefinition(1 / 3);
    secondaryRow.addColumnDefinition(1 / 3);
    secondaryRow.addColumnDefinition(1 / 3);
    secondaryRow.addRowDefinition(1.0);
    stack.addControl(secondaryRow);

    const makeSecondaryBtn = (label: string, col: number, onClick: () => void): Rectangle => {
      const btn = createAccessibleButton({
        label,
        width: '114px',
        height: '34px',
        fontSize: 12,
        backgroundColor: UI_THEME.colors.action.neutral.normal,
        borderColor: UI_THEME.colors.border.default,
        onClick,
        focusGroup: 'pause-menu',
      }, this.focusManager);
      secondaryRow.addControl(btn.control, 0, col);
      this.pauseMenuButtons.push(btn);
      return btn.control;
    };

    this.pauseSaveButton = makeSecondaryBtn('💾 Save', 0, () => { this.onSave?.(); this.showNotification('Game saved!'); });
    this.pauseRestartButton = makeSecondaryBtn('↺ Restart', 1, () => this.onRestart?.());
    this.pauseMenuButton = makeSecondaryBtn('⌂ Menu', 2, () => this.onMainMenu?.());

    this.registerPauseAutomationControls();

    createSectionDivider(stack, 'GAME SPEED', CONTENT_W);

    const speedRow = new StackPanel('speedRow');
    speedRow.isVertical = false;
    speedRow.height = '40px';
    speedRow.width = W;
    speedRow.paddingTop = '6px';
    stack.addControl(speedRow);

    const spacerL = new Rectangle();
    spacerL.width = '100px';
    spacerL.thickness = 0;
    speedRow.addControl(spacerL);

    const slowBtn = createAccessibleButton({
      label: '◀',
      width: '44px',
      height: '30px',
      fontSize: 14,
      backgroundColor: UI_THEME.colors.action.neutral.normal,
      borderColor: UI_THEME.colors.border.default,
      onClick: () => {
        this.onSpeedChange?.(-1);
        this.updateSpeedDisplay();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    speedRow.addControl(slowBtn.control);
    this.pauseMenuButtons.push(slowBtn);
    this.pauseSpeedDownButton = slowBtn.control;

    this.speedText = new TextBlock('speedText');
    this.speedText.text = '1x';
    this.speedText.color = UI_THEME.colors.text.primary;
    this.speedText.fontSize = UI_THEME.typography.scale.s16;
    this.speedText.fontWeight = 'bold';
    this.speedText.fontFamily = UI_THEME.typography.fontFamily;
    this.speedText.width = '72px';
    speedRow.addControl(this.speedText);

    const fastBtn = createAccessibleButton({
      label: '▶',
      width: '44px',
      height: '30px',
      fontSize: 14,
      backgroundColor: UI_THEME.colors.action.neutral.normal,
      borderColor: UI_THEME.colors.border.default,
      onClick: () => {
        this.onSpeedChange?.(1);
        this.updateSpeedDisplay();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    speedRow.addControl(fastBtn.control);
    this.pauseMenuButtons.push(fastBtn);
    this.pauseSpeedUpButton = fastBtn.control;

    const spacerR = new Rectangle();
    spacerR.width = '100px';
    spacerR.thickness = 0;
    speedRow.addControl(spacerR);

    const hint = new TextBlock('pauseHint');
    hint.text = 'Use the left rail for management. P / ESC returns to play.';
    hint.color = UI_THEME.colors.text.muted;
    hint.fontSize = 10;
    hint.fontFamily = UI_THEME.typography.fontFamily;
    hint.height = '20px';
    hint.paddingTop = '8px';
    stack.addControl(hint);
  }

  private registerPauseAutomationControls(): void {
    const isPauseVisible = () => this.pauseOverlay?.isVisible ?? false;
    uiAutomationBridge.register({
      id: 'pause.close',
      label: 'Close Pause Menu',
      role: 'button',
      getControl: () => this.pauseHeaderCloseButton,
      isVisible: isPauseVisible,
      isEnabled: () => (this.pauseHeaderCloseButton?.isEnabled ?? false),
      onActivate: () => this.onResume?.(),
    });
    uiAutomationBridge.register({
      id: 'pause.resume',
      label: 'Resume',
      role: 'button',
      getControl: () => this.pauseResumeButton,
      isVisible: isPauseVisible,
      isEnabled: () => this.pauseResumeButton !== null,
      onActivate: () => this.onResume?.(),
    });
    uiAutomationBridge.register({
      id: 'pause.save',
      label: 'Save Game',
      role: 'button',
      getControl: () => this.pauseSaveButton,
      isVisible: isPauseVisible,
      isEnabled: () => this.pauseSaveButton !== null,
      onActivate: () => { this.onSave?.(); this.showNotification('Game saved!'); },
    });
    uiAutomationBridge.register({
      id: 'pause.restart',
      label: 'Restart Scenario',
      role: 'button',
      getControl: () => this.pauseRestartButton,
      isVisible: isPauseVisible,
      isEnabled: () => this.pauseRestartButton !== null,
      onActivate: () => this.onRestart?.(),
    });
    uiAutomationBridge.register({
      id: 'pause.menu',
      label: 'Return To Menu',
      role: 'button',
      getControl: () => this.pauseMenuButton,
      isVisible: isPauseVisible,
      isEnabled: () => this.pauseMenuButton !== null,
      onActivate: () => this.onMainMenu?.(),
    });
    uiAutomationBridge.register({
      id: 'pause.speed.down',
      label: 'Decrease Game Speed',
      role: 'button',
      getControl: () => this.pauseSpeedDownButton,
      isVisible: isPauseVisible,
      isEnabled: () => this.pauseSpeedDownButton !== null,
      onActivate: () => {
        this.onSpeedChange?.(-1);
        this.updateSpeedDisplay();
      },
    });
    uiAutomationBridge.register({
      id: 'pause.speed.up',
      label: 'Increase Game Speed',
      role: 'button',
      getControl: () => this.pauseSpeedUpButton,
      isVisible: isPauseVisible,
      isEnabled: () => this.pauseSpeedUpButton !== null,
      onActivate: () => {
        this.onSpeedChange?.(1);
        this.updateSpeedDisplay();
      },
    });

  }

  private updateSpeedDisplay(): void {
    // Speed display will be updated by BabylonMain calling showPauseMenu with currentSpeed
  }

  private createOverlayLegend(): void {
    this.overlayLegend = new Rectangle('overlayLegend');
    this.overlayLegend.width = '160px';
    this.overlayLegend.height = '60px';
    this.overlayLegend.cornerRadius = UI_THEME.radii.scale.r5;
    this.overlayLegend.color = UI_THEME.colors.legacy.c_4a8a5a;
    this.overlayLegend.thickness = 2;
    this.overlayLegend.background = 'rgba(26, 58, 42, 0.95)';
    this.overlayLegend.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.overlayLegend.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.overlayLegend.left = '10px';
    this.overlayLegend.top = '-10px';
    this.overlayLegend.isVisible = false;
    this.advancedTexture.addControl(this.overlayLegend);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    this.overlayLegend.addControl(stack);

    this.overlayLegendTitle = new TextBlock('overlayTitle');
    this.overlayLegendTitle.text = 'MOISTURE VIEW';
    this.overlayLegendTitle.color = UI_THEME.colors.legacy.c_aaccff;
    this.overlayLegendTitle.fontSize = UI_THEME.typography.scale.s10;
    this.overlayLegendTitle.height = '14px';
    this.overlayLegendTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.overlayLegendTitle);

    const gradientRow = new StackPanel();
    gradientRow.isVertical = false;
    gradientRow.height = '20px';
    gradientRow.paddingTop = '4px';
    stack.addControl(gradientRow);

    this.overlayLegendLowLabel = new TextBlock('lowLabel');
    this.overlayLegendLowLabel.text = 'Dry';
    this.overlayLegendLowLabel.color = UI_THEME.colors.legacy.c_888888;
    this.overlayLegendLowLabel.fontSize = UI_THEME.typography.scale.s9;
    this.overlayLegendLowLabel.width = '30px';
    this.overlayLegendLowLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    gradientRow.addControl(this.overlayLegendLowLabel);

    this.overlayLegendGradient = new Rectangle('gradient');
    this.overlayLegendGradient.width = '80px';
    this.overlayLegendGradient.height = '12px';
    this.overlayLegendGradient.cornerRadius = UI_THEME.radii.scale.r2;
    this.overlayLegendGradient.thickness = 1;
    this.overlayLegendGradient.color = UI_THEME.colors.legacy.c_555555;
    gradientRow.addControl(this.overlayLegendGradient);

    this.overlayLegendHighLabel = new TextBlock('highLabel');
    this.overlayLegendHighLabel.text = 'Wet';
    this.overlayLegendHighLabel.color = UI_THEME.colors.legacy.c_888888;
    this.overlayLegendHighLabel.fontSize = UI_THEME.typography.scale.s9;
    this.overlayLegendHighLabel.width = '30px';
    this.overlayLegendHighLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    gradientRow.addControl(this.overlayLegendHighLabel);
  }

  public updateOverlayLegend(mode: OverlayMode): void {
    if (mode === 'normal') {
      this.overlayLegend.isVisible = false;
      return;
    }

    this.overlayLegend.isVisible = true;

    switch (mode) {
      case 'moisture':
        this.overlayLegendTitle.text = 'MOISTURE VIEW';
        this.overlayLegendTitle.color = UI_THEME.colors.legacy.c_88ccff;
        this.overlayLegendLowLabel.text = 'Dry';
        this.overlayLegendHighLabel.text = 'Wet';
        this.overlayLegendGradient.background = 'linear-gradient(90deg, #cc6644 0%, #4488cc 100%)';
        break;
      case 'nutrients':
        this.overlayLegendTitle.text = 'NUTRIENTS VIEW';
        this.overlayLegendTitle.color = UI_THEME.colors.legacy.c_88ff88;
        this.overlayLegendLowLabel.text = 'Low';
        this.overlayLegendHighLabel.text = 'High';
        this.overlayLegendGradient.background = 'linear-gradient(90deg, #cc8844 0%, #66cc44 100%)';
        break;
      case 'height':
        this.overlayLegendTitle.text = 'HEIGHT VIEW';
        this.overlayLegendTitle.color = UI_THEME.colors.legacy.c_ffcc88;
        this.overlayLegendLowLabel.text = 'Short';
        this.overlayLegendHighLabel.text = 'Tall';
        this.overlayLegendGradient.background = 'linear-gradient(90deg, #44aa44 0%, #cc6644 100%)';
        break;
      case 'irrigation':
        this.overlayLegendTitle.text = 'IRRIGATION VIEW';
        this.overlayLegendTitle.color = UI_THEME.colors.legacy.c_88ddff;
        this.overlayLegendLowLabel.text = 'No Flow';
        this.overlayLegendHighLabel.text = 'High Flow';
        this.overlayLegendGradient.background = 'linear-gradient(90deg, #334488 0%, #00ffff 100%)';
        break;
    }
  }


  public showPauseMenu(
    onResume: () => void,
    onRestart: () => void,
    onMainMenu?: () => void,
    onSave?: () => void,
    onEmployees?: () => void,
    onResearch?: () => void,
    onTeeSheet?: () => void,
    onTerrainEditor?: () => void,
    onHoleBuilder?: () => void,
    onAssetBuilder?: () => void,
    onEquipmentStore?: () => void,
    onAmenityPanel?: () => void,
    onCourseLayout?: () => void,
    onSpeedChange?: (delta: number) => void,
    currentSpeed?: number
  ): void {
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onMainMenu = onMainMenu;
    this.onSave = onSave;
    this.onEmployees = onEmployees;
    this.onResearch = onResearch;
    this.onTeeSheet = onTeeSheet;
    this.onTerrainEditor = onTerrainEditor;
    this.onHoleBuilder = onHoleBuilder;
    this.onAssetBuilder = onAssetBuilder;
    this.onEquipmentStore = onEquipmentStore;
    this.onAmenityPanel = onAmenityPanel;
    this.onCourseLayout = onCourseLayout;
    this.onSpeedChange = onSpeedChange;
    if (this.speedText && currentSpeed !== undefined) {
      this.speedText.text = `${currentSpeed}x`;
    }
    this.pauseOverlay.isVisible = true;
    // Enable keyboard navigation for pause menu
    this.focusManager.enableForGroup('pause-menu', 0);
  }

  public hidePauseMenu(): void {
    this.pauseOverlay.isVisible = false;
    // Disable keyboard navigation
    this.focusManager.disable();
  }

  public isPauseMenuVisible(): boolean {
    return this.pauseOverlay.isVisible;
  }

  public setPriceCallback(callback: (delta: number) => void): void {
    this.onPriceChange = callback;
  }

  public setMinimapNavigateCallback(callback: (worldX: number, worldZ: number) => void): void {
    this.onMinimapNavigate = callback;
  }

  public setCameraCallbacks(
    onRotate?: (delta: number) => void,
    onTilt?: (delta: number) => void,
    onReset?: () => void,
    onHeadingPreset?: (headingDegrees: number) => void,
    onTiltPreset?: (tiltDegrees: number) => void,
  ): void {
    this.onCameraRotate = onRotate;
    this.onCameraTilt = onTilt;
    this.onCameraReset = onReset;
    this.onCameraHeadingPreset = onHeadingPreset;
    this.onCameraTiltPreset = onTiltPreset;
  }

  public updateCameraInfo(headingDegrees: number, tiltDegrees: number): void {
    if (this.cameraHeadingText) {
      this.cameraHeadingText.text = `Head ${headingDegrees}°`;
    }
    if (this.cameraTiltText) {
      this.cameraTiltText.text = `Tilt ${tiltDegrees}°`;
    }
  }

  public setGroundModeCallback(callback: (mode: GroundInteractionMode) => void): void {
    this.onGroundModeChange = callback;
  }

  public isMinimapBlockingPointer(x: number, y: number): boolean {
    return this.minimapContainer.contains(x, y);
  }

  public isScenarioFailureVisible(): boolean {
    return this.scenarioFailureOverlay?.isVisible ?? false;
  }

  public setManagementCallbacks(
    onEmployees?: () => void,
    onResearch?: () => void,
    onTeeSheet?: () => void,
    onTerrainEditor?: () => void,
    onHoleBuilder?: () => void,
    onAssetBuilder?: () => void,
    onEquipmentStore?: () => void,
    onAmenityPanel?: () => void,
    onCourseLayout?: () => void,
  ): void {
    this.onEmployees = onEmployees;
    this.onResearch = onResearch;
    this.onTeeSheet = onTeeSheet;
    this.onTerrainEditor = onTerrainEditor;
    this.onHoleBuilder = onHoleBuilder;
    this.onAssetBuilder = onAssetBuilder;
    this.onEquipmentStore = onEquipmentStore;
    this.onAmenityPanel = onAmenityPanel;
    this.onCourseLayout = onCourseLayout;
  }

  public setGroundMode(mode: GroundInteractionMode, notify: boolean = false): void {
    this.activeGroundMode = mode;
    this.refreshGroundModeButtons();
    this.onGroundModeChange?.(mode);
    if (notify) {
      const label =
        mode === 'view'
          ? 'View mode'
          : mode === 'inspect'
            ? 'Turf inspect mode'
            : mode === 'dispatch_mow'
              ? 'Dispatch mode: mow'
              : mode === 'dispatch_water'
                ? 'Dispatch mode: water'
                : mode === 'dispatch_fertilize'
                  ? 'Dispatch mode: fertilize'
                  : 'Dispatch mode: rake';
      this.showNotification(label, undefined, 1800);
    }
  }

  public getGroundMode(): GroundInteractionMode {
    return this.activeGroundMode;
  }

  public setInspectHover(
    title: string,
    detail: string,
    hint: string,
    tone: 'info' | 'warning' | 'danger' = 'info'
  ): void {
    if (!this.inspectHoverPanel) return;
    this.inspectHoverTitle.text = title;
    this.inspectHoverDetail.text = detail;
    this.inspectHoverHint.text = hint;
    this.inspectHoverPanel.color =
      tone === 'danger'
        ? UI_THEME.colors.text.danger
        : tone === 'warning'
          ? UI_THEME.colors.text.warning
          : UI_THEME.colors.border.info;
    this.inspectHoverTitle.color =
      tone === 'danger'
        ? UI_THEME.colors.text.danger
        : tone === 'warning'
          ? UI_THEME.colors.text.warning
          : UI_THEME.colors.text.accent;
    this.inspectHoverPanel.isVisible = true;
  }

  public clearInspectHover(): void {
    if (this.inspectHoverPanel) {
      this.inspectHoverPanel.isVisible = false;
    }
  }

  public updateCurrentPrice(price: number): void {
    if (this.currentPriceText) {
      this.currentPriceText.text = `$${price}`;
    }
  }

  private formatActivityMessage(message: string): string | null {
    const compact = message
      .replace(/^Weather:\s*/i, '')
      .replace(/^Priority:\s*/i, '')
      .replace(/^Research complete:\s*/i, 'Research: ')
      .replace(/^Breakthrough!\s*/i, 'New: ')
      .replace(/\bgroundskeeper\b/gi, 'crew')
      .replace(/\bclubhouse_side\b/gi, 'Clubhouse Side')
      .replace(/\bmiddle_grounds\b/gi, 'Middle Grounds')
      .replace(/\bfar_side\b/gi, 'Far Side')
      .replace(/\s+/g, ' ')
      .trim();
    const lower = compact.toLowerCase();

    if (
      lower.includes('perfect conditions for golf') ||
      lower.startsWith('earn $') ||
      lower.startsWith('loaded day') ||
      lower.startsWith('game restarted')
    ) {
      return null;
    }

    if (compact.length <= 74) return compact;
    return `${compact.slice(0, 71)}...`;
  }

  public showNotification(message: string, color?: string, duration: number = 5000): void {
    const formatted = this.formatActivityMessage(message);
    if (!formatted) return;
    const lower = message.toLowerCase();
    const isUrgent =
      color === '#ffaa44' ||
      color === '#ff4444' ||
      color === 'warning' ||
      lower.includes('cannot') ||
      lower.includes('not enough') ||
      lower.includes('out of bounds') ||
      lower.includes('already') ||
      lower.includes('no ') ||
      lower.includes('complete') ||
      lower.includes('broken') ||
      lower.includes('leak');
    const entryColor = color ?? (isUrgent ? '#ffcc66' : UI_THEME.colors.text.secondary);

    this.activityMessages.unshift({ text: formatted, color: entryColor });
    this.activityMessages = this.activityMessages.slice(0, this.activityEntries.length);

    for (let index = 0; index < this.activityEntries.length; index++) {
      const entry = this.activityEntries[index];
      const messageEntry = this.activityMessages[index];
      if (messageEntry) {
        entry.text = messageEntry.text;
        entry.color = messageEntry.color;
      } else {
        entry.text = '';
      }
    }

    if (this.activityPanel) {
      this.activityPanel.color = isUrgent ? '#ffcc66' : UI_THEME.colors.border.default;
      this.activityPanel.thickness = isUrgent ? 3 : 2;
      setTimeout(() => {
        this.activityPanel.color = UI_THEME.colors.border.default;
        this.activityPanel.thickness = 2;
      }, Math.min(duration, 2400));
    }
  }

  public showScenarioFailure(title: string, message: string): void {
    if (!this.scenarioFailureOverlay) return;
    this.scenarioFailureTitle.text = title;
    this.scenarioFailureBody.text = message;
    this.scenarioFailureOverlay.isVisible = true;
  }

  public hideScenarioFailure(): void {
    if (this.scenarioFailureOverlay) {
      this.scenarioFailureOverlay.isVisible = false;
    }
  }

  public updateCourseStatus(health: number, moisture: number, nutrients: number): void {
    this.updateBar(this.healthBar, health, this.getHealthColor(health));
    this.healthText.text = `${Math.floor(health)}%`;
    this.healthText.color = this.getHealthColor(health);

    this.updateBar(this.moistureBar, moisture, '#0088ff');
    this.moistureText.text = `${Math.floor(moisture)}%`;

    this.updateBar(this.nutrientsBar, nutrients, '#00ff00');
    this.nutrientsText.text = `${Math.floor(nutrients)}%`;
  }

  private getHealthColor(health: number): string {
    if (health >= 70) return '#00ff00';
    if (health >= 40) return '#ffff00';
    return '#ff0000';
  }

  private updateBar(bar: Rectangle, percent: number, color: string): void {
    const width = Math.max(0, Math.min(100, percent)) * 0.7;
    bar.width = `${width}px`;
    bar.background = color;
  }

  public updateResources(fuel: number, water: number, fert: number): void {
    if (!this.fuelBar || !this.fuelText || !this.waterBar || !this.waterText || !this.fertBar || !this.fertText) {
      return;
    }
    this.updateBar(this.fuelBar, fuel, '#ff4444');
    this.fuelText.text = `${Math.floor(fuel)}%`;

    this.updateBar(this.waterBar, water, '#4488ff');
    this.waterText.text = `${Math.floor(water)}%`;

    this.updateBar(this.fertBar, fert, '#ffcc44');
    this.fertText.text = `${Math.floor(fert)}%`;
  }

  public updateResource(percent: number): void {
    this.updateResources(percent, percent, percent);
  }

  public updateTime(hours: number, minutes: number, day: number = 1, season?: string): void {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const displayMin = minutes.toString().padStart(2, '0');
    this.timeText.text = `${displayHour}:${displayMin} ${period}`;
    if (season) {
      const seasonIcon = season === 'summer' ? '☀️' :
                         season === 'winter' ? '❄️' :
                         season === 'fall' ? '🍂' : '🌸';
      this.dayText.text = `${seasonIcon} Day ${day}`;
    } else {
      this.dayText.text = `Day ${day}`;
    }
  }

  public updateWeather(type: string, temperature: number): void {
    const icon = type === 'stormy' ? '⛈️' :
                 type === 'rainy' ? '🌧️' :
                 type === 'cloudy' ? '☁️' : '☀️';

    this.weatherIcon.text = icon;
    this.weatherText.text = `${type.charAt(0).toUpperCase() + type.slice(1)} ${temperature}°F`;

    if (type === 'stormy' || type === 'rainy') {
      this.weatherText.color = UI_THEME.colors.legacy.c_88aaff;
    } else if (type === 'cloudy') {
      this.weatherText.color = UI_THEME.colors.legacy.c_aabbcc;
    } else if (temperature > 90) {
      this.weatherText.color = UI_THEME.colors.legacy.c_ffaa66;
    } else {
      this.weatherText.color = UI_THEME.colors.legacy.c_ffdd88;
    }
  }

  public updateScore(score: number): void {
    this.scoreText.text = score.toLocaleString();
    if (this.scorePanel) {
      this.scorePanel.isVisible = score > 0;
    }
  }

  public updateEconomy(cash: number, golferCount: number, satisfaction?: number): void {
    const formattedCash = cash >= 0
      ? `$${cash.toLocaleString()}`
      : `-$${Math.abs(cash).toLocaleString()}`;
    this.cashText.text = formattedCash;
    this.cashText.color = cash >= 0 ? '#44ff44' : '#ff4444';
    this.golfersText.text = `${golferCount} golfer${golferCount !== 1 ? 's' : ''}`;
    if (satisfaction !== undefined) {
      this.satisfactionText.text = `${Math.round(satisfaction)}% rating`;
      if (satisfaction >= 80) {
        this.satisfactionText.color = UI_THEME.colors.legacy.c_44ff44;
      } else if (satisfaction >= 60) {
        this.satisfactionText.color = UI_THEME.colors.legacy.c_ffcc00;
      } else {
        this.satisfactionText.color = UI_THEME.colors.legacy.c_ff6644;
      }
    }
  }

  public updateOperationsSummary(summary: {
    workersActive: number;
    workersIdle: number;
    staffedZones: number;
    totalZones: number;
    flexWorkers: number;
    zonedRobots: number;
    flexRobots: number;
    bookedTeeTimes: number;
    totalTeeTimes: number;
    researchName: string | null;
    researchProgress: number;
    robotsWorking: number;
    robotsBroken: number;
    sprinklersPumping: number;
    sprinklersDry: number;
    pipeLeaks: number;
    topPriorityLabel: string;
    topPrioritySeverity: number;
  }): void {
    this.operationsCrewText.text =
      `Crew ${summary.workersActive} active / ${summary.workersIdle} idle`;
    this.operationsCoverageText.text =
      `Coverage ${summary.staffedZones}/${summary.totalZones} zoned • ${summary.flexWorkers} flex • ${summary.zonedRobots + summary.flexRobots} bots`;
    this.operationsDemandText.text =
      summary.totalTeeTimes > 0
        ? `Bookings ${summary.bookedTeeTimes}/${summary.totalTeeTimes}`
        : 'Bookings not opened yet';

    if (summary.researchName) {
      this.operationsResearchText.text =
        `${summary.researchName}: ${Math.round(summary.researchProgress)}%`;
      this.operationsResearchText.color = UI_THEME.colors.legacy.c_88ff88;
    } else {
      this.operationsResearchText.text =
        `Research idle`;
      this.operationsResearchText.color = UI_THEME.colors.legacy.c_888888;
    }

    this.operationsAutomationText.text =
      `Bots ${summary.robotsWorking} active / ${summary.robotsBroken} down`;
    this.operationsAutomationText.color = summary.robotsBroken > 0 ? '#ff8844' : '#aaaaaa';

    this.operationsIrrigationText.text =
      `Water ${summary.sprinklersDry} dry / ${summary.pipeLeaks} leaks`;
    this.operationsIrrigationText.color =
      summary.pipeLeaks > 0 || summary.sprinklersDry > 0 ? '#ff8844' : '#88ccff';

    this.operationsPriorityText.text = `Priority: ${summary.topPriorityLabel}`;
    this.operationsPriorityText.color =
      summary.topPrioritySeverity >= 20
        ? '#ff8866'
        : summary.topPrioritySeverity > 0
          ? '#ffcc66'
          : UI_THEME.colors.text.muted;
  }

  public updatePrestige(state: PrestigeState, rejectionRate: number = 0, recommendedMax?: number): void {
    this.prestigeStarsText.text = getStarDisplay(state.starRating);
    this.prestigeTierText.text = TIER_LABELS[state.tier];
    this.prestigeScoreText.text = `${Math.round(state.currentScore)} / 1000`;

    if (state.currentScore < state.targetScore) {
      this.prestigeScoreText.color = UI_THEME.colors.legacy.c_44aa44;
    } else if (state.currentScore > state.targetScore) {
      this.prestigeScoreText.color = UI_THEME.colors.legacy.c_aa4444;
    } else {
      this.prestigeScoreText.color = UI_THEME.colors.legacy.c_888888;
    }

    if (rejectionRate >= 20 && recommendedMax) {
      this.prestigePriceWarning.text = `⚠️ ${rejectionRate}% rej (max $${recommendedMax})`;
      this.prestigePriceWarning.color = UI_THEME.colors.legacy.c_ff6644;
    } else if (rejectionRate >= 5 && recommendedMax) {
      this.prestigePriceWarning.text = `💰 ${rejectionRate}% rej (max $${recommendedMax})`;
      this.prestigePriceWarning.color = UI_THEME.colors.legacy.c_ffaa44;
    } else if (rejectionRate >= 5) {
      this.prestigePriceWarning.text = `💰 ${rejectionRate}% rejection`;
      this.prestigePriceWarning.color = UI_THEME.colors.legacy.c_ffaa44;
    } else {
      this.prestigePriceWarning.text = '';
    }
  }

  public updateObjective(text: string, completed: boolean = false): void {
    this.objectiveText.text = `🎯 ${text}${completed ? ' ✅' : ''}`;
    this.objectiveText.color = completed ? '#00ff00' : '#ffcc00';
    this.objectiveText.isVisible = true;
  }

  public updateScenarioProgress(
    objectiveText: string,
    currentValue: number,
    targetValue: number,
    daysElapsed: number,
    dayLimit?: number,
    completed: boolean = false
  ): void {
    this.scenarioPanel.isVisible = true;
    this.layoutRightHudPanels();

    const progress = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
    this.scenarioProgressFill.width = `${progress}%`;

    if (completed) {
      this.scenarioProgressText.text = `✅ ${objectiveText}`;
      this.scenarioProgressText.color = UI_THEME.colors.legacy.c_00ff00;
      this.scenarioProgressFill.background = UI_THEME.colors.legacy.c_00ff00;
    } else {
      this.scenarioProgressText.text = objectiveText;
      this.scenarioProgressText.color = UI_THEME.colors.legacy.c_ffffff;
      this.scenarioProgressFill.background = progress >= 75 ? '#44aa44' : progress >= 50 ? '#aaaa44' : '#aa6644';
    }

    if (dayLimit) {
      const daysRemaining = dayLimit - daysElapsed;
      if (daysRemaining <= 7) {
        this.daysRemainingText.color = UI_THEME.colors.legacy.c_ff6666;
      } else if (daysRemaining <= 14) {
        this.daysRemainingText.color = UI_THEME.colors.legacy.c_ffaa44;
      } else {
        this.daysRemainingText.color = UI_THEME.colors.legacy.c_aaaaaa;
      }
      this.daysRemainingText.text = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
    } else {
      this.daysRemainingText.text = `Day ${daysElapsed}`;
      this.daysRemainingText.color = UI_THEME.colors.legacy.c_aaaaaa;
    }
  }

  public setBuildMode(mode: 'terrain' | 'holes' | 'assets' | null): void {
    if (!this.buildPanel || !this.buildModeText || !this.buildHintText) return;

    if (mode === null) {
      this.buildPanel.isVisible = false;
      this.layoutRightHudPanels();
      return;
    }

    this.buildPanel.isVisible = true;
    if (mode === 'terrain') {
      this.buildModeText.text = 'Terrain Shaper';
      this.buildHintText.text = 'Shape land and paint surfaces. Press J for holes or K for assets.';
    } else if (mode === 'holes') {
      this.buildModeText.text = 'Hole Designer';
      this.buildHintText.text = 'Select and drag tees or pins. Press T for land or K for assets.';
    } else {
      this.buildModeText.text = 'Asset Builder';
      this.buildHintText.text = 'Place, drag, rotate, and delete props. Press T for land or J for holes.';
    }
    this.layoutRightHudPanels();
  }

  public hideScenarioPanel(): void {
    this.scenarioPanel.isVisible = false;
    this.layoutRightHudPanels();
  }

  public updateMinimapPlayerPosition(x: number, y: number, mapWidth: number, mapHeight: number): void {
    this.minimapWorldWidth = Math.max(1, mapWidth);
    this.minimapWorldHeight = Math.max(1, mapHeight);
    const relX = (x / mapWidth) * this.minimapPixelWidth - this.minimapPixelWidth / 2;
    const relY = (y / mapHeight) * this.minimapPixelHeight - this.minimapPixelHeight / 2;
    this.minimapPlayerDot.left = `${relX}px`;
    this.minimapPlayerDot.top = `${relY}px`;
    this.minimapPlayerDot.isVisible = true;
  }

  public updateMinimapWorkers(
    workers: readonly { gridX: number; gridY: number; task: string }[],
    mapWidth: number,
    mapHeight: number
  ): void {
    // Remove excess dots
    while (this.minimapWorkerDots.length > workers.length) {
      const dot = this.minimapWorkerDots.pop();
      if (dot) {
        this.minimapMapArea.removeControl(dot);
      }
    }

    // Add new dots if needed
    while (this.minimapWorkerDots.length < workers.length) {
      const dot = new Ellipse(`workerDot_${this.minimapWorkerDots.length}`);
      dot.width = '6px';
      dot.height = '6px';
      dot.background = UI_THEME.colors.legacy.c_ff9933;
      dot.color = UI_THEME.colors.legacy.c_cc6600;
      dot.thickness = 1;
      dot.isPointerBlocker = false;
      this.minimapMapArea.addControl(dot);
      this.minimapWorkerDots.push(dot);
    }

    // Update positions
    workers.forEach((worker, i) => {
      const dot = this.minimapWorkerDots[i];
      const relX = (worker.gridX / mapWidth) * this.minimapPixelWidth - this.minimapPixelWidth / 2;
      const relY = (worker.gridY / mapHeight) * this.minimapPixelHeight - this.minimapPixelHeight / 2;
      dot.left = `${relX}px`;
      dot.top = `${relY}px`;

      // Color based on task
      if (worker.task === 'idle') {
        dot.background = UI_THEME.colors.legacy.c_666666;
      } else if (worker.task === 'mow_grass') {
        dot.background = UI_THEME.colors.legacy.c_44aa44;
      } else if (worker.task === 'water_area') {
        dot.background = UI_THEME.colors.legacy.c_4488cc;
      } else if (worker.task === 'fertilize_area') {
        dot.background = UI_THEME.colors.legacy.c_cc8844;
      } else {
        dot.background = UI_THEME.colors.legacy.c_ff9933;
      }
    });
  }

  public updateMinimapRobots(
    robots: readonly { worldX: number; worldZ: number; state: string }[],
    mapWidth: number,
    mapHeight: number
  ): void {
    while (this.minimapRobotDots.length > robots.length) {
      const dot = this.minimapRobotDots.pop();
      if (dot) {
        this.minimapMapArea.removeControl(dot);
      }
    }

    while (this.minimapRobotDots.length < robots.length) {
      const dot = new Ellipse(`robotDot_${this.minimapRobotDots.length}`);
      dot.width = '6px';
      dot.height = '6px';
      dot.background = '#5db3ff';
      dot.color = '#d8f0ff';
      dot.thickness = 1;
      dot.isPointerBlocker = false;
      this.minimapMapArea.addControl(dot);
      this.minimapRobotDots.push(dot);
    }

    robots.forEach((robot, index) => {
      const dot = this.minimapRobotDots[index];
      const relX = (robot.worldX / mapWidth) * this.minimapPixelWidth - this.minimapPixelWidth / 2;
      const relY = (robot.worldZ / mapHeight) * this.minimapPixelHeight - this.minimapPixelHeight / 2;
      dot.left = `${relX}px`;
      dot.top = `${relY}px`;
      dot.background =
        robot.state === 'broken'
          ? '#ff7f7f'
          : robot.state === 'charging'
            ? '#ffe08a'
            : '#5db3ff';
    });
  }

  public updateMinimapGolfers(
    golfers: readonly { worldX: number; worldZ: number }[],
    mapWidth: number,
    mapHeight: number
  ): void {
    while (this.minimapGolferDots.length > golfers.length) {
      const dot = this.minimapGolferDots.pop();
      if (dot) {
        this.minimapMapArea.removeControl(dot);
      }
    }

    while (this.minimapGolferDots.length < golfers.length) {
      const dot = new Ellipse(`golferDot_${this.minimapGolferDots.length}`);
      dot.width = '4px';
      dot.height = '4px';
      dot.background = '#ffffff';
      dot.color = '#cccccc';
      dot.thickness = 1;
      dot.isPointerBlocker = false;
      this.minimapMapArea.addControl(dot);
      this.minimapGolferDots.push(dot);
    }

    golfers.forEach((golfer, index) => {
      const dot = this.minimapGolferDots[index];
      const relX = (golfer.worldX / mapWidth) * this.minimapPixelWidth - this.minimapPixelWidth / 2;
      const relY = (golfer.worldZ / mapHeight) * this.minimapPixelHeight - this.minimapPixelHeight / 2;
      dot.left = `${relX}px`;
      dot.top = `${relY}px`;
    });
  }

  public dispose(): void {
    this.focusManager.dispose();
    this.advancedTexture.dispose();
  }
}
