import { Component, inject } from '@angular/core';
import { SoundService } from '../../services/sound.service';

@Component({
  selector: 'app-mute-button',
  standalone: true,
  template: `
    <button
      class="mute-btn"
      [attr.aria-label]="sound.muted() ? 'Unmute sound effects' : 'Mute sound effects'"
      (mouseenter)="sound.playHoverOpen()"
      (mousedown)="sound.playPopPress()"
      (click)="sound.toggleMute()"
    >
      @if (sound.muted()) {
        <!-- VolumeX -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="22" y1="9" x2="16" y2="15"/>
          <line x1="16" y1="9" x2="22" y2="15"/>
        </svg>
      } @else {
        <!-- Volume2 -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      }
    </button>
  `,
  styles: `
    :host {
      --cursor: pointer;
      display: inline-flex;
    }

    .mute-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: none;
      border: none;
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.6);
      cursor: none;
      transition:
        color     150ms ease,
        transform 150ms ease;
    }

    @media (hover: hover) and (pointer: fine) {
      .mute-btn:hover {
        color: rgba(255, 255, 255, 0.95);
      }
    }

    .mute-btn:active {
      transform: scale(0.85);
      transition-duration: 80ms;
    }

    svg {
      width: 18px;
      height: 18px;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .mute-btn { transition: none; }
    }
  `,
})
export class MuteButtonComponent {
  readonly sound = inject(SoundService);
}
