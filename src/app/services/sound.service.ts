import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly muted = signal(false);

  private ctx: AudioContext | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private raw: Record<string, ArrayBuffer> = {};
  private decoding = new Set<string>();

  constructor() {
    fetch('sounds/pop.mp3')
      .then((r) => r.arrayBuffer())
      .then((b) => (this.raw['pop'] = b));
    fetch('sounds/click.ogg')
      .then((r) => r.arrayBuffer())
      .then((b) => (this.raw['click'] = b));
    fetch('sounds/open.mp3')
      .then((r) => r.arrayBuffer())
      .then((b) => (this.raw['open'] = b));
    fetch('sounds/close.mp3')
      .then((r) => r.arrayBuffer())
      .then((b) => (this.raw['close'] = b));
    fetch('sounds/button-press.mp3')
      .then((r) => r.arrayBuffer())
      .then((b) => (this.raw['press'] = b));
    fetch('sounds/button-release.mp3')
      .then((r) => r.arrayBuffer())
      .then((b) => (this.raw['release'] = b));

    // pointermove fires as the user moves their mouse toward any button,
    // before mouseenter — giving us a chance to warm up the context so
    // sounds play on first interaction without needing a click first.
    // pointerdown/keydown are kept as fallback for keyboard users.
    const cleanup = () => {
      document.removeEventListener('pointermove', unlock);
      document.removeEventListener('pointerdown', unlock, { capture: true });
      document.removeEventListener('keydown', unlock, { capture: true });
    };
    const unlock = () => {
      if (!this.ctx) this.ctx = new AudioContext();
      this.ctx.resume().then(() => {
        if (this.ctx?.state === 'running') cleanup();
      });
    };
    document.addEventListener('pointermove', unlock, { passive: true });
    document.addEventListener('pointerdown', unlock, { passive: true, capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
  }

  toggleMute(): void {
    const wasMuted = this.muted();
    this.muted.set(!wasMuted);
    if (wasMuted) this.playPopRelease();
  }

  play(id: string, semitones = 0, volume = 1): void {
    if (this.muted()) return;
    // Skip silently if the context hasn't been unlocked by a trusted gesture
    // yet — avoids the autoplay-policy warning on mouseenter events.
    if (!this.ctx || this.ctx.state !== 'running') return;

    const ctx = this.ctx;
    const buffer = this.buffers[id];
    if (buffer) {
      this.trigger(ctx, buffer, semitones, volume);
      return;
    }

    if (this.decoding.has(id)) return;
    const raw = this.raw[id];
    if (!raw) return;

    this.decoding.add(id);
    ctx.decodeAudioData(raw).then((decoded) => {
      this.buffers[id] = decoded;
      this.decoding.delete(id);
      if (this.ctx?.state === 'running') this.trigger(this.ctx, decoded, semitones, volume);
    });
  }

  playPress(volume = 1): void {
    this.play('press', (Math.random() * 2 - 1) * 2, volume);
  }

  playRelease(volume = 1): void {
    this.play('release', (Math.random() * 2 - 1) * 2, volume);
  }

  playOpen(): void {
    this.play('open', (Math.random() * 2 - 1) * 2);
  }

  playClose(): void {
    this.play('close', (Math.random() * 2 - 1) * 2);
  }

  /**
   * Hover preview — same sample as open but +5 st higher so it reads as
   * "this is interactive" without committing to a full expand. ±2 st scatter.
   * Range: +3 to +7 st.
   */
  playHoverOpen(): void {
    this.play('open', (Math.random() * 2 - 1) * 2 + 5);
  }

  /**
   * Mood selection — open sample pitched way up for a bright airy whoosh.
   * +9 st centre ±2 scatter (range +7 to +11 st).
   */
  playMoodSelect(): void {
    this.play('open', (Math.random() * 2 - 1) * 2 + 9);
  }

  /**
   * Ambient background click — high pitch so it feels fun and cute.
   * ±2 semitones scatter around +7 st (a shimmery, light register).
   */
  playClickAmbient(): void {
    this.play('click', (Math.random() * 2 - 1) * 2 + 7);
  }

  /**
   * Resize rattle tick — bright, percussive.
   * Centered at +5 st so it sits in a crisp register; ±1.5 st scatter
   * gives a natural "ratchet" quality without drifting too far.
   * Throttle + delta-threshold logic lives in the caller.
   */
  playResizeTick(): void {
    this.play('click', (Math.random() * 2 - 1) * 1.5 + 5);
  }

  /**
   * Card/note bounces off a viewport wall — lighter than the press thud,
   * centre −1 st ±1 scatter (range −2 to 0 st) so it reads as a rebound
   * with less energy than the original throw.
   */
  playWallBounce(): void {
    this.play('pop', (Math.random() * 2 - 1) * 1 - 1);
  }

  /** Polaroid card mousedown — lower pitch, weighted press feel. */
  playPopPress(): void {
    this.play('pop', (Math.random() * 2 - 1) * 1 - 3);
  }

  /** Polaroid card click (mouseup completion) — higher pitch, springy release. */
  playPopRelease(): void {
    this.play('pop', (Math.random() * 2 - 1) * 1 + 3);
  }

  /**
   * Playground entrance pop — gentle upward pitch walk per item so each one
   * sounds distinct. index 0 lands near 0 semitones; each step rises ~1 st
   * with ±1 st random scatter.
   */
  playPop(index = 0): void {
    this.play('pop', (Math.random() * 2 - 1) * 1 + index * 1);
  }

  /**
   * Broken-streak save tap — pitch climbs as the overlay shrinks.
   * clickIndex is 0-based (0 = first tap, 6 = final reveal tap).
   * Capped at 6 so post-reveal taps stay at max pitch.
   */
  playStreakTap(clickIndex: number): void {
    const capped = Math.min(clickIndex, 6);
    // Walks from 0 st (first tap) to 10 st (reveal tap), ±1 st scatter
    this.play('pop', (Math.random() * 2 - 1) * 1 + capped * (10 / 6));
  }

  private trigger(
    ctx: AudioContext,
    buffer: AudioBuffer,
    semitones: number,
    volume: number,
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, semitones / 12);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }
}
