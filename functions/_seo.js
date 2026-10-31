// Données partagées des pages publiques : combats à venir et résultats récents lus depuis le serveur
// (ESPN, TheSportsDB, Firestore), gardés 15 min dans le cache Cloudflare. Une source qui ne répond
// pas est remplacée par la dernière version connue (gardée 2 jours) plutôt que par une page vide.
import { loadGroups, packGroups, unpackGroups } from '../js/seo/data.js';

const FRESH_S = 15 * 60;
const KEEP_S = 2 * 24 * 3600;
const KEY_FRESH = 'https://beltchase.com/__seo/groups-v3';
const KEY_STALE = 'https://beltchase.com/__seo/groups-v3-stale';

export async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return res.json();
}

const store = (cache, key, body, ttl) => cache.put(key, new Response(body, {
  headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` },
}));

// Vieille copie : combats déjà commencés retirés des « à venir ».
async function staleGroups(cache, now) {
  const old = await cache.match(KEY_STALE);
  if (!old) return null;
  return unpackGroups(await old.json()).map((g) => ({ ...g, matches: g.matches.filter((m) => m.startsAt > now) }));
}

export async function groups(waitUntil) {
  const cache = caches.default;
  const hit = await cache.match(KEY_FRESH);
  if (hit) return unpackGroups(await hit.json());
  const now = Date.now();
  try {
    let fresh = await loadGroups({ getJson, fetchImpl: fetch, now });
    if (fresh.some((g) => g.failed)) {
      const old = await staleGroups(cache, now);
      if (old) fresh = fresh.map((g) => (g.failed ? old.find((o) => o.league.slug === g.league.slug) || g : g));
    }
    const total = fresh.reduce((n, g) => n + g.matches.length + g.results.length, 0);
    if (!total) throw new Error('aucun combat lu');
    const body = JSON.stringify(packGroups(fresh));
    waitUntil(Promise.all([store(cache, KEY_FRESH, body, FRESH_S), store(cache, KEY_STALE, body, KEEP_S)]));
    return fresh;
  } catch (err) {
    const old = await staleGroups(cache, now);
    if (old) return old;
    throw err;
  }
}

export const html = (body, status = 200, maxAge = 600) => new Response(body, {
  status,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': status === 200 ? `public, max-age=${maxAge}` : 'no-store',
  },
});
