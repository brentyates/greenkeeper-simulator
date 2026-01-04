import { Scene } from '@babylonjs/core/scene';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Ellipse } from '@babylonjs/gui/2D/controls/ellipse';
import { Button } from '@babylonjs/gui/2D/controls/button';

import { EquipmentType } from '../../core/equipment-logic';
import { PrestigeState, getStarDisplay, TIER_LABELS } from '../../core/prestige';
import { FocusManager } from './FocusManager';
import { AccessibleButton, createAccessibleButton } from './AccessibleButton';

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
  private onEmployees?: () => void;
  private onResearch?: () => void;
  private onTeeSheet?: () => void;
  private onMarketing?: () => void;
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
    this.createTimePanel();
    this.createEconomyPanel();
    this.createPrestigePanel();
    this.createScenarioPanel();
    this.createResourcesPanel();
    this.createScorePanel();
    this.createMinimap();
    this.createNotificationArea();
    this.createControlsHelp();
    this.createPauseOverlay();
    this.createOverlayLegend();
  }

  private createCourseStatusPanel(): void {
    const panel = new Rectangle('courseStatusPanel');
    panel.width = '200px';
    panel.height = '100px';
    panel.cornerRadius = 5;
    panel.color = '#4a8a5a';
    panel.thickness = 2;
    panel.background = 'rgba(26, 58, 42, 0.95)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.left = '10px';
    panel.top = '10px';
    this.advancedTexture.addControl(panel);

    const stack = new StackPanel('courseStack');
    stack.paddingTop = '8px';
    stack.paddingLeft = '10px';
    panel.addControl(stack);

    const title = new TextBlock('courseTitle');
    title.text = 'COURSE STATUS';
    title.color = '#7a9a7a';
    title.fontSize = 10;
    title.fontFamily = 'Arial, sans-serif';
    title.height = '16px';
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
    bar.width = '70px';
    bar.height = '10px';
    bar.cornerRadius = 2;
    bar.background = color;
    bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    const text = new TextBlock(`${name}Text`);
    text.text = '100%';
    text.color = color;
    text.fontSize = 11;
    text.fontFamily = 'Arial, sans-serif';

    return { bar, text };
  }

  private createStatRow(icon: string, label: string, bar: Rectangle, text: TextBlock, labelColor: string): Grid {
    const grid = new Grid(`${label}Row`);
    grid.height = '22px';
    grid.width = '180px';
    grid.addColumnDefinition(20, true);
    grid.addColumnDefinition(55, true);
    grid.addColumnDefinition(75, true);
    grid.addColumnDefinition(35, true);

    const iconText = new TextBlock();
    iconText.text = icon;
    iconText.fontSize = 12;
    grid.addControl(iconText, 0, 0);

    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = labelColor;
    labelText.fontSize = 11;
    labelText.fontFamily = 'Arial, sans-serif';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    grid.addControl(labelText, 0, 1);

    const barContainer = new Rectangle();
    barContainer.width = '70px';
    barContainer.height = '10px';
    barContainer.cornerRadius = 2;
    barContainer.background = '#1a3a2a';
    barContainer.color = '#3a5a4a';
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
      slot.cornerRadius = 5;
      slot.background = '#1a3a2a';
      slot.color = '#3a5a4a';
      slot.thickness = 2;

      const stack = new StackPanel();
      stack.paddingTop = '5px';
      slot.addControl(stack);

      const badge = new Ellipse(`badge${index}`);
      badge.width = '16px';
      badge.height = '16px';
      badge.background = '#2a5a3a';
      badge.color = '#4a8a5a';
      badge.thickness = 1;
      badge.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      badge.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      badge.left = '3px';
      badge.top = '3px';
      slot.addControl(badge);

      const keyText = new TextBlock();
      keyText.text = eq.key;
      keyText.color = 'white';
      keyText.fontSize = 9;
      badge.addControl(keyText);

      const iconBg = new Rectangle();
      iconBg.width = '40px';
      iconBg.height = '24px';
      iconBg.cornerRadius = 3;
      iconBg.background = eq.color;
      iconBg.alpha = 0.8;
      stack.addControl(iconBg);

      const iconText = new TextBlock();
      iconText.text = eq.icon;
      iconText.fontSize = 14;
      iconBg.addControl(iconText);

      const nameText = new TextBlock(`name${index}`);
      nameText.text = eq.name;
      nameText.color = '#999999';
      nameText.fontSize = 10;
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
        slot.color = '#7FFF7F';
        slot.thickness = 3;
        slot.background = '#2a5a3a';
      } else {
        slot.color = '#3a5a4a';
        slot.thickness = 2;
        slot.background = '#1a3a2a';
      }
    });
  }

  private createTimePanel(): void {
    const panel = new Rectangle('timePanel');
    panel.width = '110px';
    panel.height = '90px';
    panel.cornerRadius = 5;
    panel.color = '#4a8a5a';
    panel.thickness = 2;
    panel.background = 'rgba(26, 58, 42, 0.95)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.left = '-10px';
    panel.top = '10px';
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
    this.weatherIcon.fontSize = 13;
    this.weatherIcon.width = '20px';
    dayRow.addControl(this.weatherIcon);

    this.dayText = new TextBlock('dayText');
    this.dayText.text = 'Day 1';
    this.dayText.color = 'white';
    this.dayText.fontSize = 12;
    this.dayText.fontFamily = 'Arial, sans-serif';
    this.dayText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    dayRow.addControl(this.dayText);

    this.timeText = new TextBlock('timeText');
    this.timeText.text = '6:00 AM';
    this.timeText.color = '#ffcc00';
    this.timeText.fontSize = 14;
    this.timeText.fontFamily = 'Arial, sans-serif';
    this.timeText.height = '20px';
    stack.addControl(this.timeText);

    this.weatherText = new TextBlock('weatherText');
    this.weatherText.text = 'Sunny 72°F';
    this.weatherText.color = '#aaccff';
    this.weatherText.fontSize = 10;
    this.weatherText.fontFamily = 'Arial, sans-serif';
    this.weatherText.height = '16px';
    stack.addControl(this.weatherText);

    const speedBg = new Rectangle();
    speedBg.width = '40px';
    speedBg.height = '18px';
    speedBg.cornerRadius = 3;
    speedBg.background = '#2a5a3a';
    speedBg.color = '#4a8a5a';
    speedBg.thickness = 1;
    stack.addControl(speedBg);

    const speedText = new TextBlock();
    speedText.text = '1x';
    speedText.color = '#88ff88';
    speedText.fontSize = 11;
    speedBg.addControl(speedText);
  }

  private createEconomyPanel(): void {
    this.economyPanel = new Rectangle('economyPanel');
    this.economyPanel.width = '140px';
    this.economyPanel.height = '85px';
    this.economyPanel.cornerRadius = 5;
    this.economyPanel.color = '#4a8a5a';
    this.economyPanel.thickness = 2;
    this.economyPanel.background = 'rgba(26, 58, 42, 0.95)';
    this.economyPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.economyPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.economyPanel.left = '-10px';
    this.economyPanel.top = '110px';
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
    cashIcon.fontSize = 14;
    cashIcon.width = '24px';
    cashRow.addControl(cashIcon);

    this.cashText = new TextBlock('cashText');
    this.cashText.text = '$10,000';
    this.cashText.color = '#44ff44';
    this.cashText.fontSize = 14;
    this.cashText.fontFamily = 'Arial Black, sans-serif';
    this.cashText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    cashRow.addControl(this.cashText);

    const golfersRow = new StackPanel();
    golfersRow.isVertical = false;
    golfersRow.height = '20px';
    stack.addControl(golfersRow);

    const golferIcon = new TextBlock();
    golferIcon.text = '🏌️';
    golferIcon.fontSize = 13;
    golferIcon.width = '24px';
    golfersRow.addControl(golferIcon);

    this.golfersText = new TextBlock('golfersText');
    this.golfersText.text = '0 golfers';
    this.golfersText.color = '#aaaaaa';
    this.golfersText.fontSize = 11;
    this.golfersText.fontFamily = 'Arial, sans-serif';
    this.golfersText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    golfersRow.addControl(this.golfersText);

    const satisfactionRow = new StackPanel();
    satisfactionRow.isVertical = false;
    satisfactionRow.height = '20px';
    stack.addControl(satisfactionRow);

    const satisfactionIcon = new TextBlock();
    satisfactionIcon.text = '😊';
    satisfactionIcon.fontSize = 13;
    satisfactionIcon.width = '24px';
    satisfactionRow.addControl(satisfactionIcon);

    this.satisfactionText = new TextBlock('satisfactionText');
    this.satisfactionText.text = '-- rating';
    this.satisfactionText.color = '#aaaaaa';
    this.satisfactionText.fontSize = 11;
    this.satisfactionText.fontFamily = 'Arial, sans-serif';
    this.satisfactionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    satisfactionRow.addControl(this.satisfactionText);
  }

  private createPrestigePanel(): void {
    this.prestigePanel = new Rectangle('prestigePanel');
    this.prestigePanel.width = '140px';
    this.prestigePanel.height = '115px';
    this.prestigePanel.cornerRadius = 5;
    this.prestigePanel.color = '#4a8a5a';
    this.prestigePanel.thickness = 2;
    this.prestigePanel.background = 'rgba(26, 58, 42, 0.95)';
    this.prestigePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.prestigePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.prestigePanel.left = '-10px';
    this.prestigePanel.top = '205px';
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
    titleLabel.color = '#7a9a7a';
    titleLabel.fontSize = 9;
    titleLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleRow.addControl(titleLabel);

    this.prestigeStarsText = new TextBlock('prestigeStars');
    this.prestigeStarsText.text = '★☆☆☆☆';
    this.prestigeStarsText.color = '#ffcc00';
    this.prestigeStarsText.fontSize = 14;
    this.prestigeStarsText.height = '20px';
    this.prestigeStarsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigeStarsText);

    this.prestigeTierText = new TextBlock('prestigeTier');
    this.prestigeTierText.text = 'Municipal';
    this.prestigeTierText.color = '#aaaaaa';
    this.prestigeTierText.fontSize = 11;
    this.prestigeTierText.height = '16px';
    this.prestigeTierText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigeTierText);

    this.prestigeScoreText = new TextBlock('prestigeScore');
    this.prestigeScoreText.text = '100 / 1000';
    this.prestigeScoreText.color = '#888888';
    this.prestigeScoreText.fontSize = 9;
    this.prestigeScoreText.height = '14px';
    this.prestigeScoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.prestigeScoreText);

    this.prestigePriceWarning = new TextBlock('prestigePriceWarning');
    this.prestigePriceWarning.text = '';
    this.prestigePriceWarning.color = '#ffaa44';
    this.prestigePriceWarning.fontSize = 9;
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
    minusBtn.cornerRadius = 3;
    minusBtn.background = '#4a5a4a';
    minusBtn.color = 'white';
    minusBtn.fontSize = 12;
    minusBtn.thickness = 0;
    minusBtn.onPointerClickObservable.add(() => this.onPriceChange?.(-5));
    minusBtn.onPointerEnterObservable.add(() => { minusBtn.background = '#5a6a5a'; });
    minusBtn.onPointerOutObservable.add(() => { minusBtn.background = '#4a5a4a'; });
    priceRow.addControl(minusBtn);

    this.currentPriceText = new TextBlock('currentPrice');
    this.currentPriceText.text = '$25';
    this.currentPriceText.color = '#88dd88';
    this.currentPriceText.fontSize = 11;
    this.currentPriceText.width = '50px';
    this.currentPriceText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    priceRow.addControl(this.currentPriceText);

    const plusBtn = Button.CreateSimpleButton('pricePlusBtn', '+');
    plusBtn.width = '22px';
    plusBtn.height = '18px';
    plusBtn.cornerRadius = 3;
    plusBtn.background = '#4a5a4a';
    plusBtn.color = 'white';
    plusBtn.fontSize = 12;
    plusBtn.thickness = 0;
    plusBtn.onPointerClickObservable.add(() => this.onPriceChange?.(5));
    plusBtn.onPointerEnterObservable.add(() => { plusBtn.background = '#5a6a5a'; });
    plusBtn.onPointerOutObservable.add(() => { plusBtn.background = '#4a5a4a'; });
    priceRow.addControl(plusBtn);

    const feeLabel = new TextBlock();
    feeLabel.text = '/18';
    feeLabel.color = '#7a9a7a';
    feeLabel.fontSize = 9;
    feeLabel.width = '22px';
    feeLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    priceRow.addControl(feeLabel);
  }

  private createScenarioPanel(): void {
    this.scenarioPanel = new Rectangle('scenarioPanel');
    this.scenarioPanel.width = '200px';
    this.scenarioPanel.height = '75px';
    this.scenarioPanel.cornerRadius = 5;
    this.scenarioPanel.color = '#4a8a5a';
    this.scenarioPanel.thickness = 2;
    this.scenarioPanel.background = 'rgba(26, 58, 42, 0.95)';
    this.scenarioPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.scenarioPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.scenarioPanel.left = '-10px';
    this.scenarioPanel.top = '325px';
    this.scenarioPanel.isVisible = false;
    this.advancedTexture.addControl(this.scenarioPanel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '8px';
    stack.paddingRight = '8px';
    this.scenarioPanel.addControl(stack);

    this.scenarioTitleText = new TextBlock('scenarioTitle');
    this.scenarioTitleText.text = 'OBJECTIVE';
    this.scenarioTitleText.color = '#7a9a7a';
    this.scenarioTitleText.fontSize = 9;
    this.scenarioTitleText.height = '14px';
    this.scenarioTitleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.scenarioTitleText);

    this.scenarioProgressText = new TextBlock('scenarioProgress');
    this.scenarioProgressText.text = 'Earn $50,000';
    this.scenarioProgressText.color = '#ffffff';
    this.scenarioProgressText.fontSize = 11;
    this.scenarioProgressText.height = '18px';
    this.scenarioProgressText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.scenarioProgressText);

    this.scenarioProgressBar = new Rectangle('scenarioProgressBar');
    this.scenarioProgressBar.width = '180px';
    this.scenarioProgressBar.height = '12px';
    this.scenarioProgressBar.cornerRadius = 2;
    this.scenarioProgressBar.color = '#3a5a4a';
    this.scenarioProgressBar.thickness = 1;
    this.scenarioProgressBar.background = '#1a3a2a';
    stack.addControl(this.scenarioProgressBar);

    this.scenarioProgressFill = new Rectangle('scenarioProgressFill');
    this.scenarioProgressFill.width = '0%';
    this.scenarioProgressFill.height = '100%';
    this.scenarioProgressFill.background = '#44aa44';
    this.scenarioProgressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.scenarioProgressBar.addControl(this.scenarioProgressFill);

    this.daysRemainingText = new TextBlock('daysRemaining');
    this.daysRemainingText.text = '';
    this.daysRemainingText.color = '#aaaaaa';
    this.daysRemainingText.fontSize = 10;
    this.daysRemainingText.height = '16px';
    this.daysRemainingText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(this.daysRemainingText);
  }

  private createResourcesPanel(): void {
    const panel = new Rectangle('resourcesPanel');
    panel.width = '420px';
    panel.height = '55px';
    panel.cornerRadius = 5;
    panel.color = '#4a8a5a';
    panel.thickness = 2;
    panel.background = 'rgba(26, 58, 42, 0.95)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = '10px';
    panel.top = '-10px';
    this.advancedTexture.addControl(panel);

    const stack = new StackPanel();
    stack.paddingTop = '6px';
    stack.paddingLeft = '10px';
    panel.addControl(stack);

    const title = new TextBlock();
    title.text = 'RESOURCES';
    title.color = '#7a9a7a';
    title.fontSize = 10;
    title.fontFamily = 'Arial, sans-serif';
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
    iconText.fontSize = 12;
    container.addControl(iconText, 0, 0);

    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = color;
    labelText.fontSize = 11;
    labelText.fontFamily = 'Arial, sans-serif';
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.addControl(labelText, 0, 1);

    const barBg = new Rectangle();
    barBg.width = '45px';
    barBg.height = '10px';
    barBg.cornerRadius = 2;
    barBg.background = '#1a3a2a';
    barBg.color = '#3a5a4a';
    barBg.thickness = 1;
    barBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    const bar = new Rectangle();
    bar.width = '45px';
    bar.height = '10px';
    bar.cornerRadius = 2;
    bar.background = color;
    bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    barBg.addControl(bar);

    container.addControl(barBg, 0, 2);

    const text = new TextBlock();
    text.text = '100%';
    text.color = color;
    text.fontSize = 10;
    text.fontFamily = 'Arial, sans-serif';
    text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    container.addControl(text, 0, 3);

    return { container, bar, text };
  }

  private createScorePanel(): void {
    const panel = new Rectangle('scorePanel');
    panel.width = '110px';
    panel.height = '40px';
    panel.cornerRadius = 5;
    panel.color = '#4a8a5a';
    panel.thickness = 2;
    panel.background = 'rgba(42, 90, 58, 0.95)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.top = '-10px';
    this.advancedTexture.addControl(panel);

    const row = new StackPanel();
    row.isVertical = false;
    panel.addControl(row);

    const trophy = new TextBlock();
    trophy.text = '🏆';
    trophy.fontSize = 16;
    trophy.width = '30px';
    row.addControl(trophy);

    this.scoreText = new TextBlock('scoreText');
    this.scoreText.text = '0';
    this.scoreText.color = '#ffcc00';
    this.scoreText.fontSize = 18;
    this.scoreText.fontFamily = 'Arial Black, sans-serif';
    row.addControl(this.scoreText);
  }

  private createMinimap(): void {
    this.minimapContainer = new Rectangle('minimapContainer');
    this.minimapContainer.width = '160px';
    this.minimapContainer.height = '130px';
    this.minimapContainer.cornerRadius = 5;
    this.minimapContainer.color = '#4a8a5a';
    this.minimapContainer.thickness = 2;
    this.minimapContainer.background = 'rgba(13, 31, 21, 0.95)';
    this.minimapContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.minimapContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.minimapContainer.left = '-10px';
    this.minimapContainer.top = '-10px';
    this.advancedTexture.addControl(this.minimapContainer);

    const header = new Rectangle();
    header.width = '150px';
    header.height = '18px';
    header.background = '#2a5a3a';
    header.cornerRadius = 3;
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.top = '5px';
    this.minimapContainer.addControl(header);

    const headerText = new TextBlock();
    headerText.text = '📍 MINIMAP';
    headerText.color = 'white';
    headerText.fontSize = 10;
    headerText.fontFamily = 'Arial, sans-serif';
    header.addControl(headerText);

    this.minimapMapArea = new Rectangle('mapArea');
    this.minimapMapArea.width = '140px';
    this.minimapMapArea.height = '96px';
    this.minimapMapArea.background = '#228B22';
    this.minimapMapArea.cornerRadius = 3;
    this.minimapMapArea.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.minimapMapArea.top = '-8px';
    this.minimapContainer.addControl(this.minimapMapArea);

    this.minimapPlayerDot = new Ellipse('playerDot');
    this.minimapPlayerDot.width = '10px';
    this.minimapPlayerDot.height = '10px';
    this.minimapPlayerDot.background = 'white';
    this.minimapPlayerDot.color = '#7FFF7F';
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
    this.objectiveText.color = '#ffcc00';
    this.objectiveText.fontSize = 12;
    this.objectiveText.height = '20px';
    this.objectiveText.isVisible = false;
    this.notificationContainer.addControl(this.objectiveText);
  }

  private createControlsHelp(): void {
    const panel = new Rectangle('helpPanel');
    panel.width = '160px';
    panel.height = '170px';
    panel.cornerRadius = 5;
    panel.color = '#3a5a4a';
    panel.thickness = 1;
    panel.background = 'rgba(26, 58, 42, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.left = '-180px';
    panel.top = '-10px';
    this.advancedTexture.addControl(panel);

    const stack = new StackPanel('helpStack');
    stack.paddingTop = '6px';
    panel.addControl(stack);

    const lines = [
      'WASD/Arrows: Move',
      '1/2/3: Equipment',
      'Space: Toggle | E: Refill',
      '[ / ]: Zoom | P: Pause',
      '─ Management ─',
      'H: Employees | Y: Research',
      'G: TeeSheet | K: Marketing',
      'B: Equipment | U: Amenities',
      'O: Walk-On Queue',
    ];

    for (const line of lines) {
      const text = new TextBlock();
      text.text = line;
      text.color = line.startsWith('─') ? '#6a8a6a' : '#aaa';
      text.fontSize = 10;
      text.fontFamily = 'Arial, sans-serif';
      text.height = '16px';
      text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      text.paddingLeft = '8px';
      stack.addControl(text);
    }
  }

  private createPauseOverlay(): void {
    this.pauseOverlay = new Rectangle('pauseOverlay');
    this.pauseOverlay.width = '100%';
    this.pauseOverlay.height = '100%';
    this.pauseOverlay.background = 'rgba(0, 0, 0, 0.7)';
    this.pauseOverlay.thickness = 0;
    this.pauseOverlay.isVisible = false;
    this.pauseOverlay.isPointerBlocker = true;
    this.advancedTexture.addControl(this.pauseOverlay);

    const panel = new Rectangle('pausePanel');
    panel.width = '300px';
    panel.height = '600px';
    panel.cornerRadius = 10;
    panel.background = 'rgba(26, 58, 42, 0.95)';
    panel.color = '#4a8a5a';
    panel.thickness = 3;
    this.pauseOverlay.addControl(panel);

    const stack = new StackPanel('pauseStack');
    stack.paddingTop = '15px';
    panel.addControl(stack);

    const title = new TextBlock('pauseTitle');
    title.text = '⏸️ PAUSED';
    title.color = '#ffcc00';
    title.fontSize = 28;
    title.fontFamily = 'Arial Black, sans-serif';
    title.height = '45px';
    stack.addControl(title);

    // Create accessible buttons for pause menu
    const resumeBtn = createAccessibleButton({
      label: '▶️ Resume',
      onClick: () => this.onResume?.(),
      focusGroup: 'pause-menu'
    }, this.focusManager);
    resumeBtn.control.paddingTop = '10px';
    stack.addControl(resumeBtn.control);
    this.pauseMenuButtons.push(resumeBtn);

    const restartBtn = createAccessibleButton({
      label: '🔄 Restart',
      onClick: () => this.onRestart?.(),
      focusGroup: 'pause-menu'
    }, this.focusManager);
    restartBtn.control.paddingTop = '10px';
    stack.addControl(restartBtn.control);
    this.pauseMenuButtons.push(restartBtn);

    const mainMenuBtn = createAccessibleButton({
      label: '🏠 Main Menu',
      onClick: () => this.onMainMenu?.(),
      focusGroup: 'pause-menu'
    }, this.focusManager);
    mainMenuBtn.control.paddingTop = '10px';
    stack.addControl(mainMenuBtn.control);
    this.pauseMenuButtons.push(mainMenuBtn);

    const divider = new Rectangle('divider');
    divider.width = '200px';
    divider.height = '2px';
    divider.background = '#3a6a4a';
    divider.thickness = 0;
    divider.paddingTop = '10px';
    divider.paddingBottom = '5px';
    stack.addControl(divider);

    const mgmtLabel = new TextBlock('mgmtLabel');
    mgmtLabel.text = 'MANAGEMENT';
    mgmtLabel.color = '#88ccff';
    mgmtLabel.fontSize = 12;
    mgmtLabel.height = '25px';
    stack.addControl(mgmtLabel);

    const employeesBtn = createAccessibleButton({
      label: '👥 Employees',
      fontSize: 16,
      onClick: () => {
        this.hidePauseMenu();
        this.onEmployees?.();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    employeesBtn.control.paddingTop = '10px';
    stack.addControl(employeesBtn.control);
    this.pauseMenuButtons.push(employeesBtn);

    const researchBtn = createAccessibleButton({
      label: '🔬 Research',
      fontSize: 16,
      onClick: () => {
        this.hidePauseMenu();
        this.onResearch?.();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    researchBtn.control.paddingTop = '10px';
    stack.addControl(researchBtn.control);
    this.pauseMenuButtons.push(researchBtn);

    const teeSheetBtn = createAccessibleButton({
      label: '📋 Tee Sheet',
      fontSize: 16,
      onClick: () => {
        this.hidePauseMenu();
        this.onTeeSheet?.();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    teeSheetBtn.control.paddingTop = '10px';
    stack.addControl(teeSheetBtn.control);
    this.pauseMenuButtons.push(teeSheetBtn);

    const marketingBtn = createAccessibleButton({
      label: '📢 Marketing',
      fontSize: 16,
      onClick: () => {
        this.hidePauseMenu();
        this.onMarketing?.();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    marketingBtn.control.paddingTop = '10px';
    stack.addControl(marketingBtn.control);
    this.pauseMenuButtons.push(marketingBtn);

    const speedDivider = new Rectangle('speedDivider');
    speedDivider.width = '200px';
    speedDivider.height = '2px';
    speedDivider.background = '#3a6a4a';
    speedDivider.thickness = 0;
    speedDivider.paddingTop = '8px';
    speedDivider.paddingBottom = '3px';
    stack.addControl(speedDivider);

    const speedLabel = new TextBlock('speedLabel');
    speedLabel.text = 'GAME SPEED';
    speedLabel.color = '#ffcc00';
    speedLabel.fontSize = 11;
    speedLabel.height = '20px';
    stack.addControl(speedLabel);

    const speedContainer = new Rectangle('speedContainer');
    speedContainer.height = '35px';
    speedContainer.width = '200px';
    speedContainer.thickness = 0;
    stack.addControl(speedContainer);

    // Speed control buttons - smaller size
    const slowBtn = createAccessibleButton({
      label: '◀',
      width: '50px',
      height: '30px',
      fontSize: 14,
      onClick: () => {
        this.onSpeedChange?.(-1);
        this.updateSpeedDisplay();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    slowBtn.control.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    slowBtn.control.left = '10px';
    speedContainer.addControl(slowBtn.control);
    this.pauseMenuButtons.push(slowBtn);

    this.speedText = new TextBlock('speedText');
    this.speedText.text = '1x';
    this.speedText.color = '#ffffff';
    this.speedText.fontSize = 16;
    this.speedText.fontWeight = 'bold';
    speedContainer.addControl(this.speedText);

    const fastBtn = createAccessibleButton({
      label: '▶',
      width: '50px',
      height: '30px',
      fontSize: 14,
      onClick: () => {
        this.onSpeedChange?.(1);
        this.updateSpeedDisplay();
      },
      focusGroup: 'pause-menu'
    }, this.focusManager);
    fastBtn.control.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    fastBtn.control.left = '-10px';
    speedContainer.addControl(fastBtn.control);
    this.pauseMenuButtons.push(fastBtn);

    const hint = new TextBlock('pauseHint');
    hint.text = 'Press P, ESC, or Tab+Enter to navigate';
    hint.color = '#888888';
    hint.fontSize = 11;
    hint.fontFamily = 'Arial, sans-serif';
    hint.height = '20px';
    hint.paddingTop = '3px';
    stack.addControl(hint);
  }

  private updateSpeedDisplay(): void {
    // Speed display will be updated by BabylonMain calling showPauseMenu with currentSpeed
  }

  private createOverlayLegend(): void {
    this.overlayLegend = new Rectangle('overlayLegend');
    this.overlayLegend.width = '160px';
    this.overlayLegend.height = '60px';
    this.overlayLegend.cornerRadius = 5;
    this.overlayLegend.color = '#4a8a5a';
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
    this.overlayLegendTitle.color = '#aaccff';
    this.overlayLegendTitle.fontSize = 10;
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
    this.overlayLegendLowLabel.color = '#888888';
    this.overlayLegendLowLabel.fontSize = 9;
    this.overlayLegendLowLabel.width = '30px';
    this.overlayLegendLowLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    gradientRow.addControl(this.overlayLegendLowLabel);

    this.overlayLegendGradient = new Rectangle('gradient');
    this.overlayLegendGradient.width = '80px';
    this.overlayLegendGradient.height = '12px';
    this.overlayLegendGradient.cornerRadius = 2;
    this.overlayLegendGradient.thickness = 1;
    this.overlayLegendGradient.color = '#555555';
    gradientRow.addControl(this.overlayLegendGradient);

    this.overlayLegendHighLabel = new TextBlock('highLabel');
    this.overlayLegendHighLabel.text = 'Wet';
    this.overlayLegendHighLabel.color = '#888888';
    this.overlayLegendHighLabel.fontSize = 9;
    this.overlayLegendHighLabel.width = '30px';
    this.overlayLegendHighLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    gradientRow.addControl(this.overlayLegendHighLabel);
  }

  public updateOverlayLegend(mode: 'normal' | 'moisture' | 'nutrients' | 'height'): void {
    if (mode === 'normal') {
      this.overlayLegend.isVisible = false;
      return;
    }

    this.overlayLegend.isVisible = true;

    switch (mode) {
      case 'moisture':
        this.overlayLegendTitle.text = 'MOISTURE VIEW';
        this.overlayLegendTitle.color = '#88ccff';
        this.overlayLegendLowLabel.text = 'Dry';
        this.overlayLegendHighLabel.text = 'Wet';
        this.overlayLegendGradient.background = 'linear-gradient(90deg, #cc6644 0%, #4488cc 100%)';
        break;
      case 'nutrients':
        this.overlayLegendTitle.text = 'NUTRIENTS VIEW';
        this.overlayLegendTitle.color = '#88ff88';
        this.overlayLegendLowLabel.text = 'Low';
        this.overlayLegendHighLabel.text = 'High';
        this.overlayLegendGradient.background = 'linear-gradient(90deg, #cc8844 0%, #66cc44 100%)';
        break;
      case 'height':
        this.overlayLegendTitle.text = 'HEIGHT VIEW';
        this.overlayLegendTitle.color = '#ffcc88';
        this.overlayLegendLowLabel.text = 'Short';
        this.overlayLegendHighLabel.text = 'Tall';
        this.overlayLegendGradient.background = 'linear-gradient(90deg, #44aa44 0%, #cc6644 100%)';
        break;
    }
  }


  public showPauseMenu(
    onResume: () => void,
    onRestart: () => void,
    onMainMenu?: () => void,
    onEmployees?: () => void,
    onResearch?: () => void,
    onTeeSheet?: () => void,
    onMarketing?: () => void,
    onSpeedChange?: (delta: number) => void,
    currentSpeed?: number
  ): void {
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onMainMenu = onMainMenu;
    this.onEmployees = onEmployees;
    this.onResearch = onResearch;
    this.onTeeSheet = onTeeSheet;
    this.onMarketing = onMarketing;
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

  public showNotification(message: string, color?: string, duration: number = 2000): void {
    const isWarning = color === '#ffaa44' || color === 'warning';
    const bgColor = isWarning ? 'rgba(90, 58, 42, 0.95)' : 'rgba(42, 90, 58, 0.95)';
    const borderColor = color || (isWarning ? '#ffaa44' : '#7FFF7F');

    const notification = new Rectangle('notification');
    notification.width = `${Math.max(200, message.length * 8 + 40)}px`;
    notification.height = '36px';
    notification.cornerRadius = 5;
    notification.background = bgColor;
    notification.color = borderColor;
    notification.thickness = 2;
    notification.paddingBottom = '10px';

    const text = new TextBlock();
    text.text = message;
    text.color = 'white';
    text.fontSize = 14;
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

  public updateEquipment(type: EquipmentType, isActive: boolean): void {
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
      this.weatherText.color = '#88aaff';
    } else if (type === 'cloudy') {
      this.weatherText.color = '#aabbcc';
    } else if (temperature > 90) {
      this.weatherText.color = '#ffaa66';
    } else {
      this.weatherText.color = '#ffdd88';
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
        this.satisfactionText.color = '#44ff44';
      } else if (satisfaction >= 60) {
        this.satisfactionText.color = '#ffcc00';
      } else {
        this.satisfactionText.color = '#ff6644';
      }
    }
  }

  public updatePrestige(state: PrestigeState, rejectionRate: number = 0, recommendedMax?: number): void {
    this.prestigeStarsText.text = getStarDisplay(state.starRating);
    this.prestigeTierText.text = TIER_LABELS[state.tier];
    this.prestigeScoreText.text = `${Math.round(state.currentScore)} / 1000`;

    if (state.currentScore < state.targetScore) {
      this.prestigeScoreText.color = '#44aa44';
    } else if (state.currentScore > state.targetScore) {
      this.prestigeScoreText.color = '#aa4444';
    } else {
      this.prestigeScoreText.color = '#888888';
    }

    if (rejectionRate >= 20 && recommendedMax) {
      this.prestigePriceWarning.text = `⚠️ ${rejectionRate}% rej (max $${recommendedMax})`;
      this.prestigePriceWarning.color = '#ff6644';
    } else if (rejectionRate >= 5 && recommendedMax) {
      this.prestigePriceWarning.text = `💰 ${rejectionRate}% rej (max $${recommendedMax})`;
      this.prestigePriceWarning.color = '#ffaa44';
    } else if (rejectionRate >= 5) {
      this.prestigePriceWarning.text = `💰 ${rejectionRate}% rejection`;
      this.prestigePriceWarning.color = '#ffaa44';
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
      this.scenarioProgressText.color = '#00ff00';
      this.scenarioProgressFill.background = '#00ff00';
    } else {
      this.scenarioProgressText.text = objectiveText;
      this.scenarioProgressText.color = '#ffffff';
      this.scenarioProgressFill.background = progress >= 75 ? '#44aa44' : progress >= 50 ? '#aaaa44' : '#aa6644';
    }

    if (dayLimit) {
      const daysRemaining = dayLimit - daysElapsed;
      if (daysRemaining <= 7) {
        this.daysRemainingText.color = '#ff6666';
      } else if (daysRemaining <= 14) {
        this.daysRemainingText.color = '#ffaa44';
      } else {
        this.daysRemainingText.color = '#aaaaaa';
      }
      this.daysRemainingText.text = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
    } else {
      this.daysRemainingText.text = `Day ${daysElapsed}`;
      this.daysRemainingText.color = '#aaaaaa';
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
      dot.background = '#ff9933';
      dot.color = '#cc6600';
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
        dot.background = '#666666';
      } else if (worker.task === 'mow_grass') {
        dot.background = '#44aa44';
      } else if (worker.task === 'water_area') {
        dot.background = '#4488cc';
      } else if (worker.task === 'fertilize_area') {
        dot.background = '#cc8844';
      } else {
        dot.background = '#ff9933';
      }
    });
  }

  public dispose(): void {
    this.focusManager.dispose();
    this.advancedTexture.dispose();
  }
}

