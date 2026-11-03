import { CONFIG } from '../../config.js';
import { escapeHtml, fmt } from '../../util.js';
import { listProfiles } from '../../services/players.js';
import { TIERS, RADIANT, RR_PER_DIVISION, rankOf } from '../../services/ranks.js';
import { coin, googleLogo, icons, rankEmblem } from '../icons.js';
import { eventDecor, eventLogo, eventTag } from '../season.js';
import { inviteBanner, renderAccountCard, PERKS } from './account.js';
import { cloud } from '../../services/cloud.js';
import { ui } from '../uiState.js';
import { pendingReferral, REWARD } from '../../services/referral.js';
import { legalLinks } from './legal.js';
import { matchCard } from './matches.js';
import { matchStatus } from '../../services/matchInfo.js';
import { spotlight } from '../../services/spotlight.js';
import { realNow } from '../../store.js';
import { cardHtml } from '../cards.js';
import { CARDS, cardById } from '../../services/cards.js';
import { t } from '../../i18n.js';
import { langPicker } from '../langPicker.js';

// Les matchs du moment, visibles sans pseudo : en direct d'abord, puis les gros matchs à venir.
function guestMatches(s) {
  const now = realNow();
  const real = Object.values(s.matches).filter((m) => m.real);
  const live = real.filter((m) => matchStatus(m, now) === 'live').sort((a, b) => a.startsAt - b.startsAt).slice(0, 4);
  const upcoming = real.filter((m) => matchStatus(m, now) === 'upcoming');
  const top = spotlight(upcoming, now).map((x) => x.m);
  const soon = [...top, ...upcoming.sort((a, b) => a.startsAt - b.startsAt)]
    .filter((m, i, arr) => arr.indexOf(m) === i).slice(0, 8);
  if (!live.length && !soon.length) return '';
  const card = (m) => matchCard(m, { guest: true });
  return `
    <section class="guest-matches" aria-label="${t('Combats du moment')}">
      ${live.length ? `
        <h2 class="section-title"><span class="live-dot"></span>${t('En direct')} <span class="muted section-note">${t('paris en direct')}</span></h2>
        <div class="match-grid">${live.map(card).join('')}</div>` : ''}
      ${soon.length ? `
        <h2 class="section-title">${t('Les combats à venir')}</h2>
        <div class="match-grid">${soon.map(card).join('')}</div>` : ''}
      <button class="btn btn-primary btn-lg guest-cta" data-action="guest-pick" type="button">
        ${t('Voir les {n} combats et parier', { n: fmt(real.length) })}
      </button>
    </section>`;
}

const FEATURES = [
  { icon: 'stadium', title: t('Les vrais combats'), text: t('UFC, PFL, boxe, et les grandes soirées de kick, JJB et lutte : résultats officiels.') },
  { icon: 'bolt', title: t('KO, soumission ou décision ?'), text: t('Pronostique le vainqueur, la méthode et le round. Plus ton prono est précis, plus la cote grimpe.') },
  { icon: 'star', title: t('Collectionne les cartes'), text: t('{n} cartes de combattants à débloquer. Pochettes surprises et boutique du jour.', { n: CARDS.length }) },
  { icon: 'trophy', title: t('Chasse la ceinture'), text: t('De Fer à Radiant : chaque bon prono te fait monter, chaque raté te fait descendre.') },
  { icon: 'user', title: t('Ligues entre potes'), text: t('Crée ta ligue, envoie le lien sur WhatsApp, et voyez qui est le vrai expert.') },
  { icon: 'bolt', title: t('Combats éclair'), text: t('Envie de jouer tout de suite ? Des combats fictifs de 2 minutes, à toute heure.') },
];

function pseudoForm(title, note = '') {
  return `
        <form class="register" data-form="register" autocomplete="off">
          <label for="pseudo-input">${title}</label>
          ${note ? `<span class="muted">${note}</span>` : ''}
          <input id="pseudo-input" name="pseudo" maxlength="16" placeholder="${t('ex. LeRoiDuProno')}" required>
          <button class="btn btn-primary btn-lg" type="submit">
            ${t('Jouer avec {n} {coin} offerts', { n: fmt(CONFIG.STARTING_BALANCE), coin: coin('coin coin-sm') })}
          </button>
        </form>`;
}

