// Fiche d'une carte de l'album : la carte en grand et les stats du combattant (js/data/cardStats.js,
// tools/card_stats.py : ESPN pour le MMA, Wikidata / Wikipédia sinon). On y choisit aussi sa carte favorite.
import { escapeHtml } from '../util.js';
import { t, tParts } from '../i18n.js';
import { CARD_STATS } from '../data/cardStats.js';
import { cardById, favoriteCard } from '../services/cards.js';
import { style } from '../services/progress.js';
import { currentPlayer } from '../services/players.js';
import { cardHtml } from './cards.js';
import { icons } from './icons.js';

const ageOf = (birth) => {
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  return now.getFullYear() - b.getFullYear() - (now < new Date(now.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
};

function statsHtml(st) {
  const cells = [
    [t('Victoires'), st.wins], [t('Défaites'), st.losses], [t('Nuls'), st.draws],
    [t('KO / TKO'), st.kos], [t('Soumissions'), st.subs],
    [t('Âge'), st.birth && ageOf(st.birth) != null ? t('{n} ans', { n: ageOf(st.birth) }) : null],
    [t('Taille'), st.heightCm && `${st.heightCm} cm`], [t('Poids'), st.weightKg && `${st.weightKg} kg`],
    [t('Allonge'), st.reachCm && `${st.reachCm} cm`], [t('Garde'), st.stance && t(st.stance)],
  ].filter(([, v]) => v != null && v !== '');
  if (!cells.length) return `<p class="muted">${t('Pas encore de statistiques pour ce combattant.')}</p>`;
  return `<div class="cs-stats">${cells.map(([k, v]) => `<div class="stat"><span class="muted">${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('')}</div>`;
}

export function showCardSheet(id) {
  const card = cardById(id);
  if (!card) return;
  const st = CARD_STATS[id] || {};
  const p = currentPlayer();
  const fav = style(p).card === id;
  const previous = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'dialog-overlay';
  ov.innerHTML = `
    <div class="dialog card-sheet rar-${card.rarity}" role="dialog" aria-modal="true" aria-labelledby="cs-title">
      <button class="icon-btn cs-close" type="button" data-choice="close" aria-label="${t('Fermer')}">${icons.close}</button>
      <div class="cs-card">${cardHtml(card, { favorite: fav })}</div>
      <div class="cs-body">
        <h2 id="cs-title">${escapeHtml(card.name)}</h2>
        ${st.nickname ? `<p class="cs-nick">« ${escapeHtml(st.nickname)} »</p>` : ''}
        <p class="muted cs-sub">${escapeHtml([tParts(card.pos), card.national ? t(card.team) : '', st.team].filter(Boolean).join(' · '))}</p>
        ${statsHtml(st)}
        <div class="dialog-actions cs-actions">
          ${st.espnId ? `<a class="btn btn-ghost" href="#combattant/${escapeHtml(st.espnId)}" data-choice="go">${t('Fiche complète')}</a>` : ''}
          <button class="btn ${fav ? 'btn-equipped' : 'btn-primary'}" type="button" data-choice="fav">${fav ? `${icons.check} ${t('Carte favorite')}` : t('Mettre en carte favorite')}</button>
        </div>
        <p class="fineprint">${st.src === 'espn' ? t('Stats : ESPN.') : st.src ? t('Stats : Wikipédia / Wikidata.') : ''}</p>
      </div>
    </div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    ov.remove();
    previous?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-choice]');
    if (b?.dataset.choice === 'fav') { favoriteCard(id); close(); return; }
    if (b || e.target === ov) close(); // « Fiche complète » : le lien suit son cours
  });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(ov);
  ov.querySelector('.cs-close').focus();
}
