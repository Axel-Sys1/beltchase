// Fiches combattants (UFC, PFL) : bio, palmarès et historique des combats, lus chez ESPN.
// …/apis/common/v3/sports/mma/athletes/<id> (relevé du 01/11/2026) : athlete.{displayName, nickname,
// age, displayHeight « 5' 6" », displayWeight « 144 lbs », displayReach « 71.5" », weightClass, association
// (club), stance, statsSummary (W-L-D, KO, soumissions), flag, headshot} et eventsMap : un combat par
// soirée {name, gameDate, gameResult W/L/D, opponent, status.result (méthode), status.period, titleFight}.
import { defaultGetJson } from '../providers/espn/common.js';
import { methodLabel, weightClassFr } from '../providers/espn/mma.js';

export const athleteUrl = (id) => `https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/${id}`;

const toNum = (s) => Number(String(s ?? '').replace(',', '.'));
// « 5' 6" » → 168 ; « 144 lbs » → 65 ; « 71.5" » → 182.
export function heightCm(s) {
  const m = /(\d+)'\s*(\d+(?:\.\d+)?)?/.exec(String(s ?? ''));
  return m ? Math.round((toNum(m[1]) * 12 + toNum(m[2] || 0)) * 2.54) : null;
}
export const weightKg = (s) => (/(\d+(?:\.\d+)?)\s*lbs?/i.test(String(s ?? '')) ? Math.round(toNum(/(\d+(?:\.\d+)?)/.exec(s)[1]) * 0.4536) : null);
export const reachCm = (s) => (/(\d+(?:\.\d+)?)"/.test(String(s ?? '')) ? Math.round(toNum(/(\d+(?:\.\d+)?)"/.exec(s)[1]) * 2.54) : null);

const STANCE = { orthodox: 'Droitier', southpaw: 'Gaucher', switch: 'Ambidextre' };
const stat = (a, name) => a?.statsSummary?.statistics?.find((x) => x.name === name)?.displayValue || null;

// Réponse ESPN → fiche { id, name, nickname, age, heightCm, weightKg, reachCm, weightClass, team, stance,
// record, kos, subs, photo, flag, fights: [{ date, event, opponent, result, method, round, title }] }.
export function parseAthlete(data) {
  const a = data?.athlete;
  if (!a?.displayName) return null;
  const fights = Object.values(data.eventsMap || {}).map((e) => ({
    date: Date.parse(e.gameDate),
    event: String(e.name || e.shortName || ''),
    opponent: e.opponent?.displayName || '?',
    opponentId: e.opponent?.id ? String(e.opponent.id) : null,
    result: e.gameResult || null,
    method: methodLabel(e.status?.result?.name) || e.status?.result?.displayName || null,
    round: Number(e.status?.period) || null,
    title: String(e.titleFight) === 'true' || e.titleFight === true,
  })).filter((f) => Number.isFinite(f.date)).sort((x, y) => y.date - x.date);
  return {
    id: String(a.id),
    name: a.displayName,
    nickname: a.nickname || null,
    age: a.age || null,
    heightCm: heightCm(a.displayHeight),
    weightKg: weightKg(a.displayWeight),
    reachCm: reachCm(a.displayReach),
    weightClass: weightClassFr(a.weightClass?.text) || a.weightClass?.text || null,
    team: a.association?.name || null,
    stance: STANCE[String(a.stance?.text || '').toLowerCase()] || a.stance?.text || null,
    record: stat(a, 'wins-losses-draws'),
    kos: stat(a, 'tkos-tkoLosses'),
    subs: stat(a, 'submissions-submissionLosses'),
    photo: a.headshot?.href || null,
    flag: a.flag?.href || null,
    fights,
  };
}

// Fiches déjà lues (gardées pendant la visite) ; une fiche en cours de lecture n'est demandée qu'une fois.
const cache = new Map(); // id → { fighter | null, error, loading }
const listeners = new Set();
export const subscribeFighters = (fn) => listeners.add(fn);

export function fighterState(id) {
  return cache.get(String(id)) || null;
}

export async function loadFighter(id, { getJson = defaultGetJson } = {}) {
  const key = String(id);
  if (cache.has(key)) return cache.get(key);
  const entry = { fighter: null, error: null, loading: true };
  cache.set(key, entry);
  try {
    entry.fighter = parseAthlete(await getJson(athleteUrl(key)));
    if (!entry.fighter) entry.error = 'Fiche introuvable.';
  } catch {
    entry.error = 'Fiche momentanément indisponible.';
    cache.delete(key); // nouvel essai à la prochaine visite
  }
  entry.loading = false;
  listeners.forEach((fn) => fn());
  return entry;
}
