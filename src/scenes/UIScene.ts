import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { EquipmentType } from '../gameobjects/Player';

export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;

  private topBar!: Phaser.GameObjects.Container;
  private bottomBar!: Phaser.GameObjects.Container;

  private timeText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;

  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private moistureBar!: Phaser.GameObjects.Graphics;
  private moistureText!: Phaser.GameObjects.Text;
  private nutrientsBar!: Phaser.GameObjects.Graphics;
  private nutrientsText!: Phaser.GameObjects.Text;

  private equipmentSlots: Phaser.GameObjects.Container[] = [];
  private resourceBars!: Phaser.GameObjects.Graphics;
  private fuelText!: Phaser.GameObjects.Text;
  private waterText!: Phaser.GameObjects.Text;
  private fertText!: Phaser.GameObjects.Text;

  private minimap!: Phaser.GameObjects.Graphics;
  private minimapFrame!: Phaser.GameObjects.Container;

  private notificationContainer!: Phaser.GameObjects.Container;
  private overlayModeText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.gameScene = this.scene.get('GameScene') as GameScene;

    this.createTopBar();
    this.createBottomBar();
    this.createMinimap();
    this.createNotificationArea();

    this.animateUIEntry();
  }

  private animateUIEntry(): void {
    const elementsToAnimate = [this.topBar, this.bottomBar, this.minimapFrame];

    this.topBar.y = -80;
    this.bottomBar.y = 600 + 80;
    this.minimapFrame.setAlpha(0);

    this.tweens.add({
      targets: this.topBar,
      y: 0,
      duration: 400,
      ease: 'Back.easeOut',
      delay: 200
    });

    this.tweens.add({
      targets: this.bottomBar,
      y: 525,
      duration: 400,
      ease: 'Back.easeOut',
      delay: 300
    });

    this.tweens.add({
      targets: this.minimapFrame,
      alpha: 1,
      duration: 300,
      delay: 500
    });
  }

  private createTopBar(): void {
    this.topBar = this.add.container(0, 0);

    const barBg = this.add.graphics();
    barBg.fillGradientStyle(0x1a3a2a, 0x1a3a2a, 0x0d1f15, 0x0d1f15, 0.95);
    barBg.fillRect(0, 0, 800, 75);
    barBg.lineStyle(2, 0x4a8a5a, 0.8);
    barBg.lineBetween(0, 75, 800, 75);
    this.topBar.add(barBg);

    this.createCourseStats();
    this.createEquipmentSlots();
    this.createTimeDisplay();
  }

  private createCourseStats(): void {
    const statsContainer = this.add.container(15, 10);

    const statsLabel = this.add.text(0, 0, 'COURSE STATUS', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#7a9a7a',
      fontStyle: 'bold'
    });
    statsContainer.add(statsLabel);

    const healthIcon = this.add.text(0, 18, '❤️', { fontSize: '14px' });
    const healthLabel = this.add.text(20, 18, 'Health', {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#aaaaaa'
    });
    statsContainer.add([healthIcon, healthLabel]);

    this.healthBar = this.add.graphics();
    statsContainer.add(this.healthBar);

    this.healthText = this.add.text(155, 18, '100%', {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#00ff00',
      fontStyle: 'bold'
    });
    statsContainer.add(this.healthText);

    const moistureIcon = this.add.text(0, 36, '💧', { fontSize: '12px' });
    const moistureLabel = this.add.text(20, 38, 'Moisture', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#88ccff'
    });
    statsContainer.add([moistureIcon, moistureLabel]);

    this.moistureBar = this.add.graphics();
    statsContainer.add(this.moistureBar);

    this.moistureText = this.add.text(155, 38, '100%', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#88ccff'
    });
    statsContainer.add(this.moistureText);

    const nutrientsIcon = this.add.text(0, 52, '🌱', { fontSize: '12px' });
    const nutrientsLabel = this.add.text(20, 54, 'Nutrients', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#88ff88'
    });
    statsContainer.add([nutrientsIcon, nutrientsLabel]);

    this.nutrientsBar = this.add.graphics();
    statsContainer.add(this.nutrientsBar);

    this.nutrientsText = this.add.text(155, 54, '100%', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#88ff88'
    });
    statsContainer.add(this.nutrientsText);

    this.overlayModeText = this.add.text(195, 10, '', {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffff00',
      backgroundColor: '#333300',
      padding: { x: 4, y: 2 }
    });
    statsContainer.add(this.overlayModeText);

    this.topBar.add(statsContainer);
  }

  private createEquipmentSlots(): void {
    const slotsContainer = this.add.container(400, 37);

    const slotData = [
      { key: '1', name: 'Mower', color: 0xDC143C, icon: '🚜' },
      { key: '2', name: 'Sprinkler', color: 0x00CED1, icon: '💦' },
      { key: '3', name: 'Spreader', color: 0xFFD700, icon: '🌾' }
    ];

    slotData.forEach((slot, index) => {
      const x = (index - 1) * 70;
      const slotContainer = this.add.container(x, 0);

      const shadow = this.add.rectangle(2, 2, 58, 58, 0x000000, 0.3);

      const bg = this.add.rectangle(0, 0, 58, 58, 0x1a3a2a);
      bg.setStrokeStyle(2, 0x3a5a4a);

      const iconBg = this.add.rectangle(0, -5, 40, 30, slot.color, 0.8);

      const iconText = this.add.text(0, -5, slot.icon, {
        fontSize: '18px'
      }).setOrigin(0.5);

      const keyBadge = this.add.circle(-22, -22, 10, 0x2a5a3a);
      keyBadge.setStrokeStyle(1, 0x4a8a5a);

      const keyText = this.add.text(-22, -22, slot.key, {
        fontSize: '10px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const nameText = this.add.text(0, 20, slot.name, {
        fontSize: '8px',
        fontFamily: 'Arial, sans-serif',
        color: '#888888'
      }).setOrigin(0.5);

      slotContainer.add([shadow, bg, iconBg, iconText, keyBadge, keyText, nameText]);
      this.equipmentSlots.push(slotContainer);
      slotsContainer.add(slotContainer);
    });

    this.topBar.add(slotsContainer);
  }

  private createTimeDisplay(): void {
    const timeContainer = this.add.container(715, 10);

    const timeBg = this.add.rectangle(35, 30, 80, 55, 0x1a3a2a, 0.8);
    timeBg.setStrokeStyle(1, 0x3a5a4a);
    timeContainer.add(timeBg);

    const sunIcon = this.add.text(0, 5, '☀️', { fontSize: '16px' });
    timeContainer.add(sunIcon);

    this.dayText = this.add.text(22, 8, 'Day 1', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    timeContainer.add(this.dayText);

    this.timeText = this.add.text(22, 28, '6:00 AM', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffcc00'
    });
    timeContainer.add(this.timeText);

    const speedBg = this.add.rectangle(35, 52, 40, 16, 0x2a5a3a);
    speedBg.setStrokeStyle(1, 0x4a8a5a);
    timeContainer.add(speedBg);

    this.speedText = this.add.text(35, 52, '1x', {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#88ff88'
    }).setOrigin(0.5);
    timeContainer.add(this.speedText);

    this.topBar.add(timeContainer);
  }

  private createBottomBar(): void {
    this.bottomBar = this.add.container(0, 525);

    const barBg = this.add.graphics();
    barBg.fillGradientStyle(0x0d1f15, 0x0d1f15, 0x1a3a2a, 0x1a3a2a, 0.95);
    barBg.fillRect(0, 0, 800, 75);
    barBg.lineStyle(2, 0x4a8a5a, 0.8);
    barBg.lineBetween(0, 0, 800, 0);
    this.bottomBar.add(barBg);

    this.createResourceDisplay();
    this.createObjectiveDisplay();
    this.createScoreDisplay();
  }

  private createResourceDisplay(): void {
    const resourceContainer = this.add.container(15, 15);

    const resourceLabel = this.add.text(0, 0, 'RESOURCES', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#7a9a7a',
      fontStyle: 'bold'
    });
    resourceContainer.add(resourceLabel);

    this.resourceBars = this.add.graphics();
    resourceContainer.add(this.resourceBars);

    const fuelIcon = this.add.text(0, 18, '⛽', { fontSize: '14px' });
    const fuelLabel = this.add.text(20, 20, 'Fuel', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff6666'
    });
    this.fuelText = this.add.text(95, 20, '100%', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff6666'
    });
    resourceContainer.add([fuelIcon, fuelLabel, this.fuelText]);

    const waterIcon = this.add.text(120, 18, '🚿', { fontSize: '14px' });
    const waterLabel = this.add.text(140, 20, 'Water', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#6699ff'
    });
    this.waterText = this.add.text(220, 20, '100%', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#6699ff'
    });
    resourceContainer.add([waterIcon, waterLabel, this.waterText]);

    const fertIcon = this.add.text(250, 18, '🧪', { fontSize: '14px' });
    const fertLabel = this.add.text(270, 20, 'Fertilizer', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffcc66'
    });
    this.fertText = this.add.text(355, 20, '100%', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffcc66'
    });
    resourceContainer.add([fertIcon, fertLabel, this.fertText]);

    this.bottomBar.add(resourceContainer);
  }

  private createObjectiveDisplay(): void {
    const objectiveContainer = this.add.container(15, 45);

    const objectiveIcon = this.add.text(0, 5, '🎯', { fontSize: '14px' });
    objectiveContainer.add(objectiveIcon);

    this.objectiveText = this.add.text(22, 6, 'Objective: Loading...', {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffcc00'
    });
    objectiveContainer.add(this.objectiveText);

    this.bottomBar.add(objectiveContainer);
  }

  private createScoreDisplay(): void {
    const scoreContainer = this.add.container(650, 25);

    const scoreBg = this.add.rectangle(0, 0, 120, 40, 0x2a5a3a, 0.8);
    scoreBg.setStrokeStyle(2, 0x4a8a5a);
    scoreContainer.add(scoreBg);

    const trophyIcon = this.add.text(-45, -2, '🏆', { fontSize: '18px' });
    scoreContainer.add(trophyIcon);

    this.scoreText = this.add.text(10, 0, '0', {
      fontSize: '20px',
      fontFamily: 'Arial Black, sans-serif',
      color: '#ffcc00'
    }).setOrigin(0, 0.5);
    scoreContainer.add(this.scoreText);

    this.bottomBar.add(scoreContainer);
  }

  private createMinimap(): void {
    this.minimapFrame = this.add.container(642, 395);

    const frameShadow = this.add.rectangle(5, 5, 154, 128, 0x000000, 0.4);
    this.minimapFrame.add(frameShadow);

    const frameBg = this.add.rectangle(0, 0, 154, 128, 0x0d1f15, 0.95);
    frameBg.setStrokeStyle(2, 0x4a8a5a);
    this.minimapFrame.add(frameBg);

    const frameHeader = this.add.rectangle(0, -54, 150, 18, 0x2a5a3a);
    this.minimapFrame.add(frameHeader);

    const mapLabel = this.add.text(0, -54, '📍 MINIMAP', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.minimapFrame.add(mapLabel);

    this.minimap = this.add.graphics();
    this.minimap.setPosition(570, 350);
  }

  private createNotificationArea(): void {
    this.notificationContainer = this.add.container(400, 480);
  }

  showNotification(message: string, duration: number = 2000): void {
    const notification = this.add.container(0, 0);

    const bgWidth = Math.max(200, message.length * 8 + 40);
    const bg = this.add.rectangle(0, 0, bgWidth, 36, 0x2a5a3a, 0.95);
    bg.setStrokeStyle(2, 0x7FFF7F);
    notification.add(bg);

    const text = this.add.text(0, 0, message, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }).setOrigin(0.5);
    notification.add(text);

    this.notificationContainer.add(notification);

    notification.setAlpha(0);
    notification.y = 20;

    this.tweens.add({
      targets: notification,
      alpha: 1,
      y: 0,
      duration: 200,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: notification,
      y: -40,
      alpha: 0,
      duration: 500,
      delay: duration,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });

    const existingNotifications = this.notificationContainer.list;
    existingNotifications.forEach((notif) => {
      if (notif !== notification && notif instanceof Phaser.GameObjects.Container) {
        this.tweens.add({
          targets: notif,
          y: notif.y - 45,
          duration: 200
        });
      }
    });
  }

  update(): void {
    if (!this.gameScene.getTimeSystem) return;

    const timeSystem = this.gameScene.getTimeSystem();
    const grassSystem = this.gameScene.getGrassSystem();
    const equipmentManager = this.gameScene.getEquipmentManager();
    const gameStateManager = this.gameScene.getGameStateManager();

    if (!timeSystem || !grassSystem || !equipmentManager || !gameStateManager) return;

    this.timeText.setText(timeSystem.getFormattedTime());
    this.dayText.setText(timeSystem.getDayName());
    this.speedText.setText(`${timeSystem.getTimeScale()}x`);

    const health = grassSystem.getAverageHealth();
    const moisture = grassSystem.getAverageMoisture();
    const nutrients = grassSystem.getAverageNutrients();

    this.updateStatBar(this.healthBar, 70, 20, 80, 12, health, this.getHealthColor(health));
    this.healthText.setText(`${Math.floor(health)}%`);
    this.healthText.setColor(this.getHealthColorHex(health));

    this.updateStatBar(this.moistureBar, 70, 40, 80, 8, moisture, 0x0088ff);
    this.moistureText.setText(`${Math.floor(moisture)}%`);

    this.updateStatBar(this.nutrientsBar, 70, 56, 80, 8, nutrients, 0x00ff00);
    this.nutrientsText.setText(`${Math.floor(nutrients)}%`);

    const overlayMode = grassSystem.getOverlayMode();
    if (overlayMode !== 'normal') {
      this.overlayModeText.setText(`[${overlayMode.toUpperCase()}]`);
      this.overlayModeText.setVisible(true);
    } else {
      this.overlayModeText.setVisible(false);
    }

    this.updateEquipmentSlots(equipmentManager.getCurrentType());

    const mower = equipmentManager.getMower();
    const sprinkler = equipmentManager.getSprinkler();
    const spreader = equipmentManager.getSpreader();

    this.resourceBars.clear();

    const fuelPercent = mower.getResourcePercent();
    this.updateResourceBar(50, 22, 40, 8, fuelPercent, 0xff4444);
    this.fuelText.setText(`${Math.floor(fuelPercent)}%`);

    const waterPercent = sprinkler.getResourcePercent();
    this.updateResourceBar(180, 22, 40, 8, waterPercent, 0x4488ff);
    this.waterText.setText(`${Math.floor(waterPercent)}%`);

    const fertPercent = spreader.getResourcePercent();
    this.updateResourceBar(315, 22, 40, 8, fertPercent, 0xffcc44);
    this.fertText.setText(`${Math.floor(fertPercent)}%`);

    this.scoreText.setText(gameStateManager.getScore().toLocaleString());

    const objective = gameStateManager.getCurrentObjective();
    if (objective) {
      const checkmark = objective.completed ? ' ✅' : '';
      this.objectiveText.setText(`${objective.description}${checkmark}`);
      this.objectiveText.setColor(objective.completed ? '#00ff00' : '#ffcc00');
    }

    this.updateMinimap();
  }

  private updateStatBar(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, value: number, color: number): void {
    graphics.clear();

    graphics.fillStyle(0x1a3a2a, 1);
    graphics.fillRoundedRect(x, y, width, height, 3);

    graphics.lineStyle(1, 0x3a5a4a, 0.5);
    graphics.strokeRoundedRect(x, y, width, height, 3);

    const fillWidth = Math.max(0, (width - 2) * (value / 100));
    if (fillWidth > 0) {
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(x + 1, y + 1, fillWidth, height - 2, 2);
    }
  }

  private updateResourceBar(x: number, y: number, width: number, height: number, value: number, color: number): void {
    this.resourceBars.fillStyle(0x1a3a2a, 1);
    this.resourceBars.fillRoundedRect(x, y, width, height, 2);

    this.resourceBars.lineStyle(1, 0x3a5a4a, 0.5);
    this.resourceBars.strokeRoundedRect(x, y, width, height, 2);

    const fillWidth = Math.max(0, (width - 2) * (value / 100));
    if (fillWidth > 0) {
      this.resourceBars.fillStyle(color, 1);
      this.resourceBars.fillRoundedRect(x + 1, y + 1, fillWidth, height - 2, 2);
    }
  }

  private getHealthColor(health: number): number {
    if (health >= 70) return 0x00ff00;
    if (health >= 40) return 0xffff00;
    return 0xff0000;
  }

  private getHealthColorHex(health: number): string {
    if (health >= 70) return '#00ff00';
    if (health >= 40) return '#ffff00';
    return '#ff0000';
  }

  private updateEquipmentSlots(currentType: EquipmentType): void {
    const slotTypes: EquipmentType[] = ['mower', 'sprinkler', 'spreader'];

    this.equipmentSlots.forEach((slot, index) => {
      const bg = slot.list[1] as Phaser.GameObjects.Rectangle;
      const iconBg = slot.list[2] as Phaser.GameObjects.Rectangle;

      if (slotTypes[index] === currentType) {
        bg.setStrokeStyle(3, 0x7FFF7F);
        bg.setFillStyle(0x2a5a3a);
        iconBg.setAlpha(1);

        if (!slot.getData('pulsing')) {
          slot.setData('pulsing', true);
        }
      } else {
        bg.setStrokeStyle(2, 0x3a5a4a);
        bg.setFillStyle(0x1a3a2a);
        iconBg.setAlpha(0.6);
        slot.setData('pulsing', false);
      }
    });
  }

  private updateMinimap(): void {
    this.minimap.clear();

    const grassSystem = this.gameScene.getGrassSystem();
    const player = this.gameScene.getPlayer();

    if (!grassSystem || !player) return;

    const cells = grassSystem.getCells();
    const scaleX = 144 / grassSystem.getWidth();
    const scaleY = 100 / grassSystem.getHeight();

    for (let y = 0; y < grassSystem.getHeight(); y++) {
      for (let x = 0; x < grassSystem.getWidth(); x++) {
        const cell = cells[y][x];
        let color: number;

        if (cell.type === 'water') {
          color = 0x1E90FF;
        } else if (cell.type === 'bunker') {
          color = 0xD4A574;
        } else if (cell.type === 'green') {
          color = 0x00cc00;
        } else {
          const health = cell.health;
          if (health >= 70) {
            color = 0x228B22;
          } else if (health >= 40) {
            color = 0x9ACD32;
          } else {
            color = 0x8B4513;
          }
        }

        this.minimap.fillStyle(color, 1);
        this.minimap.fillRect(x * scaleX, y * scaleY, Math.max(1, scaleX), Math.max(1, scaleY));
      }
    }

    const playerGridX = Math.floor(player.x / 32);
    const playerGridY = Math.floor(player.y / 32);

    this.minimap.fillStyle(0x000000, 0.5);
    this.minimap.fillCircle(playerGridX * scaleX + scaleX / 2 + 1, playerGridY * scaleY + scaleY / 2 + 1, 4);

    this.minimap.fillStyle(0xffffff, 1);
    this.minimap.fillCircle(playerGridX * scaleX + scaleX / 2, playerGridY * scaleY + scaleY / 2, 3);

    this.minimap.lineStyle(1, 0x7FFF7F, 1);
    this.minimap.strokeCircle(playerGridX * scaleX + scaleX / 2, playerGridY * scaleY + scaleY / 2, 5);
  }
}
