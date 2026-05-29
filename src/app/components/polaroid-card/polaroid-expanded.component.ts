import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  HostListener,
  output,
  signal,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { NgIf } from '@angular/common';

/* ─────────────────────────────────────────────────────────
 * Mounts at 180*1.8 = 324px wide, 246*1.8 = 443px tall
 * (the card's visual footprint at scale(1.8))
 * Then immediately transitions to the final dialog size.
 * ───────────────────────────────────────────────────────── */

const TIMING = { collapse: 750 };
const MIN_W  = 380;
const MIN_H  = 280;

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
    >
      <button class="close-btn" (click)="close()">✕</button>

      <div class="dialog-image" [class.has-video]="videoSrc" [class.hiding]="hidingMedia()">
        <div *ngIf="!imageSrc && !videoSrc && imageSrcs.length === 0" class="image-placeholder">
          <span>{{ caption }}</span>
        </div>
        <img *ngIf="imageSrc && !videoSrc && imageSrcs.length === 0" [src]="imageSrc" [alt]="dialogTitle" draggable="false" />
        <video *ngIf="videoSrc" [src]="videoSrc" autoplay [muted]="videoMuted" loop playsinline [class.hiding]="hidingMedia()" [style.object-position]="videoObjectPosition"></video>
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
  @Input() videoMuted = false;
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

  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp   = this.onMouseUp.bind(this);

  ngOnInit() {
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
    const el = this.dialogEl.nativeElement;
    el.style.width  = Math.max(MIN_W, this.resizeStartW + 2 * dx) + 'px';
    el.style.height = Math.max(MIN_H, this.resizeStartH + 2 * dy) + 'px';
  }

  private onMouseUp(_e: MouseEvent) {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup',   this.boundMouseUp);
    document.body.classList.remove('grabbing');

    if (!this.isDraggingResize) return;
    this.isDraggingResize = false;

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
