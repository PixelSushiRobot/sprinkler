# Sprinkler

Pour one pot of tez across nine creators in a single batched transaction.
Single-file static site — no build step. Wallet + payout via Beacon + Taquito
(loaded from CDN as ES modules). Data resolves live via TzKT + objkt.

## Deploy (repo + Pages already set up)

1. Copy `index.html` into the repo root (replacing the old one).
2. Commit and push:
   ```
   git add index.html
   git commit -m "Live wallet connect + batch payout (Ghostnet)"
   git push
   ```
3. Pages redeploys automatically. Hard-refresh the Pages URL.

> The wallet + live API calls do **not** work inside the Dia artifact preview
> (its CSP blocks the CDN imports and external fetches). They only run once the
> file is served from GitHub Pages (or any real host).

## Testing on Ghostnet

1. Set your wallet (Temple / Kukai) to **Ghostnet**.
2. Fund it from a faucet: https://faucet.ghostnet.teztnets.com
3. Add nine recipients that **exist on Ghostnet** — raw `tz1…` addresses are the
   safest (your own test wallets, or faucet addresses). Ghostnet has very few
   registered `.tez` names, so name resolution will usually fail there.
4. Set an amount, pick a method, hit **sprinkle** → **connect wallet** → confirm.
5. The success screen links to `ghostnet.tzkt.io/<hash>` — verify all nine
   transfers landed.

## Going to mainnet

Flip the four values in the `SPRINKLER_CFG` block near the top of the `<script>`:

```js
window.SPRINKLER_CFG = {
  network: 'mainnet',
  rpc: 'https://mainnet.ecadinfra.com',
  tzkt: 'https://api.tzkt.io',
  explorer: 'https://tzkt.io'
};
```

Also update the footer text ("on Ghostnet for now") and swap the `PRESETS` list
for **real, resolvable** mainnet handles/addresses before launch.

## Known limits / next steps

- **Avatars** come from objkt, which is a mainnet catalog — on Ghostnet they'll
  fall back to generated identicons. That's expected.
- **Big Tree / Save The Ants** weight by TzKT `numTransactions` (activity) and
  balance (funding proxy). Balance ≈ "how funded" is a rough stand-in; swap for a
  true total-received query later if you want it precise.
- **Discovery search** still filters the curated `PRESETS` list plus manual
  address/name entry. Live objkt/hacktez/TezTree text-search autocomplete is the
  next increment (needs testing against real response shapes).
- The garden card keeps identicon avatars on purpose — drawing cross-origin
  objkt/IPFS images onto the canvas would taint it and break PNG export.
- Taquito/Beacon are pinned to `@21` on esm.sh. If a version resolves oddly,
  bump the pin in the module `import` lines.

---
*Drafted with Dia*
