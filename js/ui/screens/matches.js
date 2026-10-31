import { CONFIG } from '../../config.js';
import { logoSrc, teamMark } from '../logos.js';
import { clockFor, realNow } from '../../store.js';
import { escapeHtml, fmt, fmtOdds, formatKickoff, todayKey } from '../../util.js';
import { SPORT_ORDER, sportMeta } from '../../sports.js';
import { canClaimBonus } from '../../services/players.js';
import { isAwaitingKickoff, matchStatus, outcomeLabel, outcomeShort } from '../../services/matchInfo.js';
import { realFeedState } from '../../services/matches.js';
import { LIVE_SPORTS, liveMarket } from '../../providers/liveOdds.js';
import { spotlight } from '../../services/spotlight.js';
import { bonusFor, challengeStatus, nextStreakDay, STREAK_DAYS } from '../../services/daily.js';
import { AD_GOLD, AD_PER_DAY, adsLeft, rewardAdEnabled } from '../../services/rewardAd.js';
import { coin, icons } from '../icons.js';
import { ui } from '../uiState.js';
import { accountNudge, inviteBanner } from './account.js';
import { cloud, isGuest } from '../../services/cloud.js';
import { LEAGUE_PAGES, matchPath, resultSentence } from '../../seo/pages.js';
import { loadResults, mergeResults, results, RESULTS_DAYS } from '../../services/results.js';
import { DAYS as SEO_DAYS } from '../../seo/data.js';
import { fighterPhoto, portrait, starOf } from '../stars.js';
import { withFallback } from '../../providers/photos.js';
import { posterHtml } from '../posters.js';
import { METHOD_LABEL, marketOf, settleKey } from '../../services/markets.js';

const ORDER = { 1: 0, X: 1, 2: 2 };

// Lien vers la page publique du match (/pronos/…) : utile aux joueurs, et montre ces pages à Google.
function analysisLink(m, status, t) {
  if (status !== 'upcoming' || m.meta?.adapter !== 'mma' || m.startsAt - t > SEO_DAYS * 86_400_000) return '';
  const league = LEAGUE_PAGES.find((l) => l.sport === m.sport && l.league === m.meta.league);
  return league ? `<a class="match-analysis" href="${matchPath(league, m)}">Analyse et cotes du combat ›</a>` : '';
}

