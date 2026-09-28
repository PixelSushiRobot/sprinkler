import './theme.js';
import { renderAll } from './grid.js';
import { addMany } from './search.js';
import './presets.js';
import './overlay.js';

renderAll();

/* ?to=alice.tez,tz1…,8scribo prefills the nine through the same path as a pasted
   list — wallets, .tez names, and TTCrowd campaign slugs. Names/avatars still come
   from our own lookups, never from the link. Fewer than nine just leaves open slots;
   nothing else (pot, split, network, wallet) is settable from a URL. */
const to = new URLSearchParams(location.search).get('to');
if (to) addMany(to);
