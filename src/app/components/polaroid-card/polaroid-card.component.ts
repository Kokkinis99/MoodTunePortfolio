import {
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { CdkDrag, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
import { NgIf } from '@angular/common';
import { PolaroidExpandedComponent } from './polaroid-expanded.component';
import { nextZ } from '../z-order';

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 *    0ms   click → set transform directly on DOM element
 *          card translates + scales to viewport center (750ms soft spring)
 *  600ms   handoff: expanded component mounts at card's visual size
 *  600ms   card opacity:0 (no transition — instant hide)
 *  600ms→  expanded transitions to full dialog size
 * ───────────────────────────────────────────────────────── */

const HANDOFF_MS  = 600;
const SCALE       = 1.8;
const MAX_TILT    = 12;
const TILT_FACTOR = 20;
const SPRING_SOFT = 'linear(0, 0.218 4.3%, 0.453 9%, 0.671 14.3%, 0.846 20.5%, 0.961 28%, 1.025 37%, 1.036 48%, 1.016 62%, 1.004 78%, 1)';

@Component({
  selector: 'app-polaroid-card',
  standalone: true,
  imports: [CdkDrag, NgIf, PolaroidExpandedComponent],
  template: `
    <div class="drag-wrapper"
      cdkDrag
      [cdkDragFreeDragPosition]="dragPos"
      (cdkDragStarted)="onDragStarted()"
      (cdkDragMoved)="onDragMoved($event)"
      (cdkDragEnded)="onDragEnded($event)">

      <div #cardEl
        class="card"
        [class.grabbed]="isDragging"
        [style.--rotation]="rotation + 'deg'"
        (click)="onCardClick()">

        <div class="image-area">
          <div *ngIf="!thumbnailSrc" class="placeholder">
            <span>{{ caption }}</span>
          </div>
          <img *ngIf="thumbnailSrc" [src]="thumbnailSrc" [alt]="caption" draggable="false" />
        </div>

        <div class="caption-area">
          <span class="caption-text">{{ caption }}</span>
        </div>
      </div>
    </div>

    <app-polaroid-expanded
      *ngIf="isExpanded"
      [imageSrc]="imageSrc"
      [imageSrcs]="imageSrcs"
      [videoSrc]="videoSrc"
      [videoObjectPosition]="videoObjectPosition"
      [landscapeVideo]="landscapeVideo"
      [dialogTitle]="dialogTitle"
      [dialogDesc]="dialogDesc"
      [caption]="caption"
      (closingStart)="onExpandedClosing()"
      (closed)="onClosed()"
    ></app-polaroid-expanded>
  `,
  styles: [`
    :host {
      display: block;
      width: 0;
      height: 0;
    }

    .drag-wrapper {
      display: inline-block;
      cursor: grab;
      position: absolute;
      &:active { cursor: grabbing; }
    }

    $spring: linear(0, 0.387 6.5%, 0.68 13.5%, 0.888 21.2%, 0.962 25.4%, 1.017 29.8%, 1.066 37%, 1.08 45.5%, 1.07 53%, 1.011 78.3%, 1);

    .card {
      background: #fff;
      border-radius: 4px;
      padding: 10px 10px 0 10px;
      width: 180px;
      box-shadow: 0 2px 0 #d8d8d8, 0 6px 24px rgba(0,0,0,0.13);
      transform: rotate(var(--rotation, 0deg)) scale(1);
      transition: box-shadow 200ms ease, transform 500ms $spring;
      user-select: none;
      will-change: transform;

      &.grabbed {
        cursor: grabbing;
        box-shadow: 0 2px 0 #d8d8d8, 0 20px 56px rgba(0,0,0,0.26);
        transform: rotate(calc(var(--rotation, 0deg) + var(--tilt, 0deg))) scale(1.12);
        transition: box-shadow 120ms ease, transform 120ms ease;
      }

      &:not(.grabbed) {
        cursor: pointer;
        transform: rotate(calc(var(--rotation, 0deg) + var(--tilt, 0deg))) scale(1);
        &:hover {
          transform: rotate(calc(var(--rotation, 0deg) + var(--tilt, 0deg))) scale(1.04);
          box-shadow: 0 2px 0 #d8d8d8, 0 12px 32px rgba(0,0,0,0.18);
        }
      }
    }

    .image-area {
      width: 160px;
      height: 160px;
      border-radius: 2px;
      overflow: hidden;
      background: #f0f0f0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    }

    .placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;

      span {
        font-style: italic;
        font-size: 0.7rem;
        color: #bbb;
        text-align: center;
        padding: 12px;
        line-height: 1.4;
      }
    }

    .caption-area {
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .caption-text {
      text-align: center;
      font-style: italic;
      font-size: 0.68rem;
      color: #999;
    }
  `]
})
export class PolaroidCardComponent implements OnInit, OnDestroy {
  @Input() caption = '';
  @Input() thumbnailSrc = '';
  @Input() imageSrc = '';
  @Input() videoSrc = '';
  @Input() videoObjectPosition = 'center';
  @Input() landscapeVideo = false;
  @Input() dialogTitle = '';
  @Input() dialogDesc = '';
  @Input() rotation = 0;
  @Input() initialX = 0;  // fallback px value
  @Input() initialY = 0;
  @Input() xPct = -1;        // percentage of viewport width (0–100); overrides initialX when set
  @Input() xPctNarrow = -1;  // xPct override for viewports < 1650px
  @Input() imageSrcs: string[] = [];

  dragPos = { x: 0, y: 0 };

  @ViewChild('cardEl') private cardEl!: ElementRef<HTMLDivElement>;
  @ViewChild(CdkDrag)  private cdkDrag!: CdkDrag;

  isDragging  = false;
  isExpanding = false;
  isExpanded  = false;

  private vx = 0;
  private vy = 0;
  private lastX = 0;
  private lastY = 0;
  private lastTime = 0;
  private rafId: number | null = null;
  private dragMoved = false;
  private handoffTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const narrow = window.innerWidth < 1650;
    const pct    = (narrow && this.xPctNarrow >= 0) ? this.xPctNarrow : this.xPct;
    const x    = pct >= 0 ? Math.round(window.innerWidth * pct / 100) : this.initialX;
    this.dragPos = { x, y: this.initialY };
  }

  // ── Z-index ─────────────────────────────────────────────

  private bringToFront() {
    (this.cdkDrag.element.nativeElement as HTMLElement).style.zIndex = String(nextZ());
  }

  // ── Direct DOM helpers ──────────────────────────────────

  private setTilt(deg: number) {
    const clamped = Math.max(-MAX_TILT, Math.min(MAX_TILT, deg));
    this.cardEl.nativeElement.style.setProperty('--tilt', clamped + 'deg');
  }

  private setCardTransform(value: string, transition: string) {
    const el = this.cardEl.nativeElement;
    el.style.transition = transition;
    el.style.transform  = value;
    el.style.zIndex     = '9999';
    el.style.pointerEvents = 'none';
  }

  private hideCard() {
    const el = this.cardEl.nativeElement;
    el.style.transition  = 'none';
    el.style.opacity     = '0';
    el.style.pointerEvents = 'none';
  }

  // ── Expand ──────────────────────────────────────────────

  onCardClick() {
    this.bringToFront();
    if (this.dragMoved || this.isExpanding || this.isExpanded) return;

    const rect  = this.cardEl.nativeElement.getBoundingClientRect();
    const cardCx = rect.left + rect.width  / 2;
    const cardCy = rect.top  + rect.height / 2;
    const tx = window.innerWidth  / 2 - cardCx;
    const ty = window.innerHeight / 2 - cardCy;

    this.isExpanding = true;
    document.body.style.overflow = 'hidden';

    // Direct DOM: set transition then transform so browser animates
    this.setCardTransform(
      `translate(${tx}px, ${ty}px) scale(${SCALE})`,
      `transform 750ms ${SPRING_SOFT}, box-shadow 600ms ease`
    );

    // Handoff at 600ms (spring ~96% settled)
    this.handoffTimer = setTimeout(() => {
      this.hideCard();
      this.isExpanded  = true;
      this.isExpanding = false;
      this.cdr.markForCheck();
    }, HANDOFF_MS);
  }

  // Called the moment the user triggers close — card flies back simultaneously
  onExpandedClosing() {
    const card    = this.cardEl.nativeElement;
    const wrapper = this.cdkDrag.element.nativeElement as HTMLElement;

    // Raise wrapper above the dialog (z-index: 9000) so card is visible during flight
    wrapper.style.zIndex = '10000';

    // Show card instantly, kill existing transition so the opacity snap is immediate
    card.style.transition = 'none';
    card.style.opacity    = '1';

    // Let the browser paint this frame (card now visible at translate+scale position),
    // then in the next frame set the spring and clear the inline transform
    requestAnimationFrame(() => {
      card.style.transition = `transform 750ms ${SPRING_SOFT}`;
      card.style.transform  = '';

      setTimeout(() => {
        card.style.transition    = '';
        card.style.pointerEvents = '';
        wrapper.style.zIndex     = '';
      }, 800);
    });
  }

  onClosed() {
    this.isExpanded  = false;
    this.isExpanding = false;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  // ── Drag ────────────────────────────────────────────────

  onDragStarted() {
    this.bringToFront();
    this.isDragging  = true;
    this.dragMoved   = false;
    this.vx          = 0;
    this.vy          = 0;
    this.lastTime    = 0;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  onDragMoved(event: CdkDragMove) {
    this.dragMoved = true;
    const now = Date.now();
    const dt  = now - this.lastTime;
    if (dt > 0 && this.lastTime !== 0) {
      this.vx = (event.pointerPosition.x - this.lastX) / dt;
      this.vy = (event.pointerPosition.y - this.lastY) / dt;
      this.setTilt(this.vx * TILT_FACTOR);
    }
    this.lastX    = event.pointerPosition.x;
    this.lastY    = event.pointerPosition.y;
    this.lastTime = now;
  }

  onDragEnded(event: CdkDragEnd) {
    this.isDragging = false;
    this.lastTime   = 0;
    setTimeout(() => { this.dragMoved = false; }, 100);

    const duration = 300;
    const bounce   = 0.65;
    let totalDx    = this.vx * duration / 2;
    let totalDy    = this.vy * duration / 2;
    let startPos   = event.source.getFreeDragPosition();
    let pos        = { ...startPos };
    let prevEased  = 0;
    let startTime  = performance.now();
    const el       = this.cdkDrag.element.nativeElement as HTMLElement;

    const tick = (now: number) => {
      const elapsed    = Math.min(now - startTime, duration);
      const t          = elapsed / duration;
      const eased      = t * (2 - t);
      const deltaEased = eased - prevEased;
      prevEased        = eased;

      const dx   = totalDx * deltaEased;
      const dy   = totalDy * deltaEased;
      const rect = el.getBoundingClientRect();

      if (rect.left + dx < 0) {
        pos = { x: pos.x - rect.left, y: pos.y + dy };
        event.source.setFreeDragPosition(pos);
        totalDx = Math.abs(totalDx) * bounce * (1 - t);
        totalDy *= bounce;
        prevEased = 0; startTime = now;
        this.rafId = requestAnimationFrame(tick); return;
      } else if (rect.right + dx > window.innerWidth) {
        pos = { x: pos.x + (window.innerWidth - rect.right), y: pos.y + dy };
        event.source.setFreeDragPosition(pos);
        totalDx = -Math.abs(totalDx) * bounce * (1 - t);
        totalDy *= bounce;
        prevEased = 0; startTime = now;
        this.rafId = requestAnimationFrame(tick); return;
      }

      pos = { x: pos.x + dx, y: pos.y + dy };
      event.source.setFreeDragPosition(pos);
      if (elapsed < duration) { this.rafId = requestAnimationFrame(tick); }
      else { this.rafId = null; }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  ngOnDestroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.handoffTimer !== null) clearTimeout(this.handoffTimer);
    document.body.style.overflow = '';
  }
}