// Horaire court utilisé dans une liste déjà groupée par jour.
export function kickoffShort(ts, t) {
  const diff = ts - t;
  if (diff > 0 && diff < 60 * 60_000) return formatKickoff(ts, t);
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(key) {
  const today = todayKey(new Date(realNow()));
  const tomorrow = todayKey(new Date(realNow() + 86_400_000));
  if (key === today) return "Aujourd'hui";
  if (key === tomorrow) return 'Demain';
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const initials = (name) => String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Photo ronde du combattant, drapeau en médaillon ; initiales si la photo manque ou ne charge pas.
function fighterAvatar(t, sport) {
  const ph = fighterPhoto(t, sport);
  if (!ph) return teamMark(t);
  return `<span class="fighter-ava" data-ini="${escapeHtml(initials(t.name))}">
      <img src="${escapeHtml(ph.img)}" alt="${escapeHtml(t.name)}" loading="lazy" referrerpolicy="no-referrer" ${withFallback(ph.full)}>
      ${t.logo ? teamMark(t, 'fighter-flag') : ''}
    </span>`;
}

// Nom d'un combattant : lien vers sa fiche quand ESPN la fournit (UFC, PFL).
const fighterName = (t, label = t.name) => (t.espnId
  ? `<a class="fighter-link" href="#combattant/${escapeHtml(t.espnId)}">${escapeHtml(label)}</a>`
  : escapeHtml(label));

const teamRow = (t, winner, sport) => `
  <div class="team ${winner ? 'is-winner' : ''}">
    ${fighterAvatar(t, sport)}
    <span>${fighterName(t)}</span>
    ${t.record ? `<small class="record">${escapeHtml(t.record)}</small>` : ''}
  </div>`;

function scoreBlock(m, text) {
  if (!text) return '';
  const parts = String(text).split(' - ');
  if (m.sport !== 'tennis' && parts.length === 2 && parts.every((x) => x.trim().length <= 4)) {
    return `<div class="score"><b>${escapeHtml(parts[0])}</b><b>${escapeHtml(parts[1])}</b></div>`;
  }
  return `<div class="score score-text">${escapeHtml(text)}</div>`;
}

// Dernière cote en direct affichée par bouton, pour montrer dans quel sens elle bouge.
const shown = new Map();
const MOVE_MS = 6000;

function moveOf(key, v) {
  const prev = shown.get(key);
  if (!prev || prev.v !== v) {
    shown.set(key, { v, dir: prev && v && prev.v ? (v > prev.v ? 'up' : 'down') : null, at: Date.now() });
  }
  const cur = shown.get(key);
  return cur.dir && Date.now() - cur.at < MOVE_MS ? cur.dir : null;
}

// market : marché en direct (providers/liveOdds.js) ; sans lui, cotes d'avant-match.
function oddsButtons(m, status, slipPick, market = null, guest = false) {
  const outcomes = Object.keys(m.odds || {}).filter((k) => marketOf(k) === 'winner').sort((a, b) => ORDER[a] - ORDER[b]);
  return `
    <div class="odds cols-${outcomes.length}">
      ${outcomes.map((o) => {
        const selected = slipPick === o;
        const won = status === 'finished' && m.outcome === o;
        const v = market ? market.odds[o] : m.odds[o];
        const open = market ? market.open && !!v : status === 'upcoming';
        const move = market && v ? moveOf(`${m.id}|${o}`, v) : null;
        const label = outcomeShort(m, o);
        return `
        <button class="odd ${selected ? 'selected' : ''} ${won ? 'won' : ''} ${move ? `odd-${move}` : ''}" type="button"
          data-action="${guest ? 'guest-pick' : 'pick'}" data-match="${escapeHtml(m.id)}" data-outcome="${o}"
          ${open ? '' : 'disabled'}
          aria-pressed="${selected}" aria-label="${escapeHtml(label)} ${v ? `à ${fmtOdds(v)}` : ': non proposé'}">
          <span class="odd-label">${escapeHtml(label)}</span>
          <span class="odd-val">${v ? fmtOdds(v) : icons.lock}${move ? `<i class="odd-move" aria-hidden="true">${move === 'up' ? '▲' : '▼'}</i>` : ''}</span>
        </button>`;
      }).join('')}
    </div>`;
}

// Bouton de cote d'un marché méthode / round (même fonctionnement que les cotes du vainqueur).
function marketButton(m, key, label, status, slipPick, guest) {
  const v = m.odds[key];
  const selected = slipPick === key;
  const won = status === 'finished' && settleKey(key, m) === 'won';
  const open = status === 'upcoming' && !!v;
  return `
        <button class="odd odd-sm ${selected ? 'selected' : ''} ${won ? 'won' : ''}" type="button"
          data-action="${guest ? 'guest-pick' : 'pick'}" data-match="${escapeHtml(m.id)}" data-outcome="${key}"
          ${open ? '' : 'disabled'} aria-pressed="${selected}" aria-label="${escapeHtml(outcomeLabel(m, key))} ${v ? `à ${fmtOdds(v)}` : ''}">
          <span class="odd-label">${escapeHtml(label)}</span>
          <span class="odd-val">${v ? fmtOdds(v) : icons.lock}</span>
        </button>`;
}

// Paris « méthode » (vainqueur + KO/TKO, soumission, décision…) et « fin du combat » (round ou décision),
// repliés sous les cotes du vainqueur.
function fightMarkets(m, status, slipPick, guest) {
  const keys = Object.keys(m.odds || {}).filter((k) => marketOf(k) !== 'winner');
  if (!keys.length || status === 'void') return '';
  const open = ui.openMarkets.has(m.id);
  const picked = slipPick && marketOf(slipPick) !== 'winner' ? outcomeLabel(m, slipPick) : null;
  const methods = [...new Set(keys.filter((k) => marketOf(k) === 'method').map((k) => k.split('-')[1]))];
  const ends = keys.filter((k) => marketOf(k) === 'end').sort((a, b) => (a === 'DEC' ? 1 : b === 'DEC' ? -1 : a.localeCompare(b)));
  const toggle = `
    <button class="more-markets ${open ? 'is-open' : ''}" data-action="toggle-markets" data-match="${escapeHtml(m.id)}" type="button" aria-expanded="${open}">
      <span>${picked ? `Ton prono : <b>${escapeHtml(picked)}</b>` : `Méthode & round <small>${keys.length} paris</small>`}</span>
      <span aria-hidden="true">${open ? '▴' : '▾'}</span>
    </button>`;
  if (!open) return toggle;
  return `${toggle}
    <div class="markets">
      <p class="market-title">Vainqueur et méthode</p>
      <div class="market-grid">
        ${['1', '2'].map((side) => `
        <div class="market-col">
          <span class="market-who">${escapeHtml(side === '1' ? m.home.short || m.home.name : m.away.short || m.away.name)}</span>
          ${methods.map((k) => marketButton(m, `${side}-${k}`, METHOD_LABEL[k] || k, status, slipPick, guest)).join('')}
        </div>`).join('')}
      </div>
      ${ends.length ? `
      <p class="market-title">Fin du combat</p>
      <div class="market-row cols-${ends.length}">
        ${ends.map((k) => marketButton(m, k, k === 'DEC' ? 'Décision' : `Round ${k.slice(1)}`, status, slipPick, guest)).join('')}
      </div>` : ''}
    </div>`;
}

// Noms courts lisibles sur les cartes « À l'affiche » (les sigles ESPN sont parfois ambigus : MAN…).
const SHORT_NAMES = {
  'Manchester United': 'Man United', 'Manchester City': 'Man City', 'Paris Saint-Germain': 'PSG',
  'Tottenham Hotspur': 'Tottenham', 'Newcastle United': 'Newcastle', 'Wolverhampton Wanderers': 'Wolves',
  'Brighton & Hove Albion': 'Brighton', 'Nottingham Forest': 'Nottingham', 'Bayern Munich': 'Bayern',
  'Borussia Dortmund': 'Dortmund', 'Bayer Leverkusen': 'Leverkusen', 'Atlético Madrid': 'Atlético',
  'ASM Clermont Auvergne': 'Clermont', 'Union Bordeaux Begles': 'Bordeaux-Bègles', 'Stade Toulousain': 'Toulouse',
};
const displayName = (team) => SHORT_NAMES[team.name] || (team.name.length > 20 && team.short && team.short.length > 3 ? team.short : team.name);

// « À l'affiche » : carrousel des matchs les plus intéressants (derbys, gros clubs, chocs…).
function spotlightCard({ m, tag }, slipPick, first) {
  const t = clockFor(m);
  // Photo du combattant en grand (drapeau en médaillon), sinon le drapeau.
  const mark = (team) => {
    const face = portrait(team, 300);
    return face ? `<span class="ft-face ${face.cutout ? 'is-cutout' : ''}">
        <img src="${escapeHtml(face.img)}" alt="${escapeHtml(team.name)}" loading="lazy" referrerpolicy="no-referrer" ${withFallback(face.full)}>
        ${team.logo ? teamMark(team, 'ft-flag') : ''}
      </span>` : teamMark(team, `logo-img ${first ? 'logo-xl' : 'logo-lg'}`);
  };
  const side = (team) => `
    <div class="ft-team">
      ${mark(team)}
      <strong>${fighterName(team, displayName(team))}</strong>
    </div>`;
  // Affiche en plein cadre : l'officielle, sinon une affiche composée (posters.js).
  const poster = posterHtml(m, { width: 800, fail: "this.closest('.spot-card').classList.remove('has-poster');this.parentNode.remove()" });
  const stars = poster ? [null, null] : [m.home, m.away].map((t) => (portrait(t) ? null : starOf(t, m.sport)));
  const photo = (st, cls) => (st ? `<img class="spot-star ${cls}" src="${escapeHtml(st.img)}" alt="${escapeHtml(st.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '');
  return `
  <article class="featured spot-card ${first ? 'spot-first' : ''} ${poster ? 'has-poster' : stars.some(Boolean) ? 'has-stars' : ''}">
    ${poster ? `<div class="spot-poster">${poster}</div>` : ''}
    ${photo(stars[0], 'spot-star-home')}${photo(stars[1], 'spot-star-away')}
    <header class="featured-head">
      <span class="featured-tag">${escapeHtml(first && tag === m.competition ? 'Combat à la une' : tag)}</span>
      <span class="kick" data-kickoff="${m.startsAt}"${m.real ? ' data-real="1"' : ''}>${formatKickoff(m.startsAt, t)}</span>
    </header>
    <div class="ft-teams">${side(m.home)}<span class="ft-vs">VS</span>${side(m.away)}</div>
    <p class="ft-comp">${sportMeta(m.sport).icon} ${escapeHtml(m.competition)}${m.round ? ` · ${escapeHtml(m.round)}` : ''}</p>
    ${oddsButtons(m, 'upcoming', slipPick)}
  </article>`;
}

function spotlightSection(list, picks) {
  if (!list.length) return '';
  return `
    <section class="spotlight" aria-label="Combats à l'affiche">
      <div class="section-row spot-head">
        <h2 class="section-title">À l'affiche</h2>
        ${list.length > 1 ? `<span class="muted spot-hint">${list.length} gros combats →</span>` : ''}
      </div>
      <div class="spot-track">
        ${list.map((x, i) => spotlightCard(x, picks.get(x.m.id), i === 0)).join('')}
      </div>
    </section>`;
}


// guest : visiteur sans pseudo, une cote l'invite à s'inscrire (puis l'ajoute au panier).
// poster : affiche en tête de carte (false quand le groupe de la soirée l'affiche déjà) : l'officielle,
// ou une affiche composée pour la boxe (un combat = une soirée).
export function matchCard(m, { slipPick = null, grouped = false, guest = false, poster = true } = {}) {
  const t = clockFor(m);
  const status = matchStatus(m, t);
  const sport = sportMeta(m.sport);
  const realAttr = m.real ? ' data-real="1"' : '';

  let right = grouped
    ? `<span class="kick" data-kickoff-short="${m.startsAt}"${realAttr}>${kickoffShort(m.startsAt, t)}</span>`
    : `<span class="kick" data-kickoff="${m.startsAt}"${realAttr}>${formatKickoff(m.startsAt, t)}</span>`;
  if (status === 'live') right = isAwaitingKickoff(m, t) ? '<span class="soon-pill">PARIS FERMÉS</span>' : '<span class="live-pill">EN DIRECT</span>';
  const market = status === 'live' && LIVE_SPORTS.has(m.sport) && !isAwaitingKickoff(m, t) ? liveMarket(m, t) : null;
  if (status === 'finished') right = `<span class="done-pill">${m.outcome === 'void' ? 'Remboursé' : 'Terminé'}</span>`;
  if (status === 'void') right = '<span class="done-pill">Annulé</span>';

  const head = grouped
    ? `${m.round ? escapeHtml(m.round) : ''}${m.oddsSource === 'model' ? `${m.round ? ' · ' : ''}<span class="est" title="Aucune cote bookmaker disponible : cote estimée par BeltChase">cotes estimées</span>` : ''}`
    : `${sport.icon} ${escapeHtml(m.competition)}${m.round ? ` · ${escapeHtml(m.round)}` : ''}`;

  let extra = '';
  if (status === 'finished' || status === 'void') extra = scoreBlock(m, m.score);
  else if (status === 'live' && (m.real || m.liveScore)) extra = `${scoreBlock(m, m.liveScore)}${m.clock ? `<div class="live-clock">${escapeHtml(m.clock)}</div>` : ''}`;
  else if (status === 'live') extra = `<div class="live-clock" data-ends="${m.endsAt}"></div>`;

  const liveNote = market ? `
    <p class="live-note ${market.open ? 'is-open' : ''}">${market.open
      ? `${icons.bolt}<span>Cotes en direct</span>`
      : `${icons.lock}<span>${escapeHtml(market.reason || 'Paris suspendus')}</span>`}</p>` : '';

  return `
  <article class="match match-${status}${market?.open ? ' match-bettable' : ''}${slipPick ? ' has-pick' : ''}">
    ${poster && (m.poster || m.source === 'tsdb') ? `<div class="match-poster">${posterHtml(m)}</div>` : ''}
    <header class="match-head">
      <span class="comp">${head}</span>
      ${right}
    </header>
    <div class="match-body">
      <div class="teams">
        ${teamRow(m.home, status === 'finished' && m.outcome === '1', m.sport)}
        ${teamRow(m.away, status === 'finished' && m.outcome === '2', m.sport)}
      </div>
      ${extra}
    </div>
    ${oddsButtons(m, status, slipPick, market, guest)}
    ${fightMarkets(m, status, slipPick, guest)}
    ${liveNote}
    ${analysisLink(m, status, t)}
  </article>`;
}

function sportChips(list, countOf) {
  const counts = { all: 0 };
  for (const m of list) {
    if (!countOf(m)) continue;
    counts.all += 1;
    counts[m.sport] = (counts[m.sport] || 0) + 1;
  }
  const present = SPORT_ORDER.filter((k) => list.some((m) => m.sport === k));
  if (ui.sport !== 'all' && !present.includes(ui.sport)) ui.sport = 'all';
  const tile = (key, icon, label) => `
    <button class="sport-tile ${ui.sport === key ? 'active' : ''}" data-action="filter-sport" data-sport="${key}" type="button"
      aria-pressed="${ui.sport === key}">
      <span class="sport-icon" aria-hidden="true">${icon}</span>
      <span class="sport-name">${label}</span>
      <span class="sport-count">${counts[key] || 0}</span>
    </button>`;
  return `
    <nav class="sports-bar" aria-label="Choisir un sport">
      ${tile('all', '🏆', 'Tout')}
      ${present.map((k) => tile(k, sportMeta(k).icon, sportMeta(k).label)).join('')}
    </nav>`;
}

function modeSwitch(mode) {
  return `
    <div class="mode-switch" role="tablist" aria-label="Type de combats">
      <button class="mode ${mode === 'real' ? 'active' : ''}" role="tab" aria-selected="${mode === 'real'}" data-action="set-mode" data-mode="real" type="button">
        <span class="mode-icon">${icons.stadium}</span><span><strong>Vrais combats</strong><small>UFC, PFL, boxe…</small></span>
      </button>
      <button class="mode ${mode === 'fake' ? 'active' : ''}" role="tab" aria-selected="${mode === 'fake'}" data-action="set-mode" data-mode="fake" type="button">
        <span class="mode-icon">${icons.bolt}</span><span><strong>Combats éclair</strong><small>Fictifs · 2 min</small></span>
      </button>
    </div>`;
}

// Vues de l'écran des vrais combats : parier (par jour), calendrier des soirées, résultats récents.
const REAL_VIEWS = [['paris', 'Parier'], ['calendrier', 'Calendrier'], ['resultats', 'Résultats']];
function viewTabs() {
  return `
    <div class="tabs real-views" role="tablist">
      ${REAL_VIEWS.map(([id, label]) => `<button class="tab ${ui.realView === id ? 'active' : ''}" role="tab" aria-selected="${ui.realView === id}" data-action="real-view" data-view="${id}" type="button">${label}</button>`).join('')}
    </div>`;
}

const dateLong = (t) => new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const hourOf = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Soirées : combats d'une même compétition le même jour (la boxe sans nom de soirée : un combat = une soirée).
function eventsOf(list) {
  const events = new Map();
  for (const m of list) {
    const key = `${m.sport}|${m.competition === 'Boxe' ? m.id : m.competition}|${todayKey(new Date(m.startsAt))}`;
    if (!events.has(key)) events.set(key, []);
    events.get(key).push(m);
  }
  return [...events.values()].map((fights) => {
    const sorted = fights.sort((a, b) => a.startsAt - b.startsAt);
    const main = sorted.find((m) => /combat principal/i.test(m.round || '')) || sorted[sorted.length - 1];
    return { fights: sorted, main, startsAt: sorted[0].startsAt };
  });
}

// Calendrier : une ligne par soirée à venir ; la toucher ouvre ses combats (vue Parier, ce jour-là).
function calendarView(upcoming) {
  const events = eventsOf(upcoming).sort((a, b) => a.startsAt - b.startsAt);
  if (!events.length) return '<div class="empty"><p class="muted">Aucune soirée prévue pour le moment.</p></div>';
  const byDay = new Map();
  for (const e of events) {
    const k = todayKey(new Date(e.startsAt));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  return [...byDay].map(([day, list]) => `
    <h2 class="cal-day">${escapeHtml(cap(dateLong(list[0].startsAt)))}</h2>
    <div class="cal-list">
      ${list.map((e) => {
    const m = e.main;
    const title = m.competition === 'Boxe' ? `Boxe · ${m.home.name} – ${m.away.name}` : m.competition;
    return `
      <button class="cal-event" data-action="cal-open" data-day="${day}" type="button">
        <span class="cal-poster">${posterHtml(m, { width: 400 })}</span>
        <span class="cal-body">
          <span class="cal-sport">${sportMeta(m.sport).icon} ${escapeHtml(sportMeta(m.sport).label)} · ${escapeHtml(hourOf(e.startsAt))}</span>
          <strong>${escapeHtml(title)}</strong>
          <span class="muted">${e.fights.length > 1 ? `${e.fights.length} combats · ` : ''}${escapeHtml(m.home.name)} – ${escapeHtml(m.away.name)}</span>
        </span>
        ${icons.arrow}
      </button>`;
  }).join('')}
    </div>`).join('');
}

// Phrase de résultat, noms des combattants cliquables (fiche).
function resultLinks(m) {
  let html = escapeHtml(resultSentence(m));
  for (const t of [m.home, m.away]) if (t.espnId) html = html.replace(escapeHtml(t.name), fighterName(t));
  return html;
}

// Résultats : soirées terminées, la plus récente d'abord, vainqueur et méthode de chaque combat.
function resultsView(local, sport) {
  loadResults(); // ESPN relu toutes les 30 min (l'écran se redessine à l'arrivée)
  const list = mergeResults(results.items, local).filter((m) => sport === 'all' || m.sport === sport);
  if (!list.length) {
    return results.loading || !results.at
      ? '<div class="skeletons" aria-busy="true">' + '<div class="skeleton"></div>'.repeat(3) + '</div>'
      : `<div class="empty"><p class="muted">${escapeHtml(results.error || 'Aucun résultat récent.')}</p></div>`;
  }
  const events = eventsOf(list).sort((a, b) => b.startsAt - a.startsAt);
  return `
    <p class="muted results-note">Combats terminés des ${RESULTS_DAYS} derniers jours.</p>
    ${events.map((e) => `
    <section class="result-event">
      <h2 class="cal-day">${escapeHtml(e.main.competition === 'Boxe' ? 'Boxe' : e.main.competition)} <small>${escapeHtml(cap(dateLong(e.startsAt)))}</small></h2>
      <ul class="result-list">
        ${[...e.fights].reverse().map((m) => `
        <li class="result-row">
          <span class="result-ava">${fighterAvatar(m.outcome === '2' ? m.away : m.home, m.sport)}</span>
          <span>${resultLinks(m)}</span>
        </li>`).join('')}
      </ul>
    </section>`).join('')}`;
}

function renderReal(s, p, picks) {
  const feed = realFeedState();
  const t = realNow();
  const all = Object.values(s.matches).filter((m) => m.real);
  const inSport = all.filter((m) => ui.sport === 'all' || m.sport === ui.sport);
  const card = (m, poster = true) => matchCard(m, { slipPick: picks.get(m.id), grouped: true, poster });

  if (!feed.configured) {
    return `<div class="empty"><p><strong>Aucune source de vrais combats n'est configurée.</strong></p></div>`;
  }
  if (!all.length) {
    if (feed.error && !feed.loading) {
      return `
      <div class="empty feed-error">
        <p><strong>Impossible de charger les vrais combats</strong></p>
        <p class="muted">Vérifie ta connexion internet. (${escapeHtml(feed.error)})</p>
        <button class="btn btn-ghost" data-action="refresh-real" type="button">Réessayer</button>
      </div>`;
    }
    return `
      <div class="skeletons" aria-busy="true" aria-label="Chargement des vrais combats">
        ${'<div class="skeleton"></div>'.repeat(4)}
      </div>`;
  }

  const live = inSport.filter((m) => matchStatus(m, t) === 'live').sort((a, b) => a.startsAt - b.startsAt);
  const upcoming = inSport.filter((m) => matchStatus(m, t) === 'upcoming');
  const days = [...new Set(upcoming.map((m) => todayKey(new Date(m.startsAt))))].sort();
  if (!days.includes(ui.day)) ui.day = days[0] || null;
  const spot = spotlight(upcoming, t);
  const dayMatches = upcoming.filter((m) => todayKey(new Date(m.startsAt)) === ui.day);

  // Groupes par compétition, rangés par sport (même ordre que la barre), puis par premier match.
  const groups = new Map();
  const rank = (m) => (SPORT_ORDER.indexOf(m.sport) + 1 || 99) * 1e13 + m.startsAt;
  for (const m of dayMatches.sort((a, b) => rank(a) - rank(b))) {
    const key = `${m.sport}|${m.competition}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const finished = inSport
    .filter((m) => m.status === 'finished' || m.status === 'void')
    .sort((a, b) => (b.finishedAt || b.startsAt) - (a.finishedAt || a.startsAt))
    .slice(0, 8);

  if (ui.realView === 'calendrier') {
    return `${viewTabs()}${sportChips(all, (m) => matchStatus(m, t) === 'upcoming')}${calendarView(upcoming)}`;
  }
  if (ui.realView === 'resultats') {
    const local = all.filter((m) => m.status === 'finished');
    return `${viewTabs()}${sportChips(all, () => true)}${resultsView(local, ui.sport)}`;
  }

  return `
    ${viewTabs()}
    ${spotlightSection(spot, picks)}

    ${sportChips(all, (m) => matchStatus(m, t) === 'upcoming')}

    ${live.length ? `
      <h2 class="section-title"><span class="live-dot"></span>En direct <span class="muted section-note">${live.some((m) => LIVE_SPORTS.has(m.sport)) ? 'paris en direct' : 'paris fermés'}</span></h2>
      <div class="match-grid">${live.map((m) => matchCard(m, { slipPick: picks.get(m.id) })).join('')}</div>` : ''}

    ${days.length ? `
      <div class="day-chips" role="toolbar" aria-label="Choisir un jour">
        ${days.map((d) => `
          <button class="day-chip ${d === ui.day ? 'active' : ''}" data-action="filter-day" data-day="${d}" type="button">${dayLabel(d)}</button>`).join('')}
      </div>
      ${[...groups.values()].map((list, i, arr) => {
        const first = list[0];
        // Soirée (UFC, PFL, combats saisis) : une affiche en tête du groupe, l'officielle si toute la soirée
        // la partage, sinon composée sur le combat principal. Boxe : une affiche par combat (matchCard).
        // Le combat principal peut tomber le jour suivant (carte principale après minuit) : cherché dans toute la soirée.
        const isMain = (m) => m.competition === first.competition && /combat principal/i.test(m.round || '');
        const head = first.source === 'tsdb' ? null : list.find(isMain) || upcoming.find(isMain) || list[0];
        const shared = head && first.poster && list.every((m) => m.poster === first.poster) ? first : head;
        const headPoster = shared ? posterHtml(shared, { width: 800 }) : '';
        const newSport = ui.sport === 'all' && (i === 0 || arr[i - 1][0].sport !== first.sport);
        return `
        ${newSport ? `<h2 class="sport-heading">${sportMeta(first.sport).icon} ${escapeHtml(sportMeta(first.sport).label)}</h2>` : ''}
        <section class="comp-group">
          <h3 class="comp-title">
            ${first.competitionLogo ? `<img class="comp-logo" src="${escapeHtml(logoSrc(first.competitionLogo))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="comp-emoji">${sportMeta(first.sport).icon}</span>`}
            <span>${escapeHtml(first.competition)}</span>
            <span class="comp-count">${list.length}</span>
          </h3>
          ${headPoster ? `<div class="comp-poster">${headPoster}</div>` : ''}
          <div class="match-grid">${list.map((m) => card(m, !headPoster || (m.poster && m.poster !== shared.poster))).join('')}</div>
        </section>`;
      }).join('')}` : `
      <div class="empty"><p class="muted">Aucun combat à venir pour ce sport dans les ${CONFIG.REAL_DAYS_AHEAD} prochains jours.</p></div>`}

    ${finished.length ? `
      <h2 class="section-title">Derniers résultats</h2>
      <div class="match-grid">${finished.map((m) => matchCard(m)).join('')}</div>` : ''}

    <p class="feed-credit">
      Données : ${escapeHtml(feed.sources.join(', ') || 'sources sportives publiques')}${feed.snapshotAt
        ? ` · instantané du ${new Date(feed.snapshotAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Les résultats arrivent à chaque mise à jour de l'instantané.`
        : `${feed.lastOk ? ` · mis à jour à ${new Date(feed.lastOk).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}.`}
      Les cotes viennent des bookmakers quand elles sont publiées, sinon BeltChase les estime.
      ${feed.snapshotAt ? '' : '<button class="link-btn" data-action="refresh-real" type="button">Actualiser</button>'}
    </p>
  `;
}

function renderFake(s, p, picks) {
  const fakes = Object.values(s.matches).filter((m) => !m.real);
  const inSport = fakes.filter((m) => ui.sport === 'all' || m.sport === ui.sport);
  const byStart = (a, b) => a.startsAt - b.startsAt;
  const live = inSport.filter((m) => matchStatus(m) === 'live').sort(byStart);
  const upcoming = inSport.filter((m) => matchStatus(m) === 'upcoming').sort(byStart);
  const finished = inSport.filter((m) => m.status === 'finished').sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 6);
  const card = (m) => matchCard(m, { slipPick: picks.get(m.id) });

  return `
    ${sportChips(fakes, (m) => matchStatus(m) === 'upcoming')}

    ${live.length ? `
      <h2 class="section-title"><span class="live-dot"></span>En direct <span class="muted section-note">paris en direct</span></h2>
      <div class="match-grid">${live.map(card).join('')}</div>` : ''}

    <div class="section-row">
      <h2 class="section-title">À venir</h2>
      <button class="link-btn" data-action="fast-forward" type="button" title="Simuler le passage du temps">
        ${icons.forward} +${CONFIG.FAST_FORWARD_MIN} min
      </button>
    </div>
    ${upcoming.length
      ? `<div class="match-grid">${upcoming.map(card).join('')}</div>`
      : `<div class="empty"><p>Chargement des prochains combats…</p></div>`}

    ${finished.length ? `
      <h2 class="section-title">Derniers résultats</h2>
      <div class="match-grid">${finished.map(card).join('')}</div>` : ''}
  `;
}


// « Ta journée » : bonus et série d'un côté, défis de l'autre (liste repliable), en un seul bandeau.
function dayStrip(p) {
  if (isGuest()) return `
    <section class="card day-strip day-locked">
      <button class="day-ad" data-action="go-account" type="button">
        <span class="day-ico">${icons.lock}</span>
        <span class="grow"><strong>Bonus du jour · défis · bonus vidéo</strong><small>Crée ton compte gratuit pour les débloquer</small></span>
      </button>
    </section>`;
  const list = challengeStatus(p);
  const done = list.filter((c) => c.done).length;
  const day = nextStreakDay(p);
  const claimable = canClaimBonus(p);
  return `
    <section class="card day-strip">
      <div class="day-row">
        ${claimable ? `
          <button class="day-bonus" data-action="claim-bonus" type="button">
            <span class="day-ico">${icons.gift}</span>
            <span><strong>Bonus +${fmt(bonusFor(day))}</strong><small>${day > 1 ? `Série jour ${day}/${STREAK_DAYS}` : 'Récupère-le !'}</small></span>
          </button>` : `
          <div class="day-bonus is-done">
            <span class="day-ico">${icons.check}</span>
            <span><strong>Bonus récupéré</strong><small>Série ${p.bonusStreak || 1}/${STREAK_DAYS} · reviens demain</small></span>
          </div>`}
        <button class="day-challenges" data-action="toggle-challenges" type="button" aria-expanded="${!!ui.challengesOpen}">
          <span class="day-ico">${icons.target}</span>
          <span class="grow"><strong>Défis ${done}/${list.length}</strong>
            <span class="challenge-bar"><span style="width:${Math.round((done / list.length) * 100)}%"></span></span></span>
          <span class="day-chevron">${ui.challengesOpen ? '▴' : '▾'}</span>
        </button>
      </div>
      ${adButton(p)}
      ${ui.challengesOpen ? challengesList(list) : ''}
    </section>`;
}

// Pub récompensée : des Gold contre une pub regardée jusqu'au bout, quelques fois par jour.
function adButton(p) {
  if (!rewardAdEnabled()) return '';
  const left = adsLeft(p);
  const watched = AD_PER_DAY() - left;
  return left ? `
      <button class="day-ad" data-action="watch-ad" type="button">
        <span class="day-ico">${icons.play}</span>
        <span class="grow"><strong>Bonus vidéo · +${fmt(AD_GOLD())}</strong><small>${watched}/${AD_PER_DAY()} aujourd'hui</small></span>
        <span class="day-ad-coin">${coin('coin coin-sm')}</span>
      </button>` : `
      <div class="day-ad is-done">
        <span class="day-ico">${icons.check}</span>
        <span class="grow"><strong>Bonus vidéo du jour récupérés</strong><small>${AD_PER_DAY()}/${AD_PER_DAY()} · reviens demain</small></span>
      </div>`;
}

function challengesList(list) {
  return `
      <ul class="challenge-list">
        ${list.map((c) => `
          <li class="challenge ${c.done ? 'is-done' : ''}">
            <span class="challenge-check">${c.done ? icons.check : ''}</span>
            <span class="grow">
              <span class="challenge-text">${escapeHtml(c.text)}</span>
              <span class="challenge-bar"><span style="width:${Math.round((c.count / c.target) * 100)}%"></span></span>
            </span>
            <span class="challenge-reward">${c.done ? 'Réussi' : `${c.count}/${c.target}`}<small>+${c.gold} ${coin('coin coin-xs')} · +${c.xp} XP</small></span>
          </li>`).join('')}
      </ul>`;
}


export function renderMatches(s, p) {
  const mode = s.prefs?.mode === 'fake' ? 'fake' : 'real';
  const picks = new Map(p.slip.map((x) => [x.matchId, x.outcome]));

  return `
    <section class="greeting">
      <h1>Salut <b>${escapeHtml(p.pseudo)}</b></h1>
      ${mode === 'fake' ? '<p class="muted">Des combats fictifs de 2 minutes pour jouer tout de suite.</p>' : ''}
    </section>

    ${cloud.user ? '' : inviteBanner({ inGame: true }) || (p.stats.betsPlaced > 0 ? accountNudge() : '')}

    ${dayStrip(p)}

    ${modeSwitch(mode)}

    ${mode === 'real' ? renderReal(s, p, picks) : renderFake(s, p, picks)}
  `;
}
