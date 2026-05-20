import { Component, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CalendarDemoComponent } from '../../components/demos/calendar-demo/calendar-demo.component';
import { BrokenStreakDemoComponent } from '../../components/demos/broken-streak-demo/broken-streak-demo.component';
import { StickyNoteComponent } from '../../components/sticky-note/sticky-note.component';
import { PolaroidCardComponent } from '../../components/polaroid-card/polaroid-card.component';

export type Mood = 'happy' | 'sad' | 'angry' | 'calm';

const VALID_MOODS: Mood[] = ['happy', 'sad', 'angry', 'calm'];

const MOOD_BG: Record<Mood, string> = {
  happy: '#78b853',
  sad:   '#a18fff',
  calm:  '#5c9ead',
  angry: '#ff3f52',
};

const MOOD_SRCS = [
  'images/main-moods/happy.png',
  'images/main-moods/sad.png',
  'images/main-moods/angry.png',
  'images/main-moods/calm.png',
];

// 64px image + 32px gap = 96px per item. 32 items = 3072px — covers any viewport.
export const MOOD_STRIP = Array.from({ length: 17 }, (_, i) => MOOD_SRCS[i % 4]);

const FIGMA_EMBED_URL =
  'https://www.figma.com/embed?embed_host=share&url=' +
  'https://www.figma.com/design/IRMEh9ZYdvGIyonKN51YCw/MoodTune' +
  '%3Fnode-id%3D0-1%26t%3DOaC2CZp4PJAUxhYl-1';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NgFor,
    CalendarDemoComponent,
    BrokenStreakDemoComponent,
    StickyNoteComponent,
    PolaroidCardComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  readonly moodStrip = MOOD_STRIP;
  currentMood: Mood = 'happy';
  readonly figmaSrc: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.figmaSrc = this.sanitizer.bypassSecurityTrustResourceUrl(FIGMA_EMBED_URL);
  }

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('mood') as Mood | null;
    if (raw && (VALID_MOODS as string[]).includes(raw)) {
      this.currentMood = raw;
    }
  }

  get headerBg(): string {
    return MOOD_BG[this.currentMood];
  }
}
