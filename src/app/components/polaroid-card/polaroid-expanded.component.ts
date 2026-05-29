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
      [class.landscape]="landscapeVideo"
    >
      <button class="close-btn" (click)="close()">✕</button>

      <div class="dialog-image" [class.has-video]="videoSrc" [class.hiding]="hidingMedia()">
        <div *ngIf="!imageSrc && !videoSrc && imageSrcs.length === 0" class="image-placeholder">
          <span>{{ caption }}</span>
        </div>
        <img *ngIf="imageSrc && !videoSrc && imageSrcs.length === 0" [src]="imageSrc" [alt]="dialogTitle" draggable="false" />
        <video *ngIf="videoSrc" [src]="videoSrc" autoplay muted loop playsinline [class.hiding]="hidingMedia()" [style.object-position]="videoObjectPosition"></video>
        <div *ngIf="imageSrcs.length > 1" class="slideshow">
          <img class="slide slide-back" [src]="imageSrcs[1]" draggable="false" />
          <img class="slide slide-front" [src]="imageSrcs[0]" draggable="false" />
        </div>
      </div>

      <div class="dialog-text" *ngIf="ready() && !closing()">
        <h2 class="dialog-title">{{ dialogTitle }}</h2>
        <p class="dialog-desc" [innerHTML]="dialogDesc"></p>
      </div>
    </div>
  `,
  styleUrl: './polaroid-expanded.component.scss'
})
export class PolaroidExpandedComponent implements OnInit {
  @Input() caption = '';
  @Input() imageSrc = '';
  @Input() imageSrcs: string[] = [];
  @Input() videoSrc = '';
  @Input() videoObjectPosition = 'center';
  @Input() landscapeVideo = false;
  @Input() dialogTitle = '';
  @Input() dialogDesc = '';

  readonly closed       = output<void>();
  readonly closingStart = output<void>();
  readonly ready        = signal(false);
  readonly closing      = signal(false);
  readonly hidingMedia  = signal(false);

  ngOnInit() {
    // single RAF so the browser paints the initial (small) state first
    requestAnimationFrame(() => {
      this.ready.set(true);
    });
  }

  close() {
    if (this.closing()) return;

    if (this.videoSrc || this.imageSrcs.length > 0) {
      // Phase 1: fade media out, then spring the card back
      this.hidingMedia.set(true);
      setTimeout(() => this.doClose(), 220);
    } else {
      this.doClose();
    }
  }

  private doClose() {
    this.ready.set(false);    // springs dialog back to card footprint
    this.closing.set(true);   // fades dialog out
    this.closingStart.emit(); // parent card starts fly-back simultaneously
    setTimeout(() => this.closed.emit(), TIMING.collapse);
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.close(); }
}
