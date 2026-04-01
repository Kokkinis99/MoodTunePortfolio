import { afterNextRender, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('MoodTunePortfolio');

  constructor() {
    afterNextRender(() => {
      const overlay = document.getElementById('mood-overlay');
      if (overlay) {
        overlay.classList.add('fade-out');
        overlay.addEventListener('transitionend', () => {
          overlay.remove();
          document.documentElement.style.removeProperty('background');
        }, { once: true });
      }
    });
  }
}
