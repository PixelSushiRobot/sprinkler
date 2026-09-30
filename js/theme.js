import { full } from './state.js';
import { renderGarden } from './garden.js';

(function initTheme() {
  const root = document.documentElement; let saved = null; try { saved = localStorage.getItem('sprinkler-theme'); } catch (e) { }
  const choice = (saved === 'light' || saved === 'dark') ? saved : 'system'; apply(choice);
  document.querySelectorAll('#themeToggle button').forEach(btn => { btn.classList.toggle('on', btn.dataset.themeSet === choice); btn.onclick = () => { const c = btn.dataset.themeSet; apply(c); try { c === 'system' ? localStorage.removeItem('sprinkler-theme') : localStorage.setItem('sprinkler-theme', c); } catch (e) { } document.querySelectorAll('#themeToggle button').forEach(b => b.classList.toggle('on', b === btn)); }; });
  function apply(c) { if (c === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', c); if (full()) renderGarden(); }
})();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.getAttribute('data-theme') && full()) renderGarden(); });
