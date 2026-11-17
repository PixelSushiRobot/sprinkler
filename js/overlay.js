import { $ } from './dom.js';
import { avatarSVG } from './avatar.js';
import { NETS, payNet, getPayNetKey, setPayNetKey } from './config.js';
import { creators, full, computeSplit, setLastHash, countWord } from './state.js';
import { renderGarden } from './garden.js';
import { escapeHTML } from './escape.js';
import { wireSave } from './lists.js';
import { shareURL, copyShareLink } from './grid.js';
import * as wallet from './wallet.js';

/* overlay flow */
// share text carries the real head count; set once per sprinkle, read by every share button
let shareText = '';
const shareTextFor = n => n + (n === 1 ? ' creator' : ' creators') + '. 1 pot. zero spreadsheets. 🌱';
/* each post = tagline + the garden link, so whoever sees it can open the same garden.
   X counts any link as 23 chars, so it always gets the garden link; Bluesky (300 chars)
   and Farcaster (320 bytes) count the whole URL, so a long raw-wallet list falls back
   to the homepage there */
const HOME = 'sprinkler.psr.fyi';
function postText(platform) {
  const full = shareText + '\n' + shareURL(), home = shareText + '\n' + HOME;
  if (platform === 'bs') return [...full].length <= 300 ? full : home;
  if (platform === 'fc') return new TextEncoder().encode(full).length <= 320 ? full : home;
  return full;
}
function renderNetLabel() {
  const n = payNet(), el = document.getElementById('netLabel');
  if (el) el.textContent = n.testnet ? 'try it: real search · test payouts on ' + n.networkName : 'live on Tezos mainnet';
  document.querySelectorAll('#netTog button').forEach(b => b.classList.toggle('on', b.dataset.net === getPayNetKey()));
}
// switch the payout network at runtime — rebuilds the wallet client and drops any session
async function setPayNet(key) {
  if (!NETS[key] || key === getPayNetKey()) return;
  setPayNetKey(key);
  walletAddr = null;
  try { await wallet.setNetwork(key); } catch (e) { }
  renderNetLabel(); renderWalletState();
}
let walletAddr = null;

const shortAddr = a => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
function recipientsReady() { return full() && creators.every(c => c.addr && !c._loading && !c._err); }
export function syncConfirmReady() { if ($('overlay').classList.contains('show')) renderWalletState(); }

function renderWalletState() {
  const ready = recipientsReady(), note = $('confirmNote');
  // KT1 = smart contract; a mainnet contract isn't originated on a testnet, so a
  // test payout to it fails simulation before signing. Catch it here with a clear msg.
  const badKT = payNet().testnet ? creators.find(c => c.addr && c.addr.startsWith('KT1')) : null;
  const ktNote = 'Contract (KT1) addresses only exist on mainnet — switch to Mainnet to send here, or remove it to test on ' + payNet().networkName + '.';
  if (walletAddr) {
    $('walletK').textContent = 'From';
    $('walletVal').textContent = shortAddr(walletAddr);
    $('confirmBtn').disabled = !ready || !!badKT;
    note.textContent = badKT ? ktNote
      : ready ? (payNet().testnet ? 'Faucet XTZ only. Sprinkle freely.' : 'Your wallet signs. Your XTZ stays yours.')
        : creators.some(c => c._err) ? 'Remove the flagged recipient to continue.'
          : 'Resolving addresses — one moment.';
  } else {
    $('walletK').textContent = 'Wallet';
    $('walletVal').innerHTML = '<button class="btn ghost wc-btn" id="connectBtn">connect wallet</button>';
    $('connectBtn').onclick = doConnect;
    $('confirmBtn').disabled = true;
    note.textContent = badKT ? ktNote : 'Connect a Tezos wallet to sprinkle.';
  }
}

