import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CdkDrag, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
import { nextZ } from '../z-order';

const MAX_TILT = 15;
const TILT_FACTOR = 25;

@Component({
  selector: 'app-sticky-note',
  standalone: true,
  imports: [CdkDrag],
  template: `
    <div class="drag-wrapper"
      cdkDrag
      (cdkDragStarted)="onDragStarted()"
      (cdkDragMoved)="onDragMoved($event)"
      (cdkDragEnded)="onDragEnded($event)">
      <div #stickyEl
        class="sticky"
        [class]="stickyClasses"
        [style.--rotation]="rotation + 'deg'">
        <div class="sticky-body">{{ text }}</div>
      </div>
    </div>
  `,
  styleUrl: './sticky-note.component.scss'
})
export class StickyNoteComponent {
  @Input() text = '';
  @Input() color: 'yellow' | 'pink' | 'purple' | 'blue' | 'green' | 'orange' = 'yellow';
  @Input() rotation = -2;

  @ViewChild(CdkDrag) private cdkDrag!: CdkDrag;
  @ViewChild('stickyEl') private stickyEl!: ElementRef<HTMLDivElement>;

  isDragging = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  private bringToFront() {
    this.host.nativeElement.style.zIndex = String(nextZ());
  }

  get stickyClasses(): string {
    return `color-${this.color}${this.isDragging ? ' grabbed' : ''}`;
  }

  private setTilt(deg: number) {
    const clamped = Math.max(-MAX_TILT, Math.min(MAX_TILT, deg));
    this.stickyEl.nativeElement.style.setProperty('--tilt', clamped + 'deg');
  }

  private vx = 0;
  private vy = 0;
  private lastX = 0;
  private lastY = 0;
  private lastTime = 0;
  private rafId: number | null = null;

  onDragStarted() {
    this.bringToFront();
    this.isDragging = true;
    this.vx = 0;
    this.vy = 0;
    this.lastTime = 0;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  onDragMoved(event: CdkDragMove) {
    const now = Date.now();
    const dt = now - this.lastTime;
    if (dt > 0 && this.lastTime !== 0) {
      this.vx = (event.pointerPosition.x - this.lastX) / dt;
      this.vy = (event.pointerPosition.y - this.lastY) / dt;
      this.setTilt(this.vx * TILT_FACTOR);
    }
    this.lastX = event.pointerPosition.x;
    this.lastY = event.pointerPosition.y;
    this.lastTime = now;
  }

  onDragEnded(event: CdkDragEnd) {
    this.isDragging = false;
    this.lastTime = 0;

    const duration = 300;
    const bounce = 0.65;

    let totalDx = this.vx * duration / 2;
    let totalDy = this.vy * duration / 2;
    let startPos = event.source.getFreeDragPosition();
    let pos = { ...startPos };
    let prevEased = 0;
    let startTime = performance.now();

    const el = this.cdkDrag.element.nativeElement as HTMLElement;

    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration);
      const t = elapsed / duration;
      const eased = t * (2 - t);

      const deltaEased = eased - prevEased;
      prevEased = eased;

      let dx = totalDx * deltaEased;
      let dy = totalDy * deltaEased;

      const rect = el.getBoundingClientRect();

      if (rect.left + dx < 0) {
        pos = { x: pos.x - rect.left, y: pos.y + dy };
        event.source.setFreeDragPosition(pos);
        totalDx = Math.abs(totalDx) * bounce * (1 - t);
        totalDy *= bounce;
        startPos = { ...pos };
        prevEased = 0;
        startTime = now;
        this.rafId = requestAnimationFrame(tick);
        return;
      } else if (rect.right + dx > window.innerWidth) {
        pos = { x: pos.x + (window.innerWidth - rect.right), y: pos.y + dy };
        event.source.setFreeDragPosition(pos);
        totalDx = -Math.abs(totalDx) * bounce * (1 - t);
        totalDy *= bounce;
        startPos = { ...pos };
        prevEased = 0;
        startTime = now;
        this.rafId = requestAnimationFrame(tick);
        return;
      }

      pos = { x: pos.x + dx, y: pos.y + dy };
      event.source.setFreeDragPosition(pos);

      if (elapsed < duration) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
