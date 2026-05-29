import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { DatePipe, NgFor, NgClass } from '@angular/common';
import {
  format,
  addMonths,
  subMonths,
  subDays,
  startOfDay,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  getDay,
} from 'date-fns';

// "Today" for the demo — computed once on load
const TODAY = startOfDay(new Date());

// Earliest selectable date — 7 days back
const START_DATE = subDays(TODAY, 7);

type CalendarDate = {
  date: Date;
  isCurrentDate: boolean;
  isCurrentMonth: boolean;
  isFutureDate: boolean;
  mood: string | null;
};

// Mood pattern: 7 days ago → today
type Mood = 'happy' | 'sad' | 'angry' | 'calm';
const MOOD_CYCLE: Mood[] = ['calm', 'happy', 'calm', 'sad', 'angry', 'happy', 'calm', 'happy'];

function buildMoodEntries(): Record<string, Mood> {
  const entries: Record<string, Mood> = {};
  MOOD_CYCLE.forEach((mood, i) => {
    const daysBack = MOOD_CYCLE.length - 1 - i;
    entries[format(subDays(TODAY, daysBack), 'yyyy-MM-dd')] = mood;
  });
  return entries;
}

const MOOD_ENTRIES = buildMoodEntries();

const MOOD_COLORS: Record<string, { color: string; shade: string }> = {
  happy:   { color: '#78b853', shade: '#5a9438' },
  sad:     { color: '#a18fff', shade: '#7d6be0' },
  calm:    { color: '#5c9ead', shade: '#3d7d8e' },
  angry:   { color: '#ff3f52', shade: '#d42840' },
  default: { color: '#78b853', shade: '#5a9438' },
};

// Most recent date in the cycle for each mood
function buildMoodInitialDates(): Record<string, Date> {
  const dates: Record<string, Date> = {};
  // Iterate newest→oldest so the first hit per mood = most recent
  for (let i = MOOD_CYCLE.length - 1; i >= 0; i--) {
    const mood = MOOD_CYCLE[i];
    if (!dates[mood]) {
      dates[mood] = subDays(TODAY, MOOD_CYCLE.length - 1 - i);
    }
  }
  return dates;
}

const MOOD_INITIAL_DATE = buildMoodInitialDates();

