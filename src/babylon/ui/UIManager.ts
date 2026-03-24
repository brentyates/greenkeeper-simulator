import { Scene } from '@babylonjs/core/scene';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Ellipse } from '@babylonjs/gui/2D/controls/ellipse';
import { Button } from '@babylonjs/gui/2D/controls/button';
import { UI_THEME } from './UITheme';

import { EquipmentType } from '../../core/equipment-logic';
import { PrestigeState, getStarDisplay, TIER_LABELS } from '../../core/prestige';
import { OverlayMode } from '../../core/terrain';
import { FocusManager } from './FocusManager';
import { AccessibleButton, createAccessibleButton } from './AccessibleButton';
import { createOverlayPopup, createPopupHeader, createSectionDivider, POPUP_COLORS } from './PopupUtils';

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

  private equipmentSlots: Rectangle[] = [];
  private equipmentTexts: TextBlock[] = [];

  private dayText!: TextBlock;
  private timeText!: TextBlock;
  private weatherText!: TextBlock;
  private weatherIcon!: TextBlock;

  private fuelBar!: Rectangle;
  private fuelText!: TextBlock;
  private waterBar!: Rectangle;
  private waterText!: TextBlock;
  private fertBar!: Rectangle;
  private fertText!: TextBlock;

  private scoreText!: TextBlock;
  private objectiveText!: TextBlock;

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

  private prestigePanel!: Rectangle;
  private prestigeStarsText!: TextBlock;
  private prestigeTierText!: TextBlock;
  private prestigeScoreText!: TextBlock;
  private prestigePriceWarning!: TextBlock;

  private operationsPanel!: Rectangle;
  private operationsCrewText!: TextBlock;
  private operationsDemandText!: TextBlock;
  private operationsResearchText!: TextBlock;
  private operationsAutomationText!: TextBlock;
  private operationsIrrigationText!: TextBlock;

  private minimapContainer!: Rectangle;
  private minimapPlayerDot!: Ellipse;
  private minimapMapArea!: Rectangle;
  private minimapWorkerDots: Ellipse[] = [];

  private notificationContainer!: StackPanel;

  private pauseOverlay!: Rectangle;
  private speedText!: TextBlock;
  private onResume?: () => void;
  private onRestart?: () => void;
  private onMainMenu?: () => void;
  private onSave?: () => void;
  private onEmployees?: () => void;
  private onResearch?: () => void;
  private onTeeSheet?: () => void;
  private onIrrigation?: () => void;
  private onHoleBuilder?: () => void;
  private onEquipmentStore?: () => void;
  private onAmenityPanel?: () => void;
  private onCourseLayout?: () => void;
  private onSpeedChange?: (delta: number) => void;
  private onPriceChange?: (delta: number) => void;

  private currentPriceText!: TextBlock;

  private overlayLegend!: Rectangle;
  private overlayLegendTitle!: TextBlock;
  private overlayLegendGradient!: Rectangle;
  private overlayLegendLowLabel!: TextBlock;
  private overlayLegendHighLabel!: TextBlock;

  constructor(scene: Scene) {
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
    this.focusManager = new FocusManager(scene);

    this.createCourseStatusPanel();
    this.createEquipmentSelector();
    this.createStatusRailBackdrop();
    this.createTimePanel();
    this.createEconomyPanel();
    this.createPrestigePanel();
    this.createScenarioPanel();
    this.createOperationsPanel();
    this.createResourcesPanel();
    this.createScorePanel();
    this.createUtilityDockBackdrop();
    this.createMinimap();
    this.createNotificationArea();
    this.createControlsHelp();
    this.createPauseOverlay();
    this.createOverlayLegend();
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

  private createStatusRailBackdrop(): void {
    const rail = new Rectangle('statusRailBackdrop');
    rail.width = '244px';
    rail.height = '528px';
    rail.cornerRadius = UI_THEME.radii.panel;
    rail.color = UI_THEME.colors.border.muted;
    rail.thickness = 1;
    rail.background = 'rgba(9, 22, 17, 0.34)';
    rail.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    rail.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    rail.left = '-6px';
    rail.top = '6px';
    rail.shadowColor = UI_THEME.colors.effects.shadow;
    rail.shadowBlur = 14;
    rail.shadowOffsetY = 6;
    this.advancedTexture.addControl(rail);
  }

  private createUtilityDockBackdrop(): void {
    const dock = new Rectangle('utilityDockBackdrop');
    dock.width = '392px';
    dock.height = '170px';
    dock.cornerRadius = UI_THEME.radii.panel;
    dock.color = UI_THEME.colors.border.muted;
    dock.thickness = 1;
    dock.background = 'rgba(9, 22, 17, 0.3)';
    dock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    dock.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    dock.left = '-6px';
    dock.top = '-6px';
    dock.shadowColor = UI_THEME.colors.effects.shadow;
    dock.shadowBlur = 14;
    dock.shadowOffsetY = 6;
    this.advancedTexture.addControl(dock);
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

  private createEquipmentSelector(): void {
    const container = new Rectangle('equipmentContainer');
    container.width = '220px';
    container.height = '70px';
    container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    container.top = '10px';
    container.background = 'transparent';
    container.thickness = 0;
    this.advancedTexture.addControl(container);

    const grid = new Grid('equipmentGrid');
    grid.addColumnDefinition(1/3);
    grid.addColumnDefinition(1/3);
    grid.addColumnDefinition(1/3);
    container.addControl(grid);

    const equipmentData = [
      { key: '1', name: 'Mower', icon: '🚜', color: '#DC143C' },
      { key: '2', name: 'Sprinkler', icon: '💦', color: '#00CED1' },
      { key: '3', name: 'Spreader', icon: '🌾', color: '#FFD700' },
    ];

    equipmentData.forEach((eq, index) => {
      const slot = new Rectangle(`slot${index}`);
      slot.width = '65px';
      slot.height = '60px';
      slot.cornerRadius = UI_THEME.radii.scale.r5;
      slot.background = UI_THEME.colors.legacy.c_1a3a2a;
      slot.color = UI_THEME.colors.legacy.c_3a5a4a;
      slot.thickness = 2;

      const stack = new StackPanel();
      stack.paddingTop = '5px';
      slot.addControl(stack);

      const badge = new Ellipse(`badge${index}`);
      badge.width = '16px';
      badge.height = '16px';
      badge.background = UI_THEME.colors.legacy.c_2a5a3a;
      badge.color = UI_THEME.colors.legacy.c_4a8a5a;
      badge.thickness = 1;
      badge.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      badge.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      badge.left = '3px';
      badge.top = '3px';
      slot.addControl(badge);

      const keyText = new TextBlock();
      keyText.text = eq.key;
      keyText.color = 'white';
      keyText.fontSize = UI_THEME.typography.scale.s9;
      badge.addControl(keyText);

      const iconBg = new Rectangle();
      iconBg.width = '40px';
      iconBg.height = '24px';
      iconBg.cornerRadius = UI_THEME.radii.scale.r3;
      iconBg.background = eq.color;
      iconBg.alpha = 0.8;
      stack.addControl(iconBg);

      const iconText = new TextBlock();
      iconText.text = eq.icon;
      iconText.fontSize = UI_THEME.typography.scale.s14;
      iconBg.addControl(iconText);

      const nameText = new TextBlock(`name${index}`);
      nameText.text = eq.name;
      nameText.color = UI_THEME.colors.legacy.c_999999;
      nameText.fontSize = UI_THEME.typography.scale.s10;
      nameText.fontFamily = 'Arial, sans-serif';
      nameText.height = '18px';
      nameText.paddingTop = '4px';
      stack.addControl(nameText);

      this.equipmentSlots.push(slot);
      this.equipmentTexts.push(nameText);
      grid.addControl(slot, 0, index);
    });

    this.updateEquipmentSelection(0);
  }

  private updateEquipmentSelection(index: number): void {
    this.equipmentSlots.forEach((slot, i) => {
      if (i === index) {
        slot.color = UI_THEME.colors.legacy.c_7fff7f;
        slot.thickness = 3;
        slot.background = UI_THEME.colors.legacy.c_2a5a3a;
      } else {
        slot.color = UI_THEME.colors.legacy.c_3a5a4a;
        slot.thickness = 2;
        slot.background = UI_THEME.colors.legacy.c_1a3a2a;
      }
    });
  }

  private createTimePanel(): void {
    const panel = new Rectangle('timePanel');
    panel.width = '118px';
    panel.height = '92px';
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
    this.dayText.width = '80px';
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

  private createEconomyPanel(): void {
    this.economyPanel = new Rectangle('economyPanel');
    this.economyPanel.width = '152px';
    this.economyPanel.height = '88px';
    this.economyPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.economyPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.economyPanel.left = '-10px';
    this.economyPanel.top = '110px';
    this.applyHudPanelStyle(this.economyPanel);
    this.advancedTexture.addControl(this.economyPanel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    this.economyPanel.addControl(stack);

    const cashRow = new StackPanel();
    cashRow.isVertical = false;
    cashRow.height = '22px';
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
    golfersRow.height = '20px';
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
    satisfactionRow.height = '20px';
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
  }

  private createPrestigePanel(): void {
    this.prestigePanel = new Rectangle('prestigePanel');
    this.prestigePanel.width = '152px';
    this.prestigePanel.height = '120px';
    this.prestigePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.prestigePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.prestigePanel.left = '-10px';
    this.prestigePanel.top = '205px';
    this.applyHudPanelStyle(this.prestigePanel);
    this.advancedTexture.addControl(this.prestigePanel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    this.prestigePanel.addControl(stack);

    const titleRow = new StackPanel();
    titleRow.isVertical = false;
    titleRow.height = '14px';
    stack.addControl(titleRow);

    const titleLabel = new TextBlock();
    titleLabel.text = 'PRESTIGE';
    titleLabel.color = UI_THEME.colors.text.secondary;
    titleLabel.fontSize = UI_THEME.typography.scale.s10;
    titleLabel.width = '120px';
    titleLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleRow.addControl(titleLabel);

    this.prestigeStarsText = new TextBlock('prestigeStars');
    this.prestigeStarsText.text = '★☆☆☆☆';
    this.prestigeStarsText.color = UI_THEME.colors.text.accent;
    this.prestigeStarsText.fontSize = UI_THEME.typography.scale.s14;
    this.prestigeStarsText.height = '20px';
    this.prestigeStarsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigeStarsText);

    this.prestigeTierText = new TextBlock('prestigeTier');
    this.prestigeTierText.text = 'Municipal';
    this.prestigeTierText.color = UI_THEME.colors.text.secondary;
    this.prestigeTierText.fontSize = UI_THEME.typography.scale.s11;
    this.prestigeTierText.height = '16px';
    this.prestigeTierText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigeTierText);

    this.prestigeScoreText = new TextBlock('prestigeScore');
    this.prestigeScoreText.text = '100 / 1000';
    this.prestigeScoreText.color = UI_THEME.colors.text.muted;
    this.prestigeScoreText.fontSize = UI_THEME.typography.scale.s9;
    this.prestigeScoreText.height = '14px';
    this.prestigeScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigeScoreText);

    this.prestigePriceWarning = new TextBlock('prestigePriceWarning');
    this.prestigePriceWarning.text = '';
    this.prestigePriceWarning.color = UI_THEME.colors.text.warning;
    this.prestigePriceWarning.fontSize = UI_THEME.typography.scale.s9;
    this.prestigePriceWarning.height = '14px';
    this.prestigePriceWarning.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigePriceWarning);

    const priceRow = new StackPanel();
    priceRow.isVertical = false;
    priceRow.height = '22px';
    priceRow.paddingTop = '2px';
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
    this.scenarioPanel.width = '208px';
    this.scenarioPanel.height = '80px';
    this.scenarioPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.scenarioPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.scenarioPanel.left = '-10px';
    this.scenarioPanel.top = '325px';
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
    this.scenarioProgressBar.width = '188px';
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

  private createOperationsPanel(): void {
    this.operationsPanel = new Rectangle('operationsPanel');
    this.operationsPanel.width = '224px';
    this.operationsPanel.height = '126px';
    this.operationsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.operationsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.operationsPanel.left = '-10px';
    this.operationsPanel.top = '405px';
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
    this.operationsCrewText.text = '👷 Crew: 0 active / 0 idle';
    this.operationsCrewText.color = UI_THEME.colors.text.secondary;
    this.operationsCrewText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsCrewText.height = '16px';
    this.operationsCrewText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsCrewText);

    this.operationsDemandText = new TextBlock('operationsDemand');
    this.operationsDemandText.text = '⛳ Tee: 0/0 | Queue: 0';
    this.operationsDemandText.color = UI_THEME.colors.text.secondary;
    this.operationsDemandText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsDemandText.height = '16px';
    this.operationsDemandText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsDemandText);

    this.operationsResearchText = new TextBlock('operationsResearch');
    this.operationsResearchText.text = '🔬 Research: None';
    this.operationsResearchText.color = UI_THEME.colors.text.muted;
    this.operationsResearchText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsResearchText.height = '16px';
    this.operationsResearchText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsResearchText);

    this.operationsAutomationText = new TextBlock('operationsAutomation');
    this.operationsAutomationText.text = '🤖 Robots: 0 active, 0 broken';
    this.operationsAutomationText.color = UI_THEME.colors.text.secondary;
    this.operationsAutomationText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsAutomationText.height = '16px';
    this.operationsAutomationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsAutomationText);

    this.operationsIrrigationText = new TextBlock('operationsIrrigation');
    this.operationsIrrigationText.text = '💧 Heads: 0 | Leaks: 0';
    this.operationsIrrigationText.color = UI_THEME.colors.text.info;
    this.operationsIrrigationText.fontSize = UI_THEME.typography.scale.s10;
    this.operationsIrrigationText.height = '16px';
    this.operationsIrrigationText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.operationsIrrigationText);
  }

  private createResourcesPanel(): void {
    const panel = new Rectangle('resourcesPanel');
    panel.width = '432px';
    panel.height = '58px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = '10px';
    panel.top = '-10px';
    this.applyHudPanelStyle(panel);
    this.advancedTexture.addControl(panel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '10px';
    panel.addControl(stack);

    const title = new TextBlock();
    title.text = 'RESOURCES';
    title.color = UI_THEME.colors.text.secondary;
    title.fontSize = UI_THEME.typography.scale.s10;
    title.fontFamily = UI_THEME.typography.fontFamily;
    title.height = '14px';
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(title);

    const grid = new Grid();
    grid.height = '28px';
    grid.addColumnDefinition(1/3);
    grid.addColumnDefinition(1/3);
    grid.addColumnDefinition(1/3);
    stack.addControl(grid);

    const { container: fuelContainer, bar: fBar, text: fText } = this.createResourceItem('⛽', 'Fuel', '#ff4444');
    this.fuelBar = fBar;
    this.fuelText = fText;
    grid.addControl(fuelContainer, 0, 0);

    const { container: waterContainer, bar: wBar, text: wText } = this.createResourceItem('🚿', 'Water', '#4488ff');
    this.waterBar = wBar;
    this.waterText = wText;
    grid.addControl(waterContainer, 0, 1);

    const { container: fertContainer, bar: fertBar, text: fertText } = this.createResourceItem('🧪', 'Fert.', '#ffcc44');
    this.fertBar = fertBar;
    this.fertText = fertText;
    grid.addControl(fertContainer, 0, 2);
  }

  private createResourceItem(icon: string, label: string, color: string): { container: Grid; bar: Rectangle; text: TextBlock } {
    const container = new Grid();
    container.addColumnDefinition(22, true);
    container.addColumnDefinition(35, true);
    container.addColumnDefinition(50, true);
    container.addColumnDefinition(35, true);

    const iconText = new TextBlock();
    iconText.text = icon;
    iconText.fontSize = UI_THEME.typography.scale.s12;
    container.addControl(iconText, 0, 0);

    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = color;
    labelText.fontSize = UI_THEME.typography.scale.s11;
    labelText.fontFamily = UI_THEME.typography.fontFamily;
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.addControl(labelText, 0, 1);

    const barBg = new Rectangle();
    barBg.width = '45px';
    barBg.height = '10px';
    barBg.cornerRadius = UI_THEME.radii.scale.r2;
    barBg.background = UI_THEME.colors.surfaces.hudInset;
    barBg.color = UI_THEME.colors.border.muted;
    barBg.thickness = 1;
    barBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    const bar = new Rectangle();
    bar.width = '45px';
    bar.height = '10px';
    bar.cornerRadius = UI_THEME.radii.scale.r2;
    bar.background = color;
    bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    barBg.addControl(bar);

    container.addControl(barBg, 0, 2);

    const text = new TextBlock();
    text.text = '100%';
    text.color = color;
    text.fontSize = UI_THEME.typography.scale.s10;
    text.fontFamily = UI_THEME.typography.fontFamily;
    text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    container.addControl(text, 0, 3);

    return { container, bar, text };
  }

  private createScorePanel(): void {
    const panel = new Rectangle('scorePanel');
    panel.width = '120px';
    panel.height = '42px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.top = '-10px';
    this.applyHudPanelStyle(panel, true);
    this.advancedTexture.addControl(panel);

    const row = new StackPanel();
    row.isVertical = false;
    panel.addControl(row);

    const trophy = new TextBlock();
    trophy.text = '🏆';
    trophy.fontSize = UI_THEME.typography.scale.s16;
    trophy.width = '30px';
    row.addControl(trophy);

    this.scoreText = new TextBlock('scoreText');
    this.scoreText.text = '0';
    this.scoreText.color = UI_THEME.colors.text.accent;
    this.scoreText.fontSize = UI_THEME.typography.scale.s18;
    this.scoreText.fontFamily = UI_THEME.typography.fontFamily;
    this.scoreText.width = '80px';
    row.addControl(this.scoreText);
  }

  private createMinimap(): void {
    this.minimapContainer = new Rectangle('minimapContainer');
    this.minimapContainer.width = '170px';
    this.minimapContainer.height = '134px';
    this.minimapContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.minimapContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.minimapContainer.left = '-10px';
    this.minimapContainer.top = '-10px';
    this.applyHudPanelStyle(this.minimapContainer, true);
    this.advancedTexture.addControl(this.minimapContainer);

    const header = new Rectangle();
    header.width = '150px';
    header.height = '18px';
    header.background = UI_THEME.colors.surfaces.hudInset;
    header.cornerRadius = UI_THEME.radii.scale.r3;
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.top = '5px';
    this.minimapContainer.addControl(header);

    const headerText = new TextBlock();
    headerText.text = '📍 MINIMAP';
    headerText.color = UI_THEME.colors.text.primary;
    headerText.fontSize = UI_THEME.typography.scale.s10;
    headerText.fontFamily = UI_THEME.typography.fontFamily;
    header.addControl(headerText);

    this.minimapMapArea = new Rectangle('mapArea');
    this.minimapMapArea.width = '140px';
    this.minimapMapArea.height = '96px';
    this.minimapMapArea.background = '#2a8f2a';
    this.minimapMapArea.cornerRadius = UI_THEME.radii.scale.r3;
    this.minimapMapArea.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.minimapMapArea.top = '-8px';
    this.minimapContainer.addControl(this.minimapMapArea);

    this.minimapPlayerDot = new Ellipse('playerDot');
    this.minimapPlayerDot.width = '10px';
    this.minimapPlayerDot.height = '10px';
    this.minimapPlayerDot.background = 'white';
    this.minimapPlayerDot.color = UI_THEME.colors.legacy.c_7fff7f;
    this.minimapPlayerDot.thickness = 2;
    this.minimapMapArea.addControl(this.minimapPlayerDot);
  }

  private createNotificationArea(): void {
    this.notificationContainer = new StackPanel('notificationContainer');
    this.notificationContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.notificationContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.notificationContainer.top = '-70px';
    this.notificationContainer.width = '300px';
    this.advancedTexture.addControl(this.notificationContainer);

    this.objectiveText = new TextBlock('objectiveText');
    this.objectiveText.text = '';
    this.objectiveText.color = UI_THEME.colors.legacy.c_ffcc00;
    this.objectiveText.fontSize = UI_THEME.typography.scale.s12;
    this.objectiveText.height = '20px';
    this.objectiveText.isVisible = false;
    this.notificationContainer.addControl(this.objectiveText);
  }

  private createControlsHelp(): void {
    const panel = new Rectangle('helpPanel');
    panel.width = '188px';
    panel.height = '176px';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = '-198px';
    panel.top = '-10px';
    this.applyHudPanelStyle(panel);
    this.advancedTexture.addControl(panel);

    const stack = new StackPanel('helpStack');
    stack.paddingTop = '6px';
    panel.addControl(stack);

    const lines = [
      'Move  WASD / Arrows',
      'Tools  1 / 2 / 3',
      'Use  Space / E',
      'View  [ / ] zoom, P pause',
      'MANAGEMENT',
      'H Crew   Y Research',
      'G Tee    I Water',
      'B Store  U Amenities',
      'J Holes  L Layout',
    ];

    for (const line of lines) {
      const text = new TextBlock();
      text.text = line;
      text.color = line === 'MANAGEMENT' ? UI_THEME.colors.text.secondary : UI_THEME.colors.text.muted;
      text.fontSize = UI_THEME.typography.scale.s10;
      text.fontFamily = UI_THEME.typography.fontFamily;
      text.height = '16px';
      text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      text.paddingLeft = '8px';
      stack.addControl(text);
    }
  }

  private createPauseOverlay(): void {
    const POPUP_W = 400;
    const CONTENT_W = POPUP_W - 36;
    const W = `${CONTENT_W}px`;
    const BTN_W = `${Math.floor(CONTENT_W / 2 - 4)}px`;

    const { overlay, stack } = createOverlayPopup(this.advancedTexture, {
      name: 'pause',
      width: POPUP_W,
      height: 520,
      colors: POPUP_COLORS.green,
      padding: 18,
    });
    this.pauseOverlay = overlay;

    createPopupHeader(stack, {
      title: '⏸ PAUSED',
      width: CONTENT_W,
      onClose: () => this.onResume?.(),
      closeLabel: 'Skip',
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

    const secondaryRow = new Grid('secondaryActions');
    secondaryRow.width = W;
    secondaryRow.height = '42px';
    secondaryRow.paddingTop = '6px';
    secondaryRow.addColumnDefinition(1 / 3);
    secondaryRow.addColumnDefinition(1 / 3);
    secondaryRow.addColumnDefinition(1 / 3);
    secondaryRow.addRowDefinition(1.0);
    stack.addControl(secondaryRow);

    const makeSecondaryBtn = (label: string, col: number, onClick: () => void) => {
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
    };

    makeSecondaryBtn('💾 Save', 0, () => { this.onSave?.(); this.showNotification('Game saved!'); });
    makeSecondaryBtn('↺ Restart', 1, () => this.onRestart?.());
    makeSecondaryBtn('⌂ Menu', 2, () => this.onMainMenu?.());

    createSectionDivider(stack, 'MANAGEMENT', CONTENT_W);

    const mgmtGrid = new Grid('pauseManagementGrid');
    mgmtGrid.width = W;
    mgmtGrid.height = '148px';
    mgmtGrid.paddingTop = '6px';
    mgmtGrid.addColumnDefinition(0.5);
    mgmtGrid.addColumnDefinition(0.5);
    mgmtGrid.addRowDefinition(0.25);
    mgmtGrid.addRowDefinition(0.25);
    mgmtGrid.addRowDefinition(0.25);
    mgmtGrid.addRowDefinition(0.25);
    stack.addControl(mgmtGrid);

    const makeMgmtBtn = (label: string, row: number, col: number, onClick: () => void) => {
      const btn = createAccessibleButton({
        label,
        fontSize: 13,
        width: BTN_W,
        height: '30px',
        backgroundColor: UI_THEME.colors.action.neutral.normal,
        borderColor: UI_THEME.colors.border.default,
        onClick: () => { this.hidePauseMenu(); onClick(); },
        focusGroup: 'pause-menu'
      }, this.focusManager);
      mgmtGrid.addControl(btn.control, row, col);
      this.pauseMenuButtons.push(btn);
    };

    makeMgmtBtn('👥 Employees', 0, 0, () => this.onEmployees?.());
    makeMgmtBtn('🔬 Research', 0, 1, () => this.onResearch?.());
    makeMgmtBtn('📋 Tee Sheet', 1, 0, () => this.onTeeSheet?.());
    makeMgmtBtn('💧 Irrigation', 1, 1, () => this.onIrrigation?.());
    makeMgmtBtn('🛒 Equipment', 2, 0, () => this.onEquipmentStore?.());
    makeMgmtBtn('🏛️ Amenities', 2, 1, () => this.onAmenityPanel?.());
    makeMgmtBtn('🛠 Hole Builder', 3, 0, () => this.onHoleBuilder?.());
    makeMgmtBtn('⛳ Course Layout', 3, 1, () => this.onCourseLayout?.());

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

    const spacerR = new Rectangle();
    spacerR.width = '100px';
    spacerR.thickness = 0;
    speedRow.addControl(spacerR);

    const hint = new TextBlock('pauseHint');
    hint.text = 'P / ESC to return';
    hint.color = UI_THEME.colors.text.muted;
    hint.fontSize = 10;
    hint.fontFamily = UI_THEME.typography.fontFamily;
    hint.height = '20px';
    hint.paddingTop = '8px';
    stack.addControl(hint);
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
    onIrrigation?: () => void,
    onHoleBuilder?: () => void,
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
    this.onIrrigation = onIrrigation;
    this.onHoleBuilder = onHoleBuilder;
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

  public updateCurrentPrice(price: number): void {
    if (this.currentPriceText) {
      this.currentPriceText.text = `$${price}`;
    }
  }

  public showNotification(message: string, color?: string, duration: number = 5000): void {
    const isWarning = color === '#ffaa44' || color === 'warning';
    const bgColor = isWarning ? 'rgba(90, 58, 42, 0.95)' : 'rgba(42, 90, 58, 0.95)';
    const borderColor = color || (isWarning ? '#ffaa44' : '#7FFF7F');

    const notification = new Rectangle('notification');
    notification.width = `${Math.max(200, message.length * 8 + 40)}px`;
    notification.height = '36px';
    notification.cornerRadius = UI_THEME.radii.scale.r5;
    notification.background = bgColor;
    notification.color = borderColor;
    notification.thickness = 2;
    notification.paddingBottom = '10px';

    const text = new TextBlock();
    text.text = message;
    text.color = 'white';
    text.fontSize = UI_THEME.typography.scale.s14;
    text.fontFamily = 'Arial, sans-serif';
    notification.addControl(text);

    this.notificationContainer.addControl(notification);

    setTimeout(() => {
      this.notificationContainer.removeControl(notification);
    }, duration);
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

  public updateEquipment(type: EquipmentType | null, isActive: boolean): void {
    if (type === null) {
      this.equipmentSlots.forEach((slot) => {
        slot.color = UI_THEME.colors.legacy.c_666666;
        slot.thickness = 1;
        slot.background = UI_THEME.colors.legacy.c_1a3a2a;
        slot.alpha = 0.7;
      });
      return;
    }

    const typeIndex: Record<EquipmentType, number> = {
      mower: 0,
      sprinkler: 1,
      spreader: 2,
    };
    this.updateEquipmentSelection(typeIndex[type]);

    if (isActive) {
      this.equipmentSlots[typeIndex[type]].alpha = 1;
    }
  }

  public updateResources(fuel: number, water: number, fert: number): void {
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
    bookedTeeTimes: number;
    totalTeeTimes: number;
    researchName: string | null;
    researchProgress: number;
    robotsWorking: number;
    robotsBroken: number;
    sprinklersPumping: number;
    sprinklersDry: number;
    pipeLeaks: number;
  }): void {
    this.operationsCrewText.text =
      `👷 Crew: ${summary.workersActive} active / ${summary.workersIdle} idle`;
    this.operationsDemandText.text =
      `⛳ Tee: ${summary.bookedTeeTimes}/${summary.totalTeeTimes}`;

    if (summary.researchName) {
      this.operationsResearchText.text =
        `🔬 ${summary.researchName}: ${Math.round(summary.researchProgress)}%`;
      this.operationsResearchText.color = UI_THEME.colors.legacy.c_88ff88;
    } else {
      this.operationsResearchText.text =
        `🔬 Research: idle`;
      this.operationsResearchText.color = UI_THEME.colors.legacy.c_888888;
    }

    this.operationsAutomationText.text =
      `🤖 Work:${summary.robotsWorking} Down:${summary.robotsBroken}`;
    this.operationsAutomationText.color = summary.robotsBroken > 0 ? '#ff8844' : '#aaaaaa';

    this.operationsIrrigationText.text =
      `💧 Pump:${summary.sprinklersPumping} Dry:${summary.sprinklersDry} Leaks:${summary.pipeLeaks}`;
    this.operationsIrrigationText.color =
      summary.pipeLeaks > 0 || summary.sprinklersDry > 0 ? '#ff8844' : '#88ccff';
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

  public hideScenarioPanel(): void {
    this.scenarioPanel.isVisible = false;
  }

  public updateMinimapPlayerPosition(x: number, y: number, mapWidth: number, mapHeight: number): void {
    const relX = (x / mapWidth) * 140 - 70;
    const relY = (y / mapHeight) * 96 - 48;
    this.minimapPlayerDot.left = `${relX}px`;
    this.minimapPlayerDot.top = `${relY}px`;
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
      this.minimapMapArea.addControl(dot);
      this.minimapWorkerDots.push(dot);
    }

    // Update positions
    workers.forEach((worker, i) => {
      const dot = this.minimapWorkerDots[i];
      const relX = (worker.gridX / mapWidth) * 140 - 70;
      const relY = (worker.gridY / mapHeight) * 96 - 48;
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

  public dispose(): void {
    this.focusManager.dispose();
    this.advancedTexture.dispose();
  }
}
