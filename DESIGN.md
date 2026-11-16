# PSR Kitchen — Design System

The visual language behind PixelSushiRobot tools (**fit.gif**, **Sprinkler**, and everything after). A monochrome, monospace, terminal-adjacent aesthetic for small single-purpose web apps that run entirely in the browser. This document is the spec: hand it to a fresh build and you'll get an app that looks like it came from the same shop.

Everything here is grayscale, hairline-bordered, and keyboard-navigable. No build step is assumed — these are patterns for hand-written HTML/CSS/JS.

## Principles

- **Monochrome only.** No hues, ever. The UI is grayscale ramps plus a single "accent" that is itself the strongest text color. Status, selection, success, and danger are expressed through weight, contrast, fill inversion, and marker glyphs — never color. **Errors included: the error state is a marked, brightened gray, not red.**
- **Monospace everywhere.** One typeface for headings, body, numbers, and inputs. It reads as precise and tool-like, and makes numeric columns line up for free.
- **Uppercase + wide tracking for structure.** Labels, section titles, and buttons are uppercase with generous letter-spacing. Sentence-case is reserved for body copy and hints.
- **Hairline borders do the work.** 1px lines separate everything. Almost no shadows, no gradients (except functional checkerboards), and no rounded corners beyond pills.
- **Borders derive from text color.** Interactive borders are mixed from the element's own `currentColor`, so one `color` change on hover/select cascades to the border with no separate rule.
- **Three themes, one set of variable names.** Dark (default), light, and system. Every color is a CSS custom property; a component never hard-codes a value.
- **Numbered, sequential panels.** The workflow is broken into `01 / 02 / 03 / 04` panels so the user always knows the order of operations.
- **Keyboard-navigable by default.** Every interactive surface works without a mouse: correct tab order, Enter to act, Esc to dismiss, arrow keys inside list widgets, focus trapped in modals, and a visible focus ring for keyboard users.

## Color tokens

All color lives in CSS custom properties. Components reference the variable, never the literal. Define the same names three times: `:root` / `[data-theme="dark"]` (default), `[data-theme="light"]`, and a `@media (prefers-color-scheme: light)` block scoped to `:root:not([data-theme])` for system-follow.

Token names are **role-based, not numbered** — a name should say what a value is *for*, not where it sits in a ramp.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` | `#0a0a0b` | `#f4f4f2` | Page background |
| `--panel` | `#0e0e10` | `#ffffff` | Panel & dialog fill |
| `--inset` | `#111113` | `#ffffff` | Surface set *into* a panel: tiles, dropzones, share boxes, meter tracks |
| `--line` | `#2a2a2e` | `#d4d4cf` | Primary hairline border |
| `--divider` | `#1c1c20` | `#e6e6e1` | Fainter inner separator: header underlines, row dividers |
| `--ink` | `#ececef` | `#16161a` | Primary text |
| `--muted` | `#7c7c85` | `#6a6a70` | Secondary text, labels |
| `--dim` | `#55555d` | `#9a9a9f` | Tertiary text, captions, footer |
| `--accent` | `#ececef` | `#16161a` | = strongest text; emphasis + fills |
| `--accent-dim` | `#55555d` | `#9a9a9f` | Muted accent |
| `--on-accent` | `#0a0a0b` | `#ffffff` | Text/icon on an accent fill (inverts) |
| `--good` | `#ececef` | `#16161a` | Success (= text — no green) |
| `--bad` | `#b7b7bd` | `#55555a` | Danger / error / over-limit (a dimmer gray — no red) |
| `--chip` | `#16161a` | `#f0f0ec` | Chip / verdict / callout fill |
| `--checker-a` / `--checker-b` | `#1a1a1e` / `#111` | `#e2e2dd` / `#f4f4f2` | Transparency checkerboard (optional — image-preview apps only) |

**Key idea:** `--accent` equals the brightest text color. To "highlight" something you raise its text toward `--accent` or fill it with `--accent` and flip the text to `--on-accent`. This is why emphasis and success never introduce a new hue.

### Migration mapping