@Component({
  selector: 'app-calendar-demo',
  standalone: true,
  imports: [DatePipe, NgFor, NgClass],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div
      class="container"
      [class.expanded]="calendarExpanded"
      [style.--mood-color]="moodColor"
      [style.--mood-shade]="moodShade"
      (click)="toggleExpand()"
    >
      <div class="data-container" [class.animated]="animateDataContainer">
        <div class="month-container">
          <div class="month">{{ monthName }}</div>
          <svg class="chevron" [class.rotated]="calendarExpanded" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5" />
          </svg>
        </div>

        <div class="calendar-container">
          <!-- Day headers -->
          <div class="calendar days-row">
            <div
              class="day"
              *ngFor="let d of daysOfWeek"
              [class.current-day]="isCurrentDayLabel(d)"
            >{{ d }}</div>
          </div>

          <!-- Week view -->
          @if (!calendarExpanded) {
            <div class="calendar" (click)="$event.stopPropagation()">
              <div class="date-container" *ngFor="let d of weekDates">
                <div
                  class="date"
                  [ngClass]="getDateClasses(d, 'week')"
                  (click)="selectDate($event, d)"
                >{{ d.date | date:'d' }}</div>
              </div>
            </div>
          }

          <!-- Month view -->
          @if (calendarExpanded) {
            <div class="calendar" (click)="$event.stopPropagation()">
              <div class="date-container" *ngFor="let d of monthDates">
                <div
                  class="date"
                  [ngClass]="getDateClasses(d, 'month')"
                  (click)="selectDate($event, d)"
                >{{ d.date | date:'d' }}</div>
              </div>
            </div>
          }
        </div>
      </div>

      @if (calendarExpanded) {
        <div class="month-navigation-container">
          <svg class="nav-arrow" [class.disabled]="isMinMonth" viewBox="0 0 24 24" (click)="prevMonth($event)">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <svg class="nav-arrow right" [class.disabled]="isMaxMonth" viewBox="0 0 24 24" (click)="nextMonth($event)">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      }
    </div>
  `,
  styleUrl: './calendar-demo.component.scss'
})
export class CalendarDemoComponent implements OnInit {
  @Input() initialMood: string = 'happy';

  calendarExpanded = false;
  selectedDate: Date = TODAY; // overridden in ngOnInit based on initialMood
  currentMood = 'happy';
  animateDataContainer = false;

  displayMonth: Date = TODAY; // month being viewed

  daysOfWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  weekDates: CalendarDate[] = [];
  monthDates: CalendarDate[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const date = MOOD_INITIAL_DATE[this.initialMood] ?? TODAY;
    this.selectedDate  = date;
    this.displayMonth  = date;
    this.currentMood   = this.initialMood;
    this.buildDates();
  }

  get monthName(): string {
    return format(this.displayMonth, 'MMMM yyyy');
  }

  get isMinMonth(): boolean {
    return this.displayMonth.getFullYear() === START_DATE.getFullYear()
        && this.displayMonth.getMonth()     === START_DATE.getMonth();
  }

  get isMaxMonth(): boolean {
    return this.displayMonth.getFullYear() === TODAY.getFullYear()
        && this.displayMonth.getMonth()     === TODAY.getMonth();
  }

  get moodColor(): string {
    return (MOOD_COLORS[this.currentMood] ?? MOOD_COLORS['default']).color;
  }

  get moodShade(): string {
    return (MOOD_COLORS[this.currentMood] ?? MOOD_COLORS['default']).shade;
  }

  private buildDates(): void {
    const today = TODAY;
    const monthStart = startOfMonth(this.displayMonth);
    const monthEnd = endOfMonth(this.displayMonth);

    // Build month dates — start from Monday of the week containing monthStart
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    this.monthDates = eachDayOfInterval({ start: gridStart, end: gridEnd }).map(date =>
      this.toCalendarDate(date, today, monthStart)
    );

    // Build week dates — the week containing selectedDate, Mon–Sun
    const weekStart = startOfWeek(this.selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(this.selectedDate, { weekStartsOn: 1 });

    this.weekDates = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(date =>
      this.toCalendarDate(date, today, monthStart)
    );
  }

  private toCalendarDate(date: Date, today: Date, monthStart: Date): CalendarDate {
    const key = format(date, 'yyyy-MM-dd');
    const mood = MOOD_ENTRIES[key] ?? null;
    const isCurrentMonth = date.getMonth() === this.displayMonth.getMonth() &&
                           date.getFullYear() === this.displayMonth.getFullYear();

    return {
      date,
      isCurrentDate: isSameDay(date, this.selectedDate),
      isCurrentMonth,
      isFutureDate: isAfter(date, today),
      mood,
    };
  }

  toggleExpand(): void {
    this.calendarExpanded = !this.calendarExpanded;
    this.animateDataContainer = true;
    setTimeout(() => {
      this.animateDataContainer = false;
      this.cdr.markForCheck();
    }, 200);
  }

  selectDate(event: Event, d: CalendarDate): void {
    event.stopPropagation();
    if (d.isFutureDate) return;
    if (isBefore(d.date, START_DATE)) return;
    this.selectedDate = d.date;
    this.currentMood = d.mood ?? 'happy';
    // If clicked date is in a different month, update displayed month
    if (d.date.getMonth() !== this.displayMonth.getMonth() ||
        d.date.getFullYear() !== this.displayMonth.getFullYear()) {
      this.displayMonth = d.date;
    }
    this.buildDates();
  }

  prevMonth(event: Event): void {
    event.stopPropagation();
    if (this.isMinMonth) return;
    this.displayMonth = subMonths(this.displayMonth, 1);
    this.buildDates();
  }

  nextMonth(event: Event): void {
    event.stopPropagation();
    if (this.isMaxMonth) return;
    this.displayMonth = addMonths(this.displayMonth, 1);
    this.buildDates();
  }

  isCurrentDayLabel(label: string): boolean {
    const today = TODAY;
    // Mon=1 ... Sun=0 in getDay(), convert to Mo Tu We Th Fr Sa Su
    const dayIndex = getDay(today); // 0=Sun
    const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return labels[dayIndex] === label;
  }

  getDateClasses(d: CalendarDate, type: 'week' | 'month'): string[] {
    const today = TODAY;
    const classes: string[] = [];

    if (d.isCurrentDate && type === 'week') classes.push('current-date');
    if (d.isCurrentDate && type === 'month') classes.push('current-date-expanded');
    if (isSameDay(d.date, today) && d.isCurrentMonth) classes.push('today');
    const isBeforeStart = isBefore(d.date, START_DATE);
    if (d.isFutureDate || isBeforeStart) classes.push('disabled-date');
    if (!d.isCurrentMonth && type === 'month') classes.push('invisible');

    if (!d.isCurrentDate && !isSameDay(d.date, today)) {
      classes.push('background-container-circle');
      if (d.mood) {
        classes.push('color-' + d.mood);
      } else if (!d.isFutureDate && !isBeforeStart && d.isCurrentMonth) {
        classes.push('color-no-entries');
      }
      // Outline: dates whose mood matches the currently selected mood
      if (!d.isFutureDate && !isBeforeStart && d.isCurrentMonth) {
        const sameColor = d.mood && d.mood === this.currentMood;
        if (sameColor) classes.push('outline');
      }
    }

    return classes;
  }
}
