import {
  Component,
  Input,
  OnInit,
  HostListener,
  output,
  signal,
} from '@angular/core';
import { NgIf } from '@angular/common';

/* ─────────────────────────────────────────────────────────
 * Mounts at 180*1.8 = 324px wide, 246*1.8 = 443px tall
 * (the card's visual footprint at scale(1.8))
 * Then immediately transitions to the final dialog size.
 * ───────────────────────────────────────────────────────── */

const TIMING = { collapse: 750 };

@Component({
  selector: 'app-polaroid-expanded',
  standalone: true,
  imports: [NgIf],
  template: `
    <div
      class="backdrop"
      [class.visible]="ready()"
      [class.closing]="closing()"
      (click)="close()"
    ></div>

    <div
      class="dialog"
      [class.ready]="ready()"
      [class.closing]="closing()"
    >
      <button class="close-btn" (click)="close()">✕</button>

      <div class="dialog-image">
        <div *ngIf="!imageSrc" class="image-placeholder">
          <span>{{ caption }}</span>
        </div>
        <img *ngIf="imageSrc" [src]="imageSrc" [alt]="dialogTitle" draggable="false" />
      </div>

      <div class="dialog-text" *ngIf="ready() && !closing()">
        <h2 class="dialog-title">{{ dialogTitle }}</h2>
        <p class="dialog-desc">{{ dialogDesc }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    $spring-soft: linear(0, 0.218 4.3%, 0.453 9%, 0.671 14.3%, 0.846 20.5%, 0.961 28%, 1.025 37%, 1.036 48%, 1.016 62%, 1.004 78%, 1);

    /* ─── Backdrop ─── */
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0);
      backdrop-filter: blur(0px);
      pointer-events: auto;
      transition:
        background 300ms ease,
        backdrop-filter 300ms ease;

      &.visible {
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      &.closing {
        background: rgba(0,0,0,0) !important;
        backdrop-filter: blur(0px) !important;
        -webkit-backdrop-filter: blur(0px) !important;
        transition:
          background 200ms ease,
          backdrop-filter 200ms ease;
      }
    }

    /* ─── Dialog — starts at card's scaled footprint ─── */
    .dialog {
      position: relative;
      display: flex;
      gap: 0;
      background: #fff;
      border-radius: 7px; /* 4px * 1.8 */
      overflow: hidden;
      pointer-events: auto;
      box-shadow: none;

      /* Initial: card's visual size at scale(1.8) */
      width:  324px;  /* 180 * 1.8 */
      height: 443px;  /* 246 * 1.8 */

      transition:
        width          750ms $spring-soft,
        height         750ms $spring-soft,
        border-radius  750ms $spring-soft,
        gap            750ms $spring-soft,
        box-shadow     300ms ease;

      /* Final dialog size */
      &.ready {
        width:  600px;
        height: 420px;
        border-radius: 20px;
        gap: 24px;
        box-shadow: 0 32px 80px rgba(0,0,0,0.25);
      }

      &.closing {
        pointer-events: none;
        opacity: 0;
        transition: opacity 220ms ease;
      }
    }

    /* ─── Image — starts filling full dialog, shrinks to column ─── */
    .dialog-image {
      flex-shrink: 0;
      border-radius: 0;
      overflow: hidden;
      background: #f0f0f0;

      /* Initial: fills the whole card width */
      width:  324px;
      height: 100%;

      transition:
        width         750ms $spring-soft,
        border-radius 750ms $spring-soft;

      .dialog.ready & {
        width: 190px;
        border-radius: 12px;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    }

    .image-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;

      span {
        font-style: italic;
        font-size: 0.75rem;
        color: #bbb;
        text-align: center;
        padding: 16px;
      }
    }

    /* ─── Text ─── */
    .dialog-text {
      flex: 1;
      padding: 24px 24px 24px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: textFadeIn 200ms ease 300ms both;
    }

    @keyframes textFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(0,0,0,0.08);
      color: #555;
      font-size: 0.7rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 150ms ease;
      z-index: 1;
      line-height: 1;

      &:hover { background: rgba(0,0,0,0.14); }
    }

    .dialog-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--color-text);
      line-height: 1.3;
    }

    .dialog-desc {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      line-height: 1.7;
    }
  `]
})
export class PolaroidExpandedComponent implements OnInit {
  @Input() caption = '';
  @Input() imageSrc = '';
  @Input() dialogTitle = '';
  @Input() dialogDesc = '';

  readonly closed       = output<void>();
  readonly closingStart = output<void>();
  readonly ready   = signal(false);
  readonly closing = signal(false);

  ngOnInit() {
    // single RAF so the browser paints the initial (small) state first
    requestAnimationFrame(() => {
      this.ready.set(true);
    });
  }

  close() {
    if (this.closing()) return;
    this.ready.set(false);   // triggers width/height/border-radius back to initial values
    this.closing.set(true);
    this.closingStart.emit(); // parent starts card fly-back immediately
    setTimeout(() => this.closed.emit(), TIMING.collapse);
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.close(); }
}
