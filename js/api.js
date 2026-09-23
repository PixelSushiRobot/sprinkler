import { TZKT } from './config.js';
import { creators } from './state.js';
import { renderAll } from './grid.js';
import { syncConfirmReady } from './overlay.js';
import { isValidTezosAddress } from './base58check.js';

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const ipfsURL = u => !u ? null : (u.startsWith('ipfs://') ? 'https://ipfs.io/ipfs/' + u.slice(7) : u);
// objkt avatar CDN: returns the wallet's custom avatar if set, else a generated default
const objktAvatar = a => 'https://avatar.objkt.com/v1/' + a;
async function fetchJSON(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }

/* resolve address / .tez name, pull activity + balance, real avatar */
export async function enrichCreator(c) {
  try {
    if (!c.addr) {
      const d = await fetchJSON(`${TZKT}/v1/domains?name=${encodeURIComponent(c._input.toLowerCase())}`);
      const rec = Array.isArray(d) ? d[0] : null;
      // TzKT returns the forward record as an object {address}; hack.tez subdomains
      // set no forward record, so fall back to the owner (who claimed the name)
      const addr = rec && (((rec.address && rec.address.address)) || (rec.owner && rec.owner.address));
      if (addr) c.addr = addr;
      else throw new Error('name not found');
    }
    // catch a mistyped/corrupted address before it's ever shown as "resolved" —
    // the shape regex in makeCreator lets a bad checksum through, and a wallet
    // would otherwise be the first thing to reject it, well after the user has
    // reviewed the whole nine-recipient batch
    if (!(await isValidTezosAddress(c.addr))) {
      c._err = 'invalid address'; c._loading = false;
      renderAll(); syncConfirmReady(); return;
    }
    // reject a second entry that resolves to an address already in the list
    // (e.g. someone added once as alice.tez and once as her tz1… address)
    if (creators.some(x => x !== c && x.addr && x.addr === c.addr)) {
      c._err = 'duplicate'; c._loading = false;
      renderAll(); syncConfirmReady(); return;
    }
    const acc = await fetchJSON(`${TZKT}/v1/accounts/${c.addr}`);
    const tx = (acc && acc.numTransactions) || 0;
    c.activity = clampN(Math.log10(tx + 1) / 4 * 100, 3, 100);
    const balTez = ((acc && acc.balance) || 0) / 1e6;
    c.received = clampN(Math.log10(balTez + 1) / 6 * 100, 3, 100);
    const prof = await resolveProfile(c.addr);
    // fetch owned Tezos Domains once, only if we still need a name fallback or an
    // avatar — hack.tez / .tez profile pictures live on owned (sub)domain records
    let doms = null;
    const needName = c._isAddr && !c._named && !prof.alias;
    const needPic = !c.avatar && !prof.logo;
    if (needName || needPic) doms = await fetchJSON(`${TZKT}/v1/domains?owner=${c.addr}&limit=100`).catch(() => null);

    if (c._isAddr && !c._named) {
      // prefer a clean username — objkt alias, then teztree handle — over a .tez name
      if (prof.alias) c.name = prof.alias;
      else {
        const tt = (await teztreeAll().catch(() => [])).find(h => h.address === c.addr);
        if (tt) c.name = tt.displayName || tt.handle;
        else {
          const best = Array.isArray(doms) ? bestDomain(doms) : null;
          if (best && best.name) c.name = best.name;
          else if (acc && acc.alias) c.name = acc.alias;
        }
      }
    }
    // avatar order: objkt custom logo → hack.tez / .tez profile picture → objkt default
    if (!c.avatar) c.avatar = prof.logo || (Array.isArray(doms) ? bestPicture(doms, c.addr) : null) || objktAvatar(c.addr);
    c._loading = false;
  } catch (e) {
    c._loading = false; c._err = 'not found';
  }
  renderAll(); syncConfirmReady();
}

/* best-effort objkt profile (mainnet catalog): clean alias + avatar in one hit */
async function resolveProfile(addr) {
  try {
    const r = await fetch('https://data.objkt.com/v3/graphql', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query($a:String!){holder(where:{address:{_eq:$a}}){alias logo}}', variables: { a: addr } })
    });
    const j = await r.json();
    const h = j && j.data && j.data.holder && j.data.holder[0];
    if (h) return { alias: h.alias || null, logo: h.logo ? ipfsURL(h.logo) : null };
  } catch (e) { }
  return { alias: null, logo: null };
}
/* when a wallet holds several .tez names, pick the one to display: its reverse
   (primary) name if it set one, else the fewest-label / shortest / most-recent */
