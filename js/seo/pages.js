// Pages publiques de pronostics, rendues côté serveur (Cloudflare Pages Functions) pour que Google
// les lise sans JavaScript : /pronos (organisations et disciplines), /pronos/<page> (prochaines
// soirées, cotes et derniers résultats), /pronos/<page>/<combattants>-<id> (un combat, à venir ou
// terminé). Fonctions pures : données en entrée, HTML en sortie ; le chargement est dans seo/data.js.
import { MMA_LEAGUES } from '../providers/espn/mma.js';
import { sizedPhoto, withFallback } from '../providers/photos.js';
import { sportMeta } from '../sports.js';
import { devig } from '../providers/odds.js';
import { METHOD_LABEL, marketOf } from '../services/markets.js';

export const SITE = 'https://beltchase.com';

export const slugify = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, 'et').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Pages : UFC et PFL (ESPN), boxe (TheSportsDB), puis les combats saisis sur la page admin, par discipline.
export const LEAGUE_PAGES = [
  ...MMA_LEAGUES.map(({ slug, label }) => ({ slug, league: slug, name: label, sport: 'mma', source: 'espn' })),
  { slug: 'boxe', league: 'boxing', name: 'Boxe', sport: 'boxing', source: 'tsdb' },
  { slug: 'kick-muay-thai', league: 'kickboxing', name: 'Kick-boxing et Muay Thaï', sport: 'kickboxing', source: 'bc' },
  { slug: 'jjb-grappling', league: 'bjj', name: 'JJB et grappling', sport: 'bjj', source: 'bc' },
  { slug: 'lutte', league: 'wrestling', name: 'Lutte', sport: 'wrestling', source: 'bc' },
  { slug: 'mma', league: 'mma', name: 'MMA (ONE, ARES et autres)', sport: 'mma', source: 'bc' },
];
export const leagueBySlug = (slug) => LEAGUE_PAGES.find((l) => l.slug === slug) || null;

// Id du combat dans l'adresse : 'espn:mma:ufc:401911630_5088844_3075570' → '401911630',
// 'tsdb:boxing:4445:2373406' → '2373406', 'bc:kickboxing:k1' → 'k1'.
export const eventId = (m) => String(m.id.split(':').pop().split('_')[0]);
export const matchPath = (league, m) => `/pronos/${league.slug}/${slugify(`${m.home.name} ${m.away.name}`)}-${slugify(eventId(m))}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const odds2 = (o) => (o ? o.toFixed(2).replace('.', ',') : '–');
const pct = (p) => `${Math.round(p * 100)} %`;
const TZ = 'Europe/Paris';
const dateLong = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const dateShort = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short' });
const hour = (t) => new Date(t).toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

const LABEL = (m, o) => (o === 'X' ? 'Nul' : o === '1' ? m.home.name : m.away.name);
const winnerOdds = (m) => Object.fromEntries(Object.entries(m.odds || {}).filter(([k]) => marketOf(k) === 'winner'));
const versus = (m) => `${m.home.name} – ${m.away.name}`;

// Lecture des cotes du vainqueur : probabilités sans marge, favori et phrase d'analyse.
export function analysis(m) {
  const probs = devig(winnerOdds(m)) || {};
  const outcomes = Object.keys(winnerOdds(m)).sort((a, b) => ({ 1: 0, X: 1, 2: 2 }[a] - { 1: 0, X: 1, 2: 2 }[b]));
  const fav = outcomes.filter((o) => o !== 'X').sort((a, b) => (probs[b] || 0) - (probs[a] || 0))[0];
  const gap = Math.abs((probs['1'] || 0) - (probs['2'] || 0));
  let verdict;
  if (m.oddsSource !== 'bookmaker' && gap < 0.01) verdict = `Pas encore de cote de bookmaker pour ${versus(m)} : BeltChase le cote à 50/50, à toi de trancher.`;
  else if (gap < 0.08) verdict = `Combat très serré : les cotes ne départagent presque pas ${m.home.name} et ${m.away.name}.`;
  else if (probs[fav] > 0.6) verdict = `${LABEL(m, fav)} part grand favori (${pct(probs[fav])} de chances selon les cotes).`;
  else verdict = `${LABEL(m, fav)} est légèrement favori (${pct(probs[fav])} de chances selon les cotes).`;
  return { probs, outcomes, fav, verdict };
}

// Score d'un combat terminé → complément de phrase : 'KO/TKO · R2' → 'par KO/TKO au round 2',
// 'Décision unanime' → 'par décision unanime', 'Victoire · R3' → 'au round 3'.
export function finishPhrase(score) {
  const [method, round] = String(score ?? '').split(' · ');
  const parts = [];
  if (method && !/^(victoire|terminé)$/i.test(method)) parts.push(`par ${method === 'KO/TKO' ? method : method.charAt(0).toLowerCase() + method.slice(1)}`);
  const r = /^R(\d+)$/.exec(round || '');
  if (r) parts.push(`au round ${r[1]}`);
  return parts.join(' ');
}

// 'Ciryl Gane bat Josh Hokit par KO/TKO au round 2.'
export function resultSentence(m) {
  if (m.outcome === 'X') return `${m.home.name} et ${m.away.name} se quittent sur un match nul.`;
  const [win, lose] = m.outcome === '1' ? [m.home, m.away] : [m.away, m.home];
  const how = finishPhrase(m.score);
  return `${win.name} bat ${lose.name}${how ? ` ${how}` : ''}.`;
}

// Fil d'Ariane : HTML et données structurées (BreadcrumbList).
const crumbsHtml = (items) => `
    <nav class="seo-crumbs" aria-label="Fil d'Ariane">${items.map(([label, href]) => (href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)).join(' › ')}</nav>`;
const crumbsLd = (items, path) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${href ?? path}` })),
});

