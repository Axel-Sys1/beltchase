// Combats des pages publiques (/pronos), regroupés par page : UFC et PFL (ESPN), boxe (TheSportsDB),
// kick, JJB, lutte et autres MMA (combats saisis sur la page admin, Firestore). Combats à venir, et
// combats terminés des PAST_DAYS derniers jours (leur page reste en ligne avec le résultat).
// Utilisé par les Pages Functions : `getJson` / `fetchImpl` sont injectés (réseau du serveur, ou
// réponses enregistrées dans les tests).
import { createMmaAdapter } from '../providers/espn/mma.js';
import { createBoxingProvider } from '../providers/thesportsdb/boxing.js';
import { fightToMatch, readFights } from '../providers/beltchase.js';
import { LEAGUE_PAGES } from './pages.js';

export const DAYS = 28;
export const PAST_DAYS = 60;
const DAY = 24 * 3600 * 1000;

// Une fonction par source → liste de matchs (à venir et terminés mêlés).
export const SOURCES = {
  async espn({ getJson, now, leagues }) {
    const adapter = createMmaAdapter({ getJson, leagues: leagues.map((l) => ({ slug: l.league, label: l.name })) });
    const [upcoming, past] = await Promise.all([
      adapter.upcoming({ now, days: DAYS }),
      adapter.past({ now, days: PAST_DAYS }).catch(() => []), // résultats facultatifs
    ]);
    // Les combats terminés de la liste à venir ont leur méthode : ils passent devant.
    const byId = new Map(past.map((m) => [m.id, m]));
    for (const m of upcoming) byId.set(m.id, m);
    return [...byId.values()];
  },
  async tsdb({ getJson, now }) {
    return createBoxingProvider({ getJson }).fetchUpcoming({ now, days: 14 });
  },
  async bc({ fetchImpl, now }) {
    return (await readFights(now - PAST_DAYS * DAY, { fetchImpl })).map(fightToMatch);
  },
};

// Le match va-t-il sur la page de cette organisation / discipline ?
const belongs = (league, m) => m.source === league.source
  && (league.source === 'espn' ? m.meta?.league === league.league : m.sport === league.sport);

// → [{ league, matches, results, failed }] dans l'ordre des pages. matches : pas encore commencés,
// triés par heure ; results : terminés, du plus récent au plus ancien ; failed : source injoignable.
// Toutes les sources en échec → erreur.
export async function loadGroups({ getJson, fetchImpl = globalThis.fetch, now = Date.now(), leagues = LEAGUE_PAGES, sources = SOURCES }) {
  const used = [...new Set(leagues.map((l) => l.source))];
  const settled = await Promise.allSettled(used.map((src) => sources[src]({
    getJson, fetchImpl, now, leagues: leagues.filter((l) => l.source === src),
  })));
  const failed = new Set();
  const all = [];
  settled.forEach((r, i) => (r.status === 'fulfilled' ? all.push(...r.value) : failed.add(used[i])));
  if (used.length && failed.size === used.length) throw settled[0].reason;
  return leagues.map((league) => {
    const mine = all.filter((m) => belongs(league, m));
    return {
      league,
      failed: failed.has(league.source),
      matches: mine
        .filter((m) => m.status === 'scheduled' && m.startsAt > now && m.odds?.['1'] && m.odds?.['2'])
        .sort((a, b) => a.startsAt - b.startsAt),
      results: mine
        .filter((m) => m.status === 'finished' && m.outcome && m.startsAt <= now && m.startsAt > now - PAST_DAYS * DAY)
        .sort((a, b) => b.startsAt - a.startsAt),
    };
  });
}

// Forme compacte à mettre en cache (les objets d'organisation sont retrouvés par leur slug).
export const packGroups = (groups) => groups.map((g) => ({ slug: g.league.slug, matches: g.matches, results: g.results || [] }));
export const unpackGroups = (packed) => packed
  .map((g) => ({ league: LEAGUE_PAGES.find((l) => l.slug === g.slug), matches: g.matches, results: g.results || [] }))
  .filter((g) => g.league);