// Navigateurs intégrés aux applis (Instagram, TikTok, Snapchat, Facebook…) : Google y refuse la
// connexion, on y propose l'email à la place.
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Bytedance|Snapchat|LinkedInApp/i;
const inAppBrowser = () => typeof navigator !== 'undefined' && IN_APP.test(navigator.userAgent || '');

// Inscription : Google en un clic, l'email en secours (replié). `title` / `note` : écran verrouillé
// d'un joueur sans compte (sa partie passe sur le compte à la connexion).
function signupCard({ title = null, note = null } = {}) {
  const login = cloud.mode === 'login';
  const inApp = inAppBrowser();
  const emailOpen = ui.emailOpen || inApp;
  title = login ? t('Content de te revoir') : title || t('Crée ton compte gratuit');
  return `
        <section class="register signup-first">
          ${pendingReferral() && !login ? `<p class="referral-hello">🎁 ${t("<b>{name}</b> t'invite : crée ton compte et vous gagnez <b>{n} Gold</b> chacun !", { name: escapeHtml(pendingReferral()), n: REWARD })}</p>` : ''}
          <h2>${title}</h2>
          ${login ? `<span class="muted">${t('Connecte-toi pour retrouver ta partie.')}</span>` : note ? `<p class="saved-game">${note}</p>` : `
          <ul class="perks">${PERKS.map(([icon, text]) => `<li>${icons[icon]}<span>${text}</span></li>`).join('')}</ul>`}
          ${inApp ? `<p class="in-app-hint">${t('Dans cette appli, Google bloque sa connexion : inscris-toi avec ton email, ou ouvre beltchase.com dans ton navigateur pour utiliser Google.')}</p>`
            : `<button class="btn btn-primary btn-lg" data-action="cloud-google" type="button"><span class="google-chip">${googleLogo}</span>${t('Continuer avec Google')}</button>
          <button class="or or-toggle" data-action="email-open" type="button" aria-expanded="${emailOpen}"><span>${t('ou avec un email')} ${emailOpen ? '▴' : '▾'}</span></button>`}
          ${emailOpen ? `
          <form class="account-form" data-form="cloud-auth">
            <input id="email-input" name="email" type="email" autocomplete="email" inputmode="email" placeholder="${t('ton@email.fr')}" required>
            <input id="password-input" name="password" type="password" autocomplete="${login ? 'current-password' : 'new-password'}"
              placeholder="${login ? t('Mot de passe') : t('Choisis un mot de passe (6 caractères min.)')}" minlength="6" required>
            <button class="btn ${inApp ? 'btn-primary' : 'btn-ghost'}" type="submit">${login ? t('Se connecter') : t('Créer mon compte')}</button>
          </form>` : ''}
          <div class="account-links">
            <button class="link-btn" data-action="cloud-mode" data-mode="${login ? 'signup' : 'login'}" type="button">${login ? t('Créer un compte') : t("J'ai déjà un compte")}</button>
            ${login && emailOpen ? `<button class="link-btn" data-action="cloud-reset" type="button">${t('Mot de passe oublié ?')}</button>` : ''}
          </div>
          <span class="fineprint">${note ? t('Gratuit, sans argent réel.') : t("{n} Gold offerts à l'inscription · jeu gratuit, sans argent réel.", { n: fmt(CONFIG.STARTING_BALANCE) })}</span>
        </section>`;
}

// Écran d'accueil : l'inscription, et « jouer sans compte » (parier seulement) en option.
const signupFirst = () => `${signupCard()}
        <details class="guest-play" ${ui.guestOpen ? 'open' : ''}>
          <summary>${t('Jouer sans compte')}</summary>
          ${pseudoForm(t('Choisis ton pseudo'), t('Sans compte, tu peux parier sur tous les combats. Boutique, cartes, classement et bonus demandent un compte.'))}
        </details>`;

// Écrans réservés aux joueurs avec un compte (boutique, classement, profil), vus sans compte.
const LOCKED = {
  boutique: [t('La boutique'), t('les cartes de combattants, les pochettes et les styles')],
  classement: [t('Les rangs'), t('le classement, ta division et les ligues entre potes')],
  profil: [t('Ton profil'), t('tes stats, ton niveau, le parrainage et les réglages')],
};
export function renderLocked(routeId) {
  const [label, what] = LOCKED[routeId] || [t('Cet écran'), t('tout le jeu')];
  return `
    <div class="locked-page">
      <h1 class="page-title">${label}</h1>
      ${signupCard({
        title: t('Crée ton compte pour débloquer'),
        note: `${icons.lock} ${t('Sans compte, tu peux seulement parier. Avec un compte gratuit : {what}, les bonus du jour et les défis. Tes paris et tes Gold te suivent.', { what })}`,
      })}
    </div>`;
}

