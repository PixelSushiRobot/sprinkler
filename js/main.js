import './theme.js';
import { renderAll } from './grid.js';
import { addMany } from './search.js';
import './presets.js';
import './overlay.js';

renderAll();

/* ?to=alice.tez,bob.hack.tez,tz1… prefills the nine through the same path as a
   pasted list — addresses and .tez names only, so names/avatars still come from
   our own lookups, never from the link. Fewer than nine just leaves open slots;
   nothing else (pot, split, network, wallet) is settable from a URL. */
const to = new URLSearchParams(location.search).get('to');
if (to) addMany(to);
