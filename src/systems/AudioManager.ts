import Phaser from 'phaser';

export class AudioManager {
  private scene: Phaser.Scene;
  private isMuted = false;
  private musicVolume: number;
  private sfxVolume: number;
  private audioContext: AudioContext | null = null;
  private activeOscillators: Map<string, OscillatorNode> = new Map();
  private activeGains: Map<string, GainNode> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.5');
    this.sfxVolume = parseFloat(localStorage.getItem('sfxVolume') || '0.5');
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        console.warn('Web Audio API not supported');
        return null;
      }
    }
    return this.audioContext;
  }

  playMowerLoop(): void {
    if (this.isMuted || this.activeOscillators.has('mower')) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 100;
    gain.gain.value = this.sfxVolume * 0.1;

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();

    this.activeOscillators.set('mower', oscillator);
    this.activeGains.set('mower', gain);
  }

  stopMowerLoop(): void {
    const oscillator = this.activeOscillators.get('mower');
    const gain = this.activeGains.get('mower');

    if (oscillator && gain) {
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 0.1);
      setTimeout(() => {
        oscillator.stop();
        this.activeOscillators.delete('mower');
        this.activeGains.delete('mower');
      }, 100);
    }
  }

  playSprayLoop(): void {
    if (this.isMuted || this.activeOscillators.has('spray')) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1000;

    const gain = ctx.createGain();
    gain.gain.value = this.sfxVolume * 0.05;

    whiteNoise.connect(highpass);
    highpass.connect(gain);
    gain.connect(ctx.destination);
    whiteNoise.start();

    this.activeOscillators.set('spray', whiteNoise as unknown as OscillatorNode);
    this.activeGains.set('spray', gain);
  }

  stopSprayLoop(): void {
    const source = this.activeOscillators.get('spray');
    const gain = this.activeGains.get('spray');

    if (source && gain) {
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 0.1);
      setTimeout(() => {
        (source as unknown as AudioBufferSourceNode).stop();
        this.activeOscillators.delete('spray');
        this.activeGains.delete('spray');
      }, 100);
    }
  }

  playSpreaderLoop(): void {
    if (this.isMuted || this.activeOscillators.has('spreader')) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = 80;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 10;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    gain.gain.value = this.sfxVolume * 0.08;

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();

    this.activeOscillators.set('spreader', oscillator);
    this.activeGains.set('spreader', gain);
    this.activeOscillators.set('spreader_lfo', lfo);
  }

  stopSpreaderLoop(): void {
    const oscillator = this.activeOscillators.get('spreader');
    const gain = this.activeGains.get('spreader');
    const lfo = this.activeOscillators.get('spreader_lfo');

    if (oscillator && gain) {
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 0.1);
      setTimeout(() => {
        oscillator.stop();
        lfo?.stop();
        this.activeOscillators.delete('spreader');
        this.activeOscillators.delete('spreader_lfo');
        this.activeGains.delete('spreader');
      }, 100);
    }
  }

  playNotification(): void {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 440;
    gain.gain.value = this.sfxVolume * 0.2;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    oscillator.stop(ctx.currentTime + 0.2);
  }

  playRefill(): void {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);

    gain.gain.value = this.sfxVolume * 0.15;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.stop(ctx.currentTime + 0.3);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
    localStorage.setItem('musicVolume', this.musicVolume.toString());
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
    localStorage.setItem('sfxVolume', this.sfxVolume.toString());
  }

  mute(): void {
    this.isMuted = true;
    this.stopAllLoops();
  }

  unmute(): void {
    this.isMuted = false;
  }

  toggleMute(): boolean {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  private stopAllLoops(): void {
    this.stopMowerLoop();
    this.stopSprayLoop();
    this.stopSpreaderLoop();
  }

  destroy(): void {
    this.stopAllLoops();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