export function renderOnboarding(s) {
  const profiles = listProfiles(s);
  const ladder = [...TIERS.map((tier, i) => ({ ...rankOf(i * 3 * RR_PER_DIVISION), division: null, label: tier.name })), { ...RADIANT, division: null, label: RADIANT.name }];
  const trio = CONFIG.CARD_PHOTOS ? (CONFIG.LANDING_FIGHTERS || []).map((f) => {
    const { id, img, crop = false } = typeof f === 'string' ? { id: f } : f;
    const card = cardById(id);
    return { src: img || (card?.cutout ? card.img : null), crop };
  }).filter((f) => f.src) : [];
  const bg = trio.length > 0;
  const showcase = ['mma-ciryl-gane', 'mma-ilia-topuria', 'boxe-oleksandr-usyk'].map(cardById).filter(Boolean);
  return `
  <div class="onboarding ${bg ? 'has-bg' : ''}">
    ${bg ? `<div class="landing-bg landing-trio${trio.length === 1 ? ' landing-solo' : trio.length === 2 ? ' landing-duo' : ''}" aria-hidden="true">${trio.map((f) => `<img${f.crop ? ' class="is-crop"' : ''} src="${escapeHtml(f.src)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`).join('')}</div>` : ''}
    <div class="hero-glow"></div>
    ${eventDecor({ landing: true })}
    <div class="landing">
      <section class="landing-hero">
        <div class="brand-big">${eventLogo()}<span>BELT<b>CHASE</b></span></div>
        <p class="landing-title">${t('Pronostique.')} <br>${t('Collectionne.')} <br><b>${t('Chasse la ceinture.')}</b></p>
        <h1 class="tagline">${t('Le jeu de pronos MMA, UFC, boxe et sports de combat, gratuit, avec une monnaie 100 % virtuelle')}${eventTag({ short: true })}.</h1>
        ${showcase.length ? `
        <div class="landing-cards" aria-label="${t('Exemples de cartes à collectionner')}">
          ${showcase.map((c, i) => `<div class="lc lc-${i}">${cardHtml(c)}</div>`).join('')}
          <span class="lc-caption">${t('{n} cartes à collectionner · MMA, boxe, kick, JJB…', { n: CARDS.length })}</span>
        </div>` : ''}
        <div class="landing-ladder" aria-label="${t('Les rangs, de Fer à Radiant')}">
          ${ladder.map((r, i) => `<span style="animation-delay:${0.15 + i * 0.07}s">${rankEmblem(r)}</span>`).join('')}
        </div>
      </section>

      <ul class="features">
          ${FEATURES.map((f) => `
            <li>
              <span class="feature-icon">${icons[f.icon]}</span>
              <span><strong>${f.title}</strong><span class="muted">${f.text}</span></span>
            </li>`).join('')}
      </ul>

      <section class="onboarding-card">
        ${inviteBanner()}
        ${!cloud.enabled ? pseudoForm(t('Choisis ton pseudo')) : cloud.user ? pseudoForm(t('Dernière étape : choisis ton pseudo'), `${t('Compte créé')}${cloud.user.email ? ` (${escapeHtml(cloud.user.email)})` : ''}. ${t('Ton pseudo sera visible dans le classement.')}`) : signupFirst()}

        ${profiles.length ? `
          <div class="profiles">
            <p class="eyebrow">${t('Ou reprends ta partie')}</p>
            ${profiles.map((p) => `
              <button class="profile-row" data-action="login" data-id="${p.id}" type="button">
                <span class="avatar">${escapeHtml(p.pseudo[0].toUpperCase())}</span>
                <span class="grow">${escapeHtml(p.pseudo)}</span>
                <span class="amount">${fmt(p.balance)} ${coin('coin coin-sm')}</span>
              </button>`).join('')}
          </div>` : ''}

        ${cloud.enabled ? '' : renderAccountCard({ compact: true })}

        <p class="fineprint">${t("Jeu gratuit, sans argent réel. Le Gold ne s'achète pas et ne s'échange pas contre de l'argent ou des lots.")}</p>
        ${legalLinks()}
        ${langPicker('lang-landing')}
      </section>
    </div>
    ${guestMatches(s)}
  </div>`;
}
