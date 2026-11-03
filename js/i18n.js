// Langues du site. Le texte source est écrit en français dans le code : t('Mes paris') renvoie la
// traduction de la langue choisie (js/i18n/<langue>.js), ou le français si elle manque.
// Variables : t('Il te manque {n} Gold', { n: fmt(x) }).
//
// La langue est choisie une fois au chargement : ?lang=xx dans l'adresse, sinon le choix enregistré,
// sinon la langue du navigateur (anglais par défaut). Le dictionnaire est chargé avant tout le reste
// (attente au niveau du module) : les textes calculés au chargement des modules sont donc traduits.
// Changer de langue recharge la page.
export const LANGS = [
  { id: 'fr', name: 'Français', locale: 'fr-FR' },
  { id: 'en', name: 'English', locale: 'en-US' },
  { id: 'es', name: 'Español', locale: 'es-ES' },
  { id: 'pt', name: 'Português (Brasil)', locale: 'pt-BR' },
  { id: 'ru', name: 'Русский', locale: 'ru-RU' },
  { id: 'ar', name: 'العربية', locale: 'ar-u-nu-latn', rtl: true },
  { id: 'zh', name: '中文（简体）', locale: 'zh-CN' },
  { id: 'hi', name: 'हिन्दी', locale: 'hi-IN-u-nu-latn' },
  { id: 'bn', name: 'বাংলা', locale: 'bn-BD-u-nu-latn' },
  { id: 'ur', name: 'اردو', locale: 'ur-PK-u-nu-latn', rtl: true },
];

const KEY = 'beltchase:lang';
const known = (id) => LANGS.some((l) => l.id === id);

function detect() {
  if (typeof location === 'undefined') return 'fr'; // tests et pages serveur : français
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (known(q)) { localStorage.setItem(KEY, q); return q; }
    const saved = localStorage.getItem(KEY);
    if (known(saved)) return saved;
  } catch { /* stockage indisponible */ }
  for (const tag of navigator.languages || [navigator.language || '']) {
    const id = String(tag).toLowerCase().split('-')[0];
    if (known(id)) return id;
  }
  return 'en';
}

export const lang = detect();
export const langInfo = LANGS.find((l) => l.id === lang);
export const locale = langInfo.locale;

const dict = lang === 'fr' ? {} : await import(`./i18n/${lang}.js`).then((m) => m.default).catch(() => ({}));

export function t(fr, vars) {
  let s = dict[fr] || fr;
  if (vars) s = s.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? vars[k] : all));
  return s;
}

// Libellé composé venu des données (« Combat principal · Poids coqs ») : chaque morceau est traduit.
// Les données restent en français (le code s'y fie), seule l'affichage change.
const tPart = (x) => { const w = / \(F\)$/.test(x); const base = w ? x.slice(0, -4) : x; return w ? `${t(base)} ${t('(F)')}` : t(base); };
export const tParts = (s) => (s ? String(s).split(' · ').map(tPart).join(' · ') : s);

// Rang « 1er, 2e » selon la langue.
export function ordinal(n) {
  if (lang === 'fr') return n === 1 ? '1er' : `${n}e`;
  if (lang === 'en') {
    const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
    return `${n}${s}`;
  }
  if (lang === 'es' || lang === 'pt') return `${n}º`;
  if (lang === 'ru') return `${n}-й`;
  return `#${n}`;
}

// Singulier / pluriel (le français et la plupart des langues : 1 → singulier).
export const tn = (n, one, many, vars = {}) => t(Math.abs(n) === 1 ? one : many, { n, ...vars });

export function setLang(id) {
  if (!known(id) || id === lang) return;
  try { localStorage.setItem(KEY, id); } catch { /* stockage indisponible */ }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  // Même adresse (pas de ?lang=) : replace() ne recharge pas la page, il faut reload().
  if (url.toString() === location.href) location.reload();
  else location.replace(url.toString());
}

// Attributs de la page : langue (lecteurs d'écran, polices) et sens d'écriture (arabe, ourdou).
if (typeof document !== 'undefined') {
  document.documentElement.lang = lang;
  document.documentElement.dir = langInfo.rtl ? 'rtl' : 'ltr';
}
