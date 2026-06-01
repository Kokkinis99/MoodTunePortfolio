import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { SoundService } from '../../../services/sound.service';

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
          @if (savedStreak) {
            <button
              class="lets-go-btn"
              [style.background]="moodBg[currentMood]"
              (click)="reset()"
            >Let's go!</button>
          }
          <div class="hint" [class.visible]="overlayClicks === 0 && !savedStreak">Tap to save your streak</div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './broken-streak-demo.component.scss'
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

  constructor(
    private cdr: ChangeDetectorRef,
    private sound: SoundService,
  ) {}

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
    // 0-based click index, capped at 6 so pitch maxes out at the reveal tap
    this.sound.playStreakTap(this.overlayClicks - 1);

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
    this.sound.playMoodSelect();
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
