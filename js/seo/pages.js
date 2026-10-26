// Pages publiques de pronostics, rendues côté serveur (Cloudflare Pages Functions) pour que Google
// les lise sans JavaScript : /pronos (organisations), /pronos/<organisation> (prochaines soirées et
// cotes), /pronos/<organisation>/<combattants>-<id> (un combat). Fonctions pures : données en entrée,
// HTML en sortie ; le chargement des combats est dans seo/data.js.
import { MMA_LEAGUES } from '../providers/espn/mma.js';
import { sportMeta } from '../sports.js';
import { devig } from '../providers/odds.js';
import { METHOD_LABEL, marketOf } from '../services/markets.js';

export const SITE = 'https://goalzz.fr';

export const slugify = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, 'et').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Organisations avec une page : celles lues chez ESPN (UFC, PFL).
export const LEAGUE_PAGES = MMA_LEAGUES.map(({ slug, label }) => ({ slug, league: slug, name: label, sport: 'mma' }));
export const leagueBySlug = (slug) => LEAGUE_PAGES.find((l) => l.slug === slug) || null;

// Id du combat (ESPN) dans l'adresse : 'espn:mma:ufc:401911630_5088844_3075570' → '401911630'.
export const eventId = (m) => String(m.id.split(':').pop().split('_')[0]);
export const matchPath = (league, m) => `/pronos/${league.slug}/${slugify(`${m.home.name} ${m.away.name}`)}-${eventId(m)}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const odds2 = (o) => (o ? o.toFixed(2).replace('.', ',') : '–');
const pct = (p) => `${Math.round(p * 100)} %`;
const TZ = 'Europe/Paris';
const dateLong = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const dateShort = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short' });
const hour = (t) => new Date(t).toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

const LABEL = (m, o) => (o === 'X' ? 'Nul' : o === '1' ? m.home.name : m.away.name);
const winnerOdds = (m) => Object.fromEntries(Object.entries(m.odds || {}).filter(([k]) => marketOf(k) === 'winner'));

// Lecture des cotes du vainqueur : probabilités sans marge, favori et phrase d'analyse.
export function analysis(m) {
  const probs = devig(winnerOdds(m)) || {};
  const outcomes = Object.keys(winnerOdds(m)).sort((a, b) => ({ 1: 0, X: 1, 2: 2 }[a] - { 1: 0, X: 1, 2: 2 }[b]));
  const fav = outcomes.filter((o) => o !== 'X').sort((a, b) => (probs[b] || 0) - (probs[a] || 0))[0];
  const gap = Math.abs((probs['1'] || 0) - (probs['2'] || 0));
  let verdict;
  if (gap < 0.08) verdict = `Combat très serré : les cotes ne départagent presque pas ${m.home.name} et ${m.away.name}.`;
  else if (probs[fav] > 0.6) verdict = `${LABEL(m, fav)} part grand favori (${pct(probs[fav])} de chances selon les cotes).`;
  else verdict = `${LABEL(m, fav)} est légèrement favori (${pct(probs[fav])} de chances selon les cotes).`;
  return { probs, outcomes, fav, verdict };
}

function layout({ title, description, path, body, jsonLd = null, noindex = false }) {
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
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
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

const crumbs = (items) => `
    <nav class="seo-crumbs" aria-label="Fil d'Ariane">${items.map(([label, href]) => (href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)).join(' › ')}</nav>`;

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

// /pronos : toutes les compétitions qui ont des matchs à venir.
export function renderHub(groups) {
  const list = groups.filter((g) => g.matches.length);
  const body = `${crumbs([['BeltChase', '/'], ['Pronostics', null]])}
    <h1 class="seo-h1">Pronostics MMA et UFC : cotes des prochains combats</h1>
    <p class="seo-lead">Les cotes, les favoris et les pronos de tous les combats à venir à l'UFC et au PFL : vainqueur, méthode de victoire (KO/TKO, soumission, décision) et round. Choisis une organisation pour voir ses prochaines soirées.</p>
    <div class="seo-grid">
      ${list.map((g) => `
      <a class="card seo-league" href="/pronos/${g.league.slug}">
        <span class="seo-league-name">${sportMeta(g.league.sport).icon} ${esc(g.league.name)}</span>
        <span class="muted">${g.matches.length} combat${g.matches.length > 1 ? 's' : ''} à venir · prochaine soirée le ${esc(dateShort(g.matches[0].startsAt))}</span>
      </a>`).join('') || '<p class="muted">Aucun combat à venir pour le moment.</p>'}
    </div>`;
  return layout({
    title: 'Pronostics MMA et UFC : cotes des prochains combats · BeltChase',
    description: 'Cotes, favoris et pronostics des prochains combats UFC et PFL : vainqueur, KO, soumission, décision, round. Pronostique gratuitement avec une monnaie virtuelle sur BeltChase.',
    path: '/pronos', body,
  });
}

// /pronos/<organisation> : les prochains combats, par soirée.
export function renderLeague(league, matches) {
  const days = new Map();
  for (const m of matches) {
    const k = `${m.competition} · ${dateLong(m.startsAt)}`;
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(m);
  }
  const name = league.name;
  const body = `${crumbs([['BeltChase', '/'], ['Pronostics', '/pronos'], [name, null]])}
    <h1 class="seo-h1">Pronostics ${esc(name)} : cotes des prochains combats</h1>
    <p class="seo-lead">Toutes les soirées ${esc(name)} des 4 prochaines semaines, combat par combat, avec les cotes et les chances de victoire de chaque combattant. Clique sur un combat pour l'analyse (méthode et round compris), puis pronostique-le gratuitement sur BeltChase.</p>
    ${[...days].map(([day, list]) => `
    <h2 class="seo-day">${esc(day.charAt(0).toUpperCase() + day.slice(1))}</h2>
    <ul class="seo-matches">${list.map((m) => matchRow(league, m)).join('')}</ul>`).join('') || '<p class="muted">Pas de combat prévu dans les 4 prochaines semaines. Reviens bientôt !</p>'}`;
  return layout({
    title: `Pronostics ${name} et cotes des prochains combats · BeltChase`,
    description: `Cotes et pronostics ${name} : ${matches.slice(0, 3).map((m) => `${m.home.name} – ${m.away.name}`).join(', ') || 'les prochaines affiches'}. Pronostique gratuitement sur BeltChase.`,
    path: `/pronos/${league.slug}`, body,
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

// /pronos/<organisation>/<combattants>-<id> : un combat.
export function renderMatch(league, m, others = []) {
  const { outcomes, probs, verdict } = analysis(m);
  const title = `${m.home.name} – ${m.away.name} : cotes et pronostic (${league.name}, ${dateShort(m.startsAt)})`;
  const path = matchPath(league, m);
  const body = `${crumbs([['BeltChase', '/'], ['Pronostics', '/pronos'], [league.name, `/pronos/${league.slug}`], [`${m.home.name} – ${m.away.name}`, null]])}
    <h1 class="seo-h1">${esc(m.home.name)} – ${esc(m.away.name)} : cotes et pronostic</h1>
    <p class="seo-lead">${esc(m.competition)}${m.round ? ` · ${esc(m.round)}` : ''} · ${esc(dateLong(m.startsAt))} à ${esc(hour(m.startsAt))}${m.meta?.rounds ? ` · ${m.meta.rounds} rounds` : ''}</p>
    <section class="card seo-match-card">
      <div class="seo-vs"><b>${esc(m.home.name)}</b><span>VS</span><b>${esc(m.away.name)}</b></div>
      ${m.home.record || m.away.record ? `<p class="muted seo-records">Bilans : ${esc(m.home.name)} ${esc(m.home.record || '–')} · ${esc(m.away.name)} ${esc(m.away.record || '–')}</p>` : ''}
      <div class="seo-odds-big">${outcomes.map((o) => `
        <div><small>${esc(LABEL(m, o))}</small><b>${odds2(m.odds[o])}</b><i>${probs[o] ? `${pct(probs[o])} de chances` : ''}</i></div>`).join('')}
      </div>
      <p class="seo-verdict">${esc(verdict)}</p>
      ${marketsBlock(m)}
      <p class="muted">${m.oddsSource === 'bookmaker' ? 'Cotes du vainqueur : bookmakers (via ESPN), ramenées à la marge BeltChase.' : 'Cotes estimées par BeltChase à partir des bilans des combattants.'} Méthode et round : estimations BeltChase à partir des cotes et des statistiques de l'organisation.</p>
      <a class="btn btn-primary btn-lg" href="/">Pronostiquer ${esc(m.home.name)} – ${esc(m.away.name)}</a>
    </section>
    ${others.length ? `
    <h2 class="seo-day">Autres combats ${esc(league.name)}</h2>
    <ul class="seo-matches">${others.slice(0, 8).map((x) => matchRow(league, x)).join('')}</ul>` : ''}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${m.home.name} – ${m.away.name}`,
    startDate: new Date(m.startsAt).toISOString(),
    sport: sportMeta(m.sport).label,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: m.competition },
    competitor: [{ '@type': 'Person', name: m.home.name }, { '@type': 'Person', name: m.away.name }],
    superEvent: { '@type': 'SportsEvent', name: m.competition },
    url: `${SITE}${path}`,
  };
  return layout({
    title: `${title} · BeltChase`,
    description: `${verdict} Cotes ${outcomes.map((o) => `${o === 'X' ? 'nul' : LABEL(m, o)} ${odds2(m.odds[o])}`).join(', ')}. Pronostique gratuitement sur BeltChase.`,
    path, body, jsonLd,
  });
}

export function renderGone(league) {
  return layout({
    title: 'Combat terminé ou introuvable · BeltChase',
    description: 'Ce combat n\'est plus à venir.',
    path: '/pronos', noindex: true,
    body: `${crumbs([['BeltChase', '/'], ['Pronostics', '/pronos'], ...(league ? [[league.name, `/pronos/${league.slug}`]] : [])])}
    <h1 class="seo-h1">Ce combat n'est plus à venir</h1>
    <p class="seo-lead">Il est terminé, annulé ou introuvable. ${league ? `<a href="/pronos/${league.slug}">Voir les prochains combats ${esc(league.name)}</a>.` : '<a href="/pronos">Voir tous les pronostics</a>.'}</p>`,
  });
}

// Plan du site : pages fixes, organisations et combats à venir.
export function sitemapXml(groups, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const url = (loc, freq, prio) => `  <url><loc>${SITE}${loc}</loc><lastmod>${day}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`;
  const lines = [url('/', 'daily', '1.0'), url('/pronos', 'daily', '0.9')];
  for (const g of groups) {
    if (!g.matches.length) continue;
    lines.push(url(`/pronos/${g.league.slug}`, 'daily', '0.8'));
    for (const m of g.matches) lines.push(url(matchPath(g.league, m), 'daily', '0.6'));
  }
  lines.push(url('/legal', 'monthly', '0.2'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>\n`;
}
