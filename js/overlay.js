import { $ } from './dom.js';
import { avatarSVG } from './avatar.js';
import { NETS, payNet, getPayNetKey, setPayNetKey } from './config.js';
import { creators, full, computeSplit, setLastHash } from './state.js';
import { renderGarden } from './garden.js';
import { escapeHTML } from './escape.js';
import * as wallet from './wallet.js';

/* overlay flow */
const SHARE_TEXT = '9 creators. 1 pot. zero spreadsheets. 🌱';
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
function recipientsReady() { return creators.length === 9 && creators.every(c => c.addr && !c._loading && !c._err); }
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
  $('confirmBtn').textContent = 'sprinkle ' + pot + ' XTZ';
  const idx = creators.map((c, i) => i);
  const maxPc = Math.max(...split, 0.0001);
  let rows = ''; idx.forEach(i => { const c = creators[i]; const short = shortAddr(c.addr); const addrLine = (c.name && c.name !== short) ? `<span class="rcpt-addr">${escapeHTML(short)}</span>` : ''; rows += `<tr><td><img class="av" src="${escapeHTML(c.avatar || avatarSVG(c.id))}" onerror="this.onerror=null;this.src='${avatarSVG(c.id)}'" alt=""><div class="rcpt-who"><span class="rcpt-name">${escapeHTML(c.name)}</span>${addrLine}</div></td><td class="bar-cell"><div class="rbar"><i style="width:${(split[i] / maxPc * 100).toFixed(1)}%"></i></div></td><td>${(pot * split[i] / 100).toFixed(2)} XTZ</td></tr>`; });
  $('confirmTable').innerHTML = rows;
  $('confirmPane').style.display = ''; $('successPane').style.display = 'none';
  $('overlay').classList.add('show');
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
  $('successLead').textContent = pot + ' XTZ, sprinkled across nine.';
  $('txLink').href = payNet().explorer + '/' + hash;
  $('shareText').textContent = SHARE_TEXT;
  $('confirmPane').style.display = 'none'; $('successPane').style.display = '';
  renderGarden();
  const t = encodeURIComponent(SHARE_TEXT);
  $('shareFc').href = 'https://warpcast.com/~/compose?text=' + t;
  $('shareBs').href = 'https://bsky.app/intent/compose?text=' + t;
}
function closeOverlay() { $('overlay').classList.remove('show'); }
$('sprinkleBtn').onclick = openOverlay;
$('confirmBtn').onclick = doSprinkle;
wallet.walletReady().then(async ok => { try { if (ok) { walletAddr = await wallet.getActive(); syncConfirmReady(); } } catch (e) { } });
window.addEventListener('tez-account', e => { walletAddr = e.detail || null; syncConfirmReady(); });
$('ovClose').onclick = closeOverlay;
document.querySelectorAll('#netTog button').forEach(b => b.onclick = () => setPayNet(b.dataset.net));
renderNetLabel();
$('overlay').addEventListener('click', e => { if (e.target === $('overlay')) closeOverlay(); });
$('shareX').onclick = () => window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(SHARE_TEXT), '_blank');
$('copyBtn').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(SHARE_TEXT); $('copyBtn').textContent = 'copied ✓'; setTimeout(() => $('copyBtn').textContent = 'Copy text', 1400); };
$('dlBtn').onclick = () => { try { const a = document.createElement('a'); a.download = 'my-garden.png'; a.href = $('gardenCanvas').toDataURL('image/png'); a.click(); } catch (e) { console.error('[sprinkler] card export failed (tainted canvas?):', e); $('sprinkleErr').textContent = "couldn't export the card — try again"; } };
