/* model — the nine creators, the split method, and the split math */

export function makeCreator(input) {
  input = input.trim();
  const isAddr = /^(tz1|tz2|tz3|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/.test(input);
  const isName = /^([a-z0-9][a-z0-9-]{0,62}\.)+tez$/i.test(input);
  if (!isAddr && !isName) return null;
  const seed = input.toLowerCase();
  return {
    id: seed,
    name: isName ? seed : input.slice(0, 6) + '…' + input.slice(-4),
    addr: isAddr ? input : null,        // .tez names resolve asynchronously
    avatar: null,
    activity: 50, received: 50,          // neutral until enriched from TzKT
    _yolo: Math.random(), _isJackpotWinner: false,
    _input: input, _isAddr: isAddr, _loading: true, _err: null
  };
}

export const creators = [];
export let method = 'equal';
export let yoloLevel = 'wild';
export let lastHash = '';

export function setMethod(k) { method = k; }
export function setYoloLevel(k) { yoloLevel = k; }
export function setLastHash(h) { lastHash = h; }

export function full() { return creators.length === 9; }

export const METHODS = [
  { k: 'equal', n: 'Everyone Eats', t: 'EQUAL', d: 'No one left behind — an equal pour for all nine.' },
  { k: 'boss', n: 'I Am The Boss', t: 'RANKED', d: 'Drag to rank — #1 gets the biggest pour.' },
  { k: 'tree', n: 'Big Tree Energy', t: 'MOST ACTIVE', d: 'More to the most active onchain.' },
  { k: 'ants', n: 'Save The Ants', t: 'SMOL BAGS', d: 'More to the least-funded so far.' },
  { k: 'yolo', n: 'YOLO', t: 'RANDOM', d: 'Chance rolls it — crank the wildness, and Jackpot swings big.' },
];

export function rollYolo() {
  const n = creators.length;
  if (yoloLevel === 'jackpot') {
    const isTrueJackpot = Math.random() < 0.35;
    const winner = isTrueJackpot ? Math.floor(Math.random() * n) : -1;
    creators.forEach((c, i) => {
      c._isJackpotWinner = (i === winner);
      if (isTrueJackpot) {
        c._yolo = (i === winner ? 1 : Math.random() * 0.15);
      } else {
        c._yolo = Math.pow(Math.random(), 6);
      }
    });
  } else {
    creators.forEach(c => {
      c._yolo = Math.random();
      c._isJackpotWinner = false;
    });
  }
}

/* split math */
function rawWeights() { switch (method) { case 'equal': return creators.map(() => 1); case 'boss': return creators.map((c, i) => Math.pow(0.78, i)); case 'tree': return creators.map(c => 0.12 + c.activity / 100); case 'ants': return creators.map(c => 0.12 + (1 - c.received / 100)); case 'yolo': { const P = yoloLevel === 'chill' ? 1.5 : yoloLevel === 'jackpot' ? 6 : 3.5; return creators.map(c => Math.pow(c._yolo, P) + 0.001); } } }
function effFloor() { return (method === 'yolo' && yoloLevel === 'jackpot') ? 2.5 : 5; }
export function computeSplit() {
  const n = creators.length; if (n === 0) return [];
  let w = rawWeights(); if (!w || w.every(x => x <= 0)) w = creators.map(() => 1);
  const eff = Math.min(effFloor(), 100 / n), rem = 100 - eff * n, sumW = w.reduce((a, b) => a + b, 0);
  return w.map(x => eff + (sumW > 0 ? rem * (x / sumW) : rem / n));
}
export function displayOrder() { return creators.map((c, i) => i); }
