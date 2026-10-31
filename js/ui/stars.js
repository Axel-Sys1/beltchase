// Photos des combattants sur l'écran des combats (photo détourée, façon Betclic) : photo ESPN
// pour l'UFC et le PFL, sinon la carte du combattant dans le catalogue (js/data/cards.js).
import { CONFIG } from '../config.js';
import { CARDS } from '../services/cards.js';
import { slugify } from '../seo/pages.js';
import { isCutout, sizedPhoto } from '../providers/photos.js';

const RANK = { mythique: 5, legendaire: 4, epique: 3, rare: 2, commun: 1 };
// Noms ESPN → noms du catalogue (TheSportsDB), une fois passés en slug.
const ALIAS = {
  'paris-saint-germain': 'paris-sg', internazionale: 'inter-milan', 'as-monaco': 'monaco', 'olympique-de-marseille': 'marseille',
  'athletic-club': 'athletic-bilbao', 'brighton-hove-albion': 'brighton-and-hove-albion',
  // Sélections nationales (cartes en français)
  argentina: 'argentine', brazil: 'bresil', spain: 'espagne', norway: 'norvege', england: 'angleterre',
  morocco: 'maroc', egypt: 'egypte', croatia: 'croatie', belgium: 'belgique', 'south-korea': 'coree-du-sud',
};

let index = null;
function build() {
  index = new Map();
  for (const c of CARDS) {
    if (!c.img || !c.cutout) continue;
    // Sports individuels (tennis, UFC, boxe) : l'« équipe » d'un match est le joueur lui-même.
    index.set(`${c.sport}|p|${slugify(c.name)}`, c);
    const key = `${c.sport}|${c.national ? 'n' : 'c'}|${slugify(c.team)}`;
    const cur = index.get(key);
    if (!cur || RANK[c.rarity] > RANK[cur.rarity]) index.set(key, c);
  }
}

// Photo fournie avec le match (ESPN pour l'UFC et le PFL, TheSportsDB pour la boxe), récente.
// → { name, img, cutout } | null ; cutout : photo détourée à recadrer sur le haut du corps.
export function portrait(team, width = 200) {
  if (!CONFIG.CARD_PHOTOS || !team?.photo) return null;
  return { name: team.name, img: sizedPhoto(team.photo, width), full: team.photo, cutout: isCutout(team.photo) };
}

// Photo d'un combattant : celle du match d'abord, sinon sa carte du catalogue. → { name, img } | null.
export function fighterPhoto(team, sport, width = 200) {
  return portrait(team, width) || starOf(team, sport);
}

// Carte du catalogue d'une équipe ou d'un combattant → { name, img } | null.
export function starOf(team, sport) {
  if (!CONFIG.CARD_PHOTOS || !team?.name) return null;
  if (!index) build();
  const slug = slugify(team.name);
  const key = ALIAS[slug] || slug;
  const solo = ['tennis', 'mma', 'boxing', 'kickboxing', 'bjj', 'wrestling'].includes(sport);
  const c = solo ? index.get(`${sport}|p|${slug}`) : index.get(`${sport}|c|${key}`) || index.get(`${sport}|n|${key}`);
  return c ? { name: c.name, img: `${c.img}/medium` } : null;
}
