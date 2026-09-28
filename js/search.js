import { $ } from './dom.js';
import { avatarSVG } from './avatar.js';
import { creators, makeCreator, full } from './state.js';
import { ipfsURL, searchSources, enrichCreator, ttcrowdSearch, ttcrowdBrowse, ttcrowdResolve, ttcrowdStewards, warmSearch } from './api.js';
import { renderAll } from './grid.js';
import { escapeHTML } from './escape.js';

/* search — one combobox for everything. Empty + focused browses active TTCrowd
   campaigns; typing switches to live objkt + hack.tez + teztree lookup (plus
   campaign matches) or accepts a pasted address / .tez name directly. Fully
   keyboard-drivable: ↑/↓ move the highlight, Enter picks, Esc closes. */
let searchTimer = null, searchSeq = 0;
// navigation is tracked by STABLE ID, not list index, so results streaming in never
// change what the keyboard points at. userMoved gates the highlight: before the first
// ↑/↓ there's no active row (Enter falls back to the first). cur holds the in-flight
// generation's merged results so each source can paint as it arrives.
let nav = { activeId: null, userMoved: false };
let cur = null;

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
// stable id for a row, derived from the data-* it already carries
function rowId(el) { const d = el.dataset; return d.addr ? 'addr:' + d.addr : d.slug ? 'slug:' + d.slug : d.manual ? 'manual:' + d.manual : null; }
// assign option ids/roles for aria — index-based here is fine, it's not the nav key
function indexRows(box) {
  $('search').setAttribute('aria-expanded', box.classList.contains('show') ? 'true' : 'false');
  pickables(box).forEach((el, i) => { el.id = 'sopt-' + i; el.setAttribute('role', 'option'); });
}
// re-apply the highlight to whichever row still carries nav.activeId after a (re)paint.
// If the user hasn't navigated, nothing is highlighted (Enter still picks the first).
function restoreActive(box) {
  indexRows(box);
  const inp = $('search'), list = pickables(box);
  const el = (nav.userMoved && nav.activeId) ? list.find(x => rowId(x) === nav.activeId) || null : null;
  list.forEach(x => x.classList.toggle('active', x === el));
  if (el) { el.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', el.id); }
  else inp.removeAttribute('aria-activedescendant');
}
// move the highlight by ±1, tracking the destination by id so a later repaint keeps it
function moveActive(box, delta) {
  const list = pickables(box); if (!list.length) return;
  const idx = nav.activeId ? list.findIndex(x => rowId(x) === nav.activeId) : -1;
  const next = Math.max(0, Math.min(list.length - 1, idx + delta));
  nav.userMoved = true; nav.activeId = rowId(list[next]);
  restoreActive(box);
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
  restoreActive(box);
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

/* merge a source's rows into the current generation's de-duped creator map. Insertion
   order is fixed the first time an address is seen; a later source with the same address
   only merges its tag/avatar/meta — it never moves an existing row. Creators already in
   the nine are skipped, matching the old filter. */
function mergeCreators(rows) {
  for (const m of rows || []) {
    if (!m.address || creators.some(x => x.addr === m.address)) continue;
    const ex = cur.byAddr.get(m.address);
    if (!ex) { cur.byAddr.set(m.address, { address: m.address, name: m.name, logo: m.logo || null, meta: m.meta || '', srcs: [m.src] }); cur.order.push(m.address); }
    else { if (!ex.srcs.includes(m.src)) ex.srcs.push(m.src); if (!ex.logo && m.logo) ex.logo = m.logo; if (!ex.meta && m.meta) ex.meta = m.meta; if (!ex.name && m.name) ex.name = m.name; }
  }
}
/* rebuild the dropdown from the current generation buffer. Fixed sections (creators,
   then campaigns), never relevance-sorted, capped at 8 by insertion order so a
   highlighted row can't be bumped out. A faint "searching…" line trails until every
   source has settled. restoreActive re-pins the highlight by id after the repaint. */
function paint() {
  if (!cur) return;
  const box = $('results');
  const creatorRows = cur.order.slice(0, 8).map(a => { const r = cur.byAddr.get(a); return rowFound({ address: r.address, name: r.name, logo: r.logo, meta: r.meta, src: r.srcs.join(' · ') }); });
  const campRows = cur.camps.map(rowCampaign);
  const both = creatorRows.length && campRows.length;   // only label the split when there's something to split
  let html = cur.head;
  if (creatorRows.length) html += (both ? rowGroup('creators') : '') + creatorRows.join('');
  if (campRows.length) html += (both ? rowGroup('crowdfunding campaigns') : '') + campRows.join('');
  if (cur.pending) html += rowNote('searching…');
  else if (!creatorRows.length && !campRows.length && !cur.head) html = rowNote('no matches — paste a tz1… or a .tez name');
  box.innerHTML = html; box.classList.add('show'); wireResults(box);
  if (campRows.length) enrichStewards(box, cur.camps, cur.seq);
}

function renderResults(q) {
  const box = $('results'); q = q.trim();
  if (!q) { renderBrowse(); return; }
  nav = { activeId: null, userMoved: false };   // query changed — reset navigation
  const c = makeCreator(q);
  const head = c ? (creators.some(x => x.id === c.id) ? rowDup(q, c) : rowManual(q, c)) : '';
  // a single character blasts every source with a near-match-all query for little
  // value — wait for a second character before hitting the network
  if (q.length < 2 && !c) { cur = null; box.innerHTML = rowNote('keep typing…'); box.classList.add('show'); wireResults(box); return; }
  box.innerHTML = head + rowNote('searching…'); box.classList.add('show'); wireResults(box);
  clearTimeout(searchTimer);
  const seq = ++searchSeq;
  searchTimer = setTimeout(() => {
    // one buffer per generation: 3 creator sources + campaigns, each painting as it lands
    cur = { seq, head, order: [], byAddr: new Map(), camps: [], pending: true, remaining: 4 };
    const settle = () => { if (seq !== searchSeq) return; if (--cur.remaining <= 0) cur.pending = false; paint(); };
    searchSources(q).forEach(({ p }) => p.then(rows => { if (seq === searchSeq) mergeCreators(rows); }).catch(() => { }).finally(settle));
    ttcrowdSearch(q).then(rows => { if (seq === searchSeq) cur.camps = rows; }).catch(() => { }).finally(settle);
    paint();   // initial head + "searching…" for this generation
  }, 250);
}

// empty-focus browse: all active TTCrowd campaigns, with a one-click fill action
async function renderBrowse() {
  const box = $('results');
  nav = { activeId: null, userMoved: false };
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
function clearSearch() { nav = { activeId: null, userMoved: false }; cur = null; $('search').value = ''; const b = $('results'); b.classList.remove('show'); b.innerHTML = ''; $('search').setAttribute('aria-expanded', 'false'); }
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
  if (m.slug) c._slug = m.slug;   // let the share link emit the slug, not the raw wallet
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
/* a bare TTCrowd slug — no dots or spaces (those are .tez names or junk) */
function isSlug(t) { return /^[a-z0-9][a-z0-9-]{1,60}$/i.test(t); }
/* paste a whole list at once — newline / comma / space / semicolon separated. Also the
   ?to= prefill path in main.js, so a link gets the same validation, dedupe and nine-cap
   as a paste. Each token is tried as a wallet / .tez first, then as a TTCrowd campaign
   slug (resolved from the cached list, with a /summary fallback for one not listed). */
export async function addMany(text) {
  errNote('');
  const tokens = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  const list = await ttcrowdBrowse().catch(() => []);
  let added = 0, dup = 0, bad = 0, over = 0, closed = 0;
  for (const tok of tokens) {
    if (full()) { over++; continue; }
    const c = makeCreator(tok);
    if (c) {                                                  // wallet or .tez name
      if (creators.some(x => x.id === c.id)) { dup++; continue; }
      creators.push(c); enrichCreator(c); added++; continue;
    }
    if (isSlug(tok)) {                                        // try as a campaign slug
      let m = list.find(x => x.slug === tok);
      if (m && !m.address) { try { const info = await ttcrowdResolve(tok); if (info) m = { ...m, address: info.address, closed: m.closed || info.closed, logo: m.logo || info.avatar }; } catch (e) { } }
      if (!m) { try { const info = await ttcrowdResolve(tok); if (info && info.address) m = { slug: tok, name: tok, logo: info.avatar, address: info.address, closed: info.closed }; } catch (e) { } }
      if (m) { const st = tryAddCampaign(m); if (st === 'added') added++; else if (st === 'dup') dup++; else if (st === 'closed') closed++; else if (st === 'over') over++; else bad++; continue; }
    }
    bad++;
  }
  renderAll();
  const bits = [];
  if (added) bits.push(`added ${added}`);
  if (dup) bits.push(`${dup} already in`);
  if (closed) bits.push(`${closed} not taking donations`);
  if (bad) bits.push(`${bad} not valid`);
  if (over) bits.push(`${over} over the nine`);
  errNote(bits.join(' · '));
  clearSearch();
}

$('search').addEventListener('input', e => openFor(e.target.value));
$('search').addEventListener('focus', () => { warmSearch(); openFor($('search').value); });
$('search').addEventListener('paste', e => {
  const text = ((e.clipboardData || window.clipboardData) && (e.clipboardData || window.clipboardData).getData('text')) || '';
  const tokens = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  if (tokens.length > 1) { e.preventDefault(); addMany(text); }
});
$('search').addEventListener('keydown', e => {
  const box = $('results');
  if (e.key === 'ArrowDown') { e.preventDefault(); if (!box.classList.contains('show')) { openFor($('search').value); return; } moveActive(box, +1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(box, -1); }
  else if (e.key === 'Enter') { const list = pickables(box); const el = (nav.activeId && list.find(x => rowId(x) === nav.activeId)) || list[0]; if (el) { e.preventDefault(); el.click(); } }
  else if (e.key === 'Escape') { clearSearch(); }
  else if (e.key === 'Tab') { hideResults(); }
});
document.addEventListener('click', e => { if (!e.target.closest('.searchwrap')) hideResults(); });
