import { $ } from './dom.js';
import { avatarSVG } from './avatar.js';
import { creators, makeCreator, full } from './state.js';
import { ipfsURL, searchAll, enrichCreator, ttcrowdSearch, ttcrowdBrowse, ttcrowdResolve, ttcrowdStewards } from './api.js';
import { renderAll } from './grid.js';
import { escapeHTML } from './escape.js';

/* search — one combobox for everything. Empty + focused browses active TTCrowd
   campaigns; typing switches to live objkt + hack.tez + teztree lookup (plus
   campaign matches) or accepts a pasted address / .tez name directly. Fully
   keyboard-drivable: ↑/↓ move the highlight, Enter picks, Esc closes. */
let searchTimer = null, searchSeq = 0, activeIdx = -1;

// #addErr carries two kinds of message: genuine errors (brightened + a [!] marker
// via .is-error) and neutral outcome summaries ("added 5 · 1 already in"). Route
// error messages through errShow, summaries/clears through errNote.
function errShow(t) { const e = $('addErr'); e.textContent = t; e.classList.add('is-error'); }
function errNote(t) { const e = $('addErr'); e.textContent = t; e.classList.remove('is-error'); }

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
// TTCrowd campaign row — carries the payout wallet inline (data-caddr) so a pick
// adds with no extra call. title/tagline/logo are live public-directory values.
// The trailing .rlink opens the campaign's TTCrowd page instead of adding it.
function rowCampaign(m) { const img = m.logo ? escapeHTML(m.logo) : avatarSVG(m.slug); const sub = ['TTCrowd', m.meta].filter(Boolean).join(' · '); const url = 'https://crowd.thetezos.com/c/' + encodeURIComponent(m.slug); return `<div class="ritem" data-slug="${escapeHTML(m.slug)}" data-name="${escapeHTML(m.name || '')}" data-logo="${escapeHTML(m.logo || '')}" data-caddr="${escapeHTML(m.address || '')}" data-closed="${m.closed ? '1' : ''}"><img class="av" src="${img}" alt=""><div class="info"><div class="rn">${escapeHTML(m.name)}</div><div class="rs">${escapeHTML(sub)}</div></div><a class="rlink" href="${escapeHTML(url)}" target="_blank" rel="noopener" tabindex="-1" title="Open on TTCrowd" aria-label="Open ${escapeHTML(m.name || 'campaign')} on TTCrowd">↗</a></div>`; }
// group header inside the dropdown; the browse header also carries the fill action
function rowGroup(t, fill) { return `<div class="rgroup"><span>${escapeHTML(t)}</span>${fill ? '<button type="button" class="rfill" data-fill>fill all</button>' : ''}</div>`; }

/* keyboard highlight — the pickable rows are exactly the clickable ones */
function pickables(box) { return [...box.querySelectorAll('.ritem[data-manual],.ritem[data-addr],.ritem[data-slug]')]; }
function resetActive(box) {
  activeIdx = -1;
  const inp = $('search');
  inp.setAttribute('aria-expanded', box.classList.contains('show') ? 'true' : 'false');
  inp.removeAttribute('aria-activedescendant');
  pickables(box).forEach((el, i) => { el.id = 'sopt-' + i; el.setAttribute('role', 'option'); });
}
function setActive(box, i) {
  const list = pickables(box); if (!list.length) return;
  activeIdx = Math.max(0, Math.min(list.length - 1, i));
  list.forEach((el, k) => el.classList.toggle('active', k === activeIdx));
  const el = list[activeIdx]; el.scrollIntoView({ block: 'nearest' });
  $('search').setAttribute('aria-activedescendant', el.id);
}

