import { CONFIG } from '../../config.js';
import { escapeHtml, fmt, fmtOdds } from '../../util.js';
import { BADGES } from '../../services/badges.js';
import { coin, icons } from '../icons.js';
import { renderAccountCard } from './account.js';
import { cloud, isAdmin } from '../../services/cloud.js';
import { ui } from '../uiState.js';
import { REWARD, referralLink } from '../../services/referral.js';
import { soundOn } from '../sounds.js';
import { ITEMS, levelOf, boostActive, style } from '../../services/progress.js';
import { avatarHtml, nameHtml, titleHtml } from '../cosmetics.js';
import { cardHtml } from '../cards.js';
import { CARDS, cardById, ownedCount } from '../../services/cards.js';
import { locale, t, tn } from '../../i18n.js';
import { langPicker } from '../langPicker.js';

const pseudoTaken = (p) => !!cloud.pseudoConflict && cloud.pseudoConflict === p.pseudo;

export function renderProfile(s, p) {
  if (pseudoTaken(p)) ui.profileTab = 'settings';
  const tab = ui.profileTab === 'settings' ? 'settings' : 'stats';
  const lv = levelOf(p.xp);
  const next = ITEMS.filter((i) => i.level > lv.level).sort((a, b) => a.level - b.level)[0];
  const since = new Date(p.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <section class="profile-hero card">
      ${avatarHtml(p.pseudo, style(p), 'avatar-lg')}
      <div class="grow">
        <h1>${nameHtml(p.pseudo, style(p))}</h1>
        ${titleHtml(style(p)) || `<span class="muted">${t('Joueur depuis le {d}', { d: since })}</span>`}
      </div>
      <div class="profile-balance">${fmt(p.balance)} ${coin()}</div>
    </section>

    <section class="card level-card">
      <div class="level-head">
        <span class="level-badge">${t('Niv. {n}', { n: lv.level })}</span>
        <span class="grow muted">${lv.need ? `${fmt(lv.into)} / ${fmt(lv.need)} XP` : t('Niveau maximum !')}</span>
        ${boostActive(p) ? `<span class="tag tag-boost">${icons.bolt} XP ×2</span>` : ''}
      </div>
      <div class="xp-bar"><span style="width:${Math.round(lv.progress * 100)}%"></span></div>
      ${next ? `<span class="muted level-next">${t('Niveau {n}', { n: next.level })} : ${escapeHtml(next.name)}</span>` : ''}
    </section>

    ${collectionCard(p)}

    <div class="tabs" role="tablist">
      <button class="tab ${tab === 'stats' ? 'active' : ''}" data-action="profile-tab" data-tab="stats" role="tab" aria-selected="${tab === 'stats'}" type="button">${t('Profil')}</button>
      <button class="tab ${tab === 'settings' ? 'active' : ''}" data-action="profile-tab" data-tab="settings" role="tab" aria-selected="${tab === 'settings'}" type="button">${t('Réglages')}</button>
    </div>

    ${tab === 'settings' ? settingsView(p) : statsView(p)}
  `;
}

function statsView(p) {
  const st = p.stats;
  const unlocked = BADGES.filter((b) => p.badges[b.id]).length;
  return `
    ${cloud.user ? '' : renderAccountCard()}

    <div class="stat-row stat-row-4">
      <div class="stat"><span class="muted">${t('Paris')}</span><strong>${st.betsPlaced}</strong></div>
      <div class="stat"><span class="muted">${t('Victoires')}</span><strong>${st.wins}</strong></div>
      <div class="stat"><span class="muted">${t('Meilleure série')}</span><strong>${st.bestStreak}</strong></div>
      <div class="stat"><span class="muted">${t('Plus grosse cote')}</span><strong>${st.maxOddsWon ? fmtOdds(st.maxOddsWon) : '–'}</strong></div>
    </div>

    <div class="section-row">
      <h2 class="section-title">${t('Badges')}</h2>
      <span class="muted">${unlocked} / ${BADGES.length}</span>
    </div>
    <div class="badge-grid">
      ${BADGES.map((b) => `
        <div class="badge ${p.badges[b.id] ? 'unlocked' : 'locked'}">
          <span class="badge-icon">${icons[b.icon] || ''}</span>
          <strong>${escapeHtml(b.name)}</strong>
          <span class="muted">${escapeHtml(b.desc)}</span>
        </div>`).join('')}
    </div>

    <section class="card disclaimer">
      <h2>${t('Jeu gratuit, sans argent réel')}</h2>
      <p class="muted">${t("Le Gold est une monnaie 100 % virtuelle. Il ne peut pas être acheté, ni échangé contre de l'argent, des lots ou quoi que ce soit d'autre. Les « combats éclair » sont fictifs ; les « vrais combats » suivent les résultats officiels.")}</p>
    </section>`;
}

function settingsView(p) {
  return `
    ${isAdmin() ? `
    <a class="card settings-row admin-link" href="#admin">
      <div class="grow"><strong>${icons.crown} Admin des combats</strong><span class="muted">Ajouter des soirées (JJB, lutte, kick, ONE, ARES…) et saisir les résultats.</span></div>
      <span aria-hidden="true">›</span>
    </a>` : ''}
    ${pseudoCard(p)}
    ${referralCard(p)}

    <h2 class="section-title">${t('Compte')}</h2>
    ${renderAccountCard()}

    <h2 class="section-title">${t('Appareil')}</h2>
    <section class="card settings-list">
      <div class="settings-row">
        <div class="grow"><strong>${t('Langue')}</strong><span class="muted">${t('Langue du site sur cet appareil.')}</span></div>
        ${langPicker()}
      </div>
      ${installRow()}
      <div class="settings-row">
        <div class="grow"><strong>${t('Sons')}</strong><span class="muted">${t('Cote choisie, pari validé, pari gagné ou perdu.')}</span></div>
        <button class="btn ${soundOn() ? 'btn-ghost' : 'btn-primary'}" data-action="toggle-sound" type="button">${soundOn() ? t('Couper') : t('Activer')}</button>
      </div>
      <div class="settings-row">
        <div class="grow"><strong>${t('Changer de joueur')}</strong><span class="muted">${t("Revenir à l'écran d'accueil pour jouer avec un autre profil.")}</span></div>
        <button class="btn btn-ghost" data-action="logout" type="button">${t('Changer')}</button>
      </div>
      ${cloud.user ? `
      <div class="settings-row">
        <div class="grow"><strong>${t('Supprimer mon compte')}</strong><span class="muted">${t('Efface définitivement ton compte, ta partie en ligne et ta place dans les classements.')}</span></div>
        <button class="link-btn danger" data-action="delete-account" type="button">${t('Supprimer')}</button>
      </div>` : ''}
      <div class="settings-row">
        <div class="grow"><strong>${t("Réinitialiser l'appli")}</strong><span class="muted">${t('Efface tous les joueurs, paris et ligues de cet appareil.')}</span></div>
        <button class="link-btn danger" data-action="reset-app" type="button">${t('Tout effacer')}</button>
      </div>
    </section>
    `;
}

// Changement de pseudo : payant, sauf si un autre compte a déjà réservé le pseudo actuel.
function pseudoCard(p) {
  const taken = pseudoTaken(p);
  const cost = CONFIG.RENAME_COST;
  const short = !taken && p.balance < cost;
  return `
    <form class="card rename-card ${taken ? 'is-conflict' : ''}" data-form="rename" autocomplete="off">
      <strong>${!taken ? t('Changer de pseudo') : cloud.pseudoBanned ? t("Le pseudo « {p} » n'est pas autorisé", { p: escapeHtml(p.pseudo) }) : t('Le pseudo « {p} » est déjà pris', { p: escapeHtml(p.pseudo) })}</strong>
      <span class="muted">${taken
        ? `${cloud.pseudoBanned ? t('Il contient un mot interdit.') : t("Un autre joueur l'utilise déjà.")} ${t('Choisis-en un nouveau (gratuit) pour apparaître dans le classement.')}`
        : t('Ton pseudo doit être unique dans tout le jeu. Le changer coûte {n} Gold.', { n: fmt(cost) })}</span>
      <div class="input-row">
        <input id="rename-input" name="pseudo" maxlength="16" placeholder="${t('Nouveau pseudo')}" required ${short ? 'disabled' : ''}>
        <button class="btn btn-primary" type="submit" ${short ? 'disabled' : ''}>
          ${taken ? t('Valider') : `${fmt(cost)} ${coin('coin coin-sm')}`}
        </button>
      </div>
      ${short ? `<span class="warn">${t('Il te manque {n} Gold.', { n: fmt(cost - p.balance) })}</span>` : ''}
    </form>`;
}

// Parrainage : mon lien à partager, et le pseudo de mon parrain si je n'en ai pas encore.
// Carte favorite et avancée de l'album (lien vers la boutique).
function collectionCard(p) {
  const fav = cardById(style(p).card);
  return `
    <section class="card collection-card">
      ${fav ? `<div class="collection-fav">${cardHtml(fav)}</div>` : ''}
      <div class="collection-text">
        <strong>${t('Ma collection')}</strong>
        <span class="muted">${tn(ownedCount(p), '{n} carte sur {total}', '{n} cartes sur {total}', { total: CARDS.length })}${fav ? '' : ` · ${t("choisis ta carte favorite dans l'album")}`}</span>
        <button class="btn btn-ghost" data-action="open-album" type="button">${icons.star} Voir l'album</button>
      </div>
    </section>`;
}

function referralCard(p) {
  if (!cloud.enabled) return '';
  if (!cloud.user) {
    return `
    <section class="card referral-card">
      <strong>${t('Parrainage : +{n} Gold', { n: REWARD })}</strong>
      <span class="muted">${t("Crée ton compte pour inviter tes potes : {n} Gold pour toi et {n} pour chaque ami qui s'inscrit.", { n: REWARD })}</span>
    </section>`;
  }
  const count = p.stats.referrals || 0;
  return `
    <section class="card referral-card">
      <strong>${t('Parrainage : +{n} Gold par ami', { n: REWARD })}</strong>
      <span class="muted">${t('Envoie ton lien : quand un ami crée son compte avec, vous gagnez {n} Gold chacun.', { n: REWARD })}${count ? ` ${tn(count, 'Déjà {n} ami parrainé !', 'Déjà {n} amis parrainés !')}` : ''}</span>
      <div class="input-row">
        <input value="${escapeHtml(referralLink(p.pseudo))}" readonly aria-label="${t('Ton lien de parrainage')}">
        <button class="btn btn-primary" data-action="share-referral" type="button">${icons.share} ${t('Partager')}</button>
      </div>
      ${p.referredBy ? `<span class="muted">${t('Ton parrain :')} <b>${escapeHtml(p.referredBy === '?' ? t('déjà enregistré') : p.referredBy)}</b></span>` : `
      <form class="referral-form" data-form="referral" autocomplete="off">
        <label for="referral-input">${t("Quelqu'un t'a invité ? Entre son pseudo")}</label>
        <div class="input-row">
          <input id="referral-input" name="pseudo" maxlength="16" placeholder="${t('Pseudo de ton parrain')}" required>
          <button class="btn btn-ghost" type="submit">+${REWARD} ${coin('coin coin-sm')}</button>
        </div>
      </form>`}
    </section>`;
}

// Encadré affiché ailleurs (Rangs) quand le pseudo est pris par un autre compte.
export function renamePanel(p) {
  return pseudoTaken(p) ? pseudoCard(p) : '';
}

// Installer Gold comme une appli : bouton du navigateur (Android, ordinateur) ou consigne iPhone.
function installRow() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!ui.installPrompt && !ios) return '';
  return `
      <div class="settings-row">
        <div class="grow"><strong>${t("Installer l'appli")}</strong><span class="muted">${ui.installPrompt
          ? t("Ajoute BeltChase à ton écran d'accueil, comme une vraie appli.")
          : t("Sur iPhone : touche Partager, puis « Sur l'écran d'accueil ».")}</span></div>
        ${ui.installPrompt ? `<button class="btn btn-primary" data-action="install-app" type="button">${t('Installer')}</button>` : ''}
      </div>`;
}
