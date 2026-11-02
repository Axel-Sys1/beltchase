// Petites fonctions de lecture sur un match, partagées par les services et l'UI.
import { clockFor } from '../store.js';
import { sportMeta } from '../sports.js';
import { METHOD_LABEL, marketLabel, marketOf } from './markets.js';

const PERSON_SPORTS = new Set(['mma', 'boxing', 'kickboxing', 'bjj', 'wrestling']);

// upcoming : on peut parier · live : commencé (paris fermés) · finished / void : réglé.
export function matchStatus(m, t = clockFor(m)) {
  if (m.status === 'finished' || m.status === 'void') return m.status;
  if (m.status === 'live' || t >= m.startsAt) return 'live';
  return 'upcoming';
}

// Commencé d'après l'horloge mais la source ne l'a pas encore confirmé.
export const isAwaitingKickoff = (m, t = clockFor(m)) =>
  m.real && m.status === 'scheduled' && t >= m.startsAt;

export function outcomeLabel(m, outcome) {
  if (marketOf(outcome) !== 'winner') return marketLabel(m, outcome);
  if (outcome === 'X') return 'Match nul';
  const side = outcome === '1' ? m.home : m.away;
  return PERSON_SPORTS.has(m.sport) ? `${side.name} gagne` : `Victoire ${side.name}`;
}

// Nom sur les boutons de cote : nom de famille ('Raul Rosas Jr.' → 'Rosas') ; code court ('ROS') s'il est
// trop long ou si les deux combattants ont le même.
function callName(m, side) {
  const last = (t) => String(t?.name ?? '').split(/\s+/).filter((w) => w && !/^(jr|sr|ii|iii|iv)\.?$/i.test(w)).pop() || '';
  const [h, a] = [last(m.home), last(m.away)];
  const t = side === '1' ? m.home : m.away;
  const name = side === '1' ? h : a;
  return name && name.length <= 11 && h.toLowerCase() !== a.toLowerCase() ? name : t.short;
}

export function outcomeShort(m, outcome) {
  if (marketOf(outcome) === 'method') {
    const [side, method] = outcome.split('-');
    return `${callName(m, side)} ${METHOD_LABEL[method] || method}`;
  }
  if (outcome === 'DEC') return 'Décision';
  if (/^R\d$/.test(outcome)) return `Round ${outcome.slice(1)}`;
  if (outcome === 'X') return 'Nul';
  return callName(m, outcome);
}

export const matchTitle = (m) => `${m.home.name} – ${m.away.name}`;

export const sportOf = (m) => sportMeta(m.sport);