Both shipped projects predate these names. Values are identical — only names change, so nothing shifts visually.

| Canonical | fit.gif was | Sprinkler was |
|---|---|---|
| `--ink` | `--text` | `--ink` ✓ |
| `--panel` | `--panel-bg` | `--box` |
| `--inset` | `--bg-2` | `--bg2` |
| `--divider` | `--line-2` | `--line-2` ✓ |
| `--good` / `--bad` / `--accent-dim` | present ✓ | **add** |

`--good`, `--bad`, and `--accent-dim` must exist in every project even if unused at first — they're how status stays monochrome.

### Deriving borders from text color

```css
border: 1px solid color-mix(in srgb, currentColor 50%, transparent);
```

Change `color` on hover/selected and the border tracks it automatically. `color-mix` also draws the faint state fills — **mixed from the surface the element sits on, not the page `--bg`.** A control on a panel tints from `--panel`; a control directly on the page tints from `--bg`. (In light mode `--panel` is `#fff` while `--bg` is `#f4f4f2`, so a fill mixed from `--bg` reads as a gray patch on a white panel — always tint from the actual surface.)

```css
/* control on a panel (option rows, chips, tiles): */
background: color-mix(in srgb, var(--panel) 95%, var(--ink) 5%);  /* selected tint */
background: color-mix(in srgb, var(--panel) 96%, var(--ink) 4%);  /* barely-there hover */
```

## Typography

```css
font-family: 'SF Mono', 'JetBrains Mono', 'Menlo', 'Consolas', ui-monospace, monospace;
line-height: var(--lh-normal);
-webkit-font-smoothing: antialiased;
```

One monospace stack for the whole app. Note: `<input>` (especially `type=number`) does **not** reliably inherit the family via `font: inherit` — restate the full stack on inputs.

### Type scale — Major Second (1.125)

Every font size is a token, in `rem` (root 16px) so it respects browser zoom. The ladder steps by ~1.125 and is intentionally dense — the UI is compact monospace. Reference the token, never a px literal.

