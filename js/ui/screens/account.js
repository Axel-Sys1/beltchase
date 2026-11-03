// Carte « compte en ligne » : connexion (email + mot de passe ou Google) et état de la sauvegarde.
import { escapeHtml } from '../../util.js';
import { cloud } from '../../services/cloud.js';
import { pendingInvite } from '../../services/invite.js';
import { googleLogo, icons } from '../icons.js';
import { t } from '../../i18n.js';

export function renderAccountCard({ compact = false } = {}) {
  if (!cloud.enabled || !cloud.ready) return '';

  if (cloud.user) {
    return `
      <section class="card account-card">
        <div class="grow">
          <strong>${t('Partie sauvegardée en ligne')}</strong>
          <span class="muted">${t('Connecté avec {e}', { e: escapeHtml(cloud.user.email || t('ton compte')) })}</span>
        </div>
        <button class="btn btn-ghost" data-action="cloud-logout" type="button">${t('Se déconnecter')}</button>
      </section>`;
  }

  const signup = cloud.mode === 'signup';
  const title = signup ? t('Crée ton compte') : compact ? t('Déjà un compte ? Connecte-toi') : t('Sauvegarde ta partie');
  const intro = signup
    ? t('Ta partie sera sauvegardée en ligne et tu la retrouveras sur tous tes appareils.')
    : compact
      ? t('Retrouve ta partie sur cet appareil.')
      : t('Connecte-toi pour ne jamais perdre ta progression et la retrouver sur tous tes appareils.');

  return `
    <form class="card account-card account-form" data-form="cloud-auth">
      <strong>${title}</strong>
      <span class="muted">${intro}</span>
      <input id="email-input" name="email" type="email" autocomplete="email" inputmode="email" placeholder="${t('ton@email.fr')}" required>
      <input id="password-input" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}"
        placeholder="${signup ? t('Choisis un mot de passe (6 caractères min.)') : t('Mot de passe')}" minlength="6" required>
      <button class="btn btn-primary" type="submit">${signup ? t('Créer mon compte') : t('Se connecter')}</button>
      <button class="btn btn-ghost" data-action="cloud-google" type="button"><span class="google-chip">${googleLogo}</span>${t('Continuer avec Google')}</button>
      <div class="account-links">
        <button class="link-btn" data-action="cloud-mode" data-mode="${signup ? 'login' : 'signup'}" type="button">
          ${signup ? t("J'ai déjà un compte") : t('Pas encore de compte ? Créer un compte')}
        </button>
        ${signup ? '' : `<button class="link-btn" data-action="cloud-reset" type="button">${t('Mot de passe oublié ?')}</button>`}
      </div>
    </form>`;
}

export const PERKS = [
  ['trophy', t('Ta place dans le classement général, face à tous les joueurs')],
  ['cloud', t('Ta partie sauvegardée : rien ne se perd, sur tous tes appareils')],
  ['star', t('Ta collection de cartes de combattants, gardée pour toujours')],
  ['user', t('Les ligues privées avec tes potes')],
];

// Encart « crée ton compte » pour les joueurs qui jouent sans compte (en haut des matchs).
export function accountNudge() {
  if (!cloud.enabled || !cloud.ready || cloud.user || pendingInvite()) return '';
  return `
    <section class="card account-nudge">
      <div class="nudge-head">
        <strong>${t('Crée ton compte gratuit')}</strong>
        <span class="muted">${t('10 secondes, et tu gardes ton pseudo, ton solde et tes paris.')}</span>
      </div>
      <ul class="perks">${PERKS.map(([icon, text]) => `<li>${icons[icon]}<span>${text}</span></li>`).join('')}</ul>
      <div class="nudge-actions">
        <button class="btn btn-primary" data-action="cloud-google" type="button"><span class="google-chip">${googleLogo}</span>${t('Continuer avec Google')}</button>
        <button class="btn btn-ghost" data-action="go-account" type="button">${t('Avec un email')}</button>
      </div>
      <p class="fineprint">${t("Sans compte, ta partie reste seulement sur cet appareil et tu n'apparais pas dans le classement.")}</p>
    </section>`;
}

// Bandeau d'invitation (lien ?ligue=CODE) tant que la ligue n'est pas rejointe.
// inGame : le joueur a déjà son pseudo, il ne lui manque que le compte.
export function inviteBanner({ inGame = false } = {}) {
  const code = pendingInvite();
  if (!code) return '';
  const text = inGame
    ? t('Crée ton compte gratuit (ou connecte-toi) : tu la rejoindras automatiquement.')
    : cloud.user
      ? t('Choisis ton pseudo : tu la rejoindras automatiquement.')
      : t('Choisis ton pseudo, puis crée ton compte (gratuit) : tu la rejoindras automatiquement.');
  return `
    <section class="card invite-banner">
      <strong>${t('Tu es invité dans une ligue')}</strong>
      <span class="muted">${t('Code')} <b>${escapeHtml(code)}</b>. ${text}</span>
      ${inGame ? `<button class="btn btn-primary" data-action="go-account" type="button">${t('Créer mon compte')}</button>` : ''}
    </section>`;
}
