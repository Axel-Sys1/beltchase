// Écran « Actus » : dernières nouvelles MMA, boxe, kick, JJB et amateurs (services/news.js).
// Chaque article ouvre sa source dans un nouvel onglet ; la première actu s'affiche en grand.
import { escapeHtml } from '../../util.js';
import { NEWS_SPORTS, headlines, loadNews, news } from '../../services/news.js';
import { sportMeta } from '../../sports.js';
import { ui } from '../uiState.js';

const MIN = 60 * 1000;
function ago(t, now = Date.now()) {
  const d = now - t;
  if (!t || d < 0) return '';
  if (d < 60 * MIN) return `il y a ${Math.max(1, Math.round(d / MIN))} min`;
  if (d < 24 * 60 * MIN) return `il y a ${Math.round(d / (60 * MIN))} h`;
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const sportLabel = (id) => (id === 'amateur' ? 'Amateurs' : id ? sportMeta(id).label : '');

// Vignette : image du flux, sinon un fond aux couleurs de la discipline (La Sueur n'en fournit pas).
function thumb(a) {
  const icon = a.sport && a.sport !== 'amateur' ? sportMeta(a.sport).icon : '🥊';
  return a.image
    ? `<img src="${escapeHtml(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'news-ph',textContent:'${icon}'}))">`
    : `<span class="news-ph news-ph-${escapeHtml(a.sport || 'all')}">${icon}</span>`;
}

function card(a, big = false) {
  return `
    <a class="news-card ${big ? 'news-big' : ''}" href="${escapeHtml(a.link)}" target="_blank" rel="noopener">
      <span class="news-thumb">${thumb(a)}</span>
      <span class="news-body">
        ${a.sport ? `<span class="news-tag">${escapeHtml(sportLabel(a.sport))}</span>` : ''}
        <strong>${escapeHtml(a.title)}</strong>
        ${big && a.excerpt ? `<span class="news-excerpt">${escapeHtml(a.excerpt)}</span>` : ''}
        <small>${escapeHtml(a.source)} · ${escapeHtml(ago(a.date))}</small>
      </span>
    </a>`;
}

// « À la une » : la grosse actu en très grand (photo plein cadre, titre par-dessus), puis deux autres.
export function uneHtml(top) {
  if (!top.length) return '';
  const [main, ...rest] = top;
  const tile = (a, big) => `
    <a class="une-card ${big ? 'une-main' : ''}" href="${escapeHtml(a.link)}" target="_blank" rel="noopener">
      <img src="${escapeHtml(a.image)}" alt="" loading="${big ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" onerror="this.remove()">
      <span class="une-text">
        <span class="une-badges">${big ? '<span class="une-flag">À la une</span>' : ''}${a.sport ? `<span class="news-tag">${escapeHtml(sportLabel(a.sport))}</span>` : ''}</span>
        <strong>${escapeHtml(a.title)}</strong>
        ${big && a.excerpt ? `<span class="une-excerpt">${escapeHtml(a.excerpt)}</span>` : ''}
        <small>${escapeHtml(a.source)} · ${escapeHtml(ago(a.date))}</small>
      </span>
    </a>`;
  return `<section class="une" aria-label="À la une">${tile(main, true)}${rest.length ? `<div class="une-side">${rest.map((a) => tile(a, false)).join('')}</div>` : ''}</section>`;
}

// Bandeau de l'écran Combats : la grosse actu du moment, pour ceux qui viennent parier.
export function uneBanner() {
  loadNews();
  const [a] = headlines(news.items, 1);
  if (!a) return '';
  return `
    <a class="une-banner" href="${escapeHtml(a.link)}" target="_blank" rel="noopener">
      <img src="${escapeHtml(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">
      <span class="une-banner-text"><span class="une-flag">À la une</span><strong>${escapeHtml(a.title)}</strong></span>
    </a>
    <a class="une-more" href="#actus">Toutes les actus →</a>`;
}

export function renderNews() {
  loadNews(); // relit les flux s'ils ont plus de 10 min (l'écran se redessine à l'arrivée)
  const sport = ui.newsSport || 'all';
  const list = news.items.filter((a) => sport === 'all' || a.sport === sport);
  const chips = NEWS_SPORTS.map((s) => `
    <button class="chip ${s.id === sport ? 'active' : ''}" data-action="news-filter" data-sport="${s.id}" type="button">${escapeHtml(s.label)}</button>`).join('');

  let body;
  if (!news.items.length && news.loading) body = '<div class="empty"><p class="muted">Chargement des actus…</p></div>';
  else if (!news.items.length) body = `<div class="empty"><p class="muted">${escapeHtml(news.error || 'Aucune actu pour le moment.')}</p><button class="btn btn-ghost" data-action="news-reload" type="button">Réessayer</button></div>`;
  else if (!list.length) body = `<div class="empty"><p class="muted">Pas d'actu ${escapeHtml(sportLabel(sport))} en ce moment.</p></div>`;
  else {
    const top = headlines(list, 3);
    const rest = list.filter((a) => !top.includes(a));
    body = `${top.length ? uneHtml(top) : card(rest.shift(), true)}
      ${rest.length ? `<h2 class="section-title">Toutes les actus</h2><div class="news-grid">${rest.slice(0, 40).map((a) => card(a)).join('')}</div>` : ''}`;
  }

  return `
    <h1 class="page-title">Actus</h1>
    <div class="chips news-chips" role="toolbar" aria-label="Discipline">${chips}</div>
    ${body}
    <p class="feed-credit">Sources : ${[...new Set(news.items.map((a) => a.source))].map(escapeHtml).join(', ') || 'RMC Sport, La Sueur'}. Chaque article s'ouvre sur le site qui l'a publié.</p>`;
}
