import './theme.js';
import { renderAll } from './grid.js';
import { addMany } from './search.js';
import { restoreDraft, initDraftAutosave } from './draft.js';
import './presets.js';
import './overlay.js';

renderAll();
initDraftAutosave();

/* ?to=alice.tez,tz1…,8scribo prefills the nine through the same path as a pasted
   list — wallets, .tez names, and TTCrowd campaign slugs. Names/avatars still come
   from our own lookups, never from the link. Fewer than nine just leaves open slots;
   nothing else (pot, split, network, wallet) is settable from a URL.
   An explicit ?to= link wins over any saved draft; with no link we restore the
   draft so you pick up where you left off. Either way autosave then tracks it. */
const to = new URLSearchParams(location.search).get('to');
if (to) addMany(to);
else restoreDraft();
