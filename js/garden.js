import { $ } from './dom.js';
import { drawAvatar } from './avatar.js';
import { creators, full, displayOrder, lastHash } from './state.js';

/* load an avatar for canvas use — crossOrigin so a clean load stays exportable,
   and a CORS/404 failure resolves null (→ identicon) without tainting the canvas */
function loadImg(url) { return new Promise(res => { if (!url) return res(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }
function drawImgCover(ctx, img, x, y, size) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return false;
  const scale = Math.max(size / iw, size / ih), dw = iw * scale, dh = ih * scale;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  try { ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh); } catch (e) { ctx.restore(); return false; }
  ctx.restore(); return true;
}
function drawGarden(order, imgs) {
  const cv = $('gardenCanvas'); if (!cv) return; const ctx = cv.getContext('2d'), S = 1080, cs = getComputedStyle(document.documentElement);
  const bg = (cs.getPropertyValue('--box') || '#fff').trim(), ink = (cs.getPropertyValue('--ink') || '#111').trim(), sub = (cs.getPropertyValue('--muted') || '#777').trim(), line = (cs.getPropertyValue('--line') || '#ccc').trim();
  ctx.clearRect(0, 0, S, S); ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.strokeRect(14, 14, S - 28, S - 28);
  ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.font = '600 58px "SF Mono", Menlo, monospace'; ctx.fillText('MY GARDEN', 66, 106);
  ctx.font = '22px "SF Mono", Menlo, monospace'; ctx.fillStyle = sub; ctx.fillText('WATERED WITH ' + (Math.max(0, +$('amount').value || 0)) + ' XTZ', 68, 144);
  if (!full()) return;
  const av = 210, colGap = 40, rowStride = 264, startX = (S - (av * 3 + colGap * 2)) / 2, startY = 190;
  order.forEach((origIdx, i) => { const c = creators[origIdx]; const col = i % 3, row = Math.floor(i / 3), x = startX + col * (av + colGap), y = startY + row * rowStride; const img = imgs && imgs[i]; if (!(img && drawImgCover(ctx, img, x, y, av))) drawAvatar(ctx, c.id, x, y, av); ctx.fillStyle = ink; ctx.font = '600 22px "SF Mono", Menlo, monospace'; ctx.textAlign = 'center'; let nm = c.name; if (nm.length > 15) nm = nm.slice(0, 14) + '…'; ctx.fillText(nm, x + av / 2, y + av + 30); });
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(66, 996); ctx.lineTo(S - 66, 996); ctx.stroke();
  ctx.fillStyle = sub; ctx.font = '18px "SF Mono", Menlo, monospace'; ctx.textAlign = 'left'; ctx.fillText('TX ' + (lastHash ? lastHash.slice(0, 12) + '…' + lastHash.slice(-6) : '—'), 66, 1032); ctx.textAlign = 'right'; ctx.fillText('MADE WITH SPRINKLER', S - 66, 1032); ctx.textAlign = 'left';
}
export function renderGarden() {
  const order = displayOrder();
  drawGarden(order, null);                                                    // instant identicons
  if (full()) Promise.all(order.map(oi => loadImg(creators[oi].avatar))).then(imgs => drawGarden(order, imgs)); // upgrade to real avatars
}
