import { $ } from './dom.js';
import { avatarSVG } from './avatar.js';
import { creators, makeCreator, full } from './state.js';
import { ipfsURL, searchAll, enrichCreator, ttcrowdSearch, ttcrowdBrowse, ttcrowdResolve } from './api.js';
import { renderAll } from './grid.js';
import { escapeHTML } from './escape.js';

/* search — live objkt + hack.tez + teztree lookup, plus direct address / .tez entry */
let searchTimer = null, searchSeq = 0;

// rowManual/rowDup render `q`/`c.name` before any external profile lookup has
// run — `c` here always comes straight from makeCreator(q), whose isAddr/isName
// regexes already constrain the character set, so escaping is just cheap
// consistency, not the load-bearing defense. rowFound is the real boundary:
// m.name/m.logo/m.meta/m.address are live values from objkt/hack.tez/Teztree,
// each a public directory anyone can put arbitrary text into. See
// SECURITY_AUDIT.md finding #1.
function rowManual(q, c) { return `<div class="ritem" data-manual="${escapeHTML(q)}"><img class="av" src="${avatarSVG(q)}" alt=""><div class="info"><div class="rn">add ${escapeHTML(c.name)}</div><div class="rs">${c._isAddr ? 'tezos address' : '.tez name'}</div></div></div>`; }
function rowDup(q, c) { return `<div class="ritem" style="cursor:default"><img class="av" src="${avatarSVG(q)}" alt=""><div class="info"><div class="rn">${escapeHTML(c.name)}</div><div class="rs" style="color:var(--dim)">already in your nine</div></div></div>`; }
function rowFound(m) { const short = m.address.slice(0, 8) + '…' + m.address.slice(-4); const sub = [short, m.src, m.meta].filter(Boolean).join(' · '); return `<div class="ritem" data-addr="${escapeHTML(m.address)}" data-name="${escapeHTML(m.name || '')}" data-logo="${escapeHTML(m.logo || '')}"><img class="av" src="${escapeHTML(m.logo ? ipfsURL(m.logo) : avatarSVG(m.address))}" alt=""><div class="info"><div class="rn">${escapeHTML(m.name)}</div><div class="rs">${escapeHTML(sub)}</div></div></div>`; }
function rowNote(t) { return `<div class="ritem" style="cursor:default"><div class="info"><div class="rn" style="color:var(--dim)">${escapeHTML(t)}</div></div></div>`; }
// TTCrowd campaign row — carries a slug (no wallet yet); the address resolves on add.
// title/tagline/logo are live values from a public directory, so escape them.
function rowCampaign(m) { const img = m.logo ? escapeHTML(m.logo) : avatarSVG(m.slug); const sub = ['TTCrowd', m.meta].filter(Boolean).join(' · '); return `<div class="ritem" data-slug="${escapeHTML(m.slug)}" data-name="${escapeHTML(m.name || '')}" data-logo="${escapeHTML(m.logo || '')}"><img class="av" src="${img}" alt=""><div class="info"><div class="rn">${escapeHTML(m.name)}</div><div class="rs">${escapeHTML(sub)}</div></div></div>`; }
function wireResults(box) {
  box.querySelectorAll('.ritem[data-manual]').forEach(el => el.onclick = () => { addCreator(el.dataset.manual); clearSearch(); });
  box.querySelectorAll('.ritem[data-addr]').forEach(el => el.onclick = () => { addFound(el.dataset.addr, el.dataset.name, el.dataset.logo); clearSearch(); });
  box.querySelectorAll('.ritem[data-slug]').forEach(el => el.onclick = () => { addCampaign(el.dataset.slug, el.dataset.name, el.dataset.logo); clearSearch(); });
  // JS avatar fallback (CSP blocks inline onerror) — rowFound + rowCampaign rows have a remote src
  box.querySelectorAll('.ritem[data-addr] img.av').forEach(img => { const seed = img.closest('.ritem').dataset.addr; img.onerror = () => { img.onerror = null; img.src = avatarSVG(seed); }; });
  box.querySelectorAll('.ritem[data-slug] img.av').forEach(img => { const seed = img.closest('.ritem').dataset.slug; img.onerror = () => { img.onerror = null; img.src = avatarSVG(seed); }; });
}
function renderResults(q) {
  const box = $('results'); q = q.trim();
  if (!q) { box.classList.remove('show'); box.innerHTML = ''; return; }
  const c = makeCreator(q);
  const head = c ? (creators.some(x => x.id === c.id) ? rowDup(q, c) : rowManual(q, c)) : '';
  box.innerHTML = head + rowNote('searching…'); box.classList.add('show'); wireResults(box);
  clearTimeout(searchTimer);
  const seq = ++searchSeq;
  searchTimer = setTimeout(async () => {
    const [mRes, cRes] = await Promise.allSettled([searchAll(q), ttcrowdSearch(q)]);
    if (seq !== searchSeq) return;
    const matches = mRes.status === 'fulfilled' ? mRes.value : [];
    const camps = cRes.status === 'fulfilled' ? cRes.value : [];
    const live = matches.filter(m => !creators.some(x => x.addr === m.address)).slice(0, 8).map(rowFound).join('');
    const campRows = camps.map(rowCampaign).join('');
    let html = head + live + campRows;
    if (!html) html = rowNote('no matches — paste a tz1… or a .tez name');
    box.innerHTML = html; box.classList.add('show'); wireResults(box);
  }, 250);
}
function addFound(addr, name, logo) {
  $('addErr').textContent = '';
  if (full()) { $('addErr').textContent = "that's nine — that's the whole point"; return; }
  const c = makeCreator(addr); if (!c) return;
  if (name) { c.name = name; c._named = true; }
  if (logo) c.avatar = ipfsURL(logo);
  if (creators.some(x => x.id === c.id)) { $('addErr').textContent = 'already in your nine'; return; }
  creators.push(c); renderAll(); enrichCreator(c);
}
function clearSearch() { $('search').value = ''; $('results').classList.remove('show'); $('results').innerHTML = ''; }
// add a TTCrowd campaign: resolve its wallet (missing from the list), then add like a named pick
async function addCampaign(slug, name, logo) {
  $('addErr').textContent = '';
  if (full()) { $('addErr').textContent = "that's nine — that's the whole point"; return; }
  let info = null;
  try { info = await ttcrowdResolve(slug); } catch (e) { }
  if (!info || !info.address) { $('addErr').textContent = "couldn't load that campaign"; return; }
  if (info.closed) { $('addErr').textContent = "that campaign isn't taking donations right now"; return; }
  const c = makeCreator(info.address); if (!c) { $('addErr').textContent = 'that campaign wallet looks invalid'; return; }
  c.name = name || slug; c._named = true;
  const av = info.avatar || logo; if (av) c.avatar = av;
  if (creators.some(x => x.id === c.id)) { $('addErr').textContent = 'already in your nine'; return; }
  creators.push(c); renderAll(); enrichCreator(c);
}
// browse: drop all active campaigns straight into the results list
async function browseCampaigns() {
  const box = $('results');
  box.innerHTML = rowNote('loading campaigns…'); box.classList.add('show');
  let camps = [];
  try { camps = await ttcrowdBrowse(); } catch (e) { }
  box.innerHTML = camps.map(rowCampaign).join('') || rowNote('no active campaigns right now');
  box.classList.add('show'); wireResults(box);
}
function addCreator(v) { $('addErr').textContent = ''; if (full()) { $('addErr').textContent = "that's nine — that's the whole point"; return; } const c = makeCreator(v); if (!c) { $('addErr').textContent = "not a tz address or a .tez name"; return; } if (creators.some(x => x.id === c.id)) { $('addErr').textContent = 'already in your nine'; return; } creators.push(c); renderAll(); enrichCreator(c); }
/* paste a whole list at once — newline / comma / space / semicolon separated.
   Also the ?to= prefill path in main.js, so a link gets exactly the same
   validation, dedupe and nine-cap as a paste. */
