// Affiches des soirées UFC et PFL, lues chez TheSportsDB (ESPN n'en fournit pas), posées sur chaque
// combat de la soirée (m.poster), comme celles de la boxe.
//
// Vérifié le 31/10/2026 : eventsday.php?d=AAAA-MM-JJ&l=<ligue> (UFC 4443, PFL 5430) renvoie la soirée
// du jour (dateEvent = jour de la soirée aux États-Unis, comme meta.day d'ESPN), avec strThumb (affiche
// 16:9) ajoutée quelques jours avant (« UFC Fight Night 292 Moicano vs Nolan » oui, « UFC 334 Gane vs
// Hokit » à deux semaines : pas encore). D'où une mémoire courte quand l'affiche manque.
import { MIN } from '../../util.js';
import { defaultGetJson } from '../espn/common.js';
import { createPhotoCache, nameKeys, norm, tsdbThrottle } from './boxing.js';

const BASE = 'https://www.thesportsdb.com/api/v1/json/123';
export const POSTER_LEAGUES = { ufc: '4443', pfl: '5430' };
const HOUR = 60 * MIN;
const FOUND_TTL = 30 * 24 * HOUR;   // affiche trouvée : elle ne change plus
const MISSING_TTL = 6 * HOUR;       // pas encore d'affiche : on repasse plus tard
const LOOKUPS = 2;                  // soirées cherchées par liste (le plafond est partagé avec la boxe)

export const posterDayUrl = (day, league) => `${BASE}/eventsday.php?d=${day}&l=${league}`;

// '20261114' (meta.day d'ESPN) → '2026-11-14'.
const isoDay = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

// Affiche d'une soirée dans la réponse eventsday : l'événement qui cite un des combattants du combat
// principal, sinon le seul événement du jour. → url | null.
export function posterFrom(data, names = []) {
  const events = (data?.events || []).filter((e) => String(e?.strThumb ?? '').trim());
  const lasts = names.map((n) => nameKeys(n).last).filter((l) => l.length > 2);
  const hit = events.find((e) => lasts.some((l) => ` ${norm(e.strEvent)} `.includes(` ${l} `)))
    || (events.length === 1 ? events[0] : null);
  return hit ? String(hit.strThumb).trim() : null;
}

// → addPosters(matches, now) : pose m.poster sur les combats UFC / PFL dont l'affiche est connue,
// et cherche quelques soirées de plus (les plus proches d'abord). Une erreur arrête les recherches.
export function createPosterFinder({ getJson = defaultGetJson, throttle = tsdbThrottle, cache = createPhotoCache('beltchase:affiches'), lookups = LOOKUPS } = {}) {
  return async function addPosters(matches, now = Date.now()) {
    const cards = new Map(); // soirée ESPN → { league, day, names, list }
    for (const m of matches) {
      const league = POSTER_LEAGUES[m.meta?.league];
      if (!league || !m.meta?.eventId || !/^\d{8}$/.test(m.meta.day || '')) continue;
      const key = `${m.meta.league}:${m.meta.eventId}`;
      if (!cards.has(key)) cards.set(key, { league, day: isoDay(m.meta.day), names: [], list: [], startsAt: m.startsAt });
      const c = cards.get(key);
      c.list.push(m);
      c.startsAt = Math.min(c.startsAt, m.startsAt);
      if (/combat principal/i.test(m.round || '')) c.names.push(m.home.name, m.away.name);
    }
    let left = lookups;
    const fresh = (e) => e && now - e.at < (e.url ? FOUND_TTL : MISSING_TTL);
    for (const [key, c] of [...cards].sort((a, b) => Math.abs(a[1].startsAt - now) - Math.abs(b[1].startsAt - now))) {
      let entry = cache.get(key);
      if (!fresh(entry) && left > 0 && !throttle.paused()) {
        left -= 1;
        try {
          entry = { url: posterFrom(await throttle.run(() => getJson(posterDayUrl(c.day, c.league)), 2), c.names), at: now };
          cache.set(key, entry);
        } catch {
          left = 0;
        }
      }
      if (entry?.url) for (const m of c.list) m.poster = entry.url;
    }
    return matches;
  };
}
