import { Component, OnDestroy, afterNextRender, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SoundService } from './services/sound.service';

// Scale goes 0.85 → 1.0 (range 0.15).
// linear() value N → actual scale: 0.85 + 0.15 * N
// SPRING_DOWN: original gentle spring, small overshoot (~1.012 peak = scale 1.002)
const SPRING_DOWN = 'scale 250ms linear(0, 0.387 6.5%, 0.68 13.5%, 0.888 21.2%, 0.962 25.4%, 1.017 29.8%, 1.066 37%, 1.08 45.5%, 1.07 53%, 1.011 78.3%, 1)';
// SPRING_UP: one large bounce, no undershoot.
// linear peak 3.7 → scale 0.85 + 0.15*3.7 = 1.405; after peak stays ≥ 1.0
const SPRING_UP   = 'scale 1000ms linear(0, 0.045 0.9%, 0.181 1.9%, 1.165 6.7%, 1.312 8%, 1.354 8.7%, 1.371 9.4%, 1.362 10.3%, 1.31 11.4%, 0.938 16.3%, 0.884 17.6%, 0.862 18.9%, 0.866 19.9%, 0.885 21%, 1.025 26%, 1.043 27.2%, 1.051 28.5%, 1.043 30.6%, 0.991 35.5%, 0.981 38%, 1.007 47.6%, 0.997 57.1%, 1)';

// Clicks on these elements have their own sounds — skip the ambient click.
// app-broken-streak-demo is intentionally NOT listed wholesale: only its
// interactive children are silenced so clicking the background still plays.
const SILENT_SELECTORS = [
  'app-calendar-demo',
  'app-polaroid-card',
  'app-sticky-note',
  'app-mute-button',
  '.back-link',
  '.mood-image-container',  // broken-streak: tap-to-reveal card
  '.mood-switcher',         // broken-streak: mood colour buttons
  '.lets-go-btn',           // broken-streak: reset button
].join(', ');

const CURSORS: Record<string, { src: string; ox: number; oy: number }> = {
  'default':     { src: '/cursors/default.svg',     ox: 5,  oy: 2  },
  'pointer':     { src: '/cursors/pointer.svg',     ox: 11, oy: 2  },
  'grab':        { src: '/cursors/pointer.svg',     ox: 11, oy: 2  },
  'grabbing':    { src: '/cursors/grabbing.svg',    ox: 12, oy: 6  },
  'text':        { src: '/cursors/text.svg',        ox: 12, oy: 12 },
  'not-allowed': { src: '/cursors/not-allowed.svg', ox: 12, oy: 12 },
  'move':        { src: '/cursors/move.svg',        ox: 12, oy: 12 },
  'crosshair':   { src: '/cursors/crosshair.svg',   ox: 12, oy: 12 },
  'ew-resize':   { src: '/cursors/ew-resize.svg',   ox: 12, oy: 12 },
  'ns-resize':   { src: '/cursors/ns-resize.svg',   ox: 12, oy: 12 },
  'nwse-resize': { src: '/cursors/nwse-resize.svg', ox: 12, oy: 12 },
  'nesw-resize': { src: '/cursors/nesw-resize.svg', ox: 12, oy: 12 },
};

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  protected readonly title = signal('MoodTunePortfolio');

  private cleanup?: () => void;

  constructor(private sound: SoundService) {
    afterNextRender(() => {
      const wrap = document.querySelector<HTMLElement>('.cursor-wrap');
      const img  = document.querySelector<HTMLImageElement>('.cursor-img');
      if (!wrap || !img) return;

      let currentType = '';
      let lastX = 0;
      let lastY = 0;

      const apply = (type: string) => {
        if (type === currentType) return;
        currentType = type;
        const def = CURSORS[type] ?? CURSORS['default'];
        img.src = def.src;
        img.style.top  = `${-def.oy}px`;
        img.style.left = `${-def.ox}px`;
      };

      const detectType = (x: number, y: number): string => {
        if (document.body.classList.contains('grabbing')) return 'grabbing';
        const el = document.elementFromPoint(x, y);
        return (el ? getComputedStyle(el).getPropertyValue('--cursor').trim() : '') || 'default';
      };

      // Set initial state so the img is positioned correctly before first move
      apply('default');

      const move = (e: MouseEvent) => {
        lastX = e.clientX;
        lastY = e.clientY;
        wrap.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        wrap.style.opacity   = '1';
        apply(detectType(e.clientX, e.clientY));
      };

      const press = () => {
        img.style.transition = SPRING_DOWN;
        img.style.setProperty('--cursor-s', '0.85');
      };
      const release = () => {
        img.style.transition = SPRING_UP;
        img.style.setProperty('--cursor-s', '1');
        // Defer re-detection by one frame so drag components can remove body.grabbing first
        requestAnimationFrame(() => {
          currentType = '';
          apply(detectType(lastX, lastY));
        });
      };
      const leave = () => { wrap.style.opacity = '0'; };
      const enter = (e: MouseEvent) => {
        wrap.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        wrap.style.opacity   = '1';
        apply(detectType(e.clientX, e.clientY));
      };

      // mouseover fires as elements render under a stationary mouse on page load,
      // unlike mouseenter which doesn't fire if the cursor was already in the viewport.
      // Remove itself after first call — only needed to bootstrap the initial position.
      const revealOnce = (e: MouseEvent) => {
        lastX = e.clientX;
        lastY = e.clientY;
        wrap.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        wrap.style.opacity   = '1';
        apply(detectType(e.clientX, e.clientY));
        document.removeEventListener('mouseover', revealOnce);
      };
      // Prevent native HTML5 drag on links/images — it steals pointer events,
      // hides cursor: none, and freezes our custom cursor at the last position.
      const dragstart = (e: DragEvent) => e.preventDefault();


      const click = (e: MouseEvent) => {
        if (!(e.target as Element).closest(SILENT_SELECTORS)) {
          this.sound.playMoodSelect();
        }

        const dust: HTMLElement[] = [];

        for (let i = 0; i < 8; i++) {
          const p = document.createElement('div');
          p.className = 'cursor-dust';
          p.style.left = `${e.clientX}px`;
          p.style.top  = `${e.clientY}px`;

          const angle    = Math.random() * Math.PI * 2;
          const distance = 12 + Math.random() * 22;
          p.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
          p.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
          p.style.setProperty('--dd', `${3 + Math.random() * 4}px`);

          document.body.appendChild(p);
          dust.push(p);
        }

        setTimeout(() => dust.forEach(p => p.remove()), 700);
      };

      document.addEventListener('mousemove',  move);
      document.addEventListener('mousedown',  press);
      document.addEventListener('mouseup',    release);
      document.addEventListener('click',      click);
      document.addEventListener('mouseleave', leave);
      document.addEventListener('mouseenter', enter);
      document.addEventListener('mouseover',  revealOnce);
      document.addEventListener('dragstart',  dragstart);

      this.cleanup = () => {
        document.removeEventListener('mousemove',  move);
        document.removeEventListener('mousedown',  press);
        document.removeEventListener('mouseup',    release);
        document.removeEventListener('click',      click);
        document.removeEventListener('mouseleave', leave);
        document.removeEventListener('mouseenter', enter);
        document.removeEventListener('mouseover',  revealOnce);
        document.removeEventListener('dragstart',  dragstart);
      };
    });
  }

  ngOnDestroy(): void {
    this.cleanup?.();
  }
}
