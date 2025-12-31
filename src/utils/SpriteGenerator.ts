import Phaser from 'phaser';

export class SpriteGenerator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generateAll(): void {
    this.generatePlayerSprite();
    this.generateMowerSprite();
    this.generateSprinklerSprite();
    this.generateSpreaderSprite();
    this.generateGrassSprites();
    this.generateTerrainSprites();
    this.generateRefillStation();
    this.generateParticles();
    this.generateProps();
    this.generateCourseDecorations();
  }

  private generatePlayerSprite(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 32, h = 48;

    // Ground shadow - soft ellipse
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(16, 46, 18, 5);

    // === BOOTS ===
    // Left boot
    g.fillStyle(0x4A3525, 1); // Dark brown base
    g.fillRect(7, 40, 8, 7);
    g.fillStyle(0x5D4632, 1); // Mid brown
    g.fillRect(8, 40, 6, 5);
    g.fillStyle(0x3A2515, 1); // Darker sole
    g.fillRect(6, 45, 10, 3);
    g.fillStyle(0x6B5642, 1); // Highlight
    g.fillRect(9, 41, 3, 2);
    // Boot laces
    g.fillStyle(0x2A1A0A, 1);
    g.fillRect(10, 42, 2, 1);
    g.fillRect(10, 44, 2, 1);

    // Right boot
    g.fillStyle(0x4A3525, 1);
    g.fillRect(17, 40, 8, 7);
    g.fillStyle(0x5D4632, 1);
    g.fillRect(18, 40, 6, 5);
    g.fillStyle(0x3A2515, 1);
    g.fillRect(16, 45, 10, 3);
    g.fillStyle(0x6B5642, 1);
    g.fillRect(19, 41, 3, 2);
    g.fillRect(20, 42, 2, 1);
    g.fillRect(20, 44, 2, 1);

    // === PANTS ===
    // Left leg
    g.fillStyle(0x8B7355, 1); // Khaki base
    g.fillRect(8, 28, 7, 13);
    g.fillStyle(0x7A6345, 1); // Shadow
    g.fillRect(8, 28, 2, 13);
    g.fillRect(8, 36, 7, 5);
    g.fillStyle(0x9B8365, 1); // Highlight
    g.fillRect(11, 29, 3, 6);
    // Knee detail
    g.fillStyle(0x7A6345, 1);
    g.fillRect(9, 34, 5, 2);

    // Right leg
    g.fillStyle(0x8B7355, 1);
    g.fillRect(17, 28, 7, 13);
    g.fillStyle(0x7A6345, 1);
    g.fillRect(22, 28, 2, 13);
    g.fillRect(17, 36, 7, 5);
    g.fillStyle(0x9B8365, 1);
    g.fillRect(18, 29, 3, 6);
    g.fillStyle(0x7A6345, 1);
    g.fillRect(18, 34, 5, 2);

    // === BELT ===
    g.fillStyle(0x3D2817, 1); // Dark leather
    g.fillRect(7, 26, 18, 3);
    g.fillStyle(0x4D3827, 1); // Lighter edge
    g.fillRect(7, 26, 18, 1);
    // Belt buckle
    g.fillStyle(0xC9A93E, 1); // Gold
    g.fillRect(14, 26, 4, 3);
    g.fillStyle(0xE9C94E, 1); // Gold highlight
    g.fillRect(15, 27, 2, 1);

    // === POLO SHIRT ===
    // Main body
    g.fillStyle(0x1D7A3E, 1); // Forest green
    g.fillRect(6, 12, 20, 15);
    // Shading - left side darker
    g.fillStyle(0x156A2E, 1);
    g.fillRect(6, 12, 4, 15);
    // Shading - right side darker
    g.fillStyle(0x156A2E, 1);
    g.fillRect(22, 12, 4, 15);
    // Shading - bottom darker
    g.fillStyle(0x156A2E, 1);
    g.fillRect(6, 22, 20, 5);
    // Highlight - center chest
    g.fillStyle(0x2D8A4E, 1);
    g.fillRect(12, 14, 8, 6);
    // Shirt wrinkle details
    g.fillStyle(0x156A2E, 0.5);
    g.fillRect(10, 18, 1, 4);
    g.fillRect(21, 18, 1, 4);

    // === COLLAR ===
    g.fillStyle(0xF5F5F5, 1); // White collar
    g.fillRect(9, 10, 14, 4);
    g.fillStyle(0xE0E0E0, 1); // Collar shadow
    g.fillRect(9, 12, 14, 2);
    // Collar points
    g.fillStyle(0xF5F5F5, 1);
    g.fillRect(8, 11, 2, 2);
    g.fillRect(22, 11, 2, 2);
    // V-neck opening
    g.fillStyle(0x1D7A3E, 1);
    g.fillRect(14, 11, 4, 3);
    // Button
    g.fillStyle(0xE0E0E0, 1);
    g.fillRect(15, 14, 2, 1);

    // === LOGO PATCH ===
    g.fillStyle(0xFFD700, 1); // Gold background
    g.fillRect(18, 15, 5, 5);
    g.fillStyle(0x1D7A3E, 1); // Green G
    g.fillRect(19, 16, 3, 3);
    g.fillStyle(0xFFD700, 1);
    g.fillRect(20, 17, 1, 1);

    // === ARMS ===
    // Left arm (shirt sleeve)
    g.fillStyle(0x1D7A3E, 1);
    g.fillRect(2, 13, 5, 10);
    g.fillStyle(0x156A2E, 1);
    g.fillRect(2, 18, 5, 5);
    g.fillStyle(0x2D8A4E, 1);
    g.fillRect(3, 14, 3, 3);
    // Sleeve cuff
    g.fillStyle(0x1D7A3E, 1);
    g.fillRect(2, 22, 5, 2);

    // Right arm
    g.fillStyle(0x1D7A3E, 1);
    g.fillRect(25, 13, 5, 10);
    g.fillStyle(0x156A2E, 1);
    g.fillRect(25, 18, 5, 5);
    g.fillStyle(0x2D8A4E, 1);
    g.fillRect(26, 14, 3, 3);
    g.fillRect(25, 22, 5, 2);

    // === HANDS ===
    // Left hand
    g.fillStyle(0xE8C4A0, 1); // Skin
    g.fillRect(2, 24, 5, 5);
    g.fillStyle(0xD4B090, 1); // Shadow
    g.fillRect(2, 27, 5, 2);
    g.fillStyle(0xF8D4B0, 1); // Highlight
    g.fillRect(3, 24, 2, 2);
    // Fingers hint
    g.fillStyle(0xD4B090, 1);
    g.fillRect(3, 28, 1, 1);
    g.fillRect(5, 28, 1, 1);

    // Right hand
    g.fillStyle(0xE8C4A0, 1);
    g.fillRect(25, 24, 5, 5);
    g.fillStyle(0xD4B090, 1);
    g.fillRect(25, 27, 5, 2);
    g.fillStyle(0xF8D4B0, 1);
    g.fillRect(26, 24, 2, 2);
    g.fillStyle(0xD4B090, 1);
    g.fillRect(26, 28, 1, 1);
    g.fillRect(28, 28, 1, 1);

    // === NECK ===
    g.fillStyle(0xE8C4A0, 1);
    g.fillRect(13, 8, 6, 4);
    g.fillStyle(0xD4B090, 1);
    g.fillRect(13, 10, 6, 2);

    // === HEAD/FACE ===
    // Face base
    g.fillStyle(0xF0D0B0, 1);
    g.fillRect(9, 0, 14, 12);
    // Face shading - sides
    g.fillStyle(0xE0C0A0, 1);
    g.fillRect(9, 0, 2, 12);
    g.fillRect(21, 0, 2, 12);
    // Face shading - bottom (jaw)
    g.fillStyle(0xE0C0A0, 1);
    g.fillRect(9, 9, 14, 3);
    // Face highlight - forehead/cheek
    g.fillStyle(0xFFE0C8, 1);
    g.fillRect(12, 2, 8, 4);
    // Cheek blush (subtle)
    g.fillStyle(0xF0B8A0, 0.3);
    g.fillRect(10, 6, 3, 2);
    g.fillRect(19, 6, 3, 2);

    // === EYES ===
    // Left eye white
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(10, 4, 5, 4);
    // Left eye iris
    g.fillStyle(0x4488BB, 1);
    g.fillRect(11, 5, 3, 3);
    // Left eye pupil
    g.fillStyle(0x1A1A2E, 1);
    g.fillRect(12, 6, 2, 2);
    // Left eye highlight
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(12, 5, 1, 1);
    // Left eyebrow
    g.fillStyle(0x4A3020, 1);
    g.fillRect(10, 3, 5, 1);

    // Right eye white
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(17, 4, 5, 4);
    // Right eye iris
    g.fillStyle(0x4488BB, 1);
    g.fillRect(18, 5, 3, 3);
    // Right eye pupil
    g.fillStyle(0x1A1A2E, 1);
    g.fillRect(19, 6, 2, 2);
    // Right eye highlight
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(19, 5, 1, 1);
    // Right eyebrow
    g.fillStyle(0x4A3020, 1);
    g.fillRect(17, 3, 5, 1);

    // === NOSE ===
    g.fillStyle(0xE0C0A0, 1);
    g.fillRect(15, 6, 2, 3);
    g.fillStyle(0xD0B090, 1);
    g.fillRect(15, 8, 2, 1);

    // === MOUTH ===
    g.fillStyle(0xCC9999, 1); // Lip color
    g.fillRect(13, 10, 6, 1);
    // Smile curve
    g.fillStyle(0xF0D0B0, 1);
    g.fillRect(12, 10, 1, 1);
    g.fillRect(19, 10, 1, 1);

    // === HAIR ===
    g.fillStyle(0x4A3020, 1); // Brown hair
    g.fillRect(8, -1, 16, 4);
    // Side hair
    g.fillRect(8, -1, 3, 7);
    g.fillRect(21, -1, 3, 7);
    // Hair highlight
    g.fillStyle(0x5A4030, 1);
    g.fillRect(11, 0, 10, 2);
    // Hair texture
    g.fillStyle(0x3A2010, 1);
    g.fillRect(9, 1, 1, 2);
    g.fillRect(13, 0, 1, 2);
    g.fillRect(18, 0, 1, 2);
    g.fillRect(22, 1, 1, 2);

    // === CAP ===
    // Cap crown
    g.fillStyle(0x1A6030, 1); // Dark green
    g.fillRect(7, -3, 18, 6);
    // Cap shading
    g.fillStyle(0x0A5020, 1);
    g.fillRect(7, 1, 18, 2);
    // Cap highlight
    g.fillStyle(0x2A7040, 1);
    g.fillRect(10, -2, 12, 2);
    // Cap brim
    g.fillStyle(0x0A4018, 1);
    g.fillRect(5, 2, 22, 3);
    g.fillStyle(0x1A5028, 1);
    g.fillRect(6, 2, 20, 1);
    // Brim underside shadow
    g.fillStyle(0x083010, 1);
    g.fillRect(5, 4, 22, 1);

    // Cap logo
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(13, -2, 6, 4);
    g.fillStyle(0xFFD700, 1);
    g.fillRect(14, -1, 4, 2);
    g.fillStyle(0x1A6030, 1);
    g.fillRect(15, -1, 2, 2);

    g.generateTexture('player', w, h);
    g.destroy();
  }

  private generateMowerSprite(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 56, h = 44;

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(28, 42, 48, 8);

    // === BLADE DECK ===
    // Main deck body
    g.fillStyle(0xCC2222, 1);
    g.fillRect(4, 28, 48, 12);
    // Deck top edge highlight
    g.fillStyle(0xEE4444, 1);
    g.fillRect(4, 28, 48, 2);
    // Deck bottom shadow
    g.fillStyle(0x991818, 1);
    g.fillRect(4, 36, 48, 4);
    // Deck side shadows
    g.fillStyle(0xAA2020, 1);
    g.fillRect(4, 28, 4, 12);
    g.fillRect(48, 28, 4, 12);
    // Yellow safety stripe
    g.fillStyle(0xFFDD00, 1);
    g.fillRect(4, 38, 48, 3);
    // Black stripe segments
    g.fillStyle(0x222222, 1);
    for (let i = 0; i < 8; i++) {
      g.fillRect(6 + i * 6, 39, 3, 2);
    }

    // === ENGINE HOUSING ===
    // Main engine body
    g.fillStyle(0xCC2222, 1);
    g.fillRect(16, 8, 24, 22);
    // Engine highlight
    g.fillStyle(0xDD3333, 1);
    g.fillRect(18, 10, 18, 6);
    // Engine shadow
    g.fillStyle(0xAA1818, 1);
    g.fillRect(16, 24, 24, 6);
    g.fillRect(16, 8, 4, 22);
    // Engine vents
    g.fillStyle(0x1A1A1A, 1);
    for (let i = 0; i < 5; i++) {
      g.fillRect(20 + i * 4, 16, 2, 8);
    }
    // Vent depth
    g.fillStyle(0x333333, 1);
    for (let i = 0; i < 5; i++) {
      g.fillRect(20 + i * 4, 16, 1, 8);
    }

    // === AIR FILTER ===
    g.fillStyle(0x2A2A2A, 1);
    g.fillRect(36, 4, 10, 10);
    g.fillStyle(0x3A3A3A, 1);
    g.fillRect(37, 5, 8, 8);
    g.fillStyle(0x4A4A4A, 1);
    g.fillRect(38, 6, 6, 6);
    // Filter mesh
    g.fillStyle(0x333333, 1);
    g.fillRect(39, 7, 1, 4);
    g.fillRect(41, 7, 1, 4);
    g.fillRect(38, 8, 4, 1);
    g.fillRect(38, 10, 4, 1);

    // === GAS CAP ===
    g.fillStyle(0x1A1A1A, 1);
    g.fillCircle(22, 12, 4);
    g.fillStyle(0x333333, 1);
    g.fillCircle(22, 12, 3);
    g.fillStyle(0x444444, 1);
    g.fillCircle(21, 11, 1);

    // === HANDLE BARS ===
    // Left handle post
    g.fillStyle(0x444444, 1);
    g.fillRect(2, 4, 5, 26);
    g.fillStyle(0x555555, 1);
    g.fillRect(3, 4, 2, 26);
    // Right handle post
    g.fillStyle(0x444444, 1);
    g.fillRect(49, 4, 5, 26);
    g.fillStyle(0x555555, 1);
    g.fillRect(50, 4, 2, 26);

    // Cross bar
    g.fillStyle(0x444444, 1);
    g.fillRect(7, 10, 42, 4);
    g.fillStyle(0x555555, 1);
    g.fillRect(7, 10, 42, 1);

    // Handle grips
    g.fillStyle(0x1A1A1A, 1);
    g.fillRect(0, 0, 8, 8);
    g.fillRect(48, 0, 8, 8);
    // Grip texture
    g.fillStyle(0x2A2A2A, 1);
    for (let i = 0; i < 4; i++) {
      g.fillRect(1, 1 + i * 2, 6, 1);
      g.fillRect(49, 1 + i * 2, 6, 1);
    }
    // Grip highlights
    g.fillStyle(0x333333, 1);
    g.fillRect(2, 1, 1, 6);
    g.fillRect(50, 1, 1, 6);

    // === WHEELS ===
    // Back left wheel
    g.fillStyle(0x1A1A1A, 1);
    g.fillCircle(12, 38, 8);
    g.fillStyle(0x2A2A2A, 1);
    g.fillCircle(12, 38, 6);
    // Tire tread
    g.fillStyle(0x1A1A1A, 1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = 12 + Math.cos(angle) * 6;
      const y = 38 + Math.sin(angle) * 6;
      g.fillRect(x - 1, y - 1, 2, 2);
    }
    // Hubcap
    g.fillStyle(0x888888, 1);
    g.fillCircle(12, 38, 3);
    g.fillStyle(0xAAAAAA, 1);
    g.fillCircle(11, 37, 1);

    // Back right wheel
    g.fillStyle(0x1A1A1A, 1);
    g.fillCircle(44, 38, 8);
    g.fillStyle(0x2A2A2A, 1);
    g.fillCircle(44, 38, 6);
    g.fillStyle(0x1A1A1A, 1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = 44 + Math.cos(angle) * 6;
      const y = 38 + Math.sin(angle) * 6;
      g.fillRect(x - 1, y - 1, 2, 2);
    }
    g.fillStyle(0x888888, 1);
    g.fillCircle(44, 38, 3);
    g.fillStyle(0xAAAAAA, 1);
    g.fillCircle(43, 37, 1);

    // Front wheel (smaller, caster style)
    g.fillStyle(0x1A1A1A, 1);
    g.fillCircle(28, 40, 5);
    g.fillStyle(0x2A2A2A, 1);
    g.fillCircle(28, 40, 4);
    g.fillStyle(0x666666, 1);
    g.fillCircle(28, 40, 2);

    // === BRAND LABEL ===
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(22, 24, 12, 4);
    g.fillStyle(0xCC2222, 1);
    g.fillRect(24, 25, 8, 2);

    // === SAFETY KEY ===
    g.fillStyle(0xFF6600, 1);
    g.fillRect(10, 6, 4, 6);
    g.fillStyle(0xFF8833, 1);
    g.fillRect(11, 6, 2, 4);
    // Key ring
    g.fillStyle(0xCCCCCC, 1);
    g.fillRect(11, 4, 2, 2);

    g.generateTexture('mower', w, h);
    g.destroy();
  }

  private generateSprinklerSprite(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 48, h = 40;

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(24, 38, 40, 6);

    // === WATER TANK ===
    // Main tank body
    g.fillStyle(0x2277BB, 1);
    g.fillRect(8, 14, 32, 22);
    // Tank highlight
    g.fillStyle(0x3399DD, 1);
    g.fillRect(12, 16, 12, 8);
    // Tank shadow
    g.fillStyle(0x1155AA, 1);
    g.fillRect(8, 28, 32, 8);
    g.fillRect(8, 14, 6, 22);
    g.fillRect(34, 14, 6, 22);
    // Tank ridges
    g.fillStyle(0x2288CC, 1);
    g.fillRect(8, 20, 32, 2);
    g.fillRect(8, 26, 32, 2);

    // Water level window
    g.fillStyle(0x88CCFF, 0.8);
    g.fillRect(36, 16, 3, 18);
    g.fillStyle(0x4499EE, 1);
    g.fillRect(36, 24, 3, 10);
    // Window frame
    g.fillStyle(0x1155AA, 1);
    g.fillRect(35, 16, 1, 18);
    g.fillRect(39, 16, 1, 18);

    // Tank cap
    g.fillStyle(0x333333, 1);
    g.fillRect(18, 10, 12, 5);
    g.fillStyle(0x444444, 1);
    g.fillRect(19, 11, 10, 3);
    g.fillStyle(0x555555, 1);
    g.fillRect(20, 11, 2, 2);

    // === SPRAY ASSEMBLY ===
    // Central column
    g.fillStyle(0x444444, 1);
    g.fillRect(21, 2, 6, 9);
    g.fillStyle(0x555555, 1);
    g.fillRect(22, 2, 2, 9);

    // Spray head top
    g.fillStyle(0x555555, 1);
    g.fillRect(17, 0, 14, 4);
    g.fillStyle(0x666666, 1);
    g.fillRect(18, 1, 12, 2);

    // Spray nozzles with water effect
    const nozzlePositions = [
      { x: 8, y: 0 },
      { x: 36, y: 0 },
      { x: 4, y: 6 },
      { x: 40, y: 6 }
    ];
    nozzlePositions.forEach(pos => {
      // Nozzle body
      g.fillStyle(0x00BBFF, 1);
      g.fillRect(pos.x, pos.y, 4, 4);
      // Nozzle highlight
      g.fillStyle(0x66DDFF, 1);
      g.fillRect(pos.x + 1, pos.y + 1, 2, 2);
      // Water spray hint
      g.fillStyle(0xAAEEFF, 0.6);
      g.fillCircle(pos.x + 2, pos.y - 1, 2);
    });

    // === PRESSURE GAUGE ===
    g.fillStyle(0xDDDDDD, 1);
    g.fillCircle(14, 20, 4);
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(14, 20, 3);
    // Gauge needle
    g.fillStyle(0xFF0000, 1);
    g.fillRect(14, 18, 2, 1);
    g.fillRect(15, 19, 1, 1);
    // Gauge markings
    g.fillStyle(0x333333, 1);
    g.fillRect(12, 18, 1, 1);
    g.fillRect(16, 18, 1, 1);
    g.fillRect(14, 22, 1, 1);

    // === WHEELS ===
    // Left wheel
    g.fillStyle(0x222222, 1);
    g.fillCircle(14, 36, 5);
    g.fillStyle(0x333333, 1);
    g.fillCircle(14, 36, 4);
    g.fillStyle(0x666666, 1);
    g.fillCircle(14, 36, 2);
    g.fillStyle(0x888888, 1);
    g.fillCircle(13, 35, 1);

    // Right wheel
    g.fillStyle(0x222222, 1);
    g.fillCircle(34, 36, 5);
    g.fillStyle(0x333333, 1);
    g.fillCircle(34, 36, 4);
    g.fillStyle(0x666666, 1);
    g.fillCircle(34, 36, 2);
    g.fillStyle(0x888888, 1);
    g.fillCircle(33, 35, 1);

    // === HANDLES ===
    g.fillStyle(0x444444, 1);
    g.fillRect(2, 10, 4, 20);
    g.fillRect(42, 10, 4, 20);
    g.fillStyle(0x555555, 1);
    g.fillRect(3, 10, 1, 20);
    g.fillRect(43, 10, 1, 20);
    // Handle grips
    g.fillStyle(0x1A1A1A, 1);
    g.fillRect(1, 8, 6, 5);
    g.fillRect(41, 8, 6, 5);
    g.fillStyle(0x2A2A2A, 1);
    g.fillRect(2, 9, 4, 1);
    g.fillRect(2, 11, 4, 1);
    g.fillRect(42, 9, 4, 1);
    g.fillRect(42, 11, 4, 1);

    g.generateTexture('sprinkler', w, h);
    g.destroy();
  }

  private generateSpreaderSprite(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 52, h = 40;

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(26, 38, 44, 6);

    // === HOPPER ===
    // Main hopper body
    g.fillStyle(0xDDA000, 1);
    g.fillRect(8, 6, 36, 22);
    // Hopper highlight
    g.fillStyle(0xEEB820, 1);
    g.fillRect(14, 8, 20, 8);
    // Hopper shadow
    g.fillStyle(0xBB8800, 1);
    g.fillRect(8, 20, 36, 8);
    g.fillRect(8, 6, 6, 22);
    g.fillRect(38, 6, 6, 22);

    // Hopper top rim
    g.fillStyle(0xCC9000, 1);
    g.fillRect(6, 4, 40, 4);
    g.fillStyle(0xDDA010, 1);
    g.fillRect(8, 4, 36, 2);

    // Fertilizer visible inside
    g.fillStyle(0x7B5914, 1);
    g.fillRect(12, 8, 28, 10);
    // Fertilizer granule detail
    const granuleColors = [0x8B6924, 0x9B7934, 0x6B4904];
    for (let i = 0; i < 20; i++) {
      g.fillStyle(granuleColors[i % 3], 1);
      g.fillRect(14 + (i * 7) % 24, 9 + (i * 5) % 8, 2, 2);
    }

    // Hopper bottom opening
    g.fillStyle(0x333333, 1);
    g.fillRect(20, 28, 12, 6);
    g.fillStyle(0x222222, 1);
    g.fillRect(22, 30, 8, 3);

    // === SPREADER DISC ===
    g.fillStyle(0x444444, 1);
    g.fillEllipse(26, 36, 20, 8);
    g.fillStyle(0x555555, 1);
    g.fillEllipse(26, 36, 16, 6);
    g.fillStyle(0x666666, 1);
    g.fillEllipse(26, 36, 8, 3);
    // Disc fins
    g.fillStyle(0x444444, 1);
    g.fillRect(18, 35, 4, 2);
    g.fillRect(30, 35, 4, 2);

    // === RATE ADJUSTMENT ===
    g.fillStyle(0xEE3333, 1);
    g.fillRect(40, 10, 8, 6);
    g.fillStyle(0xFF4444, 1);
    g.fillRect(41, 11, 6, 4);
    g.fillStyle(0xCC2222, 1);
    g.fillRect(40, 14, 8, 2);
    // Rate scale markings
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(42, 12, 1, 2);
    g.fillRect(44, 12, 1, 2);
    g.fillRect(46, 12, 1, 2);

    // === HANDLE BARS ===
    g.fillStyle(0x444444, 1);
    g.fillRect(2, 0, 5, 28);
    g.fillRect(45, 0, 5, 28);
    g.fillStyle(0x555555, 1);
    g.fillRect(3, 0, 2, 28);
    g.fillRect(46, 0, 2, 28);

    // Cross support
    g.fillStyle(0x444444, 1);
    g.fillRect(7, 14, 38, 3);
    g.fillStyle(0x555555, 1);
    g.fillRect(7, 14, 38, 1);

    // Handle grips
    g.fillStyle(0x1A1A1A, 1);
    g.fillRect(0, -2, 8, 6);
    g.fillRect(44, -2, 8, 6);
    g.fillStyle(0x2A2A2A, 1);
    for (let i = 0; i < 3; i++) {
      g.fillRect(1, -1 + i * 2, 6, 1);
      g.fillRect(45, -1 + i * 2, 6, 1);
    }

    // === WHEELS ===
    // Left wheel
    g.fillStyle(0x1A1A1A, 1);
    g.fillCircle(10, 34, 6);
    g.fillStyle(0x2A2A2A, 1);
    g.fillCircle(10, 34, 5);
    g.fillStyle(0x666666, 1);
    g.fillCircle(10, 34, 2);
    g.fillStyle(0x888888, 1);
    g.fillCircle(9, 33, 1);

    // Right wheel
    g.fillStyle(0x1A1A1A, 1);
    g.fillCircle(42, 34, 6);
    g.fillStyle(0x2A2A2A, 1);
    g.fillCircle(42, 34, 5);
    g.fillStyle(0x666666, 1);
    g.fillCircle(42, 34, 2);
    g.fillStyle(0x888888, 1);
    g.fillCircle(41, 33, 1);

    // === LABEL ===
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(18, 16, 16, 5);
    g.fillStyle(0xDDA000, 1);
    g.fillRect(20, 17, 12, 3);

    g.generateTexture('spreader', w, h);
    g.destroy();
  }

  private generateGrassSprites(): void {
    this.generatePremiumGrass('grass_short', 0x6BBB40, 0x4A9920, 4, 'short');
    this.generatePremiumGrass('grass_medium', 0x4A9920, 0x388010, 8, 'medium');
    this.generatePremiumGrass('grass_tall', 0x387010, 0x286000, 14, 'tall');
    this.generatePremiumDryGrass();
    this.generatePremiumDeadGrass();
  }

  private generatePremiumGrass(key: string, baseColor: number, shadowColor: number, maxHeight: number, type: string): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Rich soil base with gradient
    g.fillStyle(shadowColor, 1);
    g.fillRect(0, 0, size, size);

    // Main grass color
    g.fillStyle(baseColor, 1);
    g.fillRect(0, 0, size, size - 3);

    // Subtle color variation patches
    g.fillStyle(this.lightenColor(baseColor, 8), 0.4);
    g.fillRect(4, 4, 8, 8);
    g.fillRect(18, 12, 10, 10);
    g.fillStyle(this.darkenColor(baseColor, 8), 0.3);
    g.fillRect(12, 0, 8, 8);
    g.fillRect(0, 16, 12, 8);

    // Ground texture
    g.fillStyle(this.darkenColor(shadowColor, 15), 0.4);
    for (let i = 0; i < 10; i++) {
      g.fillRect((i * 7 + 2) % 28, size - 4 + (i % 2), 3, 2);
    }

    // Detailed grass blades
    const bladeConfigs = [
      { x: 1, offset: 0 }, { x: 4, offset: 2 }, { x: 7, offset: -1 },
      { x: 10, offset: 1 }, { x: 13, offset: -2 }, { x: 16, offset: 2 },
      { x: 19, offset: 0 }, { x: 22, offset: 1 }, { x: 25, offset: -1 },
      { x: 28, offset: 2 }
    ];

    bladeConfigs.forEach((config, i) => {
      const h = maxHeight + config.offset + (i % 3);
      const y = size - h - 3;

      // Blade shadow (offset right)
      g.fillStyle(shadowColor, 0.6);
      g.fillRect(config.x + 1, y + 2, 2, h);

      // Main blade body
      const bladeColor = i % 2 === 0 ? baseColor : this.lightenColor(baseColor, 10);
      g.fillStyle(bladeColor, 1);
      g.fillRect(config.x, y, 2, h);

      // Blade left edge highlight
      g.fillStyle(this.lightenColor(baseColor, 25), 1);
      g.fillRect(config.x, y, 1, h - 2);

      // Blade tip (lighter)
      if (type !== 'short') {
        g.fillStyle(this.lightenColor(baseColor, 35), 1);
        g.fillRect(config.x, y, 1, 3);
      }

      // Seed heads for tall grass
      if (type === 'tall' && i % 3 === 0) {
        g.fillStyle(0xCCBB88, 1);
        g.fillRect(config.x, y - 2, 2, 3);
        g.fillStyle(0xDDCC99, 1);
        g.fillRect(config.x, y - 2, 1, 2);
      }
    });

    // Additional small detail blades
    for (let i = 0; i < 6; i++) {
      const x = 3 + i * 5;
      const h = maxHeight - 3 + (i % 2);
      g.fillStyle(this.lightenColor(baseColor, 15), 0.7);
      g.fillRect(x, size - h - 3, 1, h);
    }

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private generatePremiumDryGrass(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Dry yellowish base
    g.fillStyle(0xAA8850, 1);
    g.fillRect(0, 0, size, size);

    // Patchy dry areas
    g.fillStyle(0xBB9960, 1);
    g.fillRect(0, 0, size, size - 4);

    // Brown dying patches
    g.fillStyle(0x8B7340, 0.5);
    g.fillRect(6, 6, 10, 8);
    g.fillRect(18, 14, 12, 10);

    // Yellowed grass blades
    const bladePositions = [2, 6, 10, 14, 18, 22, 26, 29];
    bladePositions.forEach((x, i) => {
      const h = 5 + (i % 4) * 2;
      const y = size - h - 3;

      // Wilted blade (leaning)
      g.fillStyle(0xCCA860, 1);
      g.fillRect(x, y, 2, h);
      g.fillStyle(0xDDB870, 1);
      g.fillRect(x, y, 1, h - 2);

      // Some completely brown
      if (i % 3 === 0) {
        g.fillStyle(0x9B7950, 1);
        g.fillRect(x, y + 2, 2, h - 2);
      }
    });

    // Scattered dead patches
    g.fillStyle(0x7B5930, 0.6);
    for (let i = 0; i < 8; i++) {
      g.fillRect((i * 9 + 4) % 28, (i * 7 + 3) % 24 + 4, 4, 4);
    }

    g.generateTexture('grass_dry', size, size);
    g.destroy();
  }

  private generatePremiumDeadGrass(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Brown dead base
    g.fillStyle(0x6B4920, 1);
    g.fillRect(0, 0, size, size);

    // Varied brown texture
    for (let i = 0; i < 16; i++) {
      const shade = i % 3;
      const color = shade === 0 ? 0x7B5930 : shade === 1 ? 0x5B3910 : 0x8B6940;
      g.fillStyle(color, 1);
      g.fillRect((i * 5 + 2) % 28, (i * 7 + 3) % 28, 5, 5);
    }

    // Bare dirt patches
    g.fillStyle(0x4A2810, 0.7);
    g.fillRect(4, 6, 10, 8);
    g.fillRect(16, 18, 14, 10);
    g.fillRect(2, 20, 8, 8);

    // Few dead brown stalks
    g.fillStyle(0x8B6940, 1);
    g.fillRect(8, 16, 2, 8);
    g.fillRect(22, 10, 2, 10);
    g.fillRect(14, 20, 2, 6);

    // Stalk shadows
    g.fillStyle(0x5B3910, 0.5);
    g.fillRect(9, 18, 2, 6);
    g.fillRect(23, 12, 2, 8);

    g.generateTexture('grass_dead', size, size);
    g.destroy();
  }

  private generateTerrainSprites(): void {
    this.generatePremiumFairway();
    this.generatePremiumRough();
    this.generatePremiumGreen();
    this.generatePremiumBunker();
    this.generatePremiumWater();
  }

  private generatePremiumFairway(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Base fairway color
    g.fillStyle(0x5AAA30, 1);
    g.fillRect(0, 0, size, size);

    // Mowing stripes - professional alternating pattern
    for (let y = 0; y < size; y += 8) {
      // Light stripe
      g.fillStyle(0x6BBB40, 1);
      g.fillRect(0, y, size, 4);
      // Dark stripe
      g.fillStyle(0x4A9920, 1);
      g.fillRect(0, y + 4, size, 4);
    }

    // Subtle grass blade texture in stripes
    for (let y = 0; y < size; y += 8) {
      // Light stripe texture
      g.fillStyle(0x7CCC50, 0.3);
      for (let x = 0; x < size; x += 4) {
        g.fillRect(x, y + 1, 1, 2);
      }
      // Dark stripe texture
      g.fillStyle(0x3A8810, 0.3);
      for (let x = 2; x < size; x += 4) {
        g.fillRect(x, y + 5, 1, 2);
      }
    }

    // Very subtle natural variation
    g.fillStyle(0x5AAA30, 0.2);
    for (let i = 0; i < 5; i++) {
      g.fillRect((i * 11 + 3) % 26, (i * 7 + 2) % 26, 6, 6);
    }

    g.generateTexture('fairway', size, size);
    g.destroy();
  }

  private generatePremiumRough(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Dark rough base
    g.fillStyle(0x2A5A18, 1);
    g.fillRect(0, 0, size, size);

    // Varied texture patches
    g.fillStyle(0x3A6A28, 1);
    for (let i = 0; i < 10; i++) {
      g.fillRect((i * 7 + 1) % 26, (i * 5 + 2) % 26, 6, 6);
    }
    g.fillStyle(0x1A4A08, 1);
    for (let i = 0; i < 8; i++) {
      g.fillRect((i * 9 + 4) % 26, (i * 6 + 1) % 26, 5, 5);
    }

    // Tall grass blades throughout
    const positions = [1, 5, 8, 12, 16, 20, 23, 27];
    positions.forEach((x, i) => {
      const h = 12 + (i % 4) * 3;
      const y = size - h - 2;

      // Shadow
      g.fillStyle(0x1A4A08, 0.5);
      g.fillRect(x + 1, y + 3, 2, h);

      // Blade body
      g.fillStyle(0x4A7A38, 1);
      g.fillRect(x, y, 2, h);

      // Highlight
      g.fillStyle(0x5A8A48, 1);
      g.fillRect(x, y, 1, h - 4);

      // Tip
      g.fillStyle(0x6A9A58, 1);
      g.fillRect(x, y, 1, 3);
    });

    // Additional smaller blades
    for (let i = 0; i < 8; i++) {
      const x = 3 + i * 4;
      const h = 8 + (i % 3) * 2;
      g.fillStyle(0x3A6A28, 0.8);
      g.fillRect(x, size - h - 2, 1, h);
    }

    // Base shadow
    g.fillStyle(0x1A4A08, 0.4);
    g.fillRect(0, size - 4, size, 4);

    g.generateTexture('rough', size, size);
    g.destroy();
  }

  private generatePremiumGreen(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Perfect putting green - smooth bright green
    g.fillStyle(0x40C840, 1);
    g.fillRect(0, 0, size, size);

    // Very subtle mowing lines (barely visible)
    for (let y = 0; y < size; y += 4) {
      g.fillStyle(y % 8 === 0 ? 0x48D048 : 0x38B838, 0.25);
      g.fillRect(0, y, size, 2);
    }

    // Ultra fine texture pattern
    g.fillStyle(0x50D850, 0.15);
    for (let x = 0; x < size; x += 3) {
      for (let y = 0; y < size; y += 3) {
        if ((x + y) % 6 === 0) {
          g.fillRect(x, y, 2, 2);
        }
      }
    }

    // Healthy sheen highlights
    g.fillStyle(0x60E860, 0.12);
    g.fillEllipse(10, 10, 12, 10);
    g.fillEllipse(24, 22, 10, 8);

    // Ball mark hint (very subtle)
    g.fillStyle(0x38B838, 0.1);
    g.fillCircle(20, 14, 3);

    g.generateTexture('green', size, size);
    g.destroy();
  }

  private generatePremiumBunker(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Sand base
    g.fillStyle(0xE8D8B0, 1);
    g.fillRect(0, 0, size, size);

    // Sand grain texture - many small variations
    for (let i = 0; i < 80; i++) {
      const x = (i * 13 + 3) % 30;
      const y = (i * 17 + 5) % 30;
      const shade = i % 4;
      const color = shade === 0 ? 0xD8C8A0 : shade === 1 ? 0xF8E8C0 : shade === 2 ? 0xC8B890 : 0xE0D0A8;
      g.fillStyle(color, 1);
      g.fillRect(x, y, 2, 2);
    }

    // Rake line pattern
    g.fillStyle(0xD0C0A0, 0.4);
    for (let y = 3; y < size - 3; y += 3) {
      g.fillRect(2, y, size - 4, 1);
    }

    // Footprint depression hints
    g.fillStyle(0xC8B890, 0.35);
    g.fillEllipse(10, 12, 8, 4);
    g.fillEllipse(24, 20, 10, 5);

    // Edge shadow (bunker lip)
    g.fillStyle(0xA89870, 0.6);
    g.fillRect(0, 0, size, 4);
    g.fillRect(0, size - 4, size, 4);
    g.fillRect(0, 0, 4, size);
    g.fillRect(size - 4, 0, 4, size);
    // Inner lip shadow
    g.fillStyle(0x988860, 0.3);
    g.fillRect(4, 4, size - 8, 2);
    g.fillRect(4, size - 6, size - 8, 2);

    // Bright sand sparkles
    g.fillStyle(0xFFFAF0, 0.5);
    for (let i = 0; i < 12; i++) {
      g.fillRect((i * 7 + 5) % 26 + 3, (i * 11 + 3) % 22 + 5, 1, 1);
    }

    g.generateTexture('bunker', size, size);
    g.destroy();
  }

  private generatePremiumWater(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Deep water base
    g.fillStyle(0x1060A0, 1);
    g.fillRect(0, 0, size, size);

    // Depth gradient layers
    g.fillStyle(0x1878B8, 1);
    g.fillRect(0, 0, size, size - 10);
    g.fillStyle(0x2090D0, 1);
    g.fillRect(0, 0, size, size - 18);
    g.fillStyle(0x28A0E0, 1);
    g.fillRect(0, 0, size, size - 24);

    // Wave patterns
    for (let y = 2; y < size; y += 5) {
      g.fillStyle(0x38B0F0, 0.35);
      g.fillRect(0, y, size, 2);

      // Wave curves
      g.fillStyle(0x48C0FF, 0.25);
      const offset = (y * 3) % 8;
      g.fillRect(offset, y, 10, 1);
      g.fillRect(offset + 14, y, 8, 1);
    }

    // Surface reflections
    g.fillStyle(0xFFFFFF, 0.3);
    g.fillRect(4, 3, 12, 2);
    g.fillRect(2, 5, 6, 1);

    g.fillStyle(0xFFFFFF, 0.25);
    g.fillRect(18, 10, 10, 2);
    g.fillRect(8, 18, 14, 2);
    g.fillRect(22, 24, 8, 1);

    // Sparkle points
    g.fillStyle(0xFFFFFF, 0.6);
    g.fillRect(6, 4, 2, 1);
    g.fillRect(20, 11, 2, 1);
    g.fillRect(12, 19, 2, 1);
    g.fillRect(26, 6, 1, 1);

    // Deep edge shadow
    g.fillStyle(0x084880, 0.5);
    g.fillRect(0, size - 5, size, 5);

    g.generateTexture('water', size, size);
    g.destroy();
  }

  private generateRefillStation(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 64;

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(32, 62, 56, 8);

    // === CONCRETE PLATFORM ===
    g.fillStyle(0x808080, 1);
    g.fillRect(2, 50, 60, 12);
    g.fillStyle(0x707070, 1);
    g.fillRect(2, 56, 60, 6);
    g.fillStyle(0x909090, 1);
    g.fillRect(4, 50, 56, 2);
    // Platform texture
    g.fillStyle(0x606060, 0.3);
    for (let i = 0; i < 8; i++) {
      g.fillRect(4 + i * 8, 52, 6, 1);
    }

    // Safety stripe
    g.fillStyle(0xFFDD00, 1);
    g.fillRect(2, 50, 60, 3);
    g.fillStyle(0x222222, 1);
    for (let i = 0; i < 10; i++) {
      g.fillRect(4 + i * 6, 50, 3, 3);
    }

    // === MAIN STRUCTURE ===
    g.fillStyle(0x555555, 1);
    g.fillRect(4, 14, 56, 38);
    g.fillStyle(0x4A4A4A, 1);
    g.fillRect(4, 38, 56, 14);
    g.fillStyle(0x606060, 1);
    g.fillRect(6, 16, 52, 4);

    // === ROOF ===
    g.fillStyle(0x3A3A3A, 1);
    g.fillRect(0, 8, 64, 8);
    g.fillStyle(0x4A4A4A, 1);
    g.fillRect(2, 10, 60, 4);
    g.fillStyle(0x2A2A2A, 1);
    g.fillRect(0, 14, 64, 2);

    // === FUEL TANK (RED) ===
    g.fillStyle(0xCC2222, 1);
    g.fillRect(6, 20, 16, 28);
    g.fillStyle(0xDD3333, 1);
    g.fillRect(8, 22, 8, 8);
    g.fillStyle(0xAA1818, 1);
    g.fillRect(6, 38, 16, 10);
    g.fillRect(6, 20, 4, 28);
    // Fuel icon
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(10, 28, 6, 10);
    g.fillStyle(0xCC2222, 1);
    g.fillRect(12, 32, 3, 5);
    g.fillRect(11, 30, 1, 2);
    // Nozzle
    g.fillStyle(0x222222, 1);
    g.fillRect(16, 44, 6, 6);
    g.fillStyle(0x333333, 1);
    g.fillRect(17, 45, 4, 4);

    // === WATER TANK (BLUE) ===
    g.fillStyle(0x2266BB, 1);
    g.fillRect(24, 20, 16, 28);
    g.fillStyle(0x3388DD, 1);
    g.fillRect(26, 22, 8, 8);
    g.fillStyle(0x1144AA, 1);
    g.fillRect(24, 38, 16, 10);
    g.fillRect(24, 20, 4, 28);
    // Water icon
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(32, 32, 5);
    g.fillRect(30, 27, 4, 5);
    g.fillStyle(0x2266BB, 1);
    g.fillCircle(32, 33, 2);
    // Nozzle
    g.fillStyle(0x222222, 1);
    g.fillRect(34, 44, 6, 6);
    g.fillStyle(0x333333, 1);
    g.fillRect(35, 45, 4, 4);

    // === FERTILIZER TANK (YELLOW) ===
    g.fillStyle(0xBB9900, 1);
    g.fillRect(42, 20, 16, 28);
    g.fillStyle(0xDDBB22, 1);
    g.fillRect(44, 22, 8, 8);
    g.fillStyle(0x997700, 1);
    g.fillRect(42, 38, 16, 10);
    g.fillRect(42, 20, 4, 28);
    // Leaf icon
    g.fillStyle(0x228822, 1);
    g.fillCircle(50, 32, 5);
    g.fillStyle(0x44AA44, 1);
    g.fillCircle(49, 31, 3);
    g.fillStyle(0x228822, 1);
    g.fillRect(49, 33, 2, 5);
    // Nozzle
    g.fillStyle(0x222222, 1);
    g.fillRect(52, 44, 6, 6);
    g.fillStyle(0x333333, 1);
    g.fillRect(53, 45, 4, 4);

    // === STATION SIGN ===
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(16, 2, 32, 8);
    g.fillStyle(0x1A6030, 1);
    g.fillRect(17, 3, 30, 6);
    // "REFILL" text hint
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(20, 4, 3, 4);
    g.fillRect(25, 4, 3, 4);
    g.fillRect(30, 4, 3, 4);
    g.fillRect(35, 4, 3, 4);
    g.fillRect(40, 4, 3, 4);

    // === LIGHTS ===
    g.fillStyle(0xFFFF88, 1);
    g.fillRect(8, 10, 4, 4);
    g.fillRect(52, 10, 4, 4);
    g.fillStyle(0xFFFFCC, 1);
    g.fillRect(9, 11, 2, 2);
    g.fillRect(53, 11, 2, 2);

    g.generateTexture('refill_station', size, size);
    g.destroy();
  }

  private generateParticles(): void {
    // Grass clippings - elongated and detailed
    let g = this.scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x5AB830, 1);
    g.fillRect(0, 0, 8, 4);
    g.fillStyle(0x7AD850, 1);
    g.fillRect(1, 0, 6, 2);
    g.fillStyle(0x4AA020, 1);
    g.fillRect(0, 3, 8, 1);
    g.generateTexture('grass_particle', 8, 4);
    g.destroy();

    // Water droplets - shiny with highlight
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

    // Fertilizer granules - brown/tan with shine
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

  private generateProps(): void {
    this.generateFlag();
    this.generateTree();
    this.generateBench();
    this.generateFlowerBed();
  }

  private generateFlag(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(20, 70, 12, 4);

    // Flagpole
    g.fillStyle(0xBBBBBB, 1);
    g.fillRect(18, 8, 4, 64);
    g.fillStyle(0xDDDDDD, 1);
    g.fillRect(19, 8, 1, 64);
    g.fillStyle(0x999999, 1);
    g.fillRect(21, 8, 1, 64);

    // Flag
    g.fillStyle(0xDD0000, 1);
    g.fillRect(22, 10, 24, 18);
    g.fillStyle(0xBB0000, 1);
    g.fillRect(22, 22, 24, 6);
    g.fillStyle(0xEE2222, 1);
    g.fillRect(24, 12, 10, 6);

    // Flag number
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(30, 14, 8, 12);
    g.fillStyle(0xDD0000, 1);
    g.fillRect(32, 18, 4, 6);
    g.fillRect(32, 16, 2, 2);

    // Ball finial
    g.fillStyle(0xFFD700, 1);
    g.fillCircle(20, 6, 5);
    g.fillStyle(0xFFE840, 1);
    g.fillCircle(18, 4, 2);

    g.generateTexture('flag', 48, 72);
    g.destroy();
  }

  private generateTree(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 64, h = 80;

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(32, 78, 48, 8);

    // Trunk
    g.fillStyle(0x5D4037, 1);
    g.fillRect(26, 50, 12, 28);
    g.fillStyle(0x4E342E, 1);
    g.fillRect(26, 50, 4, 28);
    g.fillStyle(0x6D5047, 1);
    g.fillRect(34, 50, 4, 28);
    // Bark texture
    g.fillStyle(0x3E2723, 0.5);
    g.fillRect(28, 54, 6, 3);
    g.fillRect(27, 62, 8, 2);
    g.fillRect(29, 70, 5, 2);

    // Foliage - multiple layered ellipses
    // Bottom layer (largest)
    g.fillStyle(0x1B5E20, 1);
    g.fillEllipse(32, 46, 56, 24);
    g.fillStyle(0x2E7D32, 1);
    g.fillEllipse(32, 44, 50, 20);

    // Middle layer
    g.fillStyle(0x388E3C, 1);
    g.fillEllipse(32, 32, 48, 26);
    g.fillStyle(0x43A047, 1);
    g.fillEllipse(32, 30, 42, 22);

    // Top layer
    g.fillStyle(0x4CAF50, 1);
    g.fillEllipse(32, 18, 36, 22);
    g.fillStyle(0x66BB6A, 1);
    g.fillEllipse(32, 16, 28, 18);

    // Highlights
    g.fillStyle(0x81C784, 0.5);
    g.fillEllipse(24, 14, 14, 10);
    g.fillEllipse(20, 28, 12, 8);
    g.fillEllipse(22, 42, 14, 8);

    // Depth shadows
    g.fillStyle(0x1B5E20, 0.4);
    g.fillEllipse(40, 20, 12, 8);
    g.fillEllipse(42, 34, 10, 6);

    g.generateTexture('tree', w, h);
    g.destroy();
  }

  private generateBench(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(24, 38, 44, 6);

    // Metal legs
    g.fillStyle(0x2A2A2A, 1);
    g.fillRect(4, 22, 5, 16);
    g.fillRect(39, 22, 5, 16);
    g.fillStyle(0x3A3A3A, 1);
    g.fillRect(5, 22, 2, 16);
    g.fillRect(40, 22, 2, 16);

    // Wooden seat planks
    g.fillStyle(0x8B5A2B, 1);
    g.fillRect(2, 18, 44, 6);
    g.fillStyle(0x6B4423, 1);
    g.fillRect(2, 22, 44, 2);
    g.fillStyle(0x9B6A3B, 1);
    g.fillRect(4, 18, 40, 2);
    // Plank lines
    g.fillStyle(0x5B3413, 0.5);
    g.fillRect(2, 20, 44, 1);
    // Wood grain
    g.fillStyle(0x7B4A1B, 0.3);
    g.fillRect(8, 19, 12, 1);
    g.fillRect(28, 19, 10, 1);

    // Backrest planks
    g.fillStyle(0x8B5A2B, 1);
    g.fillRect(2, 6, 44, 5);
    g.fillRect(2, 12, 44, 5);
    g.fillStyle(0x6B4423, 1);
    g.fillRect(2, 9, 44, 2);
    g.fillRect(2, 15, 44, 2);
    g.fillStyle(0x9B6A3B, 1);
    g.fillRect(4, 6, 40, 2);
    g.fillRect(4, 12, 40, 2);

    // Armrests
    g.fillStyle(0x2A2A2A, 1);
    g.fillRect(2, 12, 5, 8);
    g.fillRect(41, 12, 5, 8);
    g.fillStyle(0x3A3A3A, 1);
    g.fillRect(3, 13, 3, 6);
    g.fillRect(42, 13, 3, 6);

    g.generateTexture('bench', 48, 40);
    g.destroy();
  }

  private generateFlowerBed(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const size = 32;

    // Mulch/dirt base
    g.fillStyle(0x4A3020, 1);
    g.fillRect(0, 0, size, size);

    // Mulch texture
    for (let i = 0; i < 20; i++) {
      const shade = i % 3;
      const color = shade === 0 ? 0x5A4030 : shade === 1 ? 0x3A2010 : 0x4A3020;
      g.fillStyle(color, 1);
      g.fillRect((i * 5 + 2) % 28, (i * 7 + 1) % 28, 4, 4);
    }

    // Red flowers
    g.fillStyle(0xEE3333, 1);
    g.fillCircle(8, 10, 5);
    g.fillCircle(26, 8, 6);
    g.fillStyle(0xFFFF44, 1);
    g.fillCircle(8, 10, 2);
    g.fillCircle(26, 8, 2);
    g.fillStyle(0xFF5555, 1);
    g.fillCircle(7, 9, 2);
    g.fillCircle(25, 7, 2);

    // Yellow flowers
    g.fillStyle(0xFFCC00, 1);
    g.fillCircle(16, 14, 5);
    g.fillStyle(0xFF8800, 1);
    g.fillCircle(16, 14, 2);
    g.fillStyle(0xFFDD44, 1);
    g.fillCircle(15, 13, 2);

    // Purple flowers
    g.fillStyle(0x9944FF, 1);
    g.fillCircle(6, 24, 5);
    g.fillCircle(28, 22, 5);
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(6, 24, 2);
    g.fillCircle(28, 22, 2);
    g.fillStyle(0xAA66FF, 1);
    g.fillCircle(5, 23, 2);
    g.fillCircle(27, 21, 2);

    // Green stems/leaves
    g.fillStyle(0x228822, 1);
    g.fillRect(7, 15, 2, 8);
    g.fillRect(15, 19, 2, 8);
    g.fillRect(25, 14, 2, 8);
    g.fillRect(5, 29, 2, 3);
    g.fillRect(27, 27, 2, 5);

    // Small white flowers
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(12, 28, 3);
    g.fillCircle(20, 26, 3);
    g.fillStyle(0xFFFF88, 1);
    g.fillCircle(12, 28, 1);
    g.fillCircle(20, 26, 1);

    g.generateTexture('flowerbed', size, size);
    g.destroy();
  }

  private generateCourseDecorations(): void {
    this.generateTeeMarker();
    this.generateYardageSign();
    this.generateBirdBath();
  }

  private generateTeeMarker(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(8, 14, 12, 4);

    // Tee marker base
    g.fillStyle(0x2266BB, 1);
    g.fillRect(4, 4, 8, 10);
    g.fillStyle(0x3388DD, 1);
    g.fillRect(5, 5, 4, 6);
    g.fillStyle(0x1144AA, 1);
    g.fillRect(4, 10, 8, 4);

    // Top dome
    g.fillStyle(0x2266BB, 1);
    g.fillCircle(8, 4, 4);
    g.fillStyle(0x3388DD, 1);
    g.fillCircle(7, 3, 2);

    g.generateTexture('tee_marker', 16, 16);
    g.destroy();
  }

  private generateYardageSign(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });

    // Post shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(12, 30, 8, 3);

    // Wooden post
    g.fillStyle(0x5D4037, 1);
    g.fillRect(10, 12, 4, 18);
    g.fillStyle(0x6D5047, 1);
    g.fillRect(11, 12, 1, 18);

    // Sign board
    g.fillStyle(0x1A6030, 1);
    g.fillRect(2, 2, 20, 12);
    g.fillStyle(0x2A7040, 1);
    g.fillRect(3, 3, 18, 2);
    // "150" text hint
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(4, 5, 4, 6);
    g.fillRect(10, 5, 4, 6);
    g.fillRect(16, 5, 4, 6);
    g.fillStyle(0x1A6030, 1);
    g.fillRect(5, 7, 2, 2);
    g.fillRect(11, 7, 2, 2);

    g.generateTexture('yardage_sign', 24, 32);
    g.destroy();
  }

  private generateBirdBath(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(16, 30, 20, 5);

    // Pedestal base
    g.fillStyle(0x888888, 1);
    g.fillRect(10, 24, 12, 6);
    g.fillStyle(0x999999, 1);
    g.fillRect(11, 25, 10, 3);

    // Pedestal column
    g.fillStyle(0x777777, 1);
    g.fillRect(12, 12, 8, 13);
    g.fillStyle(0x888888, 1);
    g.fillRect(13, 12, 3, 13);

    // Basin
    g.fillStyle(0x888888, 1);
    g.fillEllipse(16, 10, 24, 10);
    g.fillStyle(0x999999, 1);
    g.fillEllipse(16, 9, 20, 8);
    // Water in basin
    g.fillStyle(0x4488CC, 0.8);
    g.fillEllipse(16, 10, 16, 6);
    g.fillStyle(0x66AAEE, 0.6);
    g.fillEllipse(14, 9, 8, 4);

    // Basin rim
    g.fillStyle(0x666666, 1);
    g.fillEllipse(16, 6, 24, 6);
    g.fillStyle(0x777777, 1);
    g.fillEllipse(16, 6, 22, 4);

    g.generateTexture('birdbath', 32, 32);
    g.destroy();
  }

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xFF) + amount);
    const gr = Math.min(255, ((color >> 8) & 0xFF) + amount);
    const b = Math.min(255, (color & 0xFF) + amount);
    return (r << 16) | (gr << 8) | b;
  }

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, ((color >> 16) & 0xFF) - amount);
    const gr = Math.max(0, ((color >> 8) & 0xFF) - amount);
    const b = Math.max(0, (color & 0xFF) - amount);
    return (r << 16) | (gr << 8) | b;
  }
}
