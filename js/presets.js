import { $ } from './dom.js';
import { renderGrid } from './grid.js';

/* pot presets — exactly one chip lit at all times. Custom lights when the
   amount isn't a preset OR the moment you click Custom (so the click always
   gives feedback); typing a value that matches a preset snaps back to it. */
let customMode = false;
function paint() {
  const v = $('amount').value;
  const chips = [...document.querySelectorAll('#presets .preset')];
  const isPreset = chips.some(b => b.dataset.amt !== 'custom' && b.dataset.amt === v);
  chips.forEach(b => b.classList.toggle('sel',
    b.dataset.amt === 'custom' ? (customMode || !isPreset) : (!customMode && b.dataset.amt === v)));
}
document.querySelectorAll('#presets .preset').forEach(b => b.onclick = () => {
  if (b.dataset.amt === 'custom') { customMode = true; const inp = $('amount'); inp.focus(); inp.select(); paint(); return; }
  customMode = false; $('amount').value = b.dataset.amt; renderGrid(); paint();
});
$('amount').addEventListener('input', () => {
  // typing a value equal to a preset drops out of custom mode and lights that chip
  const v = $('amount').value;
  const chips = [...document.querySelectorAll('#presets .preset')];
  if (chips.some(b => b.dataset.amt !== 'custom' && b.dataset.amt === v)) customMode = false;
  paint();
});
paint();