| Token | rem | px | Role |
|---|---|---|---|
| `--fs-micro` | 0.5 | 8 | Tiny markers only (a tile's status flag). Sub-scale exception — never reading text. |
| `--fs-2xs` | 0.625 | 10 | Micro uppercase: panel title `h2`, caption, footer |
| `--fs-xs` | 0.6875 | 11 | Control base: tags, chips, inputs, hints, dropdown rows |
| `--fs-sm` | 0.78125 | 12.5 | Reading body, sub, buttons, tile names, option/method labels |
| `--fs-md` | 0.875 | 14 | Number input + preset chips (the one row where figures run larger) |
| `--fs-lg` | 1 | 16 | Prominent figures (the success headline) |
| `--fs-display` | `clamp(1.375rem, 3.2vw, 2.125rem)` | 22–34 | `h1` |

**The tag rule.** A `.tag`/chip is always **one step down the scale from its label**, never a fixed px. Sprinkler and fit.gif both put the option label at `--fs-sm` (12.5), so the tag is `--fs-xs` (11) — one step down. Promote a label a step and its tag follows with no other change. This retires the old hard-coded "chip = 9.5px." For it to hold, the pill's metrics must be relative (see *Spacing & radius* → typographic spacing).

### Line-height

Unitless, so they scale with any size.

| Token | Value | Use |
|---|---|---|
| `--lh-tight` | 1.1 | Display / `h1` |
| `--lh-snug` | 1.35 | Chips, tight labels |
| `--lh-normal` | 1.55 | Body, hints, most UI text |

### Tracking (letter-spacing)

A rule, not a strict scale: **the smaller and more structural the uppercase text, the wider the tracking.** Reading copy stays sentence-case at 0. Recurring values are tokenized; component one-offs (`0.04em` option label, `0.12em` tag, `0.08em`/`0.1em` misc) stay inline.

| Token | Value | Use |
|---|---|---|
| `--track-wide` | 0.2em | Panel titles, dialog headings |
| `--track-label` | 0.14em | Buttons, section labels, footer |
| `--track-tight` | -0.01em | Display / `h1` |

### Roles at a glance

| Element | Size | Weight | Case / tracking |
|---|---|---|---|
| `h1` | `--fs-display` | 600 | uppercase, `--track-tight` |
| Panel title `h2` | `--fs-2xs` | 600 | uppercase, `--track-wide`, `--muted` |
| Button `.btn` | `--fs-sm` | 600 | uppercase, `--track-label` |
| Option / method label | `--fs-sm` | 600 | uppercase, `0.04–0.06em` |
| Tag `.tag` | `--fs-xs` | 400 | one step below its label |
| Body / sub | `--fs-sm` | 400 | sentence case, `--muted` |
| Hint | `--fs-xs` | 400 | sentence case, `--dim` |
| Preset chip / number input | `--fs-md` | 600 | — |
| Success figure | `--fs-lg` | 600 | — |
| Caption / footer | `--fs-2xs` | 400 | uppercase, wide |

## Spacing & radius

Structural spacing is a 4px scale — gaps, panel padding, margins between blocks. Reference the token, not a px.

| Token | px | | Token | px |
|---|---|---|---|---|
| `--sp-1` | 4 | | `--sp-6` | 24 |
| `--sp-2` | 8 | | `--sp-7` | 32 |
| `--sp-3` | 12 | | `--sp-8` | 48 |
| `--sp-4` | 16 | | `--sp-9` | 64 |
| `--sp-5` | 20 | | `--sp-10` | 80 |

**Two kinds of spacing, two mechanisms:**

- **Structural** — gaps, panel padding, block margins — uses `--sp-*` in px. A fixed grid, independent of font size.
- **Typographic** — padding *inside* a text element like the tag pill — uses `em`, so it grows with the text. The pill pads `0.28em 0.82em` with a line-box of `calc(var(--fs-xs) + 4px)`; both scale with the token, which is what lets the one-step-down tag rule hold at any label size instead of breaking against a hard-coded height.

**Match heights with a shared step, not a magic number.** When two controls must be the same height — Sprinkler's preset chips and the numeric field — give them the *same* `--sp-*` vertical padding (both `--sp-2`) rather than a hand-tuned literal. Equal padding + equal font + equal border = equal height, on-grid, and it can't drift.

**Off-grid nudges stay literal** — a `2px`/`11px` optical kerning around a unit suffix, a `1px` margin, `1ch` for a monospace-space gap, the `14px` checkerboard tile. They're deliberate corrections or textures, not scale steps; forcing them onto the grid breaks alignment. Keep them as literals with a comment saying why.

**Radius:** `--r-pill: 999px` for full pills (the `.tag`), `--r-full: 50%` for dots. Everything else is square — no incidental corner rounding.

## Layout

Both apps are two-column, so the numbers are fixed (not ranges):

- Page: `body` padding `0 var(--sp-6) var(--sp-10)`; content wrapper `max-width: var(--wrap)` (1160px), `margin: 0 auto`.
- Two equal columns: `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--sp-5); align-items: start;`. The `minmax(0, …)` is deliberate — it lets columns shrink below content width so long monospace strings (filenames, wallet addresses) don't blow out the track.
- Collapses to one column at `860px`.
- Panels: `var(--sp-5)` padding.
- Measure: header/hero text (`.sub`) caps at **one column** — `max-width: calc((var(--wrap) - var(--sp-5)) / 2)` — so it aligns under the left column instead of spanning the full width. The layout is column-driven; don't cap hero or body text with a `ch` reading measure (that heuristic is for long-form prose, which these apps don't have).
- Header is a `flex` row (`space-between`, `flex-wrap: wrap`, `align-items: flex-start`) with the title block left and the theme toggle right, separated from the body by a hairline `border-bottom`.

## Components

### Panel
The core container. Numbered title bar, hairline border, no radius.