function wireResults(box) {
  box.querySelectorAll('.ritem[data-manual]').forEach(el => el.onclick = () => { addCreator(el.dataset.manual); clearSearch(); });
  box.querySelectorAll('.ritem[data-addr]').forEach(el => el.onclick = () => { addFound(el.dataset.addr, el.dataset.name, el.dataset.logo); clearSearch(); });
  box.querySelectorAll('.ritem[data-slug]').forEach(el => el.onclick = () => { addCampaign(el.dataset.slug, el.dataset.name, el.dataset.logo, el.dataset.caddr, el.dataset.closed === '1'); clearSearch(); });
  box.querySelectorAll('[data-fill]').forEach(el => el.onclick = () => fillCampaigns());
  // the campaign "learn more" link opens the TTCrowd page — don't let it bubble to the row's add handler
  box.querySelectorAll('.rlink').forEach(a => a.onclick = e => e.stopPropagation());
  // JS avatar fallback (CSP blocks inline onerror) — rowFound + rowCampaign rows have a remote src
  box.querySelectorAll('.ritem[data-addr] img.av').forEach(img => { const seed = img.closest('.ritem').dataset.addr; img.onerror = () => { img.onerror = null; img.src = avatarSVG(seed); }; });
  box.querySelectorAll('.ritem[data-slug] img.av').forEach(img => { const seed = img.closest('.ritem').dataset.slug; img.onerror = () => { img.onerror = null; img.src = avatarSVG(seed); }; });
  resetActive(box);
}

// open the right dropdown state for the current input: search when typing, browse when empty
function openFor(v) { if (v.trim()) renderResults(v); else renderBrowse(); }

/* progressive author line — the list carries no steward, so once campaign rows are
   on screen, fetch each campaign's stewards from /summary in parallel and patch them
   onto the meta line as they land (same "resolve live" pattern as avatar upgrades).
   Matching rows by data-slug + the seq guard keeps a stale render from being touched. */
function enrichStewards(box, camps, seq) {
  const rows = new Map([...box.querySelectorAll('.ritem[data-slug]')].map(r => [r.dataset.slug, r]));
  camps.forEach(m => {
    const row = rows.get(m.slug); if (!row) return;
    ttcrowdStewards(m.slug).then(names => {
      if (seq !== searchSeq || !names.length) return;
      const rs = row.querySelector('.rs'); if (!rs) return;
      rs.textContent = ['TTCrowd', m.meta, 'by ' + names.join(', ')].filter(Boolean).join(' · ');
    }).catch(() => { });
  });
}

function renderResults(q) {
  const box = $('results'); q = q.trim();
  if (!q) { renderBrowse(); return; }
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
    const liveRows = matches.filter(m => !creators.some(x => x.addr === m.address)).slice(0, 8).map(rowFound);
    const campRows = camps.map(rowCampaign);
    const both = liveRows.length && campRows.length;   // only label the split when there's something to split
    let html = head;
    if (liveRows.length) html += (both ? rowGroup('creators') : '') + liveRows.join('');
    if (campRows.length) html += (both ? rowGroup('crowdfunding campaigns') : '') + campRows.join('');
    if (!html) html = rowNote('no matches — paste a tz1… or a .tez name');
    box.innerHTML = html; box.classList.add('show'); wireResults(box);
    enrichStewards(box, camps, seq);
  }, 250);
}

// empty-focus browse: all active TTCrowd campaigns, with a one-click fill action
async function renderBrowse() {
  const box = $('results');
  box.innerHTML = rowNote('loading campaigns…'); box.classList.add('show'); wireResults(box);
  const seq = ++searchSeq;
  let camps = [];
  try { camps = await ttcrowdBrowse(); } catch (e) { }
  if (seq !== searchSeq) return;                        // a keystroke started a real search meanwhile
  box.innerHTML = camps.length ? rowGroup('crowdfunding campaigns', true) + camps.map(rowCampaign).join('') : rowNote('no active campaigns right now');
  box.classList.add('show'); wireResults(box);
  enrichStewards(box, camps, seq);
}

function addFound(addr, name, logo) {
  errNote('');
  if (full()) { errShow("that's nine — that's the whole point"); return; }
  const c = makeCreator(addr); if (!c) return;
  if (name) { c.name = name; c._named = true; }
  if (logo) c.avatar = ipfsURL(logo);
  if (creators.some(x => x.id === c.id)) { errShow('already in your nine'); return; }
  creators.push(c); renderAll(); enrichCreator(c);
}
function clearSearch() { $('search').value = ''; const b = $('results'); b.classList.remove('show'); b.innerHTML = ''; $('search').setAttribute('aria-expanded', 'false'); }
function hideResults() { $('results').classList.remove('show'); $('search').setAttribute('aria-expanded', 'false'); }

