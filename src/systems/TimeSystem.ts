export class TimeSystem {
  private gameTime = 0;
  private dayLength = 24;
  private timeScale = 1;
  private currentHour = 6;
  private currentDay = 1;
  private isPaused = false;

  update(delta: number): void {
    if (this.isPaused) return;

    const gameMinutes = (delta * this.timeScale) / 60000;
    this.gameTime += gameMinutes;

    const totalHours = (this.gameTime / 60) % this.dayLength;
    const previousHour = this.currentHour;
    this.currentHour = Math.floor(totalHours);

    if (previousHour === 23 && this.currentHour === 0) {
      this.currentDay++;
    }
  }

  setTimeScale(scale: number): void {
    this.timeScale = Phaser.Math.Clamp(scale, 0.5, 4);
  }

  getTimeScale(): number {
    return this.timeScale;
  }

  increaseTimeScale(): void {
    if (this.timeScale < 4) {
      this.timeScale *= 2;
    }
  }

  decreaseTimeScale(): void {
    if (this.timeScale > 0.5) {
      this.timeScale /= 2;
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getFormattedTime(): string {
    const hour = 6 + this.currentHour;
    const displayHour = hour % 24;
    const minutes = Math.floor((this.gameTime % 60));
    const period = displayHour >= 12 ? 'PM' : 'AM';
    const hour12 = displayHour % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  getDayName(): string {
    return `Day ${this.currentDay}`;
  }

  getCurrentHour(): number {
    return (6 + this.currentHour) % 24;
  }

  getCurrentDay(): number {
    return this.currentDay;
  }

  getGameTime(): number {
    return this.gameTime;
  }

  getDaylightTint(): number {
    const hour = this.getCurrentHour();

    if (hour >= 6 && hour < 8) {
      const t = (hour - 6) / 2;
      return this.lerpColor(0xFFCC88, 0xFFFFFF, t);
    } else if (hour >= 8 && hour < 18) {
      return 0xFFFFFF;
    } else if (hour >= 18 && hour < 20) {
      const t = (hour - 18) / 2;
      return this.lerpColor(0xFFFFFF, 0xFFAA66, t);
    } else {
      return 0x6688BB;
    }
  }

  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xFF;
    const g1 = (color1 >> 8) & 0xFF;
    const b1 = color1 & 0xFF;

    const r2 = (color2 >> 16) & 0xFF;
    const g2 = (color2 >> 8) & 0xFF;
    const b2 = color2 & 0xFF;

    const r = Math.floor(r1 + (r2 - r1) * t);
    const g = Math.floor(g1 + (g2 - g1) * t);
    const b = Math.floor(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
  }

  getSerializableState(): object {
    return {
      gameTime: this.gameTime,
      currentDay: this.currentDay,
      timeScale: this.timeScale
    };
  }

  loadState(state: { gameTime: number; currentDay: number; timeScale: number }): void {
    this.gameTime = state.gameTime;
    this.currentDay = state.currentDay;
    this.timeScale = state.timeScale;
    this.currentHour = Math.floor((this.gameTime / 60) % this.dayLength);
  }
}

import Phaser from 'phaser';
