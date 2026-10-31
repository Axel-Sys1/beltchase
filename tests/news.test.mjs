// Tests des Actus (js/services/news.js) sur des flux RSS réels enregistrés le 01/11/2026.
// Lancer : /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/news.test.mjs
globalThis.console ??= { warn: () => {}, log: print, error: print };

import { FEEDS, decode, loadNews, mergeFeeds, news, parseFeed, parseWp, sportOfArticle } from '../js/services/news.js';

const DIR = decodeURIComponent(import.meta.url.replace(/^file:\/\//, '').replace(/[^/]*$/, ''));
const load = (name) => readFile(`${DIR}fixtures/news/${name}`);
const fail = (msg) => { throw new Error(msg); };
const ok = (cond, msg) => cond || fail(msg);
const eq = (a, b, msg) => (JSON.stringify(a) === JSON.stringify(b) ? true : fail(`${msg} : attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`));
async function test(name, fn) { await fn(); print(`PASS ${name}`); }

const [RMC, SUEUR] = FEEDS;

await test('texte : CDATA et entités', () => {
  eq(decode('<![CDATA[Canelo&#8217;s &amp; Mbilli]]>'), 'Canelo’s & Mbilli', 'décodage');
  eq(decode('d&rsquo;une &laquo;&nbsp;nuit&nbsp;&raquo;'), 'd’une « nuit »', 'entités nommées');
});

await test('discipline d\'un article', () => {
  eq(sportOfArticle({ title: 'Canelo récupère la ceinture WBC', link: 'https://rmcsport.bfmtv.com/sports-de-combat/boxe/x.html' }), 'boxing', 'boxe');
  eq(sportOfArticle({ title: 'Gane vs Hokit', categories: ['MMA', 'UFC'] }), 'mma', 'MMA');
  eq(sportOfArticle({ title: 'Glory 105 : Rico Verhoeven' }), 'kickboxing', 'kick');
  eq(sportOfArticle({ title: 'Championnat de France de JJB' }), 'bjj', 'JJB');
  eq(sportOfArticle({ title: 'Gala amateur à Bordeaux', categories: ['Boxe'] }), 'amateur', 'amateurs avant la discipline');
  eq(sportOfArticle({ title: 'Une soirée à Paris' }), null, 'inconnue');
});

let rmc;
let sueur;
await test('flux RMC Sport', () => {
  rmc = parseFeed(load('rmc_sports-de-combat.xml'), RMC);
  eq(rmc.length, 30, '30 articles');
  ok(rmc.every((a) => a.title && a.link.startsWith('https://rmcsport.bfmtv.com/') && a.date > 0), 'titre, lien, date');
  ok(rmc.every((a) => a.image?.startsWith('https://')), 'image sur chaque article');
  ok(rmc.every((a) => a.excerpt.length <= 181), 'extrait court');
  ok(rmc.filter((a) => a.sport === 'boxing').length > 5 && rmc.some((a) => a.sport === 'mma'), 'boxe et MMA reconnues');
  ok(rmc.every((a) => a.source === 'RMC Sport'), 'source');
});

await test('La Sueur : flux RSS sans image, API WordPress avec photo', () => {
  const rss = parseFeed(load('lasueur.xml'), SUEUR);
  eq(rss.length, 12, 'RSS : 12 articles');
  ok(rss.every((a) => a.image === null), 'RSS : pas d\'image (émojis ignorés)');
  sueur = parseWp(load('lasueur_posts.json'), SUEUR);
  eq(sueur.length, 20, 'API : 20 articles');
  ok(sueur.every((a) => a.link.startsWith('https://lasueur.com/') && !/&#\d+;|&hellip;/.test(a.title + a.excerpt)), 'liens et texte décodé');
  ok(sueur.every((a) => a.image?.startsWith('https://lasueur.com/wp-content/')), 'photo à la une');
  eq(sueur[1].sport, 'mma', 'catégorie MMA (ARES)');
  ok(sueur.every((a) => a.date > Date.parse('2026-01-01')), 'dates');
});

await test('fusion : récents d\'abord, sans doublon', () => {
  const all = mergeFeeds([rmc, sueur, rmc.slice(0, 3)]);
  eq(all.length, rmc.length + sueur.length, 'doublons retirés');
  ok(all.every((a, i) => !i || all[i - 1].date >= a.date), 'triés par date');
});

await test('chargement : un flux en panne n\'empêche pas l\'autre', async () => {
  const fetchImpl = async (url) => (url.includes(encodeURIComponent(RMC.url))
    ? { ok: true, text: async () => load('rmc_sports-de-combat.xml') }
    : { ok: false, status: 502 });
  await loadNews({ fetchImpl, now: 1000 });
  eq(news.items.length, 30, 'RMC seul');
  ok(!news.error && !news.loading, 'pas d\'erreur');
  await loadNews({ fetchImpl: async () => fail('ne doit pas relire'), now: 2000 });
  eq(news.items.length, 30, 'cache de 10 min');
  await loadNews({ force: true, fetchImpl: async () => ({ ok: false, status: 500 }), now: 3000 });
  ok(news.error && news.items.length === 30, 'tout en panne : on garde les actus déjà lues');
});

print('ALL PASS');
