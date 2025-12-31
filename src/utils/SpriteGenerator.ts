import Phaser from 'phaser';

export class SpriteGenerator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generateAll(): void {
    this.generateIsometricTiles();
    this.generateParticles();
  }

  private generateParticles(): void {
    let g = this.scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x5AB830, 1);
    g.fillRect(0, 0, 8, 4);
    g.fillStyle(0x7AD850, 1);
    g.fillRect(1, 0, 6, 2);
    g.fillStyle(0x4AA020, 1);
    g.fillRect(0, 3, 8, 1);
    g.generateTexture('grass_particle', 8, 4);
    g.destroy();

    g = this.scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x2288DD, 1);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0x44AAFF, 1);
    g.fillCircle(4, 4, 3);
    g.fillStyle(0x88DDFF, 1);
    g.fillCircle(3, 3, 2);
    g.fillStyle(0xCCEEFF, 1);
    g.fillCircle(2, 2, 1);
    g.generateTexture('water_particle', 10, 10);
    g.destroy();

    g = this.scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x7B5914, 1);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0x9B7934, 1);
    g.fillCircle(3, 3, 3);
    g.fillStyle(0xBB9954, 1);
    g.fillCircle(2, 2, 2);
    g.fillStyle(0xDDBB77, 1);
    g.fillCircle(2, 2, 1);
    g.generateTexture('fertilizer_particle', 8, 8);
    g.destroy();
  }

  private generateIsometricTiles(): void {
    this.generateIsoTile('iso_fairway_mown', 0x78CC50, 0x52A030, true);
    this.generateIsoTile('iso_fairway_growing', 0x68BB45, 0x4A9530, true, 0.3);
    this.generateIsoTile('iso_fairway_unmown', 0x5A9A38, 0x4A8A28, false);
    this.generateIsoTile('iso_rough_mown', 0x558540, 0x385828, true);
    this.generateIsoTile('iso_rough_growing', 0x4A7535, 0x306020, true, 0.4);
    this.generateIsoTile('iso_rough_unmown', 0x3A6A20, 0x2A5A18, false);
    this.generateIsoTile('iso_green_mown', 0x50E050, 0x48D848, true, 0.15);
    this.generateIsoTile('iso_green_growing', 0x48D048, 0x42C040, true, 0.25);
    this.generateIsoTile('iso_green_unmown', 0x40C040, 0x38B038, false);
    this.generateIsoTile('iso_bunker', 0xE8D8B0, 0xD8C8A0, false);
    this.generateIsoTile('iso_water', 0x2090D0, 0x1878B8, false);
    this.generateIsoTile('iso_grass_dead', 0x8B7355, 0x7A6345, false);
    this.generateIsoTile('iso_grass_dry', 0xA09060, 0x907050, false);
    this.generateIsoPlayer();
    this.generateIsoMower();
    this.generateIsoSprinkler();
    this.generateIsoSpreader();
    this.generateIsoRefillStation();
    this.generateIsoTree();
    this.generateIsoFlag();
    this.generateElevationTiles();
    this.generateIsoShrub();
    this.generateIsoBush();
    this.generateIsoPineTree();
  }

  private generateIsoTile(key: string, lightColor: number, darkColor: number, hasStripes: boolean, stripeFade: number = 0): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 32;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = Math.abs(px - w / 2) / (w / 2);
        const dy = Math.abs(py - h / 2) / (h / 2);

        if (dx + dy <= 1) {
          let color: number;

          if (hasStripes) {
            const stripeWidth = 8;
            const stripe = Math.floor((px + py) / stripeWidth) % 2;

            if (stripeFade > 0 && ((px * 3 + py * 7) % 11 < stripeFade * 11)) {
              color = stripe === 0 ? this.blendColors(lightColor, darkColor, 0.5) : this.blendColors(darkColor, lightColor, 0.5);
            } else {
              color = stripe === 0 ? lightColor : darkColor;
            }
          } else {
            const noise = (px * 7 + py * 11) % 10;
            if (noise < 3) {
              color = lightColor;
            } else if (noise < 6) {
              color = darkColor;
            } else {
              color = this.blendColors(lightColor, darkColor, 0.5);
            }
          }

          g.fillStyle(color, 1);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = Math.abs(px - w / 2) / (w / 2);
        const dy = Math.abs(py - h / 2) / (h / 2);
        const dist = dx + dy;

        if (dist <= 1 && dist > 0.85) {
          if (px > w / 2 || py > h / 2) {
            g.fillStyle(0x000000, 0.15);
            g.fillRect(px, py, 1, 1);
          }
        }
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private generateIsoPlayer(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 32, h = 48;

    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 44, 20, 8);

    g.fillStyle(0x1D7A3E, 1);
    g.fillEllipse(16, 28, 16, 20);

    g.fillStyle(0x2D8A4E, 1);
    g.fillEllipse(14, 26, 10, 14);

    g.fillStyle(0xF0D0B0, 1);
    g.fillCircle(16, 12, 8);

    g.fillStyle(0x1A6030, 1);
    g.fillEllipse(16, 8, 12, 6);

    g.generateTexture('iso_player', w, h);
    g.destroy();
  }

  private generateIsoMower(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 48, h = 32;

    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(24, 28, 36, 10);

    g.fillStyle(0xCC2222, 1);
    g.beginPath();
    g.moveTo(8, 20);
    g.lineTo(40, 20);
    g.lineTo(44, 24);
    g.lineTo(40, 28);
    g.lineTo(8, 28);
    g.lineTo(4, 24);
    g.closePath();
    g.fill();

    g.fillStyle(0xDD3333, 1);
    g.beginPath();
    g.moveTo(10, 18);
    g.lineTo(38, 18);
    g.lineTo(42, 22);
    g.lineTo(38, 22);
    g.lineTo(10, 22);
    g.lineTo(6, 20);
    g.closePath();
    g.fill();

    g.fillStyle(0x333333, 1);
    g.fillEllipse(12, 26, 6, 4);
    g.fillEllipse(36, 26, 6, 4);

    g.fillStyle(0x444444, 1);
    g.fillRect(20, 12, 8, 6);

    g.fillStyle(0x666666, 1);
    g.fillRect(22, 10, 4, 3);

    g.fillStyle(0xAA1111, 1);
    g.fillRect(4, 22, 40, 2);

    g.generateTexture('iso_mower', w, h);
    g.destroy();
  }

  private generateIsoSprinkler(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 32, h = 32;

    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(16, 28, 20, 8);

    g.fillStyle(0x3366CC, 1);
    g.fillRect(12, 16, 8, 12);

    g.fillStyle(0x4477DD, 1);
    g.fillRect(13, 17, 6, 8);

    g.fillStyle(0x555555, 1);
    g.fillRect(14, 10, 4, 7);

    g.fillStyle(0x666666, 1);
    g.fillCircle(16, 8, 4);

    g.fillStyle(0x00BFFF, 0.6);
    g.fillCircle(10, 6, 2);
    g.fillCircle(22, 6, 2);
    g.fillCircle(16, 3, 2);

    g.generateTexture('iso_sprinkler', w, h);
    g.destroy();
  }

  private generateIsoSpreader(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 40, h = 32;

    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(20, 28, 30, 10);

    g.fillStyle(0x228B22, 1);
    g.beginPath();
    g.moveTo(8, 18);
    g.lineTo(32, 18);
    g.lineTo(36, 22);
    g.lineTo(32, 26);
    g.lineTo(8, 26);
    g.lineTo(4, 22);
    g.closePath();
    g.fill();

    g.fillStyle(0x2A9A2A, 1);
    g.beginPath();
    g.moveTo(10, 12);
    g.lineTo(30, 12);
    g.lineTo(34, 18);
    g.lineTo(30, 18);
    g.lineTo(10, 18);
    g.lineTo(6, 15);
    g.closePath();
    g.fill();

    g.fillStyle(0xD2B48C, 1);
    g.fillCircle(12, 15, 3);
    g.fillCircle(20, 14, 3);
    g.fillCircle(28, 15, 3);

    g.fillStyle(0x333333, 1);
    g.fillEllipse(10, 26, 4, 3);
    g.fillEllipse(30, 26, 4, 3);

    g.fillStyle(0x444444, 1);
    g.fillRect(18, 6, 4, 7);

    g.generateTexture('iso_spreader', w, h);
    g.destroy();
  }

  private generateIsoRefillStation(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 48, h = 48;

    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(24, 44, 40, 12);

    g.fillStyle(0x8B4513, 1);
    g.beginPath();
    g.moveTo(8, 32);
    g.lineTo(40, 32);
    g.lineTo(44, 40);
    g.lineTo(40, 44);
    g.lineTo(8, 44);
    g.lineTo(4, 40);
    g.closePath();
    g.fill();

    g.fillStyle(0x9B5523, 1);
    g.beginPath();
    g.moveTo(10, 24);
    g.lineTo(38, 24);
    g.lineTo(42, 32);
    g.lineTo(38, 32);
    g.lineTo(10, 32);
    g.lineTo(6, 28);
    g.closePath();
    g.fill();

    g.fillStyle(0x666666, 1);
    g.fillRect(18, 10, 12, 16);

    g.fillStyle(0x888888, 1);
    g.fillRect(20, 8, 8, 4);

    g.fillStyle(0x3366CC, 1);
    g.fillCircle(22, 18, 4);

    g.fillStyle(0xCC2222, 1);
    g.fillCircle(28, 18, 4);

    g.generateTexture('iso_refill_station', w, h);
    g.destroy();
  }

  private generateIsoTree(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 48, h = 64;

    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(24, 60, 20, 8);

    g.fillStyle(0x6B4423, 1);
    g.fillRect(20, 40, 8, 20);

    g.fillStyle(0x7B5433, 1);
    g.fillRect(22, 42, 4, 16);

    g.fillStyle(0x228B22, 1);
    g.fillCircle(24, 24, 18);

    g.fillStyle(0x2A9A2A, 1);
    g.fillCircle(20, 20, 10);

    g.fillStyle(0x1A7A1A, 1);
    g.fillCircle(28, 28, 12);

    g.fillStyle(0x3AAA3A, 1);
    g.fillCircle(18, 18, 6);
    g.fillCircle(30, 22, 5);

    g.generateTexture('iso_tree', w, h);
    g.destroy();
  }

  private generateIsoFlag(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 24, h = 48;

    g.fillStyle(0x000000, 0.3);
    g.fillCircle(12, 46, 4);

    g.fillStyle(0xCCCCCC, 1);
    g.fillRect(10, 8, 4, 40);

    g.fillStyle(0xDDDDDD, 1);
    g.fillRect(11, 8, 2, 38);

    g.fillStyle(0xFF0000, 1);
    g.beginPath();
    g.moveTo(14, 8);
    g.lineTo(24, 14);
    g.lineTo(14, 20);
    g.closePath();
    g.fill();

    g.fillStyle(0xCC0000, 1);
    g.beginPath();
    g.moveTo(14, 12);
    g.lineTo(20, 14);
    g.lineTo(14, 18);
    g.closePath();
    g.fill();

    g.generateTexture('iso_flag', w, h);
    g.destroy();
  }

  private generateIsoShrub(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 32, h = 32;

    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(16, 28, 20, 8);

    g.fillStyle(0x2A7A2A, 1);
    g.fillEllipse(16, 18, 22, 16);

    g.fillStyle(0x3A8A3A, 1);
    g.fillEllipse(14, 16, 14, 10);

    g.fillStyle(0x4A9A4A, 1);
    g.fillEllipse(12, 14, 8, 6);
    g.fillEllipse(20, 16, 6, 5);

    g.generateTexture('iso_shrub', w, h);
    g.destroy();
  }

  private generateIsoBush(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 24, h = 24;

    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(12, 20, 16, 6);

    g.fillStyle(0x1A6A1A, 1);
    g.fillEllipse(12, 14, 18, 12);

    g.fillStyle(0x2A7A2A, 1);
    g.fillEllipse(10, 12, 10, 8);

    g.fillStyle(0x3A8A3A, 1);
    g.fillCircle(8, 11, 4);
    g.fillCircle(16, 12, 3);

    g.generateTexture('iso_bush', w, h);
    g.destroy();
  }

  private generateIsoPineTree(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 32, h = 56;

    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 52, 16, 6);

    g.fillStyle(0x5A3A1A, 1);
    g.fillRect(14, 40, 4, 14);

    g.fillStyle(0x6A4A2A, 1);
    g.fillRect(15, 42, 2, 10);

    g.fillStyle(0x1A5A1A, 1);
    g.beginPath();
    g.moveTo(16, 6);
    g.lineTo(4, 26);
    g.lineTo(28, 26);
    g.closePath();
    g.fill();

    g.fillStyle(0x1A6A1A, 1);
    g.beginPath();
    g.moveTo(16, 14);
    g.lineTo(2, 36);
    g.lineTo(30, 36);
    g.closePath();
    g.fill();

    g.fillStyle(0x2A7A2A, 1);
    g.beginPath();
    g.moveTo(16, 24);
    g.lineTo(0, 44);
    g.lineTo(32, 44);
    g.closePath();
    g.fill();

    g.fillStyle(0x3A8A3A, 1);
    g.beginPath();
    g.moveTo(16, 8);
    g.lineTo(10, 20);
    g.lineTo(22, 20);
    g.closePath();
    g.fill();

    g.generateTexture('iso_pine_tree', w, h);
    g.destroy();
  }

  private generateElevationTiles(): void {
    this.generateElevatedTile('iso_elevated_rough', 0x558540, 0x385828, 0x2A4020);
    this.generateRampNorth('iso_ramp_north', 0x558540, 0x385828, 0x2A4020);
    this.generateRampSouth('iso_ramp_south', 0x558540, 0x385828, 0x2A4020);
    this.generateRampEast('iso_ramp_east', 0x558540, 0x385828, 0x2A4020);
    this.generateRampWest('iso_ramp_west', 0x558540, 0x385828, 0x2A4020);
    this.generateCliffEdge('iso_cliff_edge', 0x6B5030, 0x4A3820);
  }

  private generateElevatedTile(key: string, topLight: number, topDark: number, sideColor: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 48;
    const elevationHeight = 16;

    for (let py = elevationHeight; py < h - elevationHeight; py++) {
      for (let px = 0; px < w; px++) {
        const adjustedY = py - elevationHeight;
        const dx = Math.abs(px - w / 2) / (w / 2);
        const dy = Math.abs(adjustedY - 16) / 16;

        if (dx + dy <= 1) {
          const stripe = Math.floor((px + adjustedY) / 8) % 2;
          const color = stripe === 0 ? topLight : topDark;
          g.fillStyle(color, 1);
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.fillStyle(sideColor, 1);
    for (let py = h - elevationHeight; py < h; py++) {
      for (let px = 0; px < w / 2; px++) {
        const topY = h - elevationHeight;
        const bottomLeftX = w / 2 - (py - topY) * 2;
        if (px >= bottomLeftX) {
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    const sideColorDark = this.darkenColor(sideColor, 0.2);
    g.fillStyle(sideColorDark, 1);
    for (let py = h - elevationHeight; py < h; py++) {
      for (let px = w / 2; px < w; px++) {
        const topY = h - elevationHeight;
        const bottomRightX = w / 2 + (py - topY) * 2;
        if (px <= bottomRightX) {
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private generateRampNorth(key: string, topLight: number, topDark: number, sideColor: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 48;

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < w; px++) {
        const dx = Math.abs(px - w / 2) / (w / 2);
        const dy = Math.abs(py - 16) / 16;

        if (dx + dy <= 1) {
          const slopeOffset = (py / 32) * 16;
          const targetY = py + Math.floor(slopeOffset);

          if (targetY < h) {
            const stripe = Math.floor((px + py) / 8) % 2;
            const color = stripe === 0 ? topLight : topDark;
            g.fillStyle(color, 1);
            g.fillRect(px, targetY, 1, 1);
          }
        }
      }
    }

    g.fillStyle(sideColor, 1);
    for (let py = 32; py < h; py++) {
      const leftX = w / 2 - (h - py);
      const rightX = w / 2 + (h - py);
      for (let px = Math.max(0, Math.floor(leftX)); px <= Math.min(w - 1, Math.floor(rightX)); px++) {
        g.fillRect(px, py, 1, 1);
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private generateRampSouth(key: string, topLight: number, topDark: number, sideColor: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 48;

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < w; px++) {
        const dx = Math.abs(px - w / 2) / (w / 2);
        const dy = Math.abs(py - 16) / 16;

        if (dx + dy <= 1) {
          const slopeOffset = ((32 - py) / 32) * 16;
          const targetY = py + Math.floor(slopeOffset);

          if (targetY >= 0 && targetY < h) {
            const stripe = Math.floor((px + py) / 8) % 2;
            const color = stripe === 0 ? topLight : topDark;
            g.fillStyle(color, 1);
            g.fillRect(px, targetY, 1, 1);
          }
        }
      }
    }

    g.fillStyle(sideColor, 1);
    for (let py = 16; py < 32; py++) {
      const progress = (py - 16) / 16;
      const leftX = w / 2 - 32 * (1 - progress);
      const rightX = w / 2 + 32 * (1 - progress);
      for (let px = Math.max(0, Math.floor(leftX)); px <= Math.min(w - 1, Math.floor(rightX)); px++) {
        g.fillRect(px, py + 16, 1, 1);
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private generateRampEast(key: string, topLight: number, topDark: number, sideColor: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 48;

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < w; px++) {
        const dx = Math.abs(px - w / 2) / (w / 2);
        const dy = Math.abs(py - 16) / 16;

        if (dx + dy <= 1) {
          const slopeOffset = ((w - px) / w) * 16;
          const targetY = py + Math.floor(slopeOffset);

          if (targetY >= 0 && targetY < h) {
            const stripe = Math.floor((px + py) / 8) % 2;
            const color = stripe === 0 ? topLight : topDark;
            g.fillStyle(color, 1);
            g.fillRect(px, targetY, 1, 1);
          }
        }
      }
    }

    g.fillStyle(this.darkenColor(sideColor, 0.2), 1);
    for (let py = 32; py < h; py++) {
      for (let px = w / 2; px < w; px++) {
        const topY = 32;
        const bottomRightX = w / 2 + (py - topY) * 2;
        if (px <= bottomRightX) {
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private generateRampWest(key: string, topLight: number, topDark: number, sideColor: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 48;

    for (let py = 0; py < 32; py++) {
      for (let px = 0; px < w; px++) {
        const dx = Math.abs(px - w / 2) / (w / 2);
        const dy = Math.abs(py - 16) / 16;

        if (dx + dy <= 1) {
          const slopeOffset = (px / w) * 16;
          const targetY = py + Math.floor(slopeOffset);

          if (targetY >= 0 && targetY < h) {
            const stripe = Math.floor((px + py) / 8) % 2;
            const color = stripe === 0 ? topLight : topDark;
            g.fillStyle(color, 1);
            g.fillRect(px, targetY, 1, 1);
          }
        }
      }
    }

    g.fillStyle(sideColor, 1);
    for (let py = 32; py < h; py++) {
      for (let px = 0; px < w / 2; px++) {
        const topY = 32;
        const bottomLeftX = w / 2 - (py - topY) * 2;
        if (px >= bottomLeftX) {
          g.fillRect(px, py, 1, 1);
        }
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private generateCliffEdge(key: string, lightColor: number, darkColor: number): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 48;
    const cliffHeight = 32;

    g.fillStyle(lightColor, 1);
    for (let py = 0; py < cliffHeight; py++) {
      for (let px = 0; px < w / 2; px++) {
        const topY = 0;
        const bottomLeftX = w / 2 - (py - topY) * 2;
        if (px >= bottomLeftX) {
          const noise = (px * 7 + py * 11) % 10;
          if (noise < 4) {
            g.fillStyle(lightColor, 1);
          } else if (noise < 7) {
            g.fillStyle(darkColor, 1);
          } else {
            g.fillStyle(this.blendColors(lightColor, darkColor, 0.5), 1);
          }
          g.fillRect(px, py + 16, 1, 1);
        }
      }
    }

    g.fillStyle(this.darkenColor(darkColor, 0.1), 1);
    for (let py = 0; py < cliffHeight; py++) {
      for (let px = w / 2; px < w; px++) {
        const topY = 0;
        const bottomRightX = w / 2 + (py - topY) * 2;
        if (px <= bottomRightX) {
          const noise = (px * 7 + py * 11) % 10;
          if (noise < 4) {
            g.fillStyle(this.darkenColor(lightColor, 0.15), 1);
          } else if (noise < 7) {
            g.fillStyle(this.darkenColor(darkColor, 0.15), 1);
          } else {
            g.fillStyle(this.darkenColor(this.blendColors(lightColor, darkColor, 0.5), 0.15), 1);
          }
          g.fillRect(px, py + 16, 1, 1);
        }
      }
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, Math.floor(((color >> 16) & 0xFF) * (1 - amount)));
    const g = Math.max(0, Math.floor(((color >> 8) & 0xFF) * (1 - amount)));
    const b = Math.max(0, Math.floor((color & 0xFF) * (1 - amount)));
    return (r << 16) | (g << 8) | b;
  }

  private blendColors(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xFF;
    const g1 = (color1 >> 8) & 0xFF;
    const b1 = color1 & 0xFF;
    const r2 = (color2 >> 16) & 0xFF;
    const g2 = (color2 >> 8) & 0xFF;
    const b2 = color2 & 0xFF;
    const r = Math.floor(r1 + (r2 - r1) * t);
    const gr = Math.floor(g1 + (g2 - g1) * t);
    const b = Math.floor(b1 + (b2 - b1) * t);
    return (r << 16) | (gr << 8) | b;
  }
}
