/* storage-agnostic persistence — everything saved locally goes through here, so
   swapping localStorage for wallet-sync (or IndexedDB) later only touches this
   file. Fails quiet: private-mode / disabled storage just means nothing persists,
   and the app keeps working with no saved state. */

const KEY = {
  draft: 'sprinkler-draft',
  lists: 'sprinkler-lists',          // named saved lists
  // history: 'sprinkler-history',   // your sprinkles — later slice
};

function read(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function wipe(k) { try { localStorage.removeItem(k); } catch (e) { } }

export const store = {
  draft: {
    get: () => read(KEY.draft),
    set: v => write(KEY.draft, v),
    clear: () => wipe(KEY.draft),
  },
  lists: {
    all: () => read(KEY.lists) || [],
    save: arr => write(KEY.lists, arr),
  },
};
