/* named saved lists — the address book. A list stores recipients only (no pot or
   method, by design); it loads by replaying the stored tokens through addMany, so
   names/avatars and TTCrowd campaign recipients all re-resolve live rather than
   being trusted from storage. All local, via store.lists.

   Save control lives in panel 04 (save the nine you just built); the list of saved
   lists lives in panel 01 (load one as you assemble). */

import { $ } from './dom.js';
import { creators, clearCreators } from './state.js';
import { renderAll, shareToken } from './grid.js';
import { addMany } from './search.js';
import { store } from './store.js';
import { escapeHTML } from './escape.js';

const V = 1;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let editingId = null;                                   // id of the list being renamed inline

const getLists = () => store.lists.all();

function saveCurrentAs(name) {
  name = (name || '').trim();
  if (!name || !creators.length) return false;
  const lists = getLists();
  const recipients = creators.map(c => ({ input: shareToken(c), address: c.addr, name: c.name }));
  const now = Date.now();
  const dup = lists.find(l => l.name.toLowerCase() === name.toLowerCase());   // same name overwrites
  if (dup) { dup.recipients = recipients; dup.updated = now; }
  else lists.push({ v: V, id: uid(), name, created: now, updated: now, recipients });
  store.lists.save(lists);
  renderLists();
  return true;
}
function renameList(id, name) {
  name = (name || '').trim();
  const lists = getLists(), l = lists.find(x => x.id === id);
  if (l && name) { l.name = name; l.updated = Date.now(); store.lists.save(lists); }
  editingId = null; renderLists();
}
function deleteList(id) { store.lists.save(getLists().filter(x => x.id !== id)); renderLists(); }
function loadList(id) {
  const l = getLists().find(x => x.id === id); if (!l) return;
  clearCreators(); renderAll();                         // show the slate clear immediately
  const tokens = l.recipients.map(r => r && r.input).filter(Boolean).join(',');
  if (tokens) addMany(tokens);                          // repopulate — resolves names/avatars live
}

/* render the saved-lists section in panel 01 (newest first; hidden when empty) */
export function renderLists() {
  const box = $('savedLists'); if (!box) return;
  const lists = getLists().slice().sort((a, b) => b.updated - a.updated);
  if (!lists.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="savedlabel">saved lists</div>' + lists.map(l => {
    if (l.id === editingId) {
      return `<div class="srow" data-id="${l.id}"><input class="srename-input" value="${escapeHTML(l.name)}" maxlength="40" autocomplete="off" spellcheck="false"></div>`;
    }
    return `<div class="srow" data-id="${l.id}">`
      + `<button class="sload" type="button" title="load this list"><span class="sn">${escapeHTML(l.name)}</span><span class="sc">${l.recipients.length}</span></button>`
      + `<button class="slink act-rename" type="button">rename</button>`
      + `<button class="slink act-del" type="button">delete</button>`
      + `</div>`;
  }).join('');
  if (editingId) { const inp = box.querySelector('.srename-input'); if (inp) { inp.focus(); inp.select(); } }
}

/* row actions — delegated, since rows are re-rendered on every change */
$('savedLists').addEventListener('click', e => {
  const row = e.target.closest('.srow'); if (!row) return;
  const id = row.dataset.id;
  if (e.target.closest('.sload')) { loadList(id); return; }
  if (e.target.closest('.act-rename')) { editingId = id; renderLists(); return; }
  const del = e.target.closest('.act-del');
  if (del) {                                            // two-click confirm, auto-disarms
    if (del.dataset.armed) deleteList(id);
    else { del.dataset.armed = '1'; del.textContent = 'remove?'; setTimeout(() => { if (del.isConnected) { del.textContent = 'delete'; delete del.dataset.armed; } }, 2200); }
  }
});
$('savedLists').addEventListener('keydown', e => {
  if (!e.target.classList.contains('srename-input')) return;
  const row = e.target.closest('.srow'), id = row && row.dataset.id;
  if (e.key === 'Enter') { e.preventDefault(); renameList(id, e.target.value); }
  else if (e.key === 'Escape') { e.preventDefault(); editingId = null; renderLists(); }
});
$('savedLists').addEventListener('blur', e => {
  if (e.target.classList.contains('srename-input')) { const row = e.target.closest('.srow'); renameList(row && row.dataset.id, e.target.value); }
}, true);

/* save-as control in panel 04 */
const saveBtn = $('saveListBtn'), savePane = $('saveName'), nameInp = $('listName');
function openSave() { if (!creators.length) return; saveBtn.style.display = 'none'; savePane.style.display = 'flex'; nameInp.value = ''; nameInp.focus(); }
function closeSave() { savePane.style.display = 'none'; saveBtn.style.display = ''; }
function commitSave() {
  if (!saveCurrentAs(nameInp.value)) return;
  closeSave();
  const label = saveBtn.textContent;
  saveBtn.textContent = 'saved ✓';
  setTimeout(() => { saveBtn.textContent = label; }, 1400);
}
saveBtn.addEventListener('click', openSave);
$('saveNameOk').addEventListener('click', commitSave);
nameInp.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); commitSave(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeSave(); }
});

renderLists();
