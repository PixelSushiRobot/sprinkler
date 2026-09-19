# Sprinkler

Pour one pot of tez across nine creators in a single batched transaction.
Single-file static site — no build step. Wallet + payout via Beacon + Taquito
(loaded from CDN as ES modules). Data resolves live via TzKT + objkt.

## Deploy (repo + Pages already set up)

1. Copy `index.html` into the repo root.
2. Commit and push:
   ```
   git add index.html README.md
   git commit -m "Live wallet connect + batch payout (Shadownet)"
   git push
   ```
3. Pages redeploys automatically. Hard-refresh the Pages URL.

> Wallet connect and the live API calls do **not** work inside a sandboxed
> preview (CSP blocks the CDN imports and external fetches). They only run once
> the file is served from GitHub Pages or any real host.

## Testing on Shadownet

Shadownet is Tezos's permanent staging testnet (Ghostnet was retired).

1. Point your wallet (Temple / Kukai) at Shadownet. It isn't a built-in
   network, so add it as a **custom RPC**: `https://rpc.shadownet.teztnets.com`.
   If your wallet can't add a custom testnet, use `octez-client` or a wallet
   that supports custom networks.
2. Fund it from the faucet: https://faucet.shadownet.teztnets.com
3. Add nine recipients that **exist on Shadownet** — raw `tz1…` addresses are
   safest (your own test wallets, faucet addresses). Shadownet has very few
   registered `.tez` names, so name resolution will usually fail there.
4. Set an amount, pick a method, hit **sprinkle → connect wallet → confirm**.
5. The success screen links to `shadownet.tzkt.io/<hash>` — confirm all nine
   transfers landed.

## Going to mainnet

Flip the values in the `SPRINKLER_CFG` block near the top of the `<script>`:

```js
window.SPRINKLER_CFG = {
  network: 'mainnet',
  networkName: 'Mainnet',
  rpc: 'https://tezos-mainnet.octez.io',
  tzkt: 'https://api.tzkt.io',
  explorer: 'https://tzkt.io'
};
```

Mainnet RPC options (public, current as of the Tezos docs):
- `https://tezos-mainnet.octez.io` — official Octez node (recommended)
- `https://mainnet.tezos.marigold.dev` — Marigold

> Do **not** use `*.ecadinfra.com` RPCs — ECAD's free public RPC service was
> retired on 2026-05-31. Ghostnet is gone too; Shadownet replaces it.

Also update the footer text ("on Shadownet for now") and swap the `PRESETS`
list for **real, resolvable** mainnet handles/addresses before launch.

## Known limits / next steps

- **Avatars** come from objkt (a mainnet catalog) — on Shadownet they fall back
  to generated identicons. Expected.
- **Big Tree / Save The Ants** weight by TzKT `numTransactions` (activity) and
  balance (funding proxy). Balance ≈ "how funded" is a rough stand-in; swap for
  a true total-received query later if you want it precise.
- **Discovery search** filters the curated `PRESETS` list plus manual
  address/name entry. Live objkt/hacktez/TezTree autocomplete is the next
  increment.
- The garden card keeps identicon avatars on purpose — drawing cross-origin
  objkt/IPFS images onto the canvas would taint it and break PNG export.
- Taquito/Beacon are pinned to `@21` on esm.sh. If a version resolves oddly,
  bump the pin in the module `import` lines.
- Shadownet is a **custom** Beacon network (`type: 'custom'` + explicit
  `rpcUrl`); some wallets are picky about custom testnets.

## How it works

- **Split math** — each recipient clears a floor, then the remainder is
  distributed by the method's weights, so no two shares tie and nobody gets dust.
- **Payout** — one Taquito `batch()` of nine transfers; amounts computed in exact
  mutez so the shares sum precisely to the pot.
- **Methods** — Everyone Eats (equal), I Am The Boss (drag-ranked), Big Tree
  Energy (most active onchain), Save The Ants (least funded), YOLO (weighted
  random, with a Jackpot mode).

---
*Drafted with Dia*
