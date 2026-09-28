/* ── network config ──────────────────────────────────────────────────
   Search + resolution (objkt, hack.tez, teztree, Tezos Domains) only have
   data on MAINNET, so reads always hit mainnet. The PAYOUT network defaults
   to Mainnet; the confirm dialog's network toggle is a hidden setting,
   revealed with the "t" key for testing on Shadownet with faucet tez.      */
export const NETS = {
  shadownet: { network: 'custom', networkName: 'Shadownet', rpc: 'https://rpc.shadownet.teztnets.com', explorer: 'https://shadownet.tzkt.io', testnet: true },
  mainnet: { network: 'mainnet', networkName: 'Mainnet', rpc: 'https://tezos-mainnet.octez.io', explorer: 'https://tzkt.io', testnet: false }
};
export const TZKT = 'https://api.tzkt.io';  // reads — always mainnet

let payNetKey = 'mainnet'; // default payout network

export const getPayNetKey = () => payNetKey;
export const setPayNetKey = key => { payNetKey = key; };
export const payNet = () => NETS[payNetKey];
