# Sprinkler

**Live:** https://pixelsushirobot.github.io/sprinkler/

Pour one pot of tez across nine creators in a single batched transaction. Pick
nine, choose how to split, connect a wallet, sign once — everyone gets watered,
and you get a shareable garden card.

Plain static site — `index.html`, `css/style.css`, and a handful of native ES
modules under `js/`. No bundler, no build step: every `js/*.js` file is
loaded directly by the browser via `<script type="module">` / `import`. The
wallet forges and signs; Sprinkler never touches the funds.

```
index.html        markup only
css/style.css      all styles
js/
  config.js        network config (Shadownet / Mainnet), active payout network
  dom.js           tiny $(id) helper
  state.js         the nine creators, split method, split math
  avatar.js        identicon generation (rng + SVG/canvas)
  escape.js        escapeHTML — for any third-party profile data going into innerHTML
  base58check.js   Tezos address checksum validation
  api.js           TzKT / objkt / hack.tez / Teztree resolution & search
  grid.js          the "your nine" grid, drag-to-reorder, method picker
  search.js        the search box + results dropdown
  presets.js       the 9 / 90 / 900 / Custom pot chips
  garden.js        the shareable "garden" canvas card
  overlay.js       confirm dialog, network toggle, sprinkle flow
  wallet.js        Octez Connect (tzip-10) integration
  main.js          bootstraps everything else
```

`wallet.js` catches its own CDN-load failure internally (`walletReady()` /
`walletLoadError()`) rather than throwing, so a bad CDN response degrades to
a clear in-app error instead of breaking the rest of the module graph — same
isolation goal as before, without needing a separate script tag or a
`window`-global bridge. See `SECURITY_AUDIT.md` for a from-an-attacker's-view
review of this codebase (now fully remediated).

## What it does

1. **Pick nine.** Search by name or paste addresses. Nine recipients, no more.
2. **Pick a pot.** Any amount of tez, with 9 / 90 / 900 presets.
3. **Choose how to sprinkle.** Five split methods (below).
4. **Sprinkle.** Connect a Tezos wallet and sign one batched payout — nine
   transfers in a single operation, amounts computed in exact mutez so the
   shares sum precisely to the pot.
5. **Share.** A generated "garden" card with everyone's avatar, plus a link to
   the transaction and share buttons (X, Farcaster, Bluesky).

## The five ways to split

Every method clears a small floor first, so nobody gets dust and no two shares
tie. Then the remainder is distributed by the method's weights:

- **Everyone Eats** — equal pour for all nine.
- **I Am The Boss** — drag to rank; #1 gets the biggest pour.
- **Big Tree Energy** — more to the most active onchain (by transaction count).
- **Save The Ants** — more to the least-funded (by current wallet balance).
- **YOLO** — weighted random, with a Jackpot mode that can swing big.

## What you can add

- **Names** — type a partial name to search three live directories at once:
  objkt aliases, hack.tez builders, and Teztree handles. Results are deduped by
  wallet and tagged by source; hack.tez rows also show builder status and
  project count.
- **`.tez` names** — any Tezos Domains name, including subdomains like
  `name.hack.tez`. Resolved via TzKT. When a wallet owns several names, the
  display name prefers its reverse (primary) record, then the shortest top-level
  name.
- **Raw addresses** — any `tz1` / `tz2` / `tz3` wallet. Paste one, or paste a
  whole list at once (newline / comma / space separated).
- **`KT1` contracts** — smart-contract donation addresses (e.g. a DAO or
  multisig) work **on mainnet**, as long as the contract can receive a plain tez
  transfer. They can't be used on a testnet — see limitations.

For display, a creator's name prefers a clean username (objkt alias, then
Teztree handle) over a raw `.tez` domain. Avatars come from each source's own
image service, so most recipients show a real picture.

## Networks

Search and resolution only have data on **mainnet** — objkt, hack.tez, Teztree,
and Tezos Domains are all mainnet catalogs. So search always runs against
mainnet.

The **payout network is a toggle in the confirm dialog** — *Shadownet · test* vs.
*Mainnet · real* — defaulting to Shadownet so anyone can run the full flow
(connect → sign → broadcast → share) with faucet tez before real money moves.
Flipping it rebuilds the wallet client and drops the current session, so you
reconnect on the newly selected network; the success link and footer follow the
choice automatically.

To test on Shadownet, point your wallet at the custom RPC
`https://rpc.shadownet.teztnets.com` and fund it from
`https://faucet.shadownet.teztnets.com`. To change the default the dialog opens
on, set `window.SPRINKLER_PAYNET` (`'shadownet'` or `'mainnet'`) near the top of
the script.

## Data / API stack

- **[Octez Connect](https://github.com/trilitech/octez.connect)**
  (`@tezos-x/octez.connect-sdk@5`, the tzip-10 wallet standard, formerly Beacon)
  — wallet connect + the batched payout. No Taquito: the wallet forges and signs,
  so there's no forging/bignumber dependency. Loaded via dynamic `import()` from
  esm.sh so a CDN failure surfaces an error instead of hanging.
- **[TzKT](https://api.tzkt.io)** — `.tez` name resolution (forward + reverse),
  account activity (`numTransactions`) and balance for the weighting methods, and
  the transaction explorer links.
- **[objkt](https://data.objkt.com/v3/graphql)** — alias search and clean display
  names (GraphQL); `avatar.objkt.com/v1/{address}` for avatars (custom if set,
  generated default otherwise).
- **hack.tez** — builder search (`/api/v1/members?q=`, substring over
  name/bio/skills/projects); `urls.avatar` for custom-or-generated hackatars.
- **Teztree** — handle directory (`/api/v1/handles/recent`, fetched once and
  filtered locally, since Teztree has no search endpoint).

Mainnet RPC is `https://tezos-mainnet.octez.io` (official Octez node). Avoid
`*.ecadinfra.com` — ECAD's free public RPC was retired 2026-05-31, and Ghostnet
is gone; Shadownet replaces it.

## Limitations

- **KT1 contracts are mainnet-only.** A smart contract has to be originated on
  the network you're sending on, so a mainnet contract doesn't exist on
  Shadownet — a test payout to it fails simulation. Sprinkler blocks this with a
  clear message and asks you to switch to mainnet. Also, not every KT1 can
  receive a plain transfer; contracts without a payable default entrypoint will
  fail even on mainnet.
- **"Save The Ants" uses current balance** as a funding proxy, not lifetime tez
  received. A wallet that earned a lot and spent it reads as "needy." Good
  enough as a signal; swap for a true total-received query to make it precise.
- **Search is mainnet-only.** On a testnet, name search returns little — use raw
  addresses there.
- **Garden card avatars need CORS.** The card exports via canvas, so an avatar
  only draws onto it if the image loads CORS-clean; otherwise that tile falls
  back to a monochrome identicon (so a cross-origin image can never taint the
  canvas and break the PNG export). The on-page tiles always show the avatar.
- **Custom testnets can be finicky.** Shadownet is a custom Beacon network; some
  wallets are picky about adding one.

## Deploy

Copy the whole repo (`index.html`, `css/`, `js/`, and the icon files) to any
static host — it's served as-is, no build step. Note that wallet connect and
the live API calls only work from a real host, not a sandboxed preview (CSP
blocks the CDN import and external
fetches).
