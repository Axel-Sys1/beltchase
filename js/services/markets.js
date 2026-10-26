// Paris d'un combat. Trois marchés, chacun avec ses cotes dans match.odds :
// - vainqueur : '1' / '2' (et 'X' si le sport a le nul) ;
// - vainqueur + méthode : '1-KO', '2-SUB', '1-DEC'… (méthodes du sport, voir sports.js) ;
// - fin du combat : 'R1' … 'R5' (arrêt pendant ce round, quel que soit le vainqueur) ou 'DEC'
//   (le combat va au bout). Seulement pour les combats en 5 rounds au plus.
// Le résultat d'un combat (match.result = { method, round }) règle les deux derniers marchés ;
// si la source ne donne pas la méthode, ces paris sont remboursés.
import { sportMeta } from '../sports.js';
import { fromProbabilities } from '../providers/odds.js';

export const METHOD_LABEL = { KO: 'KO/TKO', SUB: 'Soumission', DEC: 'Décision', FALL: 'Tombé' };
export const MAX_ROUND_MARKET = 5;
const EXOTIC_MARGIN = 0.1; // marchés plus fins : marge un peu plus large

// Part de chaque méthode dans les victoires, par sport (moyennes UFC/PFL, boxe pro, kick…).
const METHOD_SHARE = {
  mma: { KO: 0.33, SUB: 0.19, DEC: 0.48 },
  boxing: { KO: 0.5, DEC: 0.5 },
  kickboxing: { KO: 0.32, DEC: 0.68 },
  bjj: { SUB: 0.45, DEC: 0.55 },
  wrestling: { FALL: 0.3, DEC: 0.7 },
};
// Arrêts : de plus en plus rares au fil des rounds (fatigue, prudence).
const ROUND_DECAY = 0.8;

export const marketOf = (key) => (key === '1' || key === '2' || key === 'X' ? 'winner' : /^[12]-/.test(key) ? 'method' : 'end');

// Arrêts possibles d'un combat (méthodes autres que la décision).
const finishMethods = (sport) => (sportMeta(sport).methods || []).filter((k) => k !== 'DEC');

// Probabilités du round d'arrêt, sachant qu'il y a arrêt.
function roundShares(rounds) {
  const w = Array.from({ length: rounds }, (_, i) => ROUND_DECAY ** i);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

// Cotes des marchés méthode et fin du combat, à partir des chances de victoire { 1, 2 }.
export function fightOdds(sport, win, rounds = 3) {
  const share = METHOD_SHARE[sport];
  if (!share || !(win?.[1] > 0) || !(win?.[2] > 0)) return {};
  const total = win[1] + win[2];
  const method = {};
  for (const side of ['1', '2']) {
    for (const [k, p] of Object.entries(share)) method[`${side}-${k}`] = (win[side] / total) * p;
  }
  const odds = fromProbabilities(method, EXOTIC_MARGIN);
  if (rounds > 0 && rounds <= MAX_ROUND_MARKET && share.DEC !== undefined) {
    const finish = 1 - share.DEC;
    const end = { DEC: share.DEC };
    roundShares(rounds).forEach((p, i) => { end[`R${i + 1}`] = finish * p; });
    Object.assign(odds, fromProbabilities(end, EXOTIC_MARGIN));
  }
  return odds;
}

// Tirage d'un résultat cohérent avec ces probabilités (combats fictifs) : { method, round }.
export function drawResult(sport, rounds, rnd = Math.random) {
  const share = METHOD_SHARE[sport] || { DEC: 1 };
  let r = rnd();
  let method = 'DEC';
  for (const [k, p] of Object.entries(share)) if ((r -= p) <= 0) { method = k; break; }
  if (method === 'DEC' || !rounds) return { method, round: rounds || null };
  let q = rnd();
  const shares = roundShares(rounds);
  for (let i = 0; i < shares.length; i++) if ((q -= shares[i]) <= 0) return { method, round: i + 1 };
  return { method, round: rounds };
}

// Règlement d'un pari sur ce match terminé : 'won' | 'lost' | 'void'.
export function settleKey(key, m) {
  if (m.outcome === 'void') return 'void';
  if (marketOf(key) === 'winner') return key === m.outcome ? 'won' : 'lost';
  const r = m.result;
  if (!r?.method) return 'void'; // méthode inconnue de la source : remboursé
  if (marketOf(key) === 'method') {
    const [side, method] = key.split('-');
    return side === m.outcome && method === r.method ? 'won' : 'lost';
  }
  if (key === 'DEC') return r.method === 'DEC' ? 'won' : 'lost';
  const round = Number(key.slice(1));
  if (r.method === 'DEC') return 'lost';
  if (!r.round) return 'void';
  return r.round === round ? 'won' : 'lost';
}

// Libellés : « Gane par KO/TKO », « Arrêt au round 2 », « Va à la décision ».
export function marketLabel(m, key, name = (side) => (side === '1' ? m.home?.name : m.away?.name)) {
  if (marketOf(key) === 'method') {
    const [side, method] = key.split('-');
    return `${name(side)} par ${METHOD_LABEL[method] || method}`;
  }
  if (key === 'DEC') return 'Va à la décision';
  return `Arrêt au round ${key.slice(1)}`;
}

// Résultat lisible : « KO/TKO · R2 », « Décision ».
export const resultText = (r) => (r?.method ? `${METHOD_LABEL[r.method] || r.method}${r.method !== 'DEC' && r.round ? ` · R${r.round}` : ''}` : '');