async function doConnect() {
  const btn = $('connectBtn'); if (btn) { btn.disabled = true; btn.textContent = 'connecting…'; }
  try {
    if (!(await wallet.walletReady())) throw new Error(wallet.walletLoadError() || 'wallet library did not load');
    walletAddr = await wallet.connect();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'connect wallet'; }
    const m = (e && e.message) || '';
    console.error('[sprinkler] connect failed:', e);
    if (/load|unavailable|library/i.test(m)) $('sprinkleErr').textContent = "wallet library didn't load — hard-refresh and try again";
    else if (e && (e.errorType === 'ABORTED_ERROR' || /abort|cancel|closed the modal/i.test(m))) $('sprinkleErr').textContent = 'connection cancelled — try again';
    else $('sprinkleErr').textContent = 'wallet error: ' + (m || 'unknown — see console');
    return;
  }
  $('sprinkleErr').textContent = '';
  renderWalletState();
}

function openOverlay() {
  if (!full()) return;
  const pot = Math.max(0, +$('amount').value || 0), split = computeSplit();
  $('sprinkleErr').textContent = '';
  renderWalletState();
  $('rcptAmt').textContent = pot + ' XTZ';
  $('rcptAcross').textContent = creators.length + ' creators · one transaction';
  $('confirmBtn').textContent = 'sprinkle ' + pot + ' XTZ';
  const idx = creators.map((c, i) => i);
  const maxPc = Math.max(...split, 0.0001);
  let rows = ''; idx.forEach(i => { const c = creators[i]; const short = shortAddr(c.addr); const addrLine = (c.name && c.name !== short) ? `<span class="rcpt-addr">${escapeHTML(short)}</span>` : ''; rows += `<tr><td><img class="av" src="${escapeHTML(c.avatar || avatarSVG(c.id))}" alt=""><div class="rcpt-who"><span class="rcpt-name">${escapeHTML(c.name)}</span>${addrLine}</div></td><td class="bar-cell"><div class="rbar"><i style="width:${(split[i] / maxPc * 100).toFixed(1)}%"></i></div></td><td>${(pot * split[i] / 100).toFixed(2)} XTZ</td></tr>`; });
  $('confirmTable').innerHTML = rows;
  // JS avatar fallback (CSP blocks inline onerror); imgs render in idx order
  [...$('confirmTable').querySelectorAll('img.av')].forEach((img, k) => { const c = creators[idx[k]]; img.onerror = () => { img.onerror = null; img.src = avatarSVG(c.id); }; });
  $('confirmTable').parentElement.scrollTop = 0;
  confirmWarnings(pot, split);
  $('confirmPane').style.display = ''; $('successPane').style.display = 'none';
  $('overlay').classList.add('show');
  // move focus into the dialog — the primary action if it's live, else the first control
  setTimeout(() => { const f = focusables(); const pref = f.find(el => el.id === 'connectBtn') || f.find(el => el.id === 'confirmBtn' && !el.disabled) || f[0]; if (pref) pref.focus(); }, 0);
}

/* advisory notes under the recipient table. Neither blocks sending:
   - an address that never resolved to any name is the one most worth eyeballing,
     especially in a big pasted list (a swapped address looks exactly like this)
   - a big list over a small pot can leave shares too small to be worth the fee */
function confirmWarnings(pot, split) {
  const el = $('confirmWarn'), bits = [];
  const unnamed = creators.filter(c => c.addr && c.name === shortAddr(c.addr)).length;
  if (unnamed) bits.push(`[!] ${unnamed} ${unnamed === 1 ? 'recipient has' : 'recipients have'} no name — double-check ${unnamed === 1 ? 'that address' : 'those addresses'}.`);
  const least = pot * Math.min(...split) / 100;
  if (pot > 0 && least < 0.1) bits.push(`[!] smallest share is ${least.toFixed(2)} XTZ.`);
  el.textContent = bits.join(' ');
  el.style.display = bits.length ? '' : 'none';
}

