import Phaser from 'phaser';

export type EquipmentType = 'mower' | 'sprinkler' | 'spreader' | null;
export type Direction = 'up' | 'down' | 'left' | 'right';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private stamina = 100;
  private currentEquipment: EquipmentType = null;
  private isEquipmentActive = false;
  private direction: Direction = 'down';
  private speed = 200;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDrag(500);
    this.setMaxVelocity(this.speed);
    this.setDepth(10);
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
    let velocityX = 0;
    let velocityY = 0;

    if (cursors.left.isDown || cursors.a.isDown) {
      velocityX = -this.speed;
      this.direction = 'left';
    } else if (cursors.right.isDown || cursors.d.isDown) {
      velocityX = this.speed;
      this.direction = 'right';
    }

    if (cursors.up.isDown || cursors.w.isDown) {
      velocityY = -this.speed;
      this.direction = 'up';
    } else if (cursors.down.isDown || cursors.s.isDown) {
      velocityY = this.speed;
      this.direction = 'down';
    }

    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    this.setVelocity(velocityX, velocityY);

    if (velocityX < 0) {
      this.setFlipX(true);
    } else if (velocityX > 0) {
      this.setFlipX(false);
    }
  }

  getGridPosition(): { x: number; y: number } {
    return {
      x: Math.floor(this.x / 32),
      y: Math.floor(this.y / 32)
    };
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
}
