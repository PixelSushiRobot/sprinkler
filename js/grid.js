import { $ } from './dom.js';
import { avatarSVG } from './avatar.js';
import { escapeHTML } from './escape.js';
import { creators, method, yoloLevel, METHODS, setMethod, setYoloLevel, rollYolo, full, computeSplit, displayOrder, gardenSize, gardenCols, sizeWord, prevSize, isWhale, MAX } from './state.js';

const DICE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>';
function renderMethods() {
  const m = $('methodbar'); m.innerHTML = '';
  METHODS.forEach(mt => { const b = document.createElement('button'); b.className = 'opt' + (method === mt.k ? ' sel' : ''); b.innerHTML = `<span>${mt.n}</span><span class="tag">${mt.t}</span>`; b.onclick = () => { setMethod(mt.k); if (mt.k === 'yolo') rollYolo(); renderAll(); }; m.appendChild(b); });
  const cur = METHODS.find(x => x.k === method);
  $('mdesc').textContent = cur.d;
  document.documentElement.classList.toggle('ranking', method === 'boss');
  const yb = $('yolobar');
  if (method === 'yolo') {
    yb.style.display = ''; yb.innerHTML = '<span class="ylabel">wildness</span>';
    [['chill', 'Chill'], ['wild', 'Wild'], ['jackpot', 'Jackpot']].forEach(([k, label]) => { const b = document.createElement('button'); b.className = 'mbtn' + (yoloLevel === k ? ' sel' : ''); b.textContent = label; b.onclick = () => { setYoloLevel(k); rollYolo(); renderAll(); }; yb.appendChild(b); });
    const rr = document.createElement('button'); rr.className = 'mbtn reroll'; rr.innerHTML = DICE + ' run it back'; rr.onclick = () => { rollYolo(); renderAll(); }; yb.appendChild(rr);
  } else yb.style.display = 'none';
}
const CROWN = '<div class="crown" title="Jackpot Winner"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg></div>';
const fmtTz = v => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' XTZ';
let dragging = false;   // a drag in flight owns the grid DOM — re-renders wait for the drop

/* the garden: tiles up to twelve, a scrolling list past that (whale mode). Both use the
   .tile class so remove, drag and the draft all work the same; list rows add .wrow. */