function bestDomain(list) {
  const valid = (list || []).filter(d => d && d.name);
  if (!valid.length) return null;
  const rev = valid.find(d => d.reverse);
  if (rev) return rev;
  return valid.slice().sort((a, b) => {
    const la = a.name.split('.').length, lb = b.name.split('.').length;
    if (la !== lb) return la - lb;                                  // alice.tez before x.hack.tez
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return (b.lastTime || '').localeCompare(a.lastTime || '');      // most recently active
  })[0];
}
/* a wallet can own many profile records (several hack.tez identities), each with its
   own picture. pick the one that represents the wallet: its declared primary hack.tez
   identity, then its reverse .tez, then a lone picture — never guess among many */
function bestPicture(list, addr) {
  const withPic = (list || []).filter(d => d && d.data && d.data['openid:picture']);
  if (!withPic.length) return null;
  const primary = withPic.find(d => d.data['hack:primary'] === addr);
  const rev = withPic.find(d => d.reverse);
  const pick = primary || rev || (withPic.length === 1 ? withPic[0] : null);
  return pick ? ipfsURL(pick.data['openid:picture']) : null;
}

async function objktSearch(q) {
  const term = '%' + q.replace(/[%_\\]/g, '') + '%';
  const body = { query: 'query($q:String!){holder(where:{alias:{_ilike:$q}},order_by:{alias:asc},limit:6){address alias logo}}', variables: { q: term } };
  const r = await fetch('https://data.objkt.com/v3/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  return ((j && j.data && j.data.holder) || []).filter(h => h.address && h.alias).map(h => ({ address: h.address, name: h.alias, logo: h.logo, src: 'objkt' }));
}
/* strip a .hack.tez / .tez suffix to the bare label — the hack.tez & teztree
   search indexes match the label (fafo), not the full fafo.hack.tez string */
const bareLabel = q => q.replace(/\.(hack\.)?tez$/i, '').trim();
/* hack.tez builder directory — substring search over label, name, bio, skills, projects */
async function hacktezSearch(q) {
  const label = bareLabel(q);
  if (!label) return [];
  const r = await fetch('https://hacktez.com/api/v1/members?limit=8&q=' + encodeURIComponent(label));
  if (!r.ok) return [];
  const j = await r.json();
  // hack.tez members set no forward address record — the wallet is `owner`.
  // urls.avatar returns the custom picture if set, else a generated hackatar.
  return ((j && j.data) || []).filter(m => m.owner).map(m => {
    const st = m.profile && m.profile.status, np = m.counts && m.counts.projects;
    const meta = [st, np ? np + (np === 1 ? ' project' : ' projects') : ''].filter(Boolean).join(' · ');
    return { address: m.owner, name: m.name || m.label, logo: (m.urls && m.urls.avatar) || null, src: 'hack.tez', meta };
  });
}
/* teztree link-in-bio handles — no search endpoint, so pull the (small) namespace once and filter locally */
let teztreeCache = null;
async function teztreeAll() {
  if (teztreeCache) return teztreeCache;
  const r = await fetch('https://www.teztree.com/api/v1/handles/recent?limit=200');
  if (!r.ok) return (teztreeCache = []);
  const j = await r.json();
  return (teztreeCache = ((j && j.handles) || []).filter(h => h.address));
}
async function teztreeSearch(q) {
  const t = bareLabel(q).toLowerCase();
  if (!t) return [];
  const all = await teztreeAll();
  return all.filter(h => (h.handle || '').toLowerCase().includes(t) || (h.displayName || '').toLowerCase().includes(t)).slice(0, 6).map(h => ({ address: h.address, name: h.displayName || h.handle, logo: null, src: 'teztree' }));
}
/* run all three discovery sources in parallel, merging same-address hits into one
   row that keeps every source tag, the first avatar found, and any builder meta */
export async function searchAll(q) {
  const results = await Promise.allSettled([objktSearch(q), hacktezSearch(q), teztreeSearch(q)]);
  const byAddr = new Map();
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    for (const m of r.value) {
      if (!m.address) continue;
      const ex = byAddr.get(m.address);
      if (!ex) { byAddr.set(m.address, { ...m, srcs: [m.src] }); continue; }
      if (!ex.srcs.includes(m.src)) ex.srcs.push(m.src);
      if (!ex.logo && m.logo) ex.logo = m.logo;
      if (!ex.meta && m.meta) ex.meta = m.meta;
    }
  }
  return [...byAddr.values()].map(m => ({ ...m, src: m.srcs.join(' · ') }));
}
