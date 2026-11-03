// Fiche d'un combattant (#combattant/<id ESPN>) : photo, bio, palmarès, prochain combat à parier,
// historique des combats et actus qui le citent. Données : services/fighters.js (ESPN, UFC / PFL).
import { escapeHtml } from '../../util.js';
import { realNow } from '../../store.js';
import { matchStatus } from '../../services/matchInfo.js';
import { fighterState, loadFighter } from '../../services/fighters.js';
import { loadNews, news } from '../../services/news.js';
import { sizedPhoto } from '../../providers/photos.js';
import { icons } from '../icons.js';
import { matchCard } from './matches.js';
import { locale, t, tParts } from '../../i18n.js';

export const fighterIdFromHash = () => decodeURIComponent(location.hash.replace(/^#\/?/, '').split('/')[1] || '');

const RESULT = { W: [t('V'), t('Victoire')], L: [t('D'), t('Défaite')], D: [t('N'), t('Nul')] };
const day = (ts) => new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

function factsHtml(f) {
  const facts = [
    [t('Bilan'), f.record], [t('KO / TKO'), f.kos], [t('Soumissions'), f.subs],
    [t('Âge'), f.age && t('{n} ans', { n: f.age })], [t('Taille'), f.heightCm && `${f.heightCm} cm`],
    [t('Poids'), f.weightKg && `${f.weightKg} kg`], [t('Allonge'), f.reachCm && `${f.reachCm} cm`], [t('Garde'), f.stance && t(f.stance)],
  ].filter(([, v]) => v);
  return `<div class="fighter-facts">${facts.map(([k, v]) => `<div class="stat"><span class="muted">${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div>`;
}

function historyHtml(f) {
  if (!f.fights.length) return '';
  return `
    <h2 class="section-title">${t('Ses combats')}</h2>
    <ul class="fight-log">
      ${f.fights.slice(0, 15).map((x) => {
    const [code, label] = RESULT[x.result] || ['–', t('À venir')];
    return `
      <li class="fight-row res-${escapeHtml(x.result || 'na')}">
        <span class="fight-res" title="${label}">${code}</span>
        <span class="fight-main">
          <strong>${x.opponentId ? `<a href="#combattant/${escapeHtml(x.opponentId)}">${escapeHtml(x.opponent)}</a>` : escapeHtml(x.opponent)}</strong>
          <small>${escapeHtml([x.method && tParts(x.method), x.round && x.method && !/^Décision/.test(x.method) ? `R${x.round}` : null].filter(Boolean).join(' · ') || label)}${x.title ? ` · <b class="title-fight">${t('Titre')}</b>` : ''}</small>
        </span>
        <span class="fight-when"><small>${escapeHtml(day(x.date))}</small><small class="muted">${escapeHtml(x.event)}</small></span>
      </li>`;
  }).join('')}
    </ul>`;
}

export function renderFighter(s, p) {
  const id = fighterIdFromHash();
  if (!/^\d+$/.test(id)) return `<div class="empty"><p class="muted">${t('Combattant introuvable.')}</p></div>`;
  const st = fighterState(id);
  if (!st) loadFighter(id); // l'écran se redessine à l'arrivée (main.js)
  const f = st?.fighter;
  const back = `<a class="link-btn fighter-back" href="#matchs">← ${t('Combats')}</a>`;
  if (!f) {
    return st?.error && !st.loading
      ? `${back}<div class="empty"><p class="muted">${escapeHtml(st.error)}</p></div>`
      : `${back}<div class="skeletons" aria-busy="true"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  }

  const now = realNow();
  const next = Object.values(s.matches)
    .filter((m) => m.real && (m.home.espnId === id || m.away.espnId === id) && ['upcoming', 'live'].includes(matchStatus(m, now)))
    .sort((a, b) => a.startsAt - b.startsAt)[0];
  loadNews();
  const last = f.name.split(/\s+/).filter((w) => w.length > 3).pop();
  const articles = last ? news.items.filter((a) => a.title.toLowerCase().includes(last.toLowerCase())).slice(0, 4) : [];

  return `
    ${back}
    <section class="fighter-hero">
      ${f.photo ? `<img class="fighter-photo" src="${escapeHtml(sizedPhoto(f.photo, 400))}" alt="${escapeHtml(f.name)}" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      <div class="fighter-id">
        ${f.flag ? `<img class="fighter-flag-big" src="${escapeHtml(f.flag)}" alt="" referrerpolicy="no-referrer">` : ''}
        <h1>${escapeHtml(f.name)}</h1>
        ${f.nickname ? `<p class="fighter-nick">« ${escapeHtml(f.nickname)} »</p>` : ''}
        <p class="muted">${escapeHtml([f.weightClass && tParts(f.weightClass), f.team].filter(Boolean).join(' · '))}</p>
      </div>
    </section>
    ${factsHtml(f)}
    ${next ? `<h2 class="section-title">${t('Prochain combat')}</h2><div class="match-grid">${matchCard(next, { slipPick: p.slip.find((x) => x.matchId === next.id)?.outcome || null })}</div>` : ''}
    ${historyHtml(f)}
    ${articles.length ? `
      <h2 class="section-title">${t("Dans l'actu")}</h2>
      <ul class="fighter-news">${articles.map((a) => `<li><a href="${escapeHtml(a.link)}" target="_blank" rel="noopener">${icons.news}<span>${escapeHtml(a.title)}</span><small class="muted">${escapeHtml(a.source)}</small></a></li>`).join('')}</ul>` : ''}
    <p class="feed-credit">${t('Fiche et historique : ESPN.')}</p>`;
}
