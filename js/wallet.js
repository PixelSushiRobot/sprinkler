/* Tezos wallet connect + batch payout via Octez Connect (tzip-10). Wallet forges + signs;
   no Taquito, no build step. Kept isolated from the rest of the app (window.tez / window.tezError
   / the 'tez-ready' event) so a CDN failure here surfaces an error instead of hanging the page. */
import { NETS, getPayNetKey } from './config.js';

try {
  const { DAppClient } = await import('https://esm.sh/@tezos-x/octez.connect-sdk@5?bundle');
  // The payout network is chosen at runtime, but a DAppClient fixes its network
  // at construction — so we build (and rebuild) the client to match the selection.
  let client = null, clientNet = null;
  function build(key) {
    const n = NETS[key];
    const c = new DAppClient({ name: 'Sprinkler', network: { type: n.network, name: n.networkName, rpcUrl: n.rpc } });
    // octez.connect warns if ACTIVE_ACCOUNT_SET isn't subscribed; bridge it to the app.
    c.subscribeToEvent('ACTIVE_ACCOUNT_SET', (account) => {
      window.dispatchEvent(new CustomEvent('tez-account', { detail: (account && account.address) || null }));
    });
    return c;
  }
  async function ensure() {
    const key = getPayNetKey();
    if (client && clientNet === key) return client;
    if (client) { try { await client.clearActiveAccount(); } catch (e) { } }  // drop the old network's session
    client = build(key); clientNet = key;
    return client;
  }

  window.tez = {
    // returns the connected address, prompting the wallet if needed
    async connect() {
      const c = await ensure();
      const active = await c.getActiveAccount();
      if (!active) await c.requestPermissions();   // network is set on the client
      const acc = await c.getActiveAccount();
      return acc ? acc.address : null;
    },
    // returns the already-connected address, or null
    async getActive() {
      const c = await ensure();
      const a = await c.getActiveAccount();
      return a ? a.address : null;
    },
    async disconnect() { if (client) await client.clearActiveAccount(); },
    // rebuild for a new payout network, clearing any prior session
    async setNetwork() { await ensure(); },
    // recipients: [{ addr, mutez }] — one batched operation; the wallet forges + signs
    async sprinkle(recipients) {
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
  };
} catch (e) {
  window.tezError = (e && e.message) || 'wallet library failed to load';
  console.error('[sprinkler] wallet load failed:', e);
} finally {
  window.dispatchEvent(new Event('tez-ready'));
}