/* split the pot into exact-summing mutez amounts (no dust, no rounding drift) */
function payoutMutez(pot, split) {
  const total = Math.round(pot * 1e6);
  const raw = split.map(pc => Math.floor(total * pc / 100));
  let rem = total - raw.reduce((a, b) => a + b, 0);
  const order = split.map((pc, i) => i).sort((a, b) => split[b] - split[a]);
  for (let k = 0; rem > 0; k++, rem--) raw[order[k % raw.length]] += 1;
  return raw;
}

async function doSprinkle() {
  if (!recipientsReady() || !walletAddr) return;
  if (payNet().testnet && creators.some(c => c.addr && c.addr.startsWith('KT1'))) { renderWalletState(); return; }
  const pot = Math.max(0, +$('amount').value || 0), split = computeSplit();
  const amounts = payoutMutez(pot, split);
  const recipients = creators.map((c, i) => ({ addr: c.addr, mutez: amounts[i] }));
  const btn = $('confirmBtn'), label = btn.textContent;
  btn.disabled = true; btn.textContent = 'confirm in your wallet…'; $('sprinkleErr').textContent = '';
  let hash;
  try { hash = await wallet.sprinkle(recipients); }
  catch (e) {
    btn.disabled = false; btn.textContent = label;
    const m = (e && e.message) || '';
    $('sprinkleErr').textContent = /abort|reject|cancel/i.test(m) ? 'you cancelled the transaction' : 'transaction failed — check your balance and try again';
    return;
  }
  setLastHash(hash);
  shareText = shareTextFor(creators.length);
  $('successLead').textContent = pot + ' XTZ, sprinkled across ' + countWord() + (creators.length === 1 ? ' creator.' : ' creators.');
  $('txLink').href = payNet().explorer + '/' + hash;
  $('confirmPane').style.display = 'none'; $('successPane').style.display = '';
  saveAfter.reset();
  setCardHint();
  renderGarden();
  $('shareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(postText('x'));
  $('shareFc').href = 'https://farcaster.xyz/~/compose?text=' + encodeURIComponent(postText('fc'));
  $('shareBs').href = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(postText('bs'));
}
function closeOverlay() { $('overlay').classList.remove('show'); const b = $('sprinkleBtn'); if (b) b.focus(); }
/* focus trap helpers — only visible, enabled controls inside the dialog count
   (the hidden pane's buttons have no offsetParent, so they're excluded) */
function focusables() { return [...$('overlay').querySelectorAll('button,a[href],input,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null && !el.disabled); }
$('sprinkleBtn').onclick = openOverlay;
$('confirmBtn').onclick = doSprinkle;
// list actions live in the success footer: "save as list" swaps the footer for the name
// field; "copy list link" copies the same ?to= link as the one under "sprinkle it"
const saveAfter = wireSave({ btn: $('saveAfterBtn'), hide: $('shareFoot'), pane: $('saveAfter'), input: $('saveAfterName'), ok: $('saveAfterOk'), cancel: $('saveAfterCancel') });
$('copyListAfter').addEventListener('click', () => copyShareLink($('copyListAfter'), 'copy list link'));
wallet.walletReady().then(async ok => { try { if (ok) { walletAddr = await wallet.getActive(); syncConfirmReady(); } } catch (e) { } });
window.addEventListener('tez-account', e => { walletAddr = e.detail || null; syncConfirmReady(); });
$('ovClose').onclick = closeOverlay;
document.querySelectorAll('#netTog button').forEach(b => b.onclick = () => setPayNet(b.dataset.net));
renderNetLabel();
/* the payout network toggle is a hidden setting — Mainnet is the default and the
   Network row stays out of the confirm dialog until you press "t" (a testing
   affordance for switching to Shadownet). Ignored while typing in a field. */
let netShown = false;
function applyNetRow() { const r = $('netRow'); if (r) r.style.display = netShown ? '' : 'none'; }
applyNetRow();
document.addEventListener('keydown', e => {
  if ((e.key !== 't' && e.key !== 'T') || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  netShown = !netShown; applyNetRow();
});
$('overlay').addEventListener('click', e => { if (e.target === $('overlay')) closeOverlay(); });
// Esc closes; Tab cycles within the dialog so focus never escapes behind the overlay
$('overlay').addEventListener('keydown', e => {
  if (!$('overlay').classList.contains('show')) return;
  if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); return; }
  if (e.key !== 'Tab') return;
  const f = focusables(); if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
$('dlBtn').onclick = () => { try { const a = document.createElement('a'); a.download = 'my-garden.png'; a.href = $('gardenCanvas').toDataURL('image/png'); a.click(); } catch (e) { console.error('[sprinkler] card export failed (tainted canvas?):', e); $('sprinkleErr').textContent = "couldn't export the card — try again"; } };

/* two separate abilities, checked separately:
   - shareFiles: the system share sheet can take the PNG (mostly phones) → "Share card"
   - copyImage: the clipboard can take a PNG (desktop browsers) → the social buttons copy
     the card as they open the post, and the caption under the card says so.
   Phones post the image through the share sheet (pasting there is clumsy), so where
   both exist, Share card wins and nothing is copied automatically. */
const CAN = {
  shareFiles: (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] })); } catch (e) { return false; } })(),
  copyImage: !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem),
};
const autoCopy = CAN.copyImage && !CAN.shareFiles;

