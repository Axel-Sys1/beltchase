// Liens vers les pages légales (/legal, page statique legal.html) et adresse de contact.
import { CONFIG } from '../../config.js';

export const legalLinks = () => `
  <nav class="legal-links" aria-label="Informations légales">
    <a href="/pronos">Pronostics et cotes</a>
    <a href="mailto:${CONFIG.CONTACT_EMAIL}">Contact</a>
    <a href="/legal#mentions">Mentions légales</a>
    <a href="/legal#cgu">Conditions d'utilisation</a>
    <a href="/legal#confidentialite">Confidentialité</a>
    <button class="link-btn" data-action="cookie-settings" type="button">Cookies</button>
  </nav>`;
