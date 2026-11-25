import { full } from './state.js';
import { renderGarden } from './garden.js';

/* Theme toggle: light / dark set data-theme and persist under `theme`; system clears
   both. The saved theme is already applied by js/theme-init.js before first paint, so
   this only marks the active cell (.on + aria-pressed) and handles clicks. The garden
   card is a canvas, so it's redrawn whenever the effective theme changes. */
(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll('#themeToggle button');
  const mark = () => {
    const current = root.dataset.theme || 'system';
    buttons.forEach(b => {
      const on = b.dataset.themeSet === current;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };
  buttons.forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.themeSet;
    try {
      if (t === 'system') { delete root.dataset.theme; localStorage.removeItem('theme'); }
      else { root.dataset.theme = t; localStorage.setItem('theme', t); }
    } catch (e) {
      if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
    }
    mark();
    if (full()) renderGarden();
  }));
  mark();
})();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.theme && full()) renderGarden(); });
