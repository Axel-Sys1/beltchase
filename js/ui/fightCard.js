// Carte de combattant (nouveau design) : cadre par rareté (Mythique holographique), grande photo
// (portrait ESPN détouré qui déborde, ou photo Wikipédia en plein cadre fondue vers le bas), nom de
// famille géant en fond façon affiche, reflet qui passe. Photos : js/data/cardPhotos.js
// (tools/card_photos.py), sinon l'ancienne photo TheSportsDB de la carte.
import { CONFIG } from '../config.js';
import { escapeHtml } from '../util.js';
import { CARD_PHOTOS } from '../data/cardPhotos.js';
import { sizedPhoto } from '../providers/photos.js';
import { sportMeta } from '../sports.js';
import { icons } from './icons.js';

export const RARITY_LABEL = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire', mythique: 'Mythique' };

// Photo d'une carte → { src, cut } (cut : détourée, fond transparent) ou null.
export function cardPhoto(card) {
  if (!CONFIG.CARD_PHOTOS) return null;
  const p = CARD_PHOTOS[card.id];
  if (p?.kind === 'espn') return { src: sizedPhoto(p.src, 400), cut: true };
  if (p?.src) return { src: p.src, cut: false };
  if (card.img) return { src: card.cutout ? `${card.img}/preview` : card.img, cut: !!card.cutout };
  return null;
}

// Combattant sans photo libre : silhouette en garde (buste, poings levés) aux couleurs de la rareté.
const GHOST = `<svg class="fc-ghost" viewBox="0 0 200 220" aria-hidden="true">
  <g fill="var(--c1)" opacity=".5">
    <ellipse cx="100" cy="60" rx="27" ry="33"/>
    <path d="M88 88h24l3 16H85z"/>
    <path d="M14 220c3-56 24-92 62-104l24 8 24-8c38 12 59 48 62 104z"/>
  </g>
  <g fill="var(--c1)" opacity=".75">
    <path d="M52 150l14-46 22 4-10 50z"/>
    <path d="M148 150l-14-46-22 4 10 50z"/>
    <rect x="58" y="74" width="34" height="40" rx="14"/>
    <rect x="108" y="74" width="34" height="40" rx="14"/>
  </g>
</svg>`;

// Code pays d'un émoji drapeau (🇫🇷 → fr, 🏴 Angleterre → gb-eng) pour l'image flagcdn.com (domaine public).
export function flagCode(emoji) {
  const cps = [...String(emoji)].map((c) => c.codePointAt(0));
  if (cps[0] === 0x1f3f4) { // drapeaux de sous-division (Angleterre, Écosse) : lettres « tag »
    const tag = cps.slice(1).filter((c) => c >= 0xe0061 && c <= 0xe007a).map((c) => String.fromCharCode(c - 0xe0000)).join('');
    return tag.length > 2 ? `${tag.slice(0, 2)}-${tag.slice(2)}` : '';
  }
  const ri = cps.filter((c) => c >= 0x1f1e6 && c <= 0x1f1ff);
  return ri.length === 2 ? ri.map((c) => String.fromCharCode(c - 0x1f1e6 + 97)).join('') : '';
}

const splitName = (name) => {
  const w = String(name).trim().split(/\s+/);
  return w.length > 1 ? [w.slice(0, -1).join(' '), w[w.length - 1]] : ['', w[0]];
};

// flag : drapeau (émoji) du pays de la carte ; owned : sinon silhouette verrouillée (album).
export function fightCardHtml(card, { owned = true, size = '', count = 0, favorite = false, flag = '' } = {}) {
  const ph = owned ? cardPhoto(card) : null;
  const [first, last] = splitName(card.name);
  const country = card.national ? card.team : '';
  const sub = [card.pos, country].filter(Boolean).join(' · ');
  return `
    <div class="fc fc-${card.rarity} ${size ? `fc-${size}` : ''} ${owned ? '' : 'fc-locked'}" data-sport="${card.sport}">
      <div class="fc-frame">
        <div class="fc-art">
          <span class="fc-bigname" aria-hidden="true">${escapeHtml(last)}</span>
          ${ph ? `<img class="fc-photo ${ph.cut ? 'is-cut' : 'is-full'}" src="${escapeHtml(ph.src)}" alt="${escapeHtml(card.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : owned ? `${flagCode(flag) ? `<img class="fc-flagbg" src="https://flagcdn.com/w640/${flagCode(flag)}.png" alt="" loading="lazy" onerror="this.remove()">` : ''}${GHOST}`
      : '<span class="fc-silhouette" aria-hidden="true">?</span>'}
          <span class="fc-shine" aria-hidden="true"></span>
        </div>
        <div class="fc-top">
          <span class="fc-rar">${RARITY_LABEL[card.rarity] || ''}</span>
          <span class="fc-sport" title="${escapeHtml(sportMeta(card.sport).label)}">${sportMeta(card.sport).icon}</span>
        </div>
        <div class="fc-plate">
          ${first ? `<small class="fc-first">${escapeHtml(first)}</small>` : ''}
          <strong class="fc-last">${escapeHtml(last)}</strong>
          <span class="fc-sub">${flag ? `${flag} ` : ''}${escapeHtml(sub)}</span>
        </div>
      </div>
      ${count > 1 ? `<span class="fc-count">×${count}</span>` : ''}
      ${favorite ? `<span class="fc-fav" title="Carte favorite">${icons.star}</span>` : ''}
      ${owned ? '' : `<span class="fc-lock">${icons.lock}</span>`}
    </div>`;
}