/* shared add path for a resolved campaign row (address/closed carried inline).
   Returns a status so both the single-click and batch-fill callers can report it. */
function tryAddCampaign(m) {
  if (full()) return 'over';
  if (!m.address) return 'noaddr';
  if (m.closed) return 'closed';
  const c = makeCreator(m.address);
  if (!c) return 'invalid';
  if (creators.some(x => x.id === c.id)) return 'dup';
  c.name = m.name || m.slug; c._named = true;
  if (m.logo) c.avatar = m.logo;
  creators.push(c); enrichCreator(c);
  return 'added';
}
// add one campaign from a click. The list carries the wallet, so /summary is only
// a fallback for a row that somehow arrived without one.
async function addCampaign(slug, name, logo, addr, closed) {
  errNote('');
  const m = { slug, name, logo: logo || null, address: addr || null, closed: !!closed };
  if (!m.address) { let info = null; try { info = await ttcrowdResolve(slug); } catch (e) { } if (info) { m.address = info.address; m.closed = m.closed || info.closed; m.logo = m.logo || info.avatar; } }
  const st = tryAddCampaign(m);
  const msg = { over: "that's nine — that's the whole point", noaddr: "couldn't load that campaign", closed: "that campaign isn't taking donations right now", invalid: 'that campaign wallet looks invalid', dup: 'already in your nine' };
  if (st !== 'added') { errShow(msg[st] || ''); return; }
  renderAll();
}
// fill the remaining slots with active campaigns (stops at nine)
async function fillCampaigns() {
  errNote('');
  let camps = []; try { camps = await ttcrowdBrowse(); } catch (e) { }
  let added = 0, dup = 0, closed = 0;
  for (const m of camps) { const st = tryAddCampaign(m); if (st === 'added') added++; else if (st === 'dup') dup++; else if (st === 'closed') closed++; else if (st === 'over') break; }
  renderAll(); clearSearch();
  const bits = [];
  if (added) bits.push(`added ${added}`);
  if (dup) bits.push(`${dup} already in`);
  if (closed) bits.push(`${closed} not taking donations`);
  if (!bits.length) bits.push('no active campaigns to add');
  else if (full()) bits.push('nine full');
  errNote(bits.join(' · '));
}
function addCreator(v) { errNote(''); if (full()) { errShow("that's nine — that's the whole point"); return; } const c = makeCreator(v); if (!c) { errShow("not a tz address or a .tez name"); return; } if (creators.some(x => x.id === c.id)) { errShow('already in your nine'); return; } creators.push(c); renderAll(); enrichCreator(c); }
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
  errNote(bits.join(' · '));
  clearSearch();
}

$('search').addEventListener('input', e => openFor(e.target.value));
$('search').addEventListener('focus', () => openFor($('search').value));
$('search').addEventListener('paste', e => {
  const text = ((e.clipboardData || window.clipboardData) && (e.clipboardData || window.clipboardData).getData('text')) || '';
  const tokens = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  if (tokens.length > 1) { e.preventDefault(); addMany(text); }
});
$('search').addEventListener('keydown', e => {
  const box = $('results');
  if (e.key === 'ArrowDown') { e.preventDefault(); if (!box.classList.contains('show')) { openFor($('search').value); return; } setActive(box, activeIdx + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(box, activeIdx - 1); }
  else if (e.key === 'Enter') { const list = pickables(box); const el = list[activeIdx] || list[0]; if (el) { e.preventDefault(); el.click(); } }
  else if (e.key === 'Escape') { clearSearch(); }
  else if (e.key === 'Tab') { hideResults(); }
});
document.addEventListener('click', e => { if (!e.target.closest('.searchwrap')) hideResults(); });
