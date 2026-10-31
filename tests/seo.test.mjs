// Tests des pages publiques /pronos (js/seo), sur des réponses ESPN et TheSportsDB réelles enregistrées.
// Lancer : /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/seo.test.mjs
globalThis.console ??= { warn: () => {}, log: print, error: print };

import { SOURCES, loadGroups, packGroups, unpackGroups } from '../js/seo/data.js';
import {
  LEAGUE_PAGES, finishPhrase, leagueBySlug, matchPath, renderGone, renderHub, renderLeague, renderMatch, resultSentence, sitemapXml, slugify,
} from '../js/seo/pages.js';
import { fightToMatch } from '../js/providers/beltchase.js';

const DIR = decodeURIComponent(import.meta.url.replace(/^file:\/\//, '').replace(/[^/]*$/, ''));
const load = (path) => JSON.parse(readFile(`${DIR}fixtures/${path}`));
const fail = (msg) => { throw new Error(msg); };
const ok = (cond, msg) => cond || fail(msg);
const eq = (a, b, msg) => (JSON.stringify(a) === JSON.stringify(b) ? true : fail(`${msg} : attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`));
async function test(name, fn) { await fn(); print(`PASS ${name}`); }

// UFC lu le 26/09/2026 avant la soirée ; PFL : soirées de l'été terminées (résultats) ; boxe par jour.
const NOW = Date.parse('2026-09-26T20:46Z');
const BOX_DAYS = ['2026-09-26', '2026-09-27', '2026-10-03'];
const getJson = async (url) => {
  const past = /dates=202607/.test(url); // requête des résultats (60 jours en arrière)
  if (url.includes('/mma/ufc/scoreboard')) return load(past ? 'mma/ufc_scoreboard_20260925-20261005_final.json' : 'mma/ufc_scoreboard_20260926-20261025_upcoming.json');
  if (url.includes('/mma/pfl/scoreboard')) return load(past ? 'mma/pfl_scoreboard_20260701-20261231.json' : 'mma/pfl_scoreboard_20260925-20261005_empty.json');
  if (url.includes('thesportsdb.com')) {
    const day = BOX_DAYS.find((d) => url.includes(`d=${d}`));
    return load(day ? `boxing/eventsday_${day}.json` : 'boxing/eventsday_empty.json');
  }
  throw new Error(`HTTP 404 pour ${url}`); // cotes et méthode : facultatives
};
const KICK = {
  id: 'glory-1', sport: 'kickboxing', event: 'Glory 105', home: { name: 'Rico Verhoeven', record: '66-10' },
  away: { name: 'Levi Rigters' }, startsAt: Date.parse('2026-10-10T19:00Z'), rounds: 5, p1: 0.7, status: 'scheduled',
};
const KICK_DONE = { ...KICK, id: 'glory-0', startsAt: Date.parse('2026-09-12T19:00Z'), status: 'finished', outcome: '2', result: { method: 'KO', round: 2 } };
const sources = { ...SOURCES, bc: async () => [KICK, KICK_DONE].map(fightToMatch) };

await test('slugs et pages', () => {
  eq(slugify('Ciryl Gane Josh Hokit'), 'ciryl-gane-josh-hokit', 'combattants');
  eq(slugify("Casey O'Neill Éric Müller"), 'casey-o-neill-eric-muller', 'apostrophe et accents');
  ok(leagueBySlug('ufc')?.source === 'espn', 'ufc');
  ok(leagueBySlug('boxe')?.sport === 'boxing', 'boxe');
  ok(leagueBySlug('kick-muay-thai')?.source === 'bc', 'kick');
  eq(new Set(LEAGUE_PAGES.map((l) => l.slug)).size, LEAGUE_PAGES.length, 'slugs uniques');
});

await test('phrases de résultat', () => {
  eq(finishPhrase('KO/TKO · R2'), 'par KO/TKO au round 2', 'KO');
  eq(finishPhrase('Décision unanime'), 'par décision unanime', 'décision');
  eq(finishPhrase('Victoire · R3'), 'au round 3', 'méthode inconnue');
  eq(finishPhrase('Terminé'), '', 'rien');
  eq(resultSentence({ outcome: '2', home: { name: 'A' }, away: { name: 'B' }, score: 'Soumission · R1' }), 'B bat A par soumission au round 1.', 'phrase');
});

let groups;
await test('chargement : UFC, PFL, boxe et combats saisis', async () => {
  groups = await loadGroups({ getJson, now: NOW, sources });
  eq(groups.map((g) => g.league.slug), LEAGUE_PAGES.map((l) => l.slug), 'ordre');
  const by = Object.fromEntries(groups.map((g) => [g.league.slug, g]));
  ok(by.ufc.matches.length > 0, 'UFC à venir');
  ok(by.pfl.results.length > 0, 'PFL : résultats de l\'été');
  ok(by.boxe.matches.length > 0, 'boxe à venir');
  eq(by['kick-muay-thai'].matches.map((m) => m.home.name), ['Rico Verhoeven'], 'kick à venir');
  eq(by['kick-muay-thai'].results.map((m) => m.outcome), ['2'], 'kick terminé');
  eq(by.lutte.matches.length + by.lutte.results.length, 0, 'lutte vide');
  ok(groups.every((g) => !g.failed), 'aucune source en échec');
  for (const g of groups) {
    ok(g.matches.every((m) => m.status === 'scheduled' && m.startsAt > NOW), 'à venir seulement');
    ok(g.matches.every((m, i, a) => !i || a[i - 1].startsAt <= m.startsAt), 'triés');
    ok(g.results.every((m) => m.status === 'finished' && m.startsAt <= NOW), 'terminés seulement');
    ok(g.results.every((m, i, a) => !i || a[i - 1].startsAt >= m.startsAt), 'plus récents d\'abord');
  }
  eq(unpackGroups(JSON.parse(JSON.stringify(packGroups(groups)))).map((g) => g.matches.length + g.results.length),
    groups.map((g) => g.matches.length + g.results.length), 'cache aller-retour');
});

await test('une source en panne : les autres restent', async () => {
  const broken = { ...sources, tsdb: async () => { throw new Error('429'); } };
  const gs = await loadGroups({ getJson, now: NOW, sources: broken });
  ok(gs.find((g) => g.league.slug === 'boxe').failed, 'boxe signalée');
  ok(!gs.find((g) => g.league.slug === 'ufc').failed, 'UFC lue');
  const none = Object.fromEntries(Object.keys(SOURCES).map((k) => [k, async () => { throw new Error('panne'); }]));
  let threw = false;
  try { await loadGroups({ getJson, now: NOW, sources: none }); } catch { threw = true; }
  ok(threw, 'tout en panne : erreur');
});

await test('pages HTML', () => {
  const ufc = groups.find((g) => g.league.slug === 'ufc');
  const m = ufc.matches[0];
  const hub = renderHub(groups);
  ok(hub.includes('href="/pronos/ufc"') && hub.includes('href="/pronos/boxe"') && hub.includes('href="/pronos/kick-muay-thai"'), 'hub');
  ok(!hub.includes('href="/pronos/lutte"'), 'page vide absente du hub');
  ok(hub.includes('<link rel="canonical" href="https://beltchase.com/pronos">') && hub.includes('"BreadcrumbList"'), 'canonical et fil d\'Ariane');
  const league = renderLeague(ufc.league, ufc.matches, ufc.results);
  ok(league.includes(`href="${matchPath(ufc.league, m)}"`), 'lien combat');
  ok(league.includes('<h1 class="seo-h1">Pronostics UFC'), 'titre');
  ok(renderLeague(leagueBySlug('lutte'), [], []).includes('noindex'), 'page vide non indexée');
  const page = renderMatch(ufc.league, m, ufc.matches.slice(1));
  ok(page.includes('"@type":"SportsEvent"') && page.includes('"performer"') && page.includes('"organizer"'), 'JSON-LD');
  if (m.meta.venue) ok(page.includes('"PostalAddress"'), 'adresse de la salle');
  ok(/de chances/.test(page) && /favori|serré|50\/50/.test(page), 'analyse');
  ok(matchPath(ufc.league, m).endsWith(`-${m.id.split(':').pop().split('_')[0]}`), 'id en fin de lien');

  const pfl = groups.find((g) => g.league.slug === 'pfl');
  const done = renderMatch(pfl.league, pfl.results[0], []);
  ok(done.includes(': résultat') && done.includes(' bat ') && !done.includes('noindex'), 'combat terminé indexable avec résultat');
  ok(renderLeague(pfl.league, [], pfl.results).includes('Derniers résultats PFL'), 'résultats sur la page PFL');

  const box = groups.find((g) => g.league.slug === 'boxe');
  ok(renderMatch(box.league, box.matches[0]).includes('50/50'), 'boxe sans cote : pas de faux « combat serré »');

  ok(renderGone(ufc.league).includes('noindex'), 'introuvable non indexé');
  ok(!renderGone(ufc.league).includes('canonical'), 'pas de canonical');
});

await test('plan du site', () => {
  const xml = sitemapXml(groups);
  const filled = groups.filter((g) => g.matches.length || g.results.length);
  const n = filled.reduce((s, g) => s + g.matches.length + g.results.length, 0);
  eq((xml.match(/<url>/g) || []).length, 3 + filled.length + n, 'nombre d\'adresses');
  ok(xml.includes('<loc>https://beltchase.com/pronos/boxe</loc>'), 'boxe');
  ok(!xml.includes('lastmod'), 'pas de lastmod inventé');
  ok(!/[<>&](?![a-z/!?#]|amp;)/.test(xml.replace(/<\/?[a-z?!][^>]*>/g, '')), 'XML propre');
});

print('ALL PASS');
