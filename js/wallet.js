/* Tezos wallet connect + batch payout via Octez Connect (tzip-10). Wallet forges
   + signs; no Taquito, no build step.

   The CDN import is pinned to an exact version, not a bare major (`@5`) — a
   floating major-version pin lets esm.sh silently serve a different release
   on every visit, and this module is the code that builds the payout
   operation every user signs. See SECURITY_AUDIT.md finding #3. Bump this
   deliberately, on purpose, after checking the changelog — not by drifting.

   The import failure is caught and kept internal (`loadError`, surfaced via
   `walletReady()`/`walletLoadError()`) rather than thrown at module-eval
   time, so a CDN outage degrades to a clear in-app error instead of an
   unhandled rejection breaking the rest of the module graph — the same
   isolation the previous window.tez/window.tezError bridge gave, without
   putting the payout primitive on `window` where any other script on the
   page could call it. See SECURITY_AUDIT.md finding #2. */
import { NETS, getPayNetKey } from './config.js';

const SDK_VERSION = '5.0.4';

let DAppClientCtor = null;
let loadError = null;
let client = null, clientNet = null;

const readyPromise = (async () => {
  try {
    const mod = await import(`https://esm.sh/@tezos-x/octez.connect-sdk@${SDK_VERSION}?bundle`);
    DAppClientCtor = mod.DAppClient;
  } catch (e) {
    loadError = (e && e.message) || 'wallet library failed to load';
    console.error('[sprinkler] wallet load failed:', e);
  }
})();

// resolves once the SDK has either loaded or failed — never rejects
export async function walletReady() { await readyPromise; return !loadError; }
export function walletLoadError() { return loadError; }

// The payout network is chosen at runtime, but a DAppClient fixes its network
// at construction — so we build (and rebuild) the client to match the selection.
function build(key) {
  const n = NETS[key];
  const c = new DAppClientCtor({ name: 'Sprinkler', network: { type: n.network, name: n.networkName, rpcUrl: n.rpc } });
  // octez.connect warns if ACTIVE_ACCOUNT_SET isn't subscribed; bridge it to the app.
  c.subscribeToEvent('ACTIVE_ACCOUNT_SET', (account) => {
    window.dispatchEvent(new CustomEvent('tez-account', { detail: (account && account.address) || null }));
  });
  return c;
}
async function ensure() {
  await readyPromise;
  if (loadError) throw new Error(loadError);
  const key = getPayNetKey();
  if (client && clientNet === key) return client;
  if (client) { try { await client.clearActiveAccount(); } catch (e) { } }  // drop the old network's session
  client = build(key); clientNet = key;
  return client;
}

// returns the connected address, prompting the wallet if needed
export async function connect() {
  const c = await ensure();
  const active = await c.getActiveAccount();
  if (!active) await c.requestPermissions();   // network is set on the client
  const acc = await c.getActiveAccount();
  return acc ? acc.address : null;
}
// returns the already-connected address, or null
export async function getActive() {
  const c = await ensure();
  const a = await c.getActiveAccount();
  return a ? a.address : null;
}
export async function disconnect() { if (client) await client.clearActiveAccount(); }
// rebuild for a new payout network, clearing any prior session
export async function setNetwork() { await ensure(); }
// recipients: [{ addr, mutez }] — one batched operation; the wallet forges + signs
export async function sprinkle(recipients) {
  const c = await ensure();
  const res = await c.requestOperation({
    operationDetails: recipients.map(r => ({
      kind: 'transaction',
      destination: r.addr,
      amount: String(r.mutez)   // mutez, as a string
    }))
  });
  return res.transactionHash || res.opHash || (res.transactionHashes && res.transactionHashes[0]) || '';
}
