// Choix de la langue (accueil, pied de page, réglages du profil) : menu à drapeaux. Chaque langue est
// nommée dans la langue actuelle (« Arabe ») et dans la sienne (« العربية »), pour qu'on la trouve
// même sans lire l'alphabet. Choisir une langue recharge la page (action « set-lang », events.js).
import { LANGS, lang, locale, t } from '../i18n.js';

// Drapeau d'un pays où la langue est la plus parlée (images flagcdn : les émojis drapeaux ne
// s'affichent pas sous Windows).
const FLAG = { fr: 'fr', en: 'gb', es: 'es', pt: 'br', ru: 'ru', ar: 'sa', zh: 'cn', hi: 'in', bn: 'bd', ur: 'pk' };
const CODE = { pt: 'pt-BR', zh: 'zh-Hans' };
const flagImg = (id) => `<img class="lang-flag" src="https://flagcdn.com/w40/${FLAG[id]}.png" alt="" width="20" height="15">`;

let names = null;
function localName(id) {
  try {
    names ||= new Intl.DisplayNames([locale], { type: 'language' });
    const n = names.of(CODE[id] || id);
    return n ? n.charAt(0).toLocaleUpperCase(locale) + n.slice(1) : null;
  } catch {
    return null;
  }
}

export function langPicker(cls = '') {
  const cur = LANGS.find((l) => l.id === lang);
  return `
  <details class="lang-menu ${cls}">
    <summary aria-label="${t('Langue')}">${flagImg(cur.id)}<span>${cur.name}</span><i aria-hidden="true">▾</i></summary>
    <ul role="listbox" aria-label="${t('Langue')}">
      ${LANGS.map((l) => {
    const local = localName(l.id);
    return `<li><button type="button" role="option" aria-selected="${l.id === lang}" data-action="set-lang" data-lang="${l.id}" class="${l.id === lang ? 'is-current' : ''}">
          ${flagImg(l.id)}<span class="lang-name">${local && local !== l.name ? `${local} <small lang="${l.id}">${l.name}</small>` : `<span lang="${l.id}">${l.name}</span>`}</span>
        </button></li>`;
  }).join('')}
    </ul>
  </details>`;
}
