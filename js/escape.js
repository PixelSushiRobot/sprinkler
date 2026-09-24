/* Escapes a value for safe interpolation into an HTML template literal, in
   either a text-node position or a double-quoted attribute value. Everything
   rendered here (creator names, avatar/logo URLs, search-result metadata) can
   originate from a third-party profile a stranger controls (objkt alias,
   hack.tez name, Teztree handle) — never interpolate one of those fields into
   innerHTML without this. See SECURITY_AUDIT.md finding #1. */
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
