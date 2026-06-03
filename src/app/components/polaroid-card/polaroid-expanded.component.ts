import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  output,
  signal,
} from '@angular/core';
import { NgIf } from '@angular/common';
import { SoundService } from '../../services/sound.service';

/* ─────────────────────────────────────────────────────────
 * Mounts at 180*1.8 = 324px wide, 246*1.8 = 443px tall
 * (the card's visual footprint at scale(1.8))
 * Then immediately transitions to the final dialog size.
 * ───────────────────────────────────────────────────────── */

const TIMING            = { collapse: 750 };
const MIN_W             = 380;
const MIN_H             = 280;
const TICK_INTERVAL_MS  = 80;   // minimum ms between resize ticks
const TICK_MIN_DELTA_PX = 20;   // minimum combined w+h change to fire a tick

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
      #dialogEl
      [class.ready]="ready()"
      [class.closing]="closing()"
      [class.landscape]="landscapeVideo"
      (click)="onDialogClick($event)"
    >
      <button class="close-btn" (click)="close()">✕</button>

      <div class="dialog-image" [class.has-video]="videoSrc" [class.hiding]="hidingMedia()">
        <div *ngIf="!imageSrc && !videoSrc && imageSrcs.length === 0" class="image-placeholder">
          <span>{{ caption }}</span>
        </div>
        <img *ngIf="imageSrc && !videoSrc && imageSrcs.length === 0" [src]="imageSrc" [alt]="dialogTitle" draggable="false" />
        <video *ngIf="videoSrc" [src]="videoSrc" autoplay [muted]="videoMuted" loop playsinline
          [class.hiding]="hidingMedia()" [style.object-position]="videoObjectPosition"></video>
        <div *ngIf="imageSrcs.length > 1" class="slideshow">
          <img class="slide slide-back" [src]="imageSrcs[1]" draggable="false" />
          <img class="slide slide-front" [src]="imageSrcs[0]" draggable="false" />
        </div>
      </div>

      <div class="dialog-text" *ngIf="ready() && !closing()">
        <h2 class="dialog-title">{{ dialogTitle }}</h2>
        <p class="dialog-desc" [innerHTML]="dialogDesc"></p>
      </div>

      <div class="resize-handle" (mousedown)="onResizeStart($event)"></div>
    </div>
  `,
  styleUrl: './polaroid-expanded.component.scss'
})
export class PolaroidExpandedComponent implements OnInit, OnDestroy {
  @Input() caption = '';
  @Input() imageSrc = '';
  @Input() imageSrcs: string[] = [];
  @Input() videoSrc = '';
  @Input() videoMuted = true;
  @Input() videoObjectPosition = 'center';
  @Input() landscapeVideo = false;
  @Input() dialogTitle = '';
  @Input() dialogDesc = '';

  @ViewChild('dialogEl') private dialogEl!: ElementRef<HTMLDivElement>;

  readonly closed       = output<void>();
  readonly closingStart = output<void>();
  readonly ready        = signal(false);
  readonly closing      = signal(false);
  readonly hidingMedia  = signal(false);

  private isDraggingResize  = false;
  private resizeStartMouseX = 0;
  private resizeStartMouseY = 0;
  private resizeStartW      = 0;
  private resizeStartH      = 0;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  // Resize tick tracking
  private lastTickTime = 0;
  private lastTickW    = 0;
  private lastTickH    = 0;

  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp   = this.onMouseUp.bind(this);

  constructor(private sound: SoundService) {}

  ngOnInit() {
    this.sound.playOpen();
    requestAnimationFrame(() => this.ready.set(true));
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup',   this.boundMouseUp);
    document.body.classList.remove('grabbing');
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
  }

  close() {
    if (this.closing()) return;
    this.sound.playClose();

    this.isDraggingResize = false;
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup',   this.boundMouseUp);
    document.body.classList.remove('grabbing');
    if (this.releaseTimer) { clearTimeout(this.releaseTimer); this.releaseTimer = null; }

    const el = this.dialogEl?.nativeElement;
    if (el) {
      el.classList.remove('resize-grabbing', 'resize-releasing');
      el.style.width      = '';
      el.style.height     = '';
      el.style.transition = '';
    }

    if (this.videoSrc || this.imageSrcs.length > 0) {
      this.hidingMedia.set(true);
      setTimeout(() => this.doClose(), 220);
    } else {
      this.doClose();
    }
  }

  private doClose() {
    this.ready.set(false);
    this.closing.set(true);
    this.closingStart.emit();
    setTimeout(() => this.closed.emit(), TIMING.collapse);
  }

  // ── Dialog click ambient ─────────────────────────────────────

  onDialogClick(e: MouseEvent): void {
    if ((e.target as Element).closest('.resize-handle')) return;
    this.sound.playMoodSelect();
  }

  // ── Resize ───────────────────────────────────────────────────

  onResizeStart(e: MouseEvent) {
    if (!this.ready() || this.closing()) return;
    e.preventDefault();
    e.stopPropagation();

    if (this.releaseTimer) { clearTimeout(this.releaseTimer); this.releaseTimer = null; }

    const el   = this.dialogEl.nativeElement;
    const rect = el.getBoundingClientRect();

    this.isDraggingResize  = true;
    this.resizeStartMouseX = e.clientX;
    this.resizeStartMouseY = e.clientY;
    this.resizeStartW      = rect.width;
    this.resizeStartH      = rect.height;

    // One pop on grab; seed tick tracker so first move is measured from here
    this.sound.playPopPress();
    this.lastTickTime = 0;
    this.lastTickW    = rect.width;
    this.lastTickH    = rect.height;

    // Pin current size inline (cancels any in-flight CSS size transition)
    // and disable width/height transitions so resize is immediate
    el.style.width      = rect.width  + 'px';
    el.style.height     = rect.height + 'px';
    el.style.transition = 'box-shadow 300ms ease';

    // Grab bounce: scale up with spring overshoot
    el.classList.remove('resize-releasing');
    el.classList.add('resize-grabbing');

    document.body.classList.add('grabbing');
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup',   this.boundMouseUp);
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDraggingResize) return;
    const dx = e.clientX - this.resizeStartMouseX;
    const dy = e.clientY - this.resizeStartMouseY;
    // 2× delta: all-directions growth from center
    const el   = this.dialogEl.nativeElement;
    const newW = Math.max(MIN_W, this.resizeStartW + 2 * dx);
    const newH = Math.max(MIN_H, this.resizeStartH + 2 * dy);
    el.style.width  = newW + 'px';
    el.style.height = newH + 'px';

    // Rattle tick: fire if enough time has passed AND the size actually moved
    const now   = Date.now();
    const delta = Math.abs(newW - this.lastTickW) + Math.abs(newH - this.lastTickH);
    if (now - this.lastTickTime >= TICK_INTERVAL_MS && delta >= TICK_MIN_DELTA_PX) {
      this.sound.playResizeTick();
      this.lastTickTime = now;
      this.lastTickW    = newW;
      this.lastTickH    = newH;
    }
  }

  private onMouseUp(_e: MouseEvent) {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup',   this.boundMouseUp);
    document.body.classList.remove('grabbing');

    if (!this.isDraggingResize) return;
    this.isDraggingResize = false;
    this.sound.playPopRelease();

    const el = this.dialogEl.nativeElement;

    // Release bounce: CSS keyframe does an undershoot-overshoot-settle
    el.classList.remove('resize-grabbing');
    el.classList.add('resize-releasing');

    // After bounce settles, clean up and restore full CSS transitions
    this.releaseTimer = setTimeout(() => {
      el.classList.remove('resize-releasing');
      el.style.transition = '';
      this.releaseTimer = null;
    }, 480);
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.close(); }
}
