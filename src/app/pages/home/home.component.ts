import { Component, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SoundService } from '../../services/sound.service';
import { CalendarDemoComponent } from '../../components/demos/calendar-demo/calendar-demo.component';
import { BrokenStreakDemoComponent } from '../../components/demos/broken-streak-demo/broken-streak-demo.component';
import { StickyNoteComponent } from '../../components/sticky-note/sticky-note.component';
import { PolaroidCardComponent } from '../../components/polaroid-card/polaroid-card.component';
import { MuteButtonComponent } from '../../components/mute-button/mute-button.component';

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Playground entrance (initial load)
 *
 *    0ms   polaroid 1 pops in  (scale 0.7 → 1, opacity 0 → 1)
 *  150ms   polaroid 2
 *  300ms   polaroid 3
 *  450ms   polaroid 4
 *  600ms   polaroid 5
 *  750ms   polaroid 6
 * 1350ms   note 1  (after last polaroid settles)
 * 1500ms   note 2
 * 1650ms   note 3
 * ───────────────────────────────────────────────────────── */
const INTRO_TIMING = {
  polaroidStagger: 150,   // ms between each polaroid entrance
  notesStart:      1350,  // ms before first note (last polaroid + spring settle)
  noteStagger:     150,   // ms between each note entrance
};

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

// 64px image + 32px gap = 96px per item. 17 items = 1632px — covers any viewport.
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
    MuteButtonComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  readonly moodStrip = MOOD_STRIP;
  currentMood: Mood = 'happy';
  readonly figmaSrc: SafeResourceUrl;
  // Delays: ms before each item's entrance animation fires
  readonly polaroidDelays  = Array.from({ length: 6 }, (_, i) => i * INTRO_TIMING.polaroidStagger);
  readonly noteDelays      = Array.from({ length: 3 }, (_, i) => INTRO_TIMING.notesStart + i * INTRO_TIMING.noteStagger);
  // Indices: drive the pitch walk in SoundService.playPop() — notes continue from where polaroids left off
  readonly polaroidIndices = Array.from({ length: 6 }, (_, i) => i);
  readonly noteIndices     = Array.from({ length: 3 }, (_, i) => 6 + i);
  readonly saveStreakDesc =
    `This little interaction got featured in ` +
    `<a href="https://www.joshwcomeau.com/email/wham-launch-009-student-showcase/" ` +
    `target="_blank" rel="noopener">Josh W. Comeau's newsletter</a>! ` +
    `There's something about using gamification in apps that just feels good. ` +
    `Sure it could've been a button, sure it could've been a payment, but none ` +
    `of these options would make me smile the way smashing my finger into the ` +
    `screen does.`;

  constructor(
    private sanitizer: DomSanitizer,
    protected sound: SoundService,
  ) {
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