export function renderGrid() {
  if (dragging) return;
  const g = $('grid'), wrap = g.parentElement, keep = wrap.scrollTop;
  g.innerHTML = '';
  const n = creators.length, size = gardenSize(), whale = isWhale(n);
  g.style.setProperty('--cols', gardenCols(size));
  g.classList.toggle('list', whale); wrap.classList.toggle('list', whale);
  const pot = Math.max(0, +$('amount').value || 0);
  const on = full(), split = on ? computeSplit() : [];
  const maxPc = on ? Math.max(...split, 0.0001) : 1;
  const order = displayOrder();
  order.forEach((origIdx, pos) => {
    const c = creators[origIdx];
    const t = document.createElement('div'); t.className = whale ? 'tile wrow' : 'tile'; t.draggable = false; t.dataset.i = origIdx;
    const fill = on ? (split[origIdx] / maxPc * 100).toFixed(1) : 0;
    const pc = on ? split[origIdx] : 0;
    const crownHtml = on && method === 'yolo' && yoloLevel === 'jackpot' && c._isJackpotWinner ? CROWN : '';
    const statusHtml = c._loading ? '<div class="nm-sub">resolving…</div>' : (c._err ? '<div class="nm-sub err">' + escapeHTML(c._err) + '</div>' : '');
    const avHtml = `<img class="av" src="${escapeHTML(c.avatar || avatarSVG(c.id))}" alt="">`;
    const xHtml = `<button class="x" title="remove" aria-label="remove ${escapeHTML(c.name)}">×</button>`;
    if (whale) {
      // rank always shows (it's the order the batch goes out in); the grip only appears
      // when order changes the split, and is the only drag start so the list can scroll
      const grip = method === 'boss' ? `<button class="grip" type="button" title="drag, or use ↑ / ↓" aria-label="move ${escapeHTML(c.name)}, rank ${pos + 1} of ${n}">≡</button>` : '';
      const numHtml = on ? `<div class="num"><span class="tz">${fmtTz(pot * pc / 100)}</span><span class="pc">${pc.toFixed(1)}%</span></div>` : '';
      t.innerHTML = `<div class="tilefill" style="width:${fill}%"></div>${grip}<span class="rank">${pos + 1}</span>${avHtml}<div class="info"><div class="nm">${escapeHTML(c.name)}</div>${statusHtml}</div>${crownHtml}${numHtml}${xHtml}`;
    } else {
      const numHtml = on ? `<div class="num"><span class="tz">${(pot * pc / 100).toFixed(1)} XTZ</span></div>` : '';
      t.innerHTML = `<div class="tilefill" style="height:${fill}%"></div>${crownHtml}${xHtml}${avHtml}<div class="nm">${escapeHTML(c.name)}</div>${statusHtml}${numHtml}`;
    }
    t.dataset.id = c.id;
    const av = t.querySelector('.av'); av.onerror = () => { av.onerror = null; av.src = avatarSVG(c.id); };  // JS fallback (CSP blocks inline onerror)
    t.querySelector('.x').onclick = e => { e.stopPropagation(); creators.splice(origIdx, 1); renderAll(); };
    g.appendChild(t);
  });
  if (!whale) for (let k = n; k < size; k++) { const s = document.createElement('div'); s.className = 'eslot'; s.textContent = '+'; g.appendChild(s); }
  wrap.scrollTop = keep;
  $('count').textContent = n + ' / ' + (whale ? MAX : size);
  $('sprinkleBtn').disabled = !on;
  $('shareListBtn').disabled = n === 0;
  $('saveListBtn').disabled = n === 0;
  $('splitfoot').textContent = on ? readyLine(pot, n, size, split) : fillHint(n, size);
  layoutNums();
  window.dispatchEvent(new Event('sprinkler:change'));   // draft autosave listens for this
}
// ready summary; flags tiny shares, which get likely once a big list splits a small pot
function readyLine(pot, n, size, split) {
  let s = isWhale(n) ? `${pot} XTZ across ${n} · whale mode · one transaction` : `${pot} XTZ across ${sizeWord(size)} · one transaction`;
  const least = pot * Math.min(...split) / 100;
  if (pot > 0 && least < 0.1) s += ` · smallest share ${least.toFixed(2)} XTZ`;
  return s;
}
/* an incomplete garden can't sprinkle — say how to finish it, both ways when shrinking
   to the next garden down is also an option (6 people: add 3, or remove 2 for four) */
function fillHint(n, size) {
  const add = size - n, prev = prevSize(size);
  const grow = n === 0 ? `plant ${add} to start` : `plant ${add} more`;
  if (n > 0 && prev && n > prev) return `${grow} · or remove ${n - prev} for a garden of ${sizeWord(prev)}`;
  return grow;
}
function layoutNums() {
  const wrap = document.querySelector('.gridwrap'), nl = $('numlayer'); if (!wrap || !nl) return;
  nl.innerHTML = '';
  if (!full() || method !== 'boss' || isWhale()) return;   // list rows show their rank inline
  const wr = wrap.getBoundingClientRect();
  [...$('grid').querySelectorAll('.tile')].forEach((t, i) => { const r = t.getBoundingClientRect(); const s = document.createElement('span'); s.className = 'slotnum'; s.textContent = i + 1; s.style.left = (r.left - wr.left + 6) + 'px'; s.style.top = (r.top - wr.top + 6) + 'px'; nl.appendChild(s); });
}
export function renderAll() { renderMethods(); renderGrid(); }

$('amount').addEventListener('input', renderGrid);

/* share the current garden as a ?to= link — emits the nicest identifier per creator
   (campaign slug > .tez name > wallet), in the arranged order, so the link round-trips
   through the same prefill parser main.js already uses. */
const SHARE_LABEL = 'copy link';
export function shareToken(c) {
  if (c._slug) return c._slug;
  if (c._input && /\.tez$/i.test(c._input)) return c._input;
  return c.addr;
}
function shareURL() {
  const toks = displayOrder().map(i => shareToken(creators[i])).filter(Boolean);
  return location.origin + location.pathname + '?to=' + encodeURIComponent(toks.join(','));
}
async function copyShareLink() {
  const btn = $('shareListBtn'); if (btn.disabled) return;
  const url = shareURL();
  let ok = true;
  try { await navigator.clipboard.writeText(url); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
  }
  btn.textContent = ok ? 'link copied ✓' : 'press ⌘C';
  btn.classList.toggle('copied', ok);
  clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = SHARE_LABEL; btn.classList.remove('copied'); }, 1800);
}
$('shareListBtn').addEventListener('click', copyShareLink);

