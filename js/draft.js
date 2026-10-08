/* the working draft — the in-progress nine, pot, and method/wildness, auto-saved
   to local storage and restored when you come back. This is "pick up where you
   left off", distinct from named saved lists (recipients only, a later feature).

   Recipients are stored as re-addable tokens (the same identifier the share link
   emits — slug > .tez > wallet) and replayed through addMany() on restore, so
   names/avatars/campaign recipients all re-resolve live rather than being trusted
   from storage. */

import { $ } from './dom.js';
import { creators, method, yoloLevel, setMethod, setYoloLevel } from './state.js';
import { renderAll, shareToken } from './grid.js';
import { addMany } from './search.js';
import { store } from './store.js';

const V = 1;
let suspended = false, timer = null;

function serialize() {
  return {
    v: V,
    pot: $('amount').value,
    method,
    yolo: yoloLevel,
    recipients: creators.map(c => ({ input: shareToken(c), address: c.addr, name: c.name })),
  };
}
function saveNow() {
  if (!creators.length) { store.draft.clear(); return; }   // empty grid → nothing to keep
  store.draft.set(serialize());
}
function scheduleSave() { if (suspended) return; clearTimeout(timer); timer = setTimeout(saveNow, 400); }

/* every grid render announces a change (grid.js dispatches 'sprinkler:change');
   we coalesce bursts into a single debounced write */
export function initDraftAutosave() { window.addEventListener('sprinkler:change', scheduleSave); }

export function restoreDraft() {
  const d = store.draft.get();
  if (!d || d.v !== V || !Array.isArray(d.recipients) || !d.recipients.length) return;
  suspended = true;                                        // don't autosave mid-restore
  if (d.method) setMethod(d.method);
  if (d.yolo) setYoloLevel(d.yolo);
  if (d.pot != null) $('amount').value = d.pot;
  renderAll();
  $('amount').dispatchEvent(new Event('input'));           // re-light the matching preset chip
  const tokens = d.recipients.map(r => r && r.input).filter(Boolean).join(',');
  Promise.resolve(tokens ? addMany(tokens) : null).finally(() => { suspended = false; scheduleSave(); });
}
