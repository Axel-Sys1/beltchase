// Liens vers les pages légales (/legal, page statique legal.html) et adresse de contact.
import { t } from '../../i18n.js';
import { CONFIG } from '../../config.js';

export const legalLinks = () => `
  <nav class="legal-links" aria-label="Informations légales">
    <a href="/pronos">${t('Pronostics et cotes')}</a>
    <a href="mailto:${CONFIG.CONTACT_EMAIL}">${t('Contact')}</a>
    <a href="/legal#mentions">${t('Mentions légales')}</a>
    <a href="/legal#cgu">${t("Conditions d'utilisation")}</a>
    <a href="/legal#confidentialite">${t('Confidentialité')}</a>
    <button class="link-btn" data-action="cookie-settings" type="button">${t('Cookies')}</button>
  </nav>`;