/* the card's PNG, snapshotted every time the card is drawn — Safari only allows the
   clipboard write if it starts inside the click, so the image has to be ready (or at
   least promised) before the click, not built after it */
let cardBlob = null, cardBlobP = null;
window.addEventListener('sprinkler:card', () => {
  cardBlob = null;
  cardBlobP = new Promise(res => { try { $('gardenCanvas').toBlob(b => { cardBlob = b; res(b); }, 'image/png'); } catch (e) { res(null); } });
});

const HINT = 'Sharing copies this card. Paste it into your post.';
const PASTE = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V';
function setCardHint(state) {
  const h = $('cardHint'); clearTimeout(h._t); h.className = 'cardcap';
  if (!state) { h.textContent = autoCopy ? HINT : ''; return; }
  h.classList.add(state);
  h.textContent = state === 'ok' ? `Card copied. Paste it into your post (${PASTE}).` : "Couldn't copy the card. Download it instead.";
  h._t = setTimeout(() => setCardHint(), 8000);
}
/* started synchronously in the click; the post opens through the link's own target=_blank
   navigation in that same click and never waits on this. Only says "copied" once the
   write has actually resolved (the user mostly sees it on coming back to the tab). */
function copyCardForPost() {
  if (!autoCopy) return;
  try {
    const item = new ClipboardItem({ 'image/png': cardBlob || cardBlobP.then(b => b || Promise.reject(new Error('no card image'))) });
    navigator.clipboard.write([item]).then(() => setCardHint('ok'), e => { console.warn('[sprinkler] card copy failed:', e); setCardHint('bad'); });
  } catch (e) { console.warn('[sprinkler] card copy failed:', e); setCardHint('bad'); }
}
['shareX', 'shareFc', 'shareBs'].forEach(id => $(id).addEventListener('click', copyCardForPost));

/* native share sheet WITH the card image — where it exists, the one-tap way to post the
   actual PNG. Hidden where the browser can't share files. */
async function shareCard() {
  const blob = cardBlob || (cardBlobP && await cardBlobP);
  if (!blob) { $('sprinkleErr').textContent = "couldn't build the card image"; return; }
  const file = new File([blob], 'my-garden.png', { type: 'image/png' });
  if (!(navigator.canShare && navigator.canShare({ files: [file] }))) { $('sprinkleErr').textContent = 'image sharing isn’t supported here — use ↓ Download card'; return; }
  try { await navigator.share({ files: [file], text: postText('x') }); } catch (e) { /* user dismissed the sheet */ }
}
if (CAN.shareFiles) { $('shareImg').hidden = false; $('shareImg').onclick = shareCard; }
