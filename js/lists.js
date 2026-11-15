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
export function deleteList(id) { store.lists.save(store.lists.all().filter(l => l.id !== id)); }

export function saveCurrentAs(name) {
  name = (name || '').trim();
  if (!name || !creators.length) return false;
  const lists = store.lists.all();
  // avatar is cached only to draw the list's avatar stack — loading re-resolves it
  const recipients = creators.map(c => ({ input: shareToken(c), address: c.addr, name: c.name, avatar: c.avatar || null }));
  const now = Date.now();
  const same = lists.find(l => l.name.toLowerCase() === name.toLowerCase());
  if (same) { same.recipients = recipients; same.updated = now; }
  else lists.push({ v: V, id: uid(), name, created: now, updated: now, recipients });
  return store.lists.save(lists);
}

/* inline save: clicking `btn` hides `hide` and shows `pane` (a name field + save +
   cancel). Enter saves, Esc cancels. Returns reset() for when the host re-renders. */
export function wireSave({ btn, hide, pane, input, ok, cancel }) {
  const label = btn.textContent;
  const open = () => { if (!creators.length) return; hide.style.display = 'none'; pane.style.display = 'flex'; input.value = ''; input.focus(); };
  const close = () => { pane.style.display = 'none'; hide.style.display = ''; };
  const commit = () => {
    if (!saveCurrentAs(input.value)) { input.focus(); return; }
    close();
    btn.textContent = 'saved ✓';
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.textContent = label; }, 1400);
    btn.focus();
  };
  btn.addEventListener('click', open);
  ok.addEventListener('click', commit);
  cancel.addEventListener('click', () => { close(); btn.focus(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    // stop here so Esc inside the success dialog cancels the field, not the dialog
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
  });
  return { reset() { clearTimeout(btn._t); btn.textContent = label; close(); } };
}

// panel 04 — "save list" sits next to "copy link" under the sprinkle button
wireSave({ btn: $('saveListBtn'), hide: $('actRow'), pane: $('saveName'), input: $('listName'), ok: $('saveNameOk'), cancel: $('saveNameCancel') });
