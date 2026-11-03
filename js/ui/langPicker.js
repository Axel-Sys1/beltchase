// Choix de la langue : liste déroulante (accueil, pied de page, réglages du profil).
// Le changement est écouté dans events.js (select[data-lang-select]) et recharge la page.
import { LANGS, lang, t } from '../i18n.js';

export const langPicker = (cls = '') => `
  <label class="lang-pick ${cls}">
    <span aria-hidden="true">🌐</span>
    <select data-lang-select aria-label="${t('Langue')}">
      ${LANGS.map((l) => `<option value="${l.id}"${l.id === lang ? ' selected' : ''} lang="${l.id}">${l.name}</option>`).join('')}
    </select>
  </label>`;
