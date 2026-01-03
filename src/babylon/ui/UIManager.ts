import { Scene } from '@babylonjs/core/scene';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Grid } from '@babylonjs/gui/2D/controls/grid';
import { Ellipse } from '@babylonjs/gui/2D/controls/ellipse';

import { EquipmentType } from '../../core/equipment-logic';

export class UIManager {
  private advancedTexture: AdvancedDynamicTexture;

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

  private fuelBar!: Rectangle;
  private fuelText!: TextBlock;
  private waterBar!: Rectangle;
  private waterText!: TextBlock;
  private fertBar!: Rectangle;
  private fertText!: TextBlock;

  private scoreText!: TextBlock;
  private objectiveText!: TextBlock;

  private minimapContainer!: Rectangle;
  private minimapPlayerDot!: Ellipse;

  private notificationContainer!: StackPanel;

  private pauseOverlay!: Rectangle;
  private onResume?: () => void;
  private onRestart?: () => void;
  private onMainMenu?: () => void;

  constructor(scene: Scene) {
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);

    this.createCourseStatusPanel();
    this.createEquipmentSelector();
    this.createTimePanel();
    this.createResourcesPanel();
    this.createScorePanel();
    this.createMinimap();
    this.createNotificationArea();
    this.createControlsHelp();
    this.createPauseOverlay();
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
    panel.width = '100px';
    panel.height = '70px';
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
    stack.paddingTop = '8px';
    panel.addControl(stack);

    const dayRow = new StackPanel();
    dayRow.isVertical = false;
    dayRow.height = '18px';
    stack.addControl(dayRow);

    const sunIcon = new TextBlock();
    sunIcon.text = '☀️';
    sunIcon.fontSize = 13;
    sunIcon.width = '20px';
    dayRow.addControl(sunIcon);

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
    this.timeText.height = '22px';
    stack.addControl(this.timeText);

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

    const mapArea = new Rectangle('mapArea');
    mapArea.width = '140px';
    mapArea.height = '96px';
    mapArea.background = '#228B22';
    mapArea.cornerRadius = 3;
    mapArea.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    mapArea.top = '-8px';
    this.minimapContainer.addControl(mapArea);

    this.minimapPlayerDot = new Ellipse('playerDot');
    this.minimapPlayerDot.width = '10px';
    this.minimapPlayerDot.height = '10px';
    this.minimapPlayerDot.background = 'white';
    this.minimapPlayerDot.color = '#7FFF7F';
    this.minimapPlayerDot.thickness = 2;
    mapArea.addControl(this.minimapPlayerDot);
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
    panel.height = '100px';
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
    stack.paddingTop = '8px';
    panel.addControl(stack);

    const lines = [
      'WASD/Arrows: Move',
      '1/2/3: Equipment',
      'Space: Toggle',
      '[ / ]: Zoom',
    ];

    for (const line of lines) {
      const text = new TextBlock();
      text.text = line;
      text.color = '#aaa';
      text.fontSize = 11;
      text.fontFamily = 'Arial, sans-serif';
      text.height = '18px';
      text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      text.paddingLeft = '10px';
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
    this.advancedTexture.addControl(this.pauseOverlay);

    const panel = new Rectangle('pausePanel');
    panel.width = '300px';
    panel.height = '300px';
    panel.cornerRadius = 10;
    panel.background = 'rgba(26, 58, 42, 0.95)';
    panel.color = '#4a8a5a';
    panel.thickness = 3;
    this.pauseOverlay.addControl(panel);

    const stack = new StackPanel('pauseStack');
    stack.paddingTop = '20px';
    panel.addControl(stack);

    const title = new TextBlock('pauseTitle');
    title.text = '⏸️ PAUSED';
    title.color = '#ffcc00';
    title.fontSize = 28;
    title.fontFamily = 'Arial Black, sans-serif';
    title.height = '50px';
    stack.addControl(title);

    const resumeBtn = this.createMenuButton('▶️ Resume', () => this.onResume?.());
    stack.addControl(resumeBtn);

    const restartBtn = this.createMenuButton('🔄 Restart', () => this.onRestart?.());
    stack.addControl(restartBtn);

    const mainMenuBtn = this.createMenuButton('🏠 Main Menu', () => this.onMainMenu?.());
    stack.addControl(mainMenuBtn);

    const hint = new TextBlock('pauseHint');
    hint.text = 'Press P or ESC to resume';
    hint.color = '#888888';
    hint.fontSize = 12;
    hint.fontFamily = 'Arial, sans-serif';
    hint.height = '30px';
    hint.paddingTop = '10px';
    stack.addControl(hint);
  }

  private createMenuButton(label: string, onClick: () => void): Rectangle {
    const btn = new Rectangle(`btn_${label}`);
    btn.width = '200px';
    btn.height = '45px';
    btn.cornerRadius = 8;
    btn.background = '#2a5a3a';
    btn.color = '#7FFF7F';
    btn.thickness = 2;
    btn.paddingTop = '10px';

    const text = new TextBlock();
    text.text = label;
    text.color = 'white';
    text.fontSize = 16;
    text.fontFamily = 'Arial, sans-serif';
    btn.addControl(text);

    btn.onPointerEnterObservable.add(() => {
      btn.background = '#3a7a4a';
      btn.color = '#ffffff';
    });

    btn.onPointerOutObservable.add(() => {
      btn.background = '#2a5a3a';
      btn.color = '#7FFF7F';
    });

    btn.onPointerClickObservable.add(onClick);

    return btn;
  }

  public showPauseMenu(onResume: () => void, onRestart: () => void, onMainMenu?: () => void): void {
    this.onResume = onResume;
    this.onRestart = onRestart;
    this.onMainMenu = onMainMenu;
    this.pauseOverlay.isVisible = true;
  }

  public hidePauseMenu(): void {
    this.pauseOverlay.isVisible = false;
  }

  public isPauseMenuVisible(): boolean {
    return this.pauseOverlay.isVisible;
  }

  public showNotification(message: string, duration: number = 2000): void {
    const notification = new Rectangle('notification');
    notification.width = `${Math.max(200, message.length * 8 + 40)}px`;
    notification.height = '36px';
    notification.cornerRadius = 5;
    notification.background = 'rgba(42, 90, 58, 0.95)';
    notification.color = '#7FFF7F';
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

  public updateTime(hours: number, minutes: number, day: number = 1): void {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const displayMin = minutes.toString().padStart(2, '0');
    this.timeText.text = `${displayHour}:${displayMin} ${period}`;
    this.dayText.text = `Day ${day}`;
  }

  public updateScore(score: number): void {
    this.scoreText.text = score.toLocaleString();
  }

  public updateObjective(text: string, completed: boolean = false): void {
    this.objectiveText.text = `🎯 ${text}${completed ? ' ✅' : ''}`;
    this.objectiveText.color = completed ? '#00ff00' : '#ffcc00';
    this.objectiveText.isVisible = true;
  }

  public updateMinimapPlayerPosition(x: number, y: number, mapWidth: number, mapHeight: number): void {
    const relX = (x / mapWidth) * 140 - 70;
    const relY = (y / mapHeight) * 96 - 48;
    this.minimapPlayerDot.left = `${relX}px`;
    this.minimapPlayerDot.top = `${relY}px`;
  }

  public dispose(): void {
    this.advancedTexture.dispose();
  }
}
