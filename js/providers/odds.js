// Cotes : conversion des cotes bookmaker et modèle maison quand aucune n'est publiée.
// Formules calibrées sur les cotes DraftKings d'ESPN (voir README, section Cotes).
import { clamp } from '../util.js';

export const MARGIN = 0.07;
export const MIN_ODDS = 1.05;
export const MAX_ODDS = 15;

const logistic = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));

// ─── Conversions ─────────────────────────────────────────────────────────────
// Cote américaine (nombre ou texte '+120', '-150', 'EVEN') → cote décimale. 'OFF', vide → null.
export function americanToDecimal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') {
    const t = v.trim().toUpperCase();
    if (t === 'EVEN' || t === 'EV') return 2;
    if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
    v = Number(t);
  }
  if (!Number.isFinite(v) || v === 0) return null;
  if (v > 0 && v < 100) return null; // valeur incohérente
  return v > 0 ? 1 + v / 100 : 1 + 100 / Math.abs(v);
}

// ─── Mise en forme des cotes ─────────────────────────────────────────────────
// Probabilités { 1, X?, 2 } (somme ≈ 1) → cotes décimales avec la marge Gold.
export function fromProbabilities(probs, margin = MARGIN) {
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  const odds = {};
  for (const [k, p] of Object.entries(probs)) {
    const q = p / total;
    odds[k] = clamp(Math.floor(100 / (q * (1 + margin))) / 100, MIN_ODDS, MAX_ODDS);
  }
  return odds;
}

// Cotes décimales d'un bookmaker → probabilités sans marge.
export function devig(decimalOdds) {
  const inv = {};
  let sum = 0;
  for (const [k, d] of Object.entries(decimalOdds)) {
    if (!(d > 1)) return null;
    inv[k] = 1 / d;
    sum += inv[k];
  }
  for (const k of Object.keys(inv)) inv[k] /= sum;
  return inv;
}

// Cotes bookmaker → cotes BeltChase (même marge pour toutes les sources). null si incomplet.
export function fromBookmaker(decimalOdds, margin = MARGIN) {
  const probs = devig(decimalOdds);
  return probs ? fromProbabilities(probs, margin) : null;
}

// ─── Bilans ──────────────────────────────────────────────────────────────────
// Bilan 'V-D-N' d'un combattant (MMA, boxe) → { w, l, d }.
export function parseRecord(summary) {
  const parts = String(summary ?? '').split(/[-–]/).map((x) => parseInt(x, 10));
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return { w: parts[0], l: parts[1], d: parts[2] || 0 };
}

// ─── Modèles ─────────────────────────────────────────────────────────────────
// MMA et boxe : bilans V-D-N des combattants. Non calibré : les cotes bookmaker sont prioritaires.
export function combatProbs(a, b) {
  const rate = (r) => (r ? (r.w + 3) / (r.w + r.l + 6) : 0.5);
  const p = logistic(1.2 * (logit(rate(a)) - logit(rate(b))));
  const p1 = clamp(p, 0.08, 0.92);
  return { 1: p1, 2: 1 - p1 };
}

// Rien de connu sur les participants : cotes prudentes et égales.
export const neutralProbs = (hasDraw) => (hasDraw ? { 1: 0.4, X: 0.27, 2: 0.33 } : { 1: 0.5, 2: 0.5 });
