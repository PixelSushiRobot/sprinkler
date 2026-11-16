/* named saved lists — the address book. A list stores recipients only (no pot or
   method, by design). Loading lives in the search dropdown (search.js), which
   replays the stored tokens through addMany so names, avatars and TTCrowd campaign
   recipients all re-resolve live rather than being trusted from storage.

   This module owns the data (via store.lists) and the inline "name this list"
   control, used under "sprinkle it" (panel 04) and on the success screen. Saving
   under a name that already exists updates that list — there's no rename. */

import { $ } from './dom.js';
import { creators } from './state.js';
import { shareToken } from './grid.js';
import { store } from './store.js';

const V = 1;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// newest first
export function getLists() { return store.lists.all().slice().sort((a, b) => b.updated - a.updated); }
export function findList(id) { return store.lists.all().find(l => l.id === id) || null; }
export function deleteList(id) { store.lists.save(store.lists.all().filter(l => l.id !== id)); if (id === loadedId) setLoadedList(null); }
const byName = name => store.lists.all().find(l => l.name.toLowerCase() === name.trim().toLowerCase()) || null;

/* the list the garden came from (loaded, or last saved as), so saving again offers
   "update" with its name already filled in. Forgotten once the garden is emptied or
   the list is deleted. */
let loadedId = null;
export function loadedList() { return loadedId ? findList(loadedId) : null; }
export function setLoadedList(id) { loadedId = id || null; window.dispatchEvent(new Event('sprinkler:change')); }   // relabels + re-saves the draft
function syncSaveLabel() { if (!creators.length) loadedId = null; $('saveListBtn').textContent = loadedList() ? 'update list' : 'save list'; }
window.addEventListener('sprinkler:change', syncSaveLabel);

// returns the saved list's id, or false
export function saveCurrentAs(name) {
  name = (name || '').trim();
  if (!name || !creators.length) return false;
  const lists = store.lists.all();
  // avatar is cached only to draw the list's avatar stack — loading re-resolves it
  const recipients = creators.map(c => ({ input: shareToken(c), address: c.addr, name: c.name, avatar: c.avatar || null }));
  const now = Date.now();
  let l = lists.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (l) { l.recipients = recipients; l.updated = now; }
  else lists.push(l = { v: V, id: uid(), name, created: now, updated: now, recipients });
  return store.lists.save(lists) ? l.id : false;
}

/* inline save: clicking `btn` hides `hide` and shows `pane` (a name field + save +
   cancel). The field starts with the current list's name, selected — Enter updates
   it, typing replaces it with a new name. The confirm button reads "update" whenever
   the name matches an existing list, so an overwrite is never a surprise. Enter
   saves, Esc cancels. Returns reset() for when the host re-renders. */
export function wireSave({ btn, hide, pane, input, ok, cancel }) {
  const label = () => btn === $('saveListBtn') && loadedList() ? 'update list' : btn.dataset.label;
  btn.dataset.label = btn.textContent;
  const syncOk = () => { ok.textContent = byName(input.value) ? 'update' : 'save'; };
  const open = () => {
    if (!creators.length) return;
    hide.style.display = 'none'; pane.style.display = 'flex';
    const l = loadedList(); input.value = l ? l.name : ''; syncOk();
    input.focus(); input.select();
  };
  const close = () => { pane.style.display = 'none'; hide.style.display = ''; };
  const commit = () => {
    const updating = !!byName(input.value), id = saveCurrentAs(input.value);
    if (!id) { input.focus(); return; }
    setLoadedList(id);
    close();
    btn.textContent = updating ? 'updated ✓' : 'saved ✓';
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = label(); }, 1400);
    btn.focus();
  };
  btn.addEventListener('click', open);
  ok.addEventListener('click', commit);
  cancel.addEventListener('click', () => { close(); btn.focus(); });
  input.addEventListener('input', syncOk);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    // stop here so Esc inside the success dialog cancels the field, not the dialog
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
  });
  return { reset() { clearTimeout(btn._t); btn.textContent = label(); close(); } };
}

// panel 04 — "save list" sits next to "copy link" under the sprinkle button
wireSave({ btn: $('saveListBtn'), hide: $('actRow'), pane: $('saveName'), input: $('listName'), ok: $('saveNameOk'), cancel: $('saveNameCancel') });
