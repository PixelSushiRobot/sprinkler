/* Apply a saved theme before first paint, so the page doesn't flash.
   A classic (non-module) script loaded in <head> before the stylesheet: it runs
   synchronously, before anything draws. DESIGN.md has this inline, but the page's CSP
   (script-src 'self' https://esm.sh) blocks inline scripts, so it lives in its own file.
   The key is `theme` (the PSR Kitchen standard); older visits saved it under
   `sprinkler-theme`, which is still read and moved across so nobody loses their choice. */
try {
  let t = localStorage.getItem('theme');
  if (t === null) {
    const old = localStorage.getItem('sprinkler-theme');
    if (old === 'light' || old === 'dark') { localStorage.setItem('theme', old); t = old; }
    localStorage.removeItem('sprinkler-theme');
  }
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) { }
