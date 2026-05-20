import {
  Component,
  Input,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';

const MOOD_COLORS: Record<string, string[]> = {
  happy: ['#78b853', '#5a9438'],
  sad:   ['#a18fff', '#7d6be0'],
  calm:  ['#5c9ead', '#3d7d8e'],
  angry: ['#ff3f52', '#d42840'],
};

const MOOD_BG: Record<string, string> = {
  happy: '#78b853',
  sad:   '#a18fff',
  calm:  '#5c9ead',
  angry: '#ff3f52',
};

@Component({
  selector: 'app-broken-streak-demo',
  standalone: true,
  imports: [],
  template: `
    <div class="wrapper">
      <div class="mood-switcher">
        @for (m of moods; track m) {
          <button
            [class.active]="m === currentMood"
            [style.background]="moodBg[m]"
            (click)="setMood(m)"
            [title]="m"
          ></button>
        }
      </div>

      <div class="container" #container>
        <div class="title" [innerHTML]="title"></div>

        <div
          class="mood-image-container"
          #moodImageContainer
          [class.small]="bounceScale"
          [class.saved-streak]="savedStreak"
          [class.idle]="overlayClicks === 0"
          [style.--border-opacity]="borderOpacity"
          (click)="shrinkOverlay()"
        >
          <div
            class="mood-image"
            [class.idle]="overlayClicks === 0"
            [style.background-image]="'url(images/main-moods/' + currentMood + '.png)'"
          ></div>
          <div
            class="overlay"
            #moodOverlay
            [class.idle]="overlayClicks === 0"
            [style.background-image]="'url(images/main-moods/' + currentMood + '.png)'"
          ></div>
        </div>

        <div class="subtitle" [innerHTML]="subtitle"></div>

        <!-- Fixed-height bottom slot so layout never shifts -->
        <div class="bottom-slot">
          <button
            class="lets-go-btn"
            [style.visibility]="savedStreak ? 'visible' : 'hidden'"
            (click)="reset()"
          >Let's go!</button>
          <div class="hint" [class.visible]="overlayClicks === 0 && !savedStreak">Tap to save your streak</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .mood-switcher {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;

      button {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: transform 0.2s ease, border-color 0.2s ease;
        padding: 0;

        &.active {
          border-color: var(--color-text);
          transform: scale(1.2);
        }

        &:active { transform: scale(0.9); }
      }
    }

    .container {
      width: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      position: relative;
      overflow: visible;
      isolation: isolate; /* particles at z-index:-1 stay behind siblings, not the page */
    }

    $bounceEasing: linear(0, 0.544 5.5%, 0.947 11.5%, 1.213 18.1%, 1.298 21.7%, 1.352 25.5%, 1.372 28.2%, 1.379 31.1%, 1.374 34.2%, 1.357 37.6%, 1.307 43.7%, 1.121 61.8%, 1.074 67.8%, 1.04 73.7%, 1.007 84.7%, 1);

    .mood-image-container {
      position: relative;
      width: 180px;
      height: 180px;
      overflow: hidden;
      border-radius: 22px;
      border: 2px dashed rgba(0, 0, 0, calc(var(--border-opacity, 1) * 0.35));
      cursor: pointer;
      transform: scale(1);
      transition:
        border-color 0.2s ease,
        transform 1000ms $bounceEasing;

      &.small { transform: scale(0.9); }
      &.saved-streak { border-color: transparent; }

      @keyframes squashIdle {
        from { transform: scale(1.0); }
        to   { transform: scale(0.96); }
      }

      &.idle { animation: squashIdle 600ms ease-in-out infinite alternate; }
    }

    .mood-image, .overlay {
      position: absolute;
      width: 160px;
      height: 160px;
      background-size: 100%;
      background-repeat: no-repeat;
      // left: 8px centers within the 176px content area (180px border-box - 2px border × 2)
      // giving 10px visual margin on both sides from the outer border edge
      left: 8px;
    }

    .mood-image {
      top: 8px;
      &.idle { opacity: 0; }
    }

    .overlay {
      filter: grayscale(1);
      top: 8px;
      transition: height 0.1s ease;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 600;
      text-align: center;
      line-height: 1.4;
      color: var(--color-text);
      /* reserve 2 lines so single-line titles don't collapse the layout */
      min-height: calc(1.25rem * 1.4 * 2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .subtitle {
      font-size: 0.875rem;
      text-align: center;
      color: var(--color-text-secondary);
      line-height: 1.5;
      /* reserve 2 lines */
      min-height: calc(0.875rem * 1.5 * 2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bottom-slot {
      height: 48px; /* fixed — button and hint share this slot */
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .hint {
      position: absolute;
      font-size: 0.75rem;
      color: var(--color-text-secondary);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;

      &.visible { opacity: 1; }
    }

    .lets-go-btn {
      padding: 12px 32px;
      border-radius: 8px;
      border: none;
      background: var(--color-mood-happy);
      color: white;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;

      @keyframes squashBtn {
        from { transform: scale(1.02); }
        to   { transform: scale(0.98); }
      }
      animation: squashBtn 600ms ease-in-out infinite alternate;
    }
  `]
})
export class BrokenStreakDemoComponent implements OnInit, OnDestroy {
  @Input() initialMood: 'happy' | 'sad' | 'angry' | 'calm' = 'happy';

