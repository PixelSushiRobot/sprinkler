import { $ } from './dom.js';
import { avatarSVG } from './avatar.js';
import { creators, method, yoloLevel, METHODS, setMethod, setYoloLevel, rollYolo, full, computeSplit, displayOrder } from './state.js';

const DICE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>';
function renderMethods() {
  const m = $('methodbar'); m.innerHTML = '';
  METHODS.forEach(mt => { const b = document.createElement('button'); b.className = 'mrow' + (method === mt.k ? ' sel' : ''); b.innerHTML = `<span>${mt.n}</span><span class="mtag">${mt.t}</span>`; b.onclick = () => { setMethod(mt.k); if (mt.k === 'yolo') rollYolo(); renderAll(); }; m.appendChild(b); });
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
export function renderGrid() {
  const g = $('grid'); g.innerHTML = '';
  const pot = Math.max(0, +$('amount').value || 0);
  const on = full(), split = on ? computeSplit() : [];
  const maxPc = on ? Math.max(...split, 0.0001) : 1;
  const order = displayOrder();
  order.forEach((origIdx, pos) => {
    const c = creators[origIdx];
    const t = document.createElement('div'); t.className = 'tile'; t.draggable = false; t.dataset.i = origIdx;
    const fillH = on ? (split[origIdx] / maxPc * 100).toFixed(1) : 0;

    let crownHtml = '';
    let numHtml = '';
    if (on) {
      const pc = split[origIdx];
      const win = method === 'yolo' && yoloLevel === 'jackpot' && c._isJackpotWinner;
      if (win) {
        crownHtml = `<div class="crown" title="Jackpot Winner"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg></div>`;
      }
      numHtml = `<div class="num"><span class="tz">${(pot * pc / 100).toFixed(1)} XTZ</span></div>`;
    }

    const statusHtml = c._loading ? '<div class="nm-sub">resolving…</div>' : (c._err ? '<div class="nm-sub err">' + c._err + '</div>' : '');
    t.innerHTML = `<div class="tilefill" style="height:${fillH}%"></div>${crownHtml}<button class="x" title="remove">×</button><img class="av" src="${c.avatar || avatarSVG(c.id)}" onerror="this.onerror=null;this.src='${avatarSVG(c.id)}'" alt=""><div class="nm">${c.name}</div>${statusHtml}${numHtml}`;
    t.dataset.id = c.id;
    t.querySelector('.x').onclick = e => { e.stopPropagation(); creators.splice(origIdx, 1); renderAll(); };
    g.appendChild(t);
  });
  for (let k = creators.length; k < 9; k++) { const s = document.createElement('div'); s.className = 'eslot'; s.textContent = '+'; g.appendChild(s); }
  $('count').textContent = creators.length + ' / 9';
  $('sprinkleBtn').disabled = !on;
  $('splitfoot').textContent = on ? `${pot} XTZ across nine · one transaction` : `plant ${9 - creators.length} more`;
  layoutNums();
}
function layoutNums() {
  const wrap = document.querySelector('.gridwrap'), nl = $('numlayer'); if (!wrap || !nl) return;
  nl.innerHTML = '';
  if (!full() || method !== 'boss') return;
  const wr = wrap.getBoundingClientRect();
  [...$('grid').querySelectorAll('.tile')].forEach((t, i) => { const r = t.getBoundingClientRect(); const s = document.createElement('span'); s.className = 'slotnum'; s.textContent = i + 1; s.style.left = (r.left - wr.left + 6) + 'px'; s.style.top = (r.top - wr.top + 6) + 'px'; nl.appendChild(s); });
}
export function renderAll() { renderMethods(); renderGrid(); }

$('amount').addEventListener('input', renderGrid);

/* Photos-style Drag and Drop */
(function () {
  const grid = $('grid');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let active = null, placeholder = null, grabX = 0, grabY = 0;

  grid.addEventListener('pointerdown', e => {
    if (e.target.closest('.x')) return;
    const tile = e.target.closest('.tile');
    if (!tile) return;
    e.preventDefault();
    active = tile;

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

    const cs = getComputedStyle(grid);
    const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length || 3;
    const gap = parseFloat(cs.columnGap || cs.gap) || 10;
    const rect = grid.getBoundingClientRect();
    const colW = (rect.width - gap * (cols - 1)) / cols;
    const tileH = (placeholder || {}).offsetHeight || 172;
    const stepX = colW + gap, stepY = tileH + gap;

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

    if (!active || !placeholder) return;

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

      active = placeholder = null;
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

window.addEventListener('resize', () => layoutNums());
