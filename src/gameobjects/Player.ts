import Phaser from 'phaser';

export type EquipmentType = 'mower' | 'sprinkler' | 'spreader' | null;
export type Direction = 'up' | 'down' | 'left' | 'right';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private stamina = 100;
  private currentEquipment: EquipmentType = null;
  private isEquipmentActive = false;
  private direction: Direction = 'down';
  private mapWidth = 30;
  private mapHeight = 60;

  private gridX = 0;
  private gridY = 0;
  private isMoving = false;
  private moveSpeed = 150;
  private tileWidth = 64;
  private tileHeight = 32;
  private canWalkOnTile: ((x: number, y: number) => boolean) | null = null;
  private canMoveFromTo: ((fromX: number, fromY: number, toX: number, toY: number) => boolean) | null = null;
  private getElevationAt: ((x: number, y: number) => number) | null = null;
  private readonly ELEVATION_HEIGHT = 16;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'iso_player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(false);
    this.setDepth(100);

    if (this.body) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.setAllowGravity(false);
    }
  }

  setMapSize(mapWidth: number, mapHeight?: number): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight ?? mapWidth;

    const gridPos = this.screenToGrid(this.x, this.y);
    this.gridX = gridPos.x;
    this.gridY = gridPos.y;

    const snappedPos = this.gridToScreen(this.gridX, this.gridY);
    this.setPosition(snappedPos.x, snappedPos.y);
  }

  private gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const screenX = (gridX - gridY) * (this.tileWidth / 2) + (this.mapWidth * this.tileWidth / 2);
    const elevation = this.getElevationAt ? this.getElevationAt(gridX, gridY) : 0;
    const screenY = (gridX + gridY) * (this.tileHeight / 2) - elevation * this.ELEVATION_HEIGHT;
    return { x: screenX, y: screenY };
  }

  private screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const offsetX = screenX - (this.mapWidth * this.tileWidth / 2);
    const isoX = (offsetX / (this.tileWidth / 2) + screenY / (this.tileHeight / 2)) / 2;
    const isoY = (screenY / (this.tileHeight / 2) - offsetX / (this.tileWidth / 2)) / 2;
    return { x: Math.round(isoX), y: Math.round(isoY) };
  }

  syncGridPosition(): void {
    const gridPos = this.screenToGrid(this.x, this.y);
    this.gridX = gridPos.x;
    this.gridY = gridPos.y;
  }

  update(cursors: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  }): void {
    if (this.isMoving) {
      this.updateDepth();
      return;
    }

    let dx = 0;
    let dy = 0;

    if (cursors.up.isDown || cursors.w.isDown) {
      dy = -1;
      this.direction = 'up';
    } else if (cursors.down.isDown || cursors.s.isDown) {
      dy = 1;
      this.direction = 'down';
    } else if (cursors.left.isDown || cursors.a.isDown) {
      dx = -1;
      this.direction = 'left';
    } else if (cursors.right.isDown || cursors.d.isDown) {
      dx = 1;
      this.direction = 'right';
    }

    if (dx !== 0 || dy !== 0) {
      this.moveToTile(this.gridX + dx, this.gridY + dy);
    }

    if (this.direction === 'left' || this.direction === 'up') {
      this.setFlipX(true);
    } else {
      this.setFlipX(false);
    }

    this.updateDepth();
  }

  private moveToTile(targetX: number, targetY: number): void {
    if (targetX < 0 || targetX >= this.mapWidth || targetY < 0 || targetY >= this.mapHeight) {
      return;
    }

    if (this.canMoveFromTo) {
      if (!this.canMoveFromTo(this.gridX, this.gridY, targetX, targetY)) {
        return;
      }
    } else if (this.canWalkOnTile && !this.canWalkOnTile(targetX, targetY)) {
      return;
    }

    this.isMoving = true;
    this.gridX = targetX;
    this.gridY = targetY;

    const targetPos = this.gridToScreen(targetX, targetY);
    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetPos.x, targetPos.y);
    const duration = (distance / this.moveSpeed) * 1000;

    this.scene.tweens.add({
      targets: this,
      x: targetPos.x,
      y: targetPos.y,
      duration: Math.max(duration, 80),
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false;
      }
    });
  }

  private updateDepth(): void {
    this.setDepth(100 + this.gridX + this.gridY);
  }

  getGridPosition(): { x: number; y: number } {
    return { x: this.gridX, y: this.gridY };
  }

  getIsMoving(): boolean {
    return this.isMoving;
  }

  setGridPosition(x: number, y: number): void {
    this.gridX = x;
    this.gridY = y;
    const pos = this.gridToScreen(x, y);
    this.setPosition(pos.x, pos.y);
  }

  getStamina(): number {
    return this.stamina;
  }

  setStamina(value: number): void {
    this.stamina = Phaser.Math.Clamp(value, 0, 100);
  }

  getCurrentEquipment(): EquipmentType {
    return this.currentEquipment;
  }

  setCurrentEquipment(equipment: EquipmentType): void {
    this.currentEquipment = equipment;
  }

  getIsEquipmentActive(): boolean {
    return this.isEquipmentActive;
  }

  setIsEquipmentActive(active: boolean): void {
    this.isEquipmentActive = active;
  }

  getDirection(): Direction {
    return this.direction;
  }

  setCollisionChecker(checker: (x: number, y: number) => boolean): void {
    this.canWalkOnTile = checker;
  }

  setElevationGetter(getter: (x: number, y: number) => number): void {
    this.getElevationAt = getter;
  }

  setMoveChecker(checker: (fromX: number, fromY: number, toX: number, toY: number) => boolean): void {
    this.canMoveFromTo = checker;
  }
}
