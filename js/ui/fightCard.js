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
    : `<span class="fc-silhouette" aria-hidden="true">${owned ? escapeHtml(card.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')) : '?'}</span>`}
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
