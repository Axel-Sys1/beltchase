// /pronos/<page> et /pronos/<page>/<combattants>-<id> : pages publiques lisibles par Google
// (HTML complet, sans JavaScript). /pronos seul est servi par index.js. Rendu dans js/seo/pages.js.
import { getJson, groups, html } from '../_seo.js';
import { leagueBySlug, renderGone, renderHub, renderLeague, renderMatch, eventId, matchPath, slugify } from '../../js/seo/pages.js';
import { methodLabel, parseBoutKey, statusUrl } from '../../js/providers/espn/mma.js';

const SORRY = '<!doctype html><meta charset="utf-8"><title>BeltChase</title><p>Les pronostics sont momentanément indisponibles. <a href="/">Jouer sur BeltChase</a></p>';

// Combat UFC / PFL terminé lu sans sa méthode ('Victoire · R2') : on la demande à ESPN pour cette page.
async function withMethod(m) {
  if (m.source !== 'espn' || !/^Victoire/.test(m.score || '')) return m;
  try {
    const st = await getJson(statusUrl(m.meta.league, m.meta.eventId, parseBoutKey(m.id).boutId));
    const method = methodLabel(st?.result?.name);
    if (!method || method === 'Nul' || method === 'No contest') return m;
    return { ...m, score: method.startsWith('Décision') ? method : m.score.replace('Victoire', method) };
  } catch {
    return m;
  }
}

export async function onRequestGet({ params, waitUntil, request }) {
  const parts = [].concat(params.path || []).filter(Boolean);
  if (parts.length > 2) return html(renderGone(null), 404);
  const league = parts[0] ? leagueBySlug(parts[0]) : null;
  if (parts[0] && !league) return html(renderGone(null), 404);

  let all;
  try {
    all = await groups(waitUntil);
  } catch {
    return new Response(SORRY, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '600' } });
  }
  if (!league) return html(renderHub(all));

  const g = all.find((x) => x.league.slug === league.slug);
  const matches = g?.matches || [];
  const results = g?.results || [];
  if (parts.length === 1) return html(renderLeague(league, matches, results));

  // Le combat est retrouvé par son id, en fin d'adresse ; nom de combattant corrigé depuis → redirection.
  const m = [...matches, ...results].find((x) => parts[1].endsWith(`-${slugify(eventId(x))}`));
  if (!m) return html(renderGone(league), 404);
  const path = matchPath(league, m);
  if (path !== `/pronos/${parts[0]}/${parts[1]}`) return Response.redirect(new URL(path, request.url).href, 301);
  const page = m.status === 'finished' ? await withMethod(m) : m;
  return html(renderMatch(league, page, matches.filter((x) => x !== m)));
}