  @ViewChild('moodOverlay') moodOverlay!: ElementRef<HTMLElement>;
  @ViewChild('container') containerRef!: ElementRef<HTMLElement>;
  @ViewChild('moodImageContainer') moodImageContainer!: ElementRef<HTMLElement>;

  overlayClicks = 0;
  savedStreak = false;
  bounceScale = false;
  borderOpacity = 1;
  currentMood: 'happy' | 'sad' | 'angry' | 'calm' = 'happy';

  moods: Array<'happy' | 'sad' | 'angry' | 'calm'> = ['happy', 'sad', 'angry', 'calm'];
  moodBg = MOOD_BG;

  private bounceTimeout?: ReturnType<typeof setTimeout>;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.currentMood = this.initialMood;
  }

  get title(): string {
    if (this.savedStreak) return 'We caught it just&nbsp;in&nbsp;time!';
    if (this.overlayClicks === 0) return 'Your MoodWeek<br>slipped away!';
    const remaining = 7 - this.overlayClicks;
    return `${remaining} tap${remaining !== 1 ? 's' : ''} to save it!`;
  }

  get subtitle(): string {
    if (this.savedStreak) return 'Your streak is safe. Keep the mood going!';
    return 'Tap the card to reveal your mood and save your MoodWeek streak.';
  }

  shrinkOverlay(): void {
    this.overlayClicks++;

    this.bounceScale = true;
    if (this.bounceTimeout) clearTimeout(this.bounceTimeout);
    this.bounceTimeout = setTimeout(() => {
      this.bounceScale = false;
      this.cdr.markForCheck();
    }, 150);

    this.createParticles();

    const step = 160 / 7;
    const remaining = Math.max(0, 160 - step * this.overlayClicks);
    this.borderOpacity = this.lerp(remaining, 160, 0, 1, 0);

    if (remaining <= 0) {
      this.savedStreak = true;
      this.borderOpacity = 0;
      if (this.moodOverlay?.nativeElement) {
        this.moodOverlay.nativeElement.style.height = '0px';
      }
      return;
    }

    if (this.moodOverlay?.nativeElement) {
      this.moodOverlay.nativeElement.style.height = remaining + 'px';
    }
  }

  private lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private createParticles(): void {
    const minDuration = 750;
    const maxDuration = 1250;
    const numOfParticles = 30;
    const jitter = 40;
    const colors = MOOD_COLORS[this.currentMood] ?? ['#78b853', '#5a9438'];
    const particleEls: HTMLElement[] = [];

    // Compute image card center relative to the container
    const containerEl = this.containerRef.nativeElement;
    const imageEl = this.moodImageContainer.nativeElement;
    const containerRect = containerEl.getBoundingClientRect();
    const imageRect = imageEl.getBoundingClientRect();
    const cx = imageRect.left + imageRect.width / 2 - containerRect.left;
    const cy = imageRect.top + imageRect.height / 2 - containerRect.top;

    for (let i = 0; i < numOfParticles; i++) {
      const el = document.createElement('div');
      el.classList.add('particle');

      let angle = this.lerp(i, 0, numOfParticles, 0, 360);
      angle += this.randomInt(-jitter, jitter);

      const distance = this.randomInt(100, 160);
      const fadeDuration = this.randomInt(minDuration, maxDuration);

      // Override the global inset/margin centering with exact coords
      el.style.inset = 'unset';
      el.style.margin = '0';
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.transform = 'translate(-50%, -50%) scale(3)';

      el.style.setProperty('--angle', angle + 'deg');
      el.style.setProperty('--distance', distance + 'px');
      el.style.setProperty('--fade-duration', fadeDuration + 'ms');
      el.style.setProperty('--fromColor', i % 2 === 0 ? colors[0] : colors[1]);
      el.style.background = i % 2 === 0 ? colors[0] : colors[1];

      containerEl.appendChild(el);
      particleEls.push(el);
    }

    setTimeout(() => {
      particleEls.forEach(p => p.remove());
    }, maxDuration + 200);
  }

  setMood(mood: 'happy' | 'sad' | 'angry' | 'calm'): void {
    this.currentMood = mood;
    this.reset();
  }

  reset(): void {
    this.overlayClicks = 0;
    this.savedStreak = false;
    this.borderOpacity = 1;
    this.bounceScale = false;
    setTimeout(() => {
      if (this.moodOverlay?.nativeElement) {
        this.moodOverlay.nativeElement.style.height = '';
      }
    });
  }

  ngOnDestroy(): void {
    if (this.bounceTimeout) clearTimeout(this.bounceTimeout);
  }
}