function layout({ title, description, path, body, jsonLd = [], noindex = false }) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#08122a">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${path}">`}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BeltChase">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}/icons/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css">
  ${jsonLd.map((ld) => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`).join('\n  ')}
</head>
<body>
  <header class="seo-top">
    <a class="logo" href="/" aria-label="BeltChase, jouer"><span>BELT<b>CHASE</b></span></a>
    <a class="btn btn-primary" href="/">Jouer gratuitement</a>
  </header>
  <main class="seo-page">
${body}
    <section class="card seo-cta">
      <strong>Pronostique gratuitement sur BeltChase</strong>
      <span class="muted">Le jeu de pronos MMA, boxe et sports de combat avec une monnaie 100 % virtuelle : vainqueur, méthode et round, rangs de Fer à Radiant, cartes de combattants et ligues entre potes. Gratuit, sans argent réel.</span>
      <a class="btn btn-primary btn-lg" href="/">Je joue maintenant</a>
    </section>
    <footer class="seo-foot">
      <a href="/pronos">Tous les pronostics</a> · <a href="/">Jouer</a> · <a href="/legal">Mentions légales</a>
      <p class="muted">Jeu gratuit, sans argent réel. Les cotes sont indicatives (bookmakers via ESPN, ou estimées par BeltChase ; méthode et round toujours estimés) et ne sont pas des conseils de pari.</p>
    </footer>
  </main>
</body>
</html>`;
}

function oddsRow(m) {
  const { outcomes, probs } = analysis(m);
  return `<span class="seo-odds">${outcomes.map((o) => `<span><small>${o === 'X' ? 'N' : o}</small><b>${odds2(m.odds[o])}</b><i>${probs[o] ? pct(probs[o]) : ''}</i></span>`).join('')}</span>`;
}

function matchRow(league, m) {
  return `
      <li class="seo-match">
        <a href="${matchPath(league, m)}">
          <span class="seo-when">${esc(dateShort(m.startsAt))} · ${esc(hour(m.startsAt))}</span>
          <span class="seo-teams"><b>${esc(m.home.name)}</b> – <b>${esc(m.away.name)}</b></span>
          ${oddsRow(m)}
        </a>
      </li>`;
}

function resultRow(league, m) {
  return `
      <li class="seo-match">
        <a href="${matchPath(league, m)}">
          <span class="seo-when">${esc(dateShort(m.startsAt))}</span>
          <span class="seo-teams">${esc(resultSentence(m))}</span>
        </a>
      </li>`;
}

// /pronos : toutes les pages qui ont des combats à venir ou des résultats récents.
export function renderHub(groups) {
  const list = groups.filter((g) => g.matches.length || g.results?.length);
  const items = [['BeltChase', '/'], ['Pronostics', null]];
  const body = `${crumbsHtml(items)}
    <h1 class="seo-h1">Pronostics MMA, UFC et boxe : cotes des prochains combats</h1>
    <p class="seo-lead">Les cotes, les favoris et les pronos des combats à venir à l'UFC, au PFL, en boxe, en kick-boxing, en JJB et en lutte : vainqueur, méthode de victoire (KO/TKO, soumission, décision) et round. Choisis une organisation pour voir ses prochaines soirées et ses derniers résultats.</p>
    <div class="seo-grid">
      ${list.map((g) => `
      <a class="card seo-league" href="/pronos/${g.league.slug}">
        <span class="seo-league-name">${sportMeta(g.league.sport).icon} ${esc(g.league.name)}</span>
        <span class="muted">${g.matches.length
    ? `${g.matches.length} combat${g.matches.length > 1 ? 's' : ''} à venir · prochaine soirée le ${esc(dateShort(g.matches[0].startsAt))}`
    : `Derniers résultats · ${esc(dateShort(g.results[0].startsAt))}`}</span>
      </a>`).join('') || '<p class="muted">Aucun combat à venir pour le moment.</p>'}
    </div>`;
  return layout({
    title: 'Pronostics MMA, UFC et boxe : cotes des prochains combats · BeltChase',
    description: 'Cotes, favoris et pronostics des prochains combats UFC, PFL, boxe, kick et JJB : vainqueur, KO, soumission, décision, round. Pronostique gratuitement avec une monnaie virtuelle sur BeltChase.',
    path: '/pronos', body, jsonLd: [crumbsLd(items, '/pronos')],
  });
}

// /pronos/<page> : les prochains combats, par soirée, puis les derniers résultats.
export function renderLeague(league, matches, results = []) {
  const days = new Map();
  for (const m of matches) {
    const k = `${m.competition} · ${dateLong(m.startsAt)}`;
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(m);
  }
  const name = league.name;
  const path = `/pronos/${league.slug}`;
  const items = [['BeltChase', '/'], ['Pronostics', '/pronos'], [name, null]];
  const body = `${crumbsHtml(items)}
    <h1 class="seo-h1">Pronostics ${esc(name)} : cotes des prochains combats</h1>
    <p class="seo-lead">Les combats ${esc(name)} des prochaines semaines, avec les cotes et les chances de victoire de chaque combattant, et les résultats des dernières soirées. Clique sur un combat pour l'analyse (méthode et round compris), puis pronostique-le gratuitement sur BeltChase.</p>
    ${[...days].map(([day, list]) => `
    <h2 class="seo-day">${esc(day.charAt(0).toUpperCase() + day.slice(1))}</h2>
    <ul class="seo-matches">${list.map((m) => matchRow(league, m)).join('')}</ul>`).join('') || '<p class="muted">Pas de combat prévu pour le moment. Reviens bientôt !</p>'}
    ${results.length ? `
    <h2 class="seo-day">Derniers résultats ${esc(name)}</h2>
    <ul class="seo-matches">${results.slice(0, 30).map((m) => resultRow(league, m)).join('')}</ul>` : ''}`;
  const next = matches.slice(0, 3).map(versus).join(', ');
  return layout({
    title: `Pronostics ${name} et cotes des prochains combats · BeltChase`,
    description: `Cotes et pronostics ${name} : ${next || 'les prochaines affiches et les derniers résultats'}. Pronostique gratuitement sur BeltChase.`,
    path, body, jsonLd: [crumbsLd(items, path)],
    noindex: !matches.length && !results.length, // page vide : rien à proposer à Google
  });
}

// Cotes méthode et round d'un combat (estimées) : tableau lisible par Google.
function marketsBlock(m) {
  const keys = Object.keys(m.odds || {});
  const methods = [...new Set(keys.filter((k) => marketOf(k) === 'method').map((k) => k.split('-')[1]))];
  const ends = keys.filter((k) => marketOf(k) === 'end').sort((a, b) => (a === 'DEC' ? 1 : b === 'DEC' ? -1 : a.localeCompare(b)));
  if (!methods.length) return '';
  return `
      <h2 class="seo-day">Méthode de victoire</h2>
      <table class="seo-table">
        <thead><tr><th></th>${methods.map((k) => `<th>${esc(METHOD_LABEL[k] || k)}</th>`).join('')}</tr></thead>
        <tbody>${['1', '2'].map((s) => `<tr><th>${esc(s === '1' ? m.home.name : m.away.name)}</th>${methods.map((k) => `<td>${odds2(m.odds[`${s}-${k}`])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      ${ends.length ? `
      <h2 class="seo-day">Fin du combat</h2>
      <table class="seo-table">
        <thead><tr>${ends.map((k) => `<th>${k === 'DEC' ? 'Décision' : `Round ${k.slice(1)}`}</th>`).join('')}</tr></thead>
        <tbody><tr>${ends.map((k) => `<td>${odds2(m.odds[k])}</td>`).join('')}</tr></tbody>
      </table>` : ''}`;
}

// Données structurées d'un combat (SportsEvent) : lieu, organisateur et combattants.
function eventLd(league, m, path, description) {
  const v = m.meta?.venue;
  const fighters = [m.home, m.away].map((f) => ({ '@type': 'Person', name: f.name, ...(f.photo ? { image: f.photo } : {}) }));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: versus(m),
    description,
    startDate: new Date(m.startsAt).toISOString(),
    sport: sportMeta(m.sport).label,
    image: [...(m.poster ? [m.poster] : []), `${SITE}/icons/og.png`],
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: v
      ? { '@type': 'Place', name: v.name, address: { '@type': 'PostalAddress', ...(v.city ? { addressLocality: v.city } : {}), ...(v.country ? { addressCountry: v.country } : {}) } }
      : { '@type': 'Place', name: m.competition },
    competitor: fighters,
    performer: fighters,
    superEvent: { '@type': 'SportsEvent', name: m.competition },
    url: `${SITE}${path}`,
  };
  if (league.source === 'espn') ld.organizer = { '@type': 'Organization', name: league.name };
  return ld;
}

// /pronos/<page>/<combattants>-<id> : un combat à venir (cotes et analyse) ou terminé (résultat).
export function renderMatch(league, m, others = []) {
  const done = m.status === 'finished';
  const { outcomes, probs, verdict } = analysis(m);
  const path = matchPath(league, m);
  const items = [['BeltChase', '/'], ['Pronostics', '/pronos'], [league.name, `/pronos/${league.slug}`], [versus(m), null]];
  const where = m.meta?.venue ? ` · ${[m.meta.venue.name, m.meta.venue.city].filter(Boolean).join(', ')}` : '';
  const lead = `${esc(m.competition)}${m.round ? ` · ${esc(m.round)}` : ''} · ${esc(dateLong(m.startsAt))}${done ? '' : ` à ${esc(hour(m.startsAt))}`}${m.meta?.rounds ? ` · ${m.meta.rounds} rounds` : ''}${esc(where)}`;
  const face = (f) => (f.photo ? `<img class="seo-face" src="${esc(sizedPhoto(f.photo, 200))}" alt="${esc(f.name)}" width="200" height="145" loading="lazy" referrerpolicy="no-referrer" ${withFallback(f.photo)}>` : '');
  const vs = `<div class="seo-vs"><b>${face(m.home)}${esc(m.home.name)}</b><span>VS</span><b>${face(m.away)}${esc(m.away.name)}</b></div>
      ${m.home.record || m.away.record ? `<p class="muted seo-records">Bilans : ${esc(m.home.name)} ${esc(m.home.record || '–')} · ${esc(m.away.name)} ${esc(m.away.record || '–')}</p>` : ''}`;
  const poster = m.poster ? `<img class="seo-poster" src="${esc(sizedPhoto(m.poster, 800))}" alt="Affiche ${esc(versus(m))}" width="889" height="500" referrerpolicy="no-referrer" ${withFallback(m.poster)}>` : '';
  const card = done ? `
    <section class="card seo-match-card">
      ${poster}
      ${vs}
      <p class="seo-verdict">Résultat : ${esc(resultSentence(m))}</p>
      <a class="btn btn-primary btn-lg" href="/">Pronostiquer les prochains combats</a>
    </section>` : `
    <section class="card seo-match-card">
      ${poster}
      ${vs}
      <div class="seo-odds-big">${outcomes.map((o) => `
        <div><small>${esc(LABEL(m, o))}</small><b>${odds2(m.odds[o])}</b><i>${probs[o] ? `${pct(probs[o])} de chances` : ''}</i></div>`).join('')}
      </div>
      <p class="seo-verdict">${esc(verdict)}</p>
      ${marketsBlock(m)}
      <p class="muted">${m.oddsSource === 'bookmaker' ? 'Cotes du vainqueur : bookmakers (via ESPN), ramenées à la marge BeltChase.' : 'Cotes estimées par BeltChase à partir des bilans des combattants.'} Méthode et round : estimations BeltChase à partir des cotes et des statistiques de l'organisation.</p>
      <a class="btn btn-primary btn-lg" href="/">Pronostiquer ${esc(versus(m))}</a>
    </section>`;
  const body = `${crumbsHtml(items)}
    <h1 class="seo-h1">${esc(m.home.name)} – ${esc(m.away.name)} : ${done ? 'résultat' : 'cotes et pronostic'}</h1>
    <p class="seo-lead">${lead}</p>
    ${card}
    ${others.length ? `
    <h2 class="seo-day">${done ? 'Prochains' : 'Autres'} combats ${esc(league.name)}</h2>
    <ul class="seo-matches">${others.slice(0, 8).map((x) => matchRow(league, x)).join('')}</ul>` : ''}`;
  const description = done
    ? `${resultSentence(m)} ${m.competition}, ${dateShort(m.startsAt)}. Pronostique les prochains combats ${league.name} gratuitement sur BeltChase.`
    : `${verdict} Cotes ${outcomes.map((o) => `${o === 'X' ? 'nul' : LABEL(m, o)} ${odds2(m.odds[o])}`).join(', ')}. Pronostique gratuitement sur BeltChase.`;
  return layout({
    title: done
      ? `${versus(m)} : résultat (${league.name}, ${dateShort(m.startsAt)}) · BeltChase`
      : `${versus(m)} : cotes et pronostic (${league.name}, ${dateShort(m.startsAt)}) · BeltChase`,
    description, path, body,
    jsonLd: [eventLd(league, m, path, description), crumbsLd(items, path)],
  });
}

export function renderGone(league) {
  return layout({
    title: 'Combat introuvable · BeltChase',
    description: 'Ce combat est introuvable ou trop ancien.',
    path: '/pronos', noindex: true,
    body: `${crumbsHtml([['BeltChase', '/'], ['Pronostics', '/pronos'], ...(league ? [[league.name, `/pronos/${league.slug}`]] : [])])}
    <h1 class="seo-h1">Ce combat est introuvable</h1>
    <p class="seo-lead">Il a été annulé, ou il est trop ancien. ${league ? `<a href="/pronos/${league.slug}">Voir les prochains combats ${esc(league.name)}</a>.` : '<a href="/pronos">Voir tous les pronostics</a>.'}</p>`,
  });
}

// Plan du site : pages fixes, pages de combats à venir et de résultats récents. Ni lastmod, ni
// changefreq, ni priority : Google ignore les deux derniers, et un lastmod inexact lui fait ignorer le premier.
export function sitemapXml(groups) {
  const url = (loc) => `  <url><loc>${SITE}${loc}</loc></url>`;
  const lines = [url('/'), url('/pronos')];
  for (const g of groups) {
    const fights = [...g.matches, ...(g.results || [])];
    if (!fights.length) continue;
    lines.push(url(`/pronos/${g.league.slug}`));
    for (const m of fights) lines.push(url(matchPath(g.league, m)));
  }
  lines.push(url('/legal'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>\n`;
}
