// Combats à venir des pages publiques (/pronos), regroupés par organisation (UFC, PFL). Utilisé par les
// Pages Functions : `getJson` est injecté (réseau du serveur, ou réponses enregistrées dans les tests).
import { createMmaAdapter } from '../providers/espn/mma.js';
import { LEAGUE_PAGES } from './pages.js';

export const DAYS = 28;

// → [{ league, matches }] dans l'ordre des organisations ; combats pas encore commencés, triés par heure.
export async function loadGroups({ getJson, now = Date.now(), leagues = LEAGUE_PAGES }) {
  const adapter = createMmaAdapter({ getJson, leagues: leagues.map((l) => ({ slug: l.league, label: l.name })) });
  const all = await adapter.upcoming({ now, days: DAYS });
  return leagues.map((league) => ({
    league,
    matches: all
      .filter((m) => m.meta?.league === league.league)
      .filter((m) => m.status === 'scheduled' && m.startsAt > now && m.odds?.['1'] && m.odds?.['2'])
      .sort((a, b) => a.startsAt - b.startsAt),
  }));
}

// Forme compacte à mettre en cache (les objets d'organisation sont retrouvés par leur slug).
export const packGroups = (groups) => groups.map((g) => ({ slug: g.league.slug, matches: g.matches }));
export const unpackGroups = (packed) => packed
  .map((g) => ({ league: LEAGUE_PAGES.find((l) => l.slug === g.slug), matches: g.matches }))
  .filter((g) => g.league);
