import { $ } from './dom.js';
import { drawAvatar } from './avatar.js';
import { creators, full, displayOrder, lastHash, gardenSize, gardenCols, isWhale } from './state.js';

/* load an avatar for canvas use — crossOrigin so a clean load stays exportable. Some
   hosts (incl. a few TTCrowd campaign logos) send no CORS headers, which fails the
   crossOrigin load and would taint the canvas / break the card export. On that failure
   we retry once through a CORS-adding image proxy, then fall back to the identicon. A
   plain <img> in the grid has none of this constraint, which is why it shows there. */
function loadImg(url) {
  return new Promise(res => {
    if (!url) return res(null);
    const attempt = (src, next) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = next; im.src = src; };
    attempt(url, () => attempt('https://wsrv.nl/?url=' + encodeURIComponent(url) + '&output=png', () => res(null)));
  });
}
function drawImgCover(ctx, img, x, y, size) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return false;
  const scale = Math.max(size / iw, size / ih), dw = iw * scale, dh = ih * scale;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  try { ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh); } catch (e) { ctx.restore(); return false; }
  ctx.restore(); return true;
}
/* avatar size, column gap and name length per garden — nine keeps the original card
   layout exactly; four goes bigger, twelve tighter. The block is centred vertically
   in the same band nine fills (y 190 → ~982). */
const CARD = { 4: { av: 300, gap: 60, chars: 20 }, 6: { av: 250, gap: 50, chars: 18 }, 9: { av: 210, gap: 40, chars: 15 }, 12: { av: 170, gap: 36, chars: 12 } };
const NAME_ROW = 54, BAND = 792;
function drawGarden(order, imgs) {
  const cv = $('gardenCanvas'); if (!cv) return; const ctx = cv.getContext('2d'), S = 1080, cs = getComputedStyle(document.documentElement);
  const bg = (cs.getPropertyValue('--panel') || '#fff').trim(), ink = (cs.getPropertyValue('--ink') || '#111').trim(), sub = (cs.getPropertyValue('--muted') || '#777').trim(), line = (cs.getPropertyValue('--line') || '#ccc').trim();
  ctx.clearRect(0, 0, S, S); ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.strokeRect(14, 14, S - 28, S - 28);
  ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.font = '600 58px "SF Mono", Menlo, monospace'; ctx.fillText('MY GARDEN', 66, 106);
  ctx.font = '22px "SF Mono", Menlo, monospace'; ctx.fillStyle = sub; ctx.fillText('WATERED WITH ' + (Math.max(0, +$('amount').value || 0)) + ' XTZ', 68, 144);
  if (!full()) return;
  if (isWhale()) drawWhale(ctx, S, order, imgs, ink, sub, line);
  else drawGrid(ctx, S, order, imgs, ink);
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(66, 996); ctx.lineTo(S - 66, 996); ctx.stroke();
  ctx.fillStyle = sub; ctx.font = '18px "SF Mono", Menlo, monospace'; ctx.textAlign = 'left'; ctx.fillText('TX ' + (lastHash ? lastHash.slice(0, 12) + '…' + lastHash.slice(-6) : '—'), 66, 1032); ctx.textAlign = 'right'; ctx.fillText('MADE WITH SPRINKLER', S - 66, 1032); ctx.textAlign = 'left';
}
function drawGrid(ctx, S, order, imgs, ink) {
  const size = gardenSize(), cols = gardenCols(size), rows = Math.ceil(size / cols), L = CARD[size] || CARD[9];
  const av = L.av, colGap = L.gap, rowStride = av + NAME_ROW;
  const startX = (S - (av * cols + colGap * (cols - 1))) / 2, startY = 190 + Math.max(0, (BAND - rows * rowStride) / 2);
  order.forEach((origIdx, i) => { const c = creators[origIdx]; const col = i % cols, row = Math.floor(i / cols), x = startX + col * (av + colGap), y = startY + row * rowStride; const img = imgs && imgs[i]; if (!(img && drawImgCover(ctx, img, x, y, av))) drawAvatar(ctx, c.id, x, y, av); ctx.fillStyle = ink; ctx.font = '600 22px "SF Mono", Menlo, monospace'; ctx.textAlign = 'center'; let nm = c.name; if (nm.length > L.chars) nm = nm.slice(0, L.chars - 1) + '…'; ctx.fillText(nm, x + av / 2, y + av + 30); });
}
/* whale card: too many people for a grid of faces, so the head count is the hero —
   a big number, then a strip of the first STRIP avatars and a "+N" tile for the rest */
const STRIP = 8;
function drawWhale(ctx, S, order, imgs, ink, sub, line) {
  const n = order.length;
  ctx.textAlign = 'center'; ctx.fillStyle = ink;
  ctx.font = '600 260px "SF Mono", Menlo, monospace'; ctx.fillText(String(n), S / 2, 560);
  ctx.fillStyle = sub; ctx.font = '600 34px "SF Mono", Menlo, monospace'; ctx.fillText('C R E A T O R S', S / 2, 630);
  const av = 88, gap = 14, slots = STRIP + 1, startX = (S - (av * slots + gap * (slots - 1))) / 2, y = 740;
  order.slice(0, STRIP).forEach((origIdx, i) => { const x = startX + i * (av + gap); const img = imgs && imgs[i]; if (!(img && drawImgCover(ctx, img, x, y, av))) drawAvatar(ctx, creators[origIdx].id, x, y, av); });
  const rx = startX + STRIP * (av + gap);
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.strokeRect(rx + 1, y + 1, av - 2, av - 2);
  ctx.fillStyle = ink; ctx.font = '600 26px "SF Mono", Menlo, monospace'; ctx.fillText('+' + (n - STRIP), rx + av / 2, y + av / 2 + 9);
  ctx.textAlign = 'left';
}
export function renderGarden() {
  const order = displayOrder();
  drawGarden(order, null);                                                    // instant identicons
  // upgrade to real avatars — only the ones the card actually shows
  const shown = isWhale() ? order.slice(0, STRIP) : order;
  if (full()) Promise.all(shown.map(oi => loadImg(creators[oi].avatar))).then(imgs => drawGarden(order, imgs));
}