```css
.panel { background: var(--panel); border: 1px solid var(--line); padding: var(--sp-5); }
.phead {
  text-transform: uppercase; letter-spacing: var(--track-wide); font-size: var(--fs-2xs); font-weight: 600;
  color: var(--muted); margin: 0 0 var(--sp-4); padding-bottom: var(--sp-3);
  border-bottom: 1px solid var(--divider);
  display: flex; align-items: center; gap: var(--sp-2);
}
.phead .step  { color: var(--accent); font-weight: 600; }   /* the 01/02 step marker */
.phead .count { margin-left: auto; color: var(--dim); }     /* optional right-aligned count */
```
The `01`/`02` step number (`.step`) sits in the title bar, and the whole bar is a real heading — `<h2 class="phead">`, not a styled `<div>` — so the panel structure is navigable by heading. The step marker is **`--accent`, weight 600** — the standard across every app, for maximum wayfinding. An optional right-aligned `.count` sits at `margin-left: auto` in `--dim` (e.g. `3 / 9`); not every panel needs one — Result-style panels skip it. (Reserve `.num` for a rendered *value* — e.g. a tile's XTZ amount — not the step marker.)

### Primary button (`.btn`)
Solid accent fill, inverted text, full width, uppercase wide tracking. Hover = `opacity: 0.82`. Disabled = `opacity: 0.3`.

```css
.btn {
  background: var(--accent); color: var(--on-accent); border: 1px solid var(--accent);
  padding: var(--sp-3) var(--sp-5); font-size: var(--fs-sm); font-weight: 600;
  text-transform: uppercase; letter-spacing: var(--track-label); width: 100%; cursor: pointer;
}
```
Disabled is just `opacity: 0.3` on the accent fill. Fading the bright accent to 30% over the panel lands on a mid-gray block in both themes — no separate disabled color.

### Ghost button (`.btn.ghost`)
Transparent with a `--line` border; hover brightens border/text to `--accent`. For secondary/optional actions (an "auto" or "fill" action preceding the primary one).

### Segmented control (`.seg` + scoped `.seg button`)
A bordered row (or column) of equal-flex buttons divided by 1px lines. Target the cells as a **scoped descendant** (`.seg button`) rather than inventing a `.seg-btn` class — the wrapper already names the pattern, so the buttons don't need to repeat it. The active segment gets the accent fill + `--on-accent` text — the same "fill to select" pattern as the primary button. **No border-radius** — the outer frame and cells stay square. Every toggle uses this: the theme toggle (icon scale, 32×30px cells), the network toggle, an art-type toggle. (Note: a plain flex row of separately-bordered buttons — e.g. Sprinkler's YOLO wildness levels — is *not* this pattern; it's a feature-local button group, not a joined segmented control.)

Concretely — four states, all monochrome, border derived from `--line` and the glyph/text from the text ramp:

```css
.seg                 { border: 1px solid var(--line); }               /* frame */
.seg button          { color: var(--dim); background: transparent; }  /* idle */
.seg button + button { border-left: 1px solid var(--line); }          /* divider between cells */
.seg button:hover    { color: var(--ink); }                           /* hover */
.seg button.on       { background: var(--accent); color: var(--on-accent); }  /* selected */
```

### Theme toggle (standard light / dark / system icons)

Every app ships the same light / dark / system switch — a `.seg` of three icon cells scoped by `id="themeToggle"`. Use these exact SVGs (sun = light, moon = dark, monitor = system) verbatim so the toggle is identical everywhere. Buttons carry `data-theme-set` (`light`/`dark`/`system`) and an `aria-label` (they're icon-only); the active cell gets `.on`. JS scopes to `#themeToggle button` so it never collides with another segmented control (e.g. a network toggle).

```html
<div class="seg" role="group" aria-label="Theme" id="themeToggle">
  <button data-theme-set="light" aria-label="Light theme" title="Light">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  </button>
  <button data-theme-set="dark" aria-label="Dark theme" title="Dark">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  </button>
  <button data-theme-set="system" aria-label="Follow system theme" title="Follow system" class="on">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  </button>
</div>
```

Cells are 32×30 with a 15px glyph; color, dividers, hover (`--ink`) and the `.on` accent fill all come from the shared `.seg` rules — so the toggle needs only its sizing:

```css
#themeToggle button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 30px; padding: 0; }
#themeToggle svg    { width: 15px; height: 15px; display: block; }
```

Wiring: default is `system` (no stored preference → follow OS via `prefers-color-scheme`); clicking `light`/`dark` sets `data-theme` on `<html>` and persists to `localStorage`, `system` clears both.

### Option row + tag (`.opt` + `.tag`)
The pick-one list pattern (method choices, target platforms). Full-width rows: `flex`, label left, a trailing **`.tag`** pill right (`margin-left: auto`). The row border is mixed from `currentColor`, so brightening the text auto-brightens the border in one move.

State model — **hover previews, selection commits** (a deliberate improvement over a shared hover/selected treatment, where a hovered-unselected row looks selected):
- **Hover** — text raises to `--ink`, **no fill**. Lightweight preview.
- **Selected** (`.on`/`.sel`) — text raises to `--ink`, a **faint 5% fill** (`color-mix(in srgb, var(--panel) 95%, var(--ink) 5%)`), and the border brightens to **`--ink 75%`**. The fill is what distinguishes selected from hover.

This selected treatment (5% fill + `--ink 75%` border) is **shared across the whole pick-one family** — full-width option rows and small preset chips alike — so "selected" reads identically at every scale.

The `.tag` is a **fully-rounded pill that inherits the row's color**, so it brightens *with* the row on hover/select rather than sitting static:

```css
.tag { color: inherit; opacity: .7;
       border: 1px solid color-mix(in srgb, currentColor 50%, transparent);
       border-radius: var(--r-pill); font-size: var(--fs-2xs); letter-spacing: 0.12em;
       line-height: calc(var(--fs-xs) + 4px); padding: 0.28em 0.82em; }
```
Both row and tag ease over `--t-state` (see Interaction & motion). The pill's `em` padding and `calc()` line-box track the label automatically — the line-box is `calc(var(--fs-xs) + 4px)`, keyed to the tag's own `--fs-xs` (identical to fit.gif), so the pill height tracks the tag size directly. An inline-editable variant keeps that same line-box and switches to `display: inline` with an inline `<input>`.

### Preset chips + unit input
A row of quick-value chips (`flex`, `gap: var(--sp-2)`, `flex-wrap`) beside a numeric field. Chips use the `currentColor` border and share the **exact selected treatment of the option rows** (5% fill + `--ink 75%` border + `--ink` text) — a chip is just a compact member of the pick-one family, so selection looks the same as it does on a method row. **Chips and the field share the same `--sp-2` vertical padding**, so they're the same height by construction rather than by a hand-tuned literal (see *Spacing & radius*). A "Custom" chip hands focus to the input. The field is a bordered `inline-flex` wrapping a borderless `<input type=number>` and a `--muted` unit suffix (`XTZ`, `MB`, `%`) so the unit reads as part of the control.

### Range slider
```css
input[type=range] { width: 100%; accent-color: var(--accent); height: 3px; background: var(--line); }
```
Native control, tinted by `accent-color`. Pair with a label row: bold uppercase label left, live value (in `--accent`) right.

### Select
Native `<select>` with `appearance: none`, transparent bg, `currentColor`-derived border, and a CSS chevron drawn via a wrapper `::after` (a rotated 45° box). Focus brightens the border to `--ink`; no glow.

### Search combobox + results dropdown
A text input that doubles as a search field and a browse menu.

- **Input** is `role="combobox"` with `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`. An absolutely-positioned `role="listbox"` dropdown sits directly below, shown/hidden with a `.show` class.
- **Rows** are `flex`: a ~28px avatar left, an info block (bold name that ellipsizes, uppercase `--dim` sub-line) right. Hover uses the barely-there tint.
- **Group headers** — a sticky, uppercase `--dim` label row separates categories (e.g. `creators` / `campaigns`); it can carry a right-aligned ghost text-button for a bulk action.
- **Empty-focus browse** — focusing an empty box shows a default browsable set; typing switches to live search; clearing returns to browse. Debounce lookups (~250ms) and guard out-of-order responses with a sequence counter.
- **Keyboard** — `↑`/`↓` move an `.active` highlight (same fill as hover), `Enter` picks the highlighted row (or the first), `Esc` clears, `Tab` closes. Track the active row with `aria-activedescendant`. Clicking outside closes without wiping typed text.

### Selectable card grid (tiles)
A grid of picked items. Each tile is a bordered square on `--inset` holding: an avatar, an ellipsized name, an optional status sub-line, and — layered behind — a **fill meter** (bottom-anchored `height: N%` block in a faint tint) that visualizes the item's share. Overlays: an absolute top-right **remove button** (`×`, always visible but `--muted`, brightening on hover, with an `aria-label`) and an optional **rank/crown marker**. Unfilled positions render as **empty dashed slots** (`1px dashed var(--line)`) so the target count is always visible.

### Avatar & identicon
Remote avatars (`<img>`) with a deterministic **generated SVG fallback** seeded from the item's id, so every entity has a stable mark even without a remote image. A strict CSP blocks inline `onerror`, so attach the fallback in JS:

```js
img.onerror = () => { img.onerror = null; img.src = identiconSVG(seed); };
```

### Modal / overlay dialog
```css
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(6px); display: none; }
.overlay.show { display: flex; align-items: center; justify-content: center; }
.dialog { background: var(--panel); border: 1px solid var(--line); max-width: 400px; max-height: 92vh; overflow: auto; padding: var(--sp-6); }
```
A blurred backdrop centers a hairline-bordered dialog with an absolute close button (`×`, `aria-label="close"`). Inside: **receipt rows** (key/value stack, `--divider` dividers, uppercase `--muted` key, bold value, `word-break: break-all` for addresses), a **data table** (borderless, `--divider` row dividers, optional inline meter cell), and **two panes** (confirm / success) toggled by `display`. **Focus management:** move focus in on open, trap `Tab`/`Shift+Tab` within visible enabled controls, `Esc` closes, return focus to the trigger on close.

### Status & errors (no color)
State reads from a **marker glyph + contrast**, never a hue.

- **Error** — text goes to `--ink` (brightest, so it stands out from surrounding `--muted`/`--dim`) with a leading **`[!]`** marker. The bracketed exclamation reads as a log/status tag, on-brand for the monospace look:
  ```css
  .err { color: var(--muted); }              /* base: neutral status line */
  .err.is-error { color: var(--ink); }
  .err.is-error::before { content: "[!] "; }
  ```
- **Inline field errors** collapse to zero space when empty, so layout reserves no gap:
  ```css
  .err:empty { display: none; }
  .err:not(:empty) { margin-top: var(--sp-3); }
  ```
- **Tiny inline status** (a sub-line under a tile name) uses plain `--bad` gray, uppercase — a whisper, not a form error. Reserve `[!]` for the primary error line.
- Join multiple outcomes on one line with `·` (`added 5 · 1 already in`).

Alternate markers, if a project wants a heavier signal: a CSS-drawn warning triangle rendered as a `currentColor` mask (an SVG mask, so it inverts with the theme) — but `[!]` is the house default.

### Progress / meter bars
Hairline-bordered tracks (`--inset`) with an `--accent` fill. Three flavors: a determinate bar (`width` transition), an indeterminate `sweep` keyframe (~35%-wide fill translating left→right on a 1s loop), and a result meter with an absolutely-positioned limit marker (`CAP`) via `::after`.

### Verdict / callout
A dot + text on a `--chip` fill inside a hairline border. Success uses a `--ink`/`--good` border and filled dot; failure uses a `--line` border and a hollow `--muted`-ringed dot. No red/green — state reads from fill vs. outline. A left-accent-bar variant (`border-left: 3px solid var(--ink)`) is used for advisories.

### Transparency checkerboard (optional)
Only for apps previewing images with alpha:

```css
background: repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%) 0 0 / 14px 14px;
```

## Interaction & motion

Motion is tokenized so nothing is a one-off — **one easing curve, three duration roles**, defined once in `:root`:

```css
--ease:     cubic-bezier(.2, .8, .2, 1);  /* every transition uses it */
--t-state:  .12s;   /* color / background / border / opacity on interactive controls */
--t-move:   .22s;   /* transform: drag-lift, reordering */
--t-reveal: .45s;   /* size reveals: meter fills, height/width */
```

- **State** (`--t-state`) is applied through a *single shared rule* that lists every interactive selector (`.btn`, option rows, chips, toggles, `select`, search rows, tags). New interactive components get added to that one rule — never a per-component `transition`. Enumerate the properties (`color, background-color, border-color, opacity`); never `transition: all`.
- **Move** (`--t-move`) and **Reveal** (`--t-reveal`) are per-element (`transform` / `height`) but reuse the same `--ease`.
- No transforms-on-hover, no shadows (the modal backdrop blur is the one exception). State reads from contrast shift and fill inversion.
- Show/hide toggles a `.show` class on `display` (not animated).
- Custom text selection is theme-tinted: `::selection { background: color-mix(in srgb, currentColor 22%, transparent); }`.

## Accessibility & keyboard

Part of the design, not a retrofit:

- **Tab order** follows visual/DOM order top-to-bottom; never reorder with positive `tabindex`.
- **Focus ring** — suppress for mouse, show for keyboard:
  ```css
  button:focus-visible, a:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  ```
  Inputs may instead brighten their own border to `--ink` on focus (no glow).
- **Enter / Esc** — Enter activates the primary or highlighted control; Esc dismisses menus and modals.
- **Listbox widgets** — arrow-key movement over an `.active` option, `role="listbox"`/`role="option"`, `aria-activedescendant` on the input.
- **Modals** — focus moves in on open, is trapped while open, returns to the trigger on close.
- **Icon-only buttons** carry an `aria-label` (`×` remove/close, theme icons).

## Voice & copy

Two registers, matching the type scale:

- **Structural labels** are terse and uppercase: `YOUR GIF`, `TARGET PLATFORM`, `PICK YOUR PEOPLE`. No articles, no punctuation.
- **Hints and body** are plain, opinionated, sentence-case sentences that explain the *why* — "On flat art, cut colors first — resize is the fallback for tight caps." They read like a knowledgeable tool author, not marketing copy.

A project may layer a **playful brand voice** on top (Sprinkler's lowercase, dry, wholesome register) — keep it in the body/hint layer; structural labels stay uppercase and terse regardless.

**Footer** states the app's core promise in dim, wide-tracked uppercase, `·` between clauses — either a single centered line (`RUNS ENTIRELY IN YOUR BROWSER · YOUR GIF NEVER LEAVES YOUR DEVICE`) or a short stack of promise lines.

## Recipe for a new app

1. Paste the three `:root` theme blocks (canonical token names) **and the shared scale block (`--fs-*`, `--lh-*`, `--track-*`, `--sp-*`, `--r-*`)**; wire a three-way toggle (light / dark / system) that sets `data-theme` on `<html>`; leave the attribute off for system-follow.
2. Set the monospace stack and `line-height: var(--lh-normal)` on `body`; center a `max-width: 1160px` wrapper.
3. Build the page as numbered `.panel`s in a two-column `minmax(0,1fr)` grid that collapses at 860px.
4. Use `.btn` for the one primary action, `.btn.ghost` for secondary, `.seg` for either/or toggles, `.opt` + `.tag` for pick-one lists, and the search combobox for anything with more than a handful of options.
5. Size everything from the scale: a label picks an `--fs-*` step and its tag takes the step below; structural gaps/padding use `--sp-*`, text-internal padding (pills) uses `em`, and two controls match height by sharing a `--sp-*` step — never a magic px. Off-grid optical nudges stay literals, with a comment saying why.
6. Keep it grayscale. If you reach for a color to signal something — including errors — use a marker glyph (`[!]`), fill-vs-outline, or a text-weight shift instead.
7. Uppercase + wide tracking for anything structural; sentence case for anything you actually read.
8. Wire keyboard support as you build each widget (tab order, Enter/Esc, arrow nav, focus-visible), not at the end.
