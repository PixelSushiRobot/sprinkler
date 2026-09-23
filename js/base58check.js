/* Base58Check validation for Tezos addresses. The regex in state.js only
   checks prefix + length/alphabet; it accepts any string of the right shape,
   typo included. This verifies the actual embedded checksum, the same check
   a wallet does before it will sign anything. See SECURITY_AUDIT.md finding #5. */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(str) {
  let num = 0n;
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    num = num * 58n + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  for (const ch of str) { if (ch !== '1') break; bytes.unshift(0); }
  return new Uint8Array(bytes);
}

/* tz1/tz2/tz3/KT1 all base58check-decode to 27 bytes: a 3-byte version
   prefix, a 20-byte hash, and a 4-byte checksum (the first four bytes of
   SHA-256(SHA-256(prefix + hash))). */
export async function isValidTezosAddress(addr) {
  if (!/^(tz1|tz2|tz3|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return false;
  const decoded = base58Decode(addr);
  if (!decoded || decoded.length !== 27) return false;
  const payload = decoded.slice(0, 23);
  const checksum = decoded.slice(23);
  const hash1 = new Uint8Array(await crypto.subtle.digest('SHA-256', payload));
  const hash2 = new Uint8Array(await crypto.subtle.digest('SHA-256', hash1));
  for (let i = 0; i < 4; i++) if (hash2[i] !== checksum[i]) return false;
  return true;
}
