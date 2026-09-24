import { $ } from './dom.js';
import { renderGrid } from './grid.js';

/* pot presets — one chip always lit; a non-preset amount lights Custom */
function syncPresets() {
  const v = $('amount').value;
  const chips = document.querySelectorAll('#presets .preset');
  const isPreset = [...chips].some(b => b.dataset.amt === v);
  chips.forEach(b => b.classList.toggle('sel', b.dataset.amt === 'custom' ? !isPreset : b.dataset.amt === v));
}
document.querySelectorAll('#presets .preset').forEach(b => b.onclick = () => {
  if (b.dataset.amt === 'custom') { const inp = $('amount'); inp.focus(); inp.select(); syncPresets(); return; }
  $('amount').value = b.dataset.amt; renderGrid(); syncPresets();
});
$('amount').addEventListener('input', syncPresets);
syncPresets();
