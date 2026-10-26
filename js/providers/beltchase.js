// Provider « BeltChase » : combats saisis à la main sur la page admin (#admin), pour les disciplines
// et organisations sans source gratuite (JJB, lutte, kick, Muay Thaï, ONE, ARES, Hexagone…).
// Voir providers/index.js pour le contrat.
//
// Les combats sont dans Firestore (collection « fights », lecture publique, écriture réservée à
// l'admin) : un document par combat, { data: JSON du combat, startsAt }. On les lit avec l'API REST
// de Firestore (pas besoin du SDK ni d'être connecté).
// Combat : { id, sport, event, label?, home: { name, record? }, away, startsAt, rounds, p1 (chances du
// combattant 1, 0-1), status: 'scheduled' | 'finished' | 'void', outcome?: '1' | '2' | 'X',
// result?: { method, round } }.
// Cotes : vainqueur à partir de p1, méthode et round estimés comme pour l'UFC (services/markets.js).
import { CONFIG } from '../config.js';
import { MIN } from '../util.js';
import { fromProbabilities } from './odds.js';
import { fightOdds, resultText } from '../services/markets.js';
import { fighterShort } from './espn/mma.js';

const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const LOOKBACK = 4 * DAY; // combats passés encore lus (le temps de saisir leur résultat)

const runQueryUrl = () => `https://firestore.googleapis.com/v1/projects/${CONFIG.FIREBASE.projectId}/databases/(default)/documents:runQuery?key=${CONFIG.FIREBASE.apiKey}`;

// Combats dont l'heure est après `since` (ms).
export async function readFights(since, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(runQueryUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'fights' }],
          where: { fieldFilter: { field: { fieldPath: 'startsAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(Math.floor(since)) } } },
          limit: 500,
        },
      }),
    });
    if (!res.ok) throw new Error(`Combats BeltChase : HTTP ${res.status}`);
    const rows = await res.json();
    return rows
      .map((r) => r.document?.fields?.data?.stringValue)
      .filter(Boolean)
      .map((json) => { try { return JSON.parse(json); } catch { return null; } })
      .filter((f) => f?.id && f.home?.name && f.away?.name && Number.isFinite(f.startsAt));
  } finally {
    clearTimeout(timer);
  }
}

export const fightMatchId = (f) => `bc:${f.sport}:${f.id}`;

const side = ({ name, record }) => ({ name, short: fighterShort(name), ...(record ? { record } : {}) });

// Combat saisi → Match.
export function fightToMatch(f) {
  const p1 = Math.min(0.95, Math.max(0.05, Number(f.p1) || 0.5));
  const win = { 1: p1, 2: 1 - p1 };
  const rounds = Number(f.rounds) || 0;
  const m = {
    id: fightMatchId(f),
    source: 'bc',
    real: true,
    sport: f.sport,
    competition: f.event,
    home: side(f.home),
    away: side(f.away),
    startsAt: f.startsAt,
    odds: { ...fromProbabilities(win), ...fightOdds(f.sport, win, rounds) },
    oddsSource: 'model',
    status: 'scheduled',
    outcome: null,
    score: null,
    meta: { adapter: 'bc', fightId: f.id, rounds },
  };
  const label = [f.label, rounds ? `${rounds} rounds` : null].filter(Boolean).join(' · ');
  if (label) m.round = label;
  if (f.status === 'void') Object.assign(m, { status: 'void', score: 'Annulé' });
  if (f.status === 'finished' && f.outcome) {
    Object.assign(m, { status: 'finished', outcome: f.outcome, result: f.result || null, score: resultText(f.result) || (f.outcome === 'X' ? 'Nul' : 'Terminé') });
  }
  return m;
}

export function createBeltChaseProvider({ read = readFights } = {}) {
  return {
    id: 'bc',
    label: 'BeltChase',
    real: true,
    refresh: { upcomingMs: 10 * MIN, resultsMs: 2 * MIN, idleResultsMs: 5 * MIN },

    async probe() {
      return !!CONFIG.FIREBASE?.projectId;
    },

    async fetchUpcoming({ now }) {
      return (await read(now - LOOKBACK)).map(fightToMatch);
    },

    // Résultats saisis par l'admin. Un combat supprimé de la liste (alors qu'elle a bien répondu)
    // est remboursé.
    async fetchResults({ now, matches }) {
      const byId = new Map((await read(now - LOOKBACK - 30 * DAY)).map((f) => [fightMatchId(f), f]));
      const out = [];
      for (const m of matches) {
        const f = byId.get(m.id);
        if (!f) { out.push({ matchId: m.id, status: 'void' }); continue; }
        const cur = fightToMatch(f);
        if (cur.status === 'finished') out.push({ matchId: m.id, status: 'finished', outcome: cur.outcome, result: cur.result, score: cur.score });
        else if (cur.status === 'void') out.push({ matchId: m.id, status: 'void' });
        else if (cur.startsAt !== m.startsAt) out.push({ matchId: m.id, status: 'scheduled', startsAt: cur.startsAt });
      }
      return out;
    },
  };
}