export function addMany(text) {
  const tokens = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  let added = 0, dup = 0, bad = 0, over = 0;
  for (const tok of tokens) {
    if (full()) { over++; continue; }
    const c = makeCreator(tok);
    if (!c) { bad++; continue; }
    if (creators.some(x => x.id === c.id)) { dup++; continue; }
    creators.push(c); enrichCreator(c); added++;
  }
  renderAll();
  const bits = [];
  if (added) bits.push(`added ${added}`);
  if (dup) bits.push(`${dup} already in`);
  if (bad) bits.push(`${bad} not valid`);
  if (over) bits.push(`${over} over the nine`);
  $('addErr').textContent = bits.join(' · ');
  clearSearch();
}

$('search').addEventListener('input', e => renderResults(e.target.value));
if ($('browseCampaigns')) $('browseCampaigns').addEventListener('click', browseCampaigns);
$('search').addEventListener('paste', e => {
  const text = ((e.clipboardData || window.clipboardData) && (e.clipboardData || window.clipboardData).getData('text')) || '';
  const tokens = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  if (tokens.length > 1) { e.preventDefault(); addMany(text); }
});
$('search').addEventListener('keydown', e => { if (e.key === 'Enter') { const first = $('results').querySelector('.ritem[data-h],.ritem[data-manual]'); if (first) first.click(); } if (e.key === 'Escape') clearSearch(); });
document.addEventListener('click', e => { if (!e.target.closest('.searchwrap')) $('results').classList.remove('show'); });
