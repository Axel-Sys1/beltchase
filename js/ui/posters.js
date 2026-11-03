// Affiches des combats : l'officielle quand TheSportsDB en a une (m.poster), sinon une affiche
// composée ici dans le même esprit (face-à-face des deux combattants, noms en grand, « VS », soirée
// et date), pour que chaque combat mis en avant ait la sienne. Format 16:9, comme les officielles.
import { CONFIG } from '../config.js';
import { escapeHtml } from '../util.js';
import { sizedPhoto, withFallback } from '../providers/photos.js';
import { fighterPhoto } from './stars.js';
import { logoSrc, teamMark } from './logos.js';
import { matchTitle } from '../services/matchInfo.js';
import { locale, t } from '../i18n.js';

const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

// 'Raul Rosas Jr.' → { first: 'Raul', last: 'Rosas Jr.' } ; nom d'un seul mot → { first: '', last }.
function splitName(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  let i = words.length - 1;
  while (i > 0 && SUFFIX.test(words[i])) i -= 1;
  if (i <= 0) return { first: '', last: words.join(' ') };
  return { first: words.slice(0, i).join(' '), last: words.slice(i).join(' ') };
}

// Couleurs des deux coins, différentes d'un combat à l'autre (mais stables pour un même combat).
const PALETTES = [
  ['#8e1020', '#123a8a'], ['#a3470a', '#1d2a6b'], ['#5b1180', '#0f5a5a'], ['#7a0f3d', '#14507a'],
  ['#8a6a0a', '#2a1470'], ['#0f5a2a', '#6a0f0f'],
];
function paletteOf(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

const dateText = (t) => {
  const d = new Date(t);
  return `${d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`.toUpperCase();
};

// Affiche composée d'un combat (HTML). width : largeur d'affichage, pour la taille des photos.
export function madePoster(m, { width = 400 } = {}) {
  const [c1, c2] = paletteOf(m.id);
  const side = (team, n) => {
    const ph = fighterPhoto(team, m.sport, Math.round(width * 0.6));
    const name = splitName(team.name);
    return {
      img: ph ? `<img class="mp-f mp-f${n}" src="${escapeHtml(ph.img)}" alt="${escapeHtml(team.name)}" loading="lazy" referrerpolicy="no-referrer" ${withFallback(ph.full || ph.img)}>` : '',
      name: `<span class="mp-n mp-n${n}">${name.first ? `<small>${escapeHtml(name.first)}</small>` : ''}${escapeHtml(name.last)}${team.logo ? teamMark(team, 'mp-flag') : ''}</span>`,
    };
  };
  const [h, a] = [side(m.home, 1), side(m.away, 2)];
  // Sans photos (choix par défaut) : les drapeaux des deux combattants en fond, de part et d'autre.
  const bare = !h.img && !a.img;
  const flagBg = (team, n) => (team.logo ? `<span class="mp-flagbg mp-flagbg${n}" style="background-image:url('${escapeHtml(logoSrc(team.logo))}')"></span>` : '');
  return `
    <div class="made-poster ${bare ? 'mp-bare' : ''}" style="--c1:${c1};--c2:${c2}" role="img" aria-label="${t('Affiche {m}', { m: escapeHtml(matchTitle(m)) })}">
      ${bare ? `${flagBg(m.home, 1)}${flagBg(m.away, 2)}` : `${h.img}${a.img}`}
      <span class="mp-event">${m.competitionLogo ? `<img src="${escapeHtml(m.competitionLogo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(m.competition || '')}</span>
      <span class="mp-names">${h.name}<b class="mp-vs">VS</b>${a.name}</span>
      <span class="mp-date">${escapeHtml(dateText(m.startsAt))}</span>
    </div>`;
}

// Affiche d'un combat : officielle, sinon composée. → HTML (contenu d'un cadre 16:9) ou ''.
// fail : code JS si l'officielle ne charge pas (le cadre est alors retiré).
export function posterHtml(m, { width = 400, fail = 'this.parentNode.remove()' } = {}) {
  // Affiches officielles et photos seulement si CARD_PHOTOS (droits d'auteur, droit à l'image) ;
  // sinon notre affiche, aux drapeaux des combattants.
  if (CONFIG.CARD_PHOTOS && m.poster) {
    return `<img src="${escapeHtml(sizedPhoto(m.poster, width))}" alt="${t('Affiche {m}', { m: escapeHtml(matchTitle(m)) })}" loading="lazy" referrerpolicy="no-referrer" ${withFallback(m.poster, fail)}>`;
  }
  return madePoster(m, { width });
}