/* Photos-style Drag and Drop */
(function () {
  const grid = $('grid');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let active = null, placeholder = null, grabX = 0, grabY = 0;

  grid.addEventListener('pointerdown', e => {
    if (e.target.closest('.x')) return;
    // list rows drag from their grip only, so touching a row still scrolls the list
    if (grid.classList.contains('list') && !e.target.closest('.grip')) return;
    const tile = e.target.closest('.tile');
    if (!tile) return;
    e.preventDefault();
    active = tile; dragging = true;

    const r = tile.getBoundingClientRect();
    grabX = e.clientX - r.left;
    grabY = e.clientY - r.top;

    placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.style.width = r.width + 'px';
    placeholder.style.height = r.height + 'px';
    grid.insertBefore(placeholder, tile);

    document.body.appendChild(active);
    active.classList.add('lifted');
    active.style.width = r.width + 'px';
    active.style.height = r.height + 'px';
    moveLifted(e.clientX, e.clientY);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  function onMove(e) {
    if (!active) return;
    moveLifted(e.clientX, e.clientY);

    // nudge a scrolling list when the pointer nears its top or bottom edge
    const wrap = grid.parentElement;
    if (wrap.classList.contains('list')) {
      const w = wrap.getBoundingClientRect();
      if (e.clientY < w.top + 32) wrap.scrollTop -= 14;
      else if (e.clientY > w.bottom - 32) wrap.scrollTop += 14;
    }

    const cs = getComputedStyle(grid);
    const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length || 3;
    const gapOf = v => { const g = parseFloat(v); return isNaN(g) ? 10 : g; };
    const gapX = gapOf(cs.columnGap), gapY = gapOf(cs.rowGap);
    const rect = grid.getBoundingClientRect();
    const colW = (rect.width - gapX * (cols - 1)) / cols;
    const tileH = (placeholder || {}).offsetHeight || 172;
    const stepX = colW + gapX, stepY = tileH + gapY;

    const children = [...grid.children];
    const rows = Math.ceil(children.length / cols);
    const col = clamp(Math.floor((e.clientX - rect.left) / stepX), 0, cols - 1);
    const row = clamp(Math.floor((e.clientY - rect.top) / stepY), 0, rows - 1);
    const index = Math.min(row * cols + col, children.length - 1);

    const target = children[index];
    if (!target || target === placeholder) return;

    const after = children.indexOf(placeholder) < index;
    flip(() => grid.insertBefore(placeholder, after ? target.nextElementSibling : target));
  }

  function moveLifted(x, y) {
    active.style.transform = `translate(${x - grabX}px, ${y - grabY}px) scale(1.04)`;
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);

    if (!active || !placeholder) { dragging = false; return; }

    const p = placeholder.getBoundingClientRect();
    active.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
    active.style.transform = `translate(${p.left}px, ${p.top}px) scale(1)`;

    setTimeout(() => {
      grid.insertBefore(active, placeholder);
      placeholder.remove();
      active.classList.remove('lifted');
      active.removeAttribute('style');

      // Update creator model array based on final DOM ordering
      const newOrderIds = [...grid.querySelectorAll('.tile')].map(el => el.dataset.id);
      creators.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));

      active = placeholder = null; dragging = false;
      renderAll();
    }, 220);
  }

  function flip(mutate) {
    const items = [...grid.children];
    const first = items.map(el => el.getBoundingClientRect());
    mutate();
    items.forEach((el, i) => {
      const last = el.getBoundingClientRect();
      const dx = first[i].left - last.left;
      const dy = first[i].top - last.top;
      if (dx || dy) {
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = '';
          el.style.transform = '';
        });
      }
    });
  }
})();

/* keyboard reorder for list rows — ↑ / ↓ on a focused grip moves that creator one rank
   and keeps focus on it, so you can walk someone up or down the list */
$('grid').addEventListener('keydown', e => {
  const grip = e.target.closest('.grip');
  if (!grip || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  const i = +grip.closest('.tile').dataset.i, j = i + (e.key === 'ArrowUp' ? -1 : 1);
  if (j < 0 || j >= creators.length) return;
  [creators[i], creators[j]] = [creators[j], creators[i]];
  renderAll();
  const next = $('grid').querySelector(`.tile[data-i="${j}"] .grip`); if (next) next.focus();
});

window.addEventListener('resize', () => layoutNums());
