// Progression : niveau du joueur (XP), cosmétiques à débloquer par niveau ou à acheter en Gold
// (couleur de pseudo, cadre d'avatar, titre) et boost d'XP. Les cartes sont dans services/cards.js. Rien qui aide à gagner : la boutique
// ne vend que du style, et les objets de prestige (rang, saison) ne s'achètent pas.
import { getState, update } from '../store.js';
import { currentPlayer } from './players.js';
import { locale, t } from '../i18n.js';

export const MAX_LEVEL = 100;
export const BOOST_MS = 24 * 3600_000;

// XP pour passer du niveau n au niveau n + 1 : 100, 120, 140… (≈ 107 000 XP pour le niveau 100).
export const xpToNext = (n) => 100 + 20 * (n - 1);

export function levelOf(xp = 0) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (level < MAX_LEVEL && rest >= xpToNext(level)) { rest -= xpToNext(level); level += 1; }
  const need = level < MAX_LEVEL ? xpToNext(level) : 0;
  return { level, into: rest, need, progress: need ? rest / need : 1 };
}

// XP gagnés : à chaque pari placé, puis à son règlement (plus pour une grosse cote).
export const XP = {
  place: (legs = 1) => 10 + (legs > 1 ? 5 * legs : 0),
  won: (odds) => Math.min(80, 20 + Math.round(15 * (odds - 1))),
  lost: () => 5,
  bonus: 25,
  referral: 100,
};

// ─── Catalogue ───────────────────────────────────────────────────────────────
// kind : color (pseudo) | frame (cadre d'avatar) | title | boost. level : débloqué gratuitement à ce
// niveau (les cosmétiques ne s'achètent plus : ça se mérite). price : boosts seulement.
// rarity : commun | rare | epique | legendaire | mythique | exclusif (couleur et lueur dans la boutique).
export const ITEMS = [
  // Effets de pseudo
  { id: 'color-orange', kind: 'color', rarity: 'commun', name: t('Orange vif'), level: 2 },
  { id: 'color-blue', kind: 'color', rarity: 'commun', name: t('Bleu électrique'), level: 6 },
  { id: 'color-purple', kind: 'color', rarity: 'rare', name: t('Violet royal'), level: 12 },
  { id: 'color-ice', kind: 'color', rarity: 'epique', name: t('Glace'), level: 20 },
  { id: 'color-gold', kind: 'color', rarity: 'epique', name: t('Or massif'), level: 30 },
  { id: 'color-fire', kind: 'color', rarity: 'legendaire', name: t('Flammes'), level: 45 },
  { id: 'color-neon', kind: 'color', rarity: 'mythique', name: t('Néon arc-en-ciel'), level: 70 },
  // Cadres d'avatar
  { id: 'frame-bronze', kind: 'frame', rarity: 'commun', name: t('Bronze'), level: 5 },
  { id: 'frame-pitch', kind: 'frame', rarity: 'rare', name: t('Octogone'), level: 10 },
  { id: 'frame-silver', kind: 'frame', rarity: 'rare', name: t('Argent'), level: 18 },
  { id: 'frame-gold', kind: 'frame', rarity: 'epique', name: t('Or'), level: 28 },
  { id: 'frame-diamond', kind: 'frame', rarity: 'legendaire', name: t('Diamant'), level: 50 },
  { id: 'frame-legend', kind: 'frame', rarity: 'mythique', name: t('Légende'), level: 80 },
  { id: 'frame-champion', kind: 'frame', rarity: 'exclusif', name: t('Champion'), exclusive: t('Top 3 d\'une saison') },
  { id: 'frame-pionnier', kind: 'frame', rarity: 'exclusif', name: t('Pionnier'), exclusive: t('Pré-inscrit avant le lancement') },
  // Titres
  { id: 'title-rookie', kind: 'title', rarity: 'commun', name: t('Rookie'), level: 1 },
  { id: 'title-prono', kind: 'title', rarity: 'commun', name: t('Pronostiqueur'), level: 4 },
  { id: 'title-expert', kind: 'title', rarity: 'rare', name: t('Expert'), level: 15 },
  { id: 'title-sniper', kind: 'title', rarity: 'epique', name: t('Sniper'), level: 25 },
  { id: 'title-boss', kind: 'title', rarity: 'legendaire', name: t('Le Boss'), level: 40 },
  { id: 'title-legend', kind: 'title', rarity: 'legendaire', name: t('Légende'), level: 60 },
  { id: 'title-goat', kind: 'title', rarity: 'mythique', name: t('GOAT'), level: 100 },
  { id: 'title-champion', kind: 'title', rarity: 'exclusif', name: t('Champion de saison'), exclusive: t('Top 3 d\'une saison') },
  { id: 'title-pionnier', kind: 'title', rarity: 'exclusif', name: t('Pionnier'), exclusive: t('Pré-inscrit avant le lancement') },
  // Anciens objets (plus disponibles) : gardés pour ceux qui les ont achetés, visibles seulement chez eux.
  { id: 'color-green', kind: 'color', rarity: 'commun', name: t('Vert pelouse'), retired: true },
  { id: 'color-pink', kind: 'color', rarity: 'rare', name: t('Rose fluo'), retired: true },
  { id: 'color-toxic', kind: 'color', rarity: 'epique', name: t('Toxique'), retired: true },
  { id: 'color-lava', kind: 'color', rarity: 'legendaire', name: t('Lave'), retired: true },
  { id: 'color-galaxy', kind: 'color', rarity: 'legendaire', name: t('Galaxie'), retired: true },
  { id: 'frame-lightning', kind: 'frame', rarity: 'epique', name: t('Éclair'), retired: true },
  { id: 'frame-fire', kind: 'frame', rarity: 'legendaire', name: t('Flammes'), retired: true },
  { id: 'frame-galaxy', kind: 'frame', rarity: 'legendaire', name: t('Galaxie'), retired: true },
  { id: 'title-ultra', kind: 'title', rarity: 'commun', name: t('Ultra'), retired: true },
  { id: 'title-1n2', kind: 'title', rarity: 'rare', name: t('Mister 1N2'), retired: true },
  { id: 'title-prophet', kind: 'title', rarity: 'rare', name: t('Le Prophète'), retired: true },
  { id: 'title-combo', kind: 'title', rarity: 'epique', name: t('Roi du combiné'), retired: true },
  { id: 'title-machine', kind: 'title', rarity: 'legendaire', name: t('Machine à cotes'), retired: true },
  { id: 'title-untouchable', kind: 'title', rarity: 'mythique', name: t('Intouchable'), retired: true },
  // Boosts
  { id: 'boost-xp', kind: 'boost', rarity: 'rare', name: t('Boost XP ×2 · 24 h'), price: 1000, hours: 24 },
  { id: 'boost-xp-3d', kind: 'boost', rarity: 'epique', name: t('Boost XP ×2 · 3 jours'), price: 2500, hours: 72 },
  { id: 'boost-packs', kind: 'boost', rarity: 'epique', name: t('Recharge pochettes · +3 aujourd\'hui'), price: 1500, packs: 3 },
];
export const RARITY = {
  commun: t('Commun'), rare: t('Rare'), epique: t('Épique'), legendaire: t('Légendaire'), mythique: t('Mythique'), exclusif: t('Exclusif'),
};
export const itemById = (id) => ITEMS.find((i) => i.id === id);
export const KINDS = { color: t('Effets de pseudo'), frame: t('Cadres'), title: t('Titres'), boost: t('Boosts') };

// ─── Outils de la boutique du jour (voir services/cards.js) ─────────────────
export function nextMidnight(t = Date.now()) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// Générateur pseudo-aléatoire reproductible : même clé, même tirage (boutique perso du jour).
export function seeded(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

// Prix d'un objet ; null s'il ne s'achète pas (débloqué par niveau, ou exclusif). Les cosmétiques
// se débloquent par niveau uniquement ; la boutique du jour est réservée aux cartes.
export const priceOf = (item) => item?.price ?? null;

export const style = (p) => p?.style || {};
export const owns = (p, item) => item.kind !== 'boost' && (levelOf(p?.xp).level >= (item.level ?? Infinity) || !!p?.owned?.[item.id]);
export const boostActive = (p, t = Date.now()) => (p?.boostUntil || 0) > t;

// Joueurs créés avant les niveaux : XP de départ tirés de leurs statistiques.
export function ensureProgress(p) {
  if (p.xp == null) p.xp = (p.stats?.betsPlaced || 0) * XP.place() + (p.stats?.wins || 0) * 25 + (p.stats?.losses || 0) * XP.lost();
  p.owned ||= {};
  p.style ||= {};
}

// Ajoute de l'XP (dans un update()). Annonce les niveaux gagnés et ce qu'ils débloquent.
export function addXp(p, amount, { boostable = true } = {}) {
  ensureProgress(p);
  const gain = Math.round(amount * (boostable && boostActive(p) ? 2 : 1));
  const before = levelOf(p.xp).level;
  p.xp += gain;
  const after = levelOf(p.xp).level;
  if (after > before) {
    const unlocks = ITEMS.filter((i) => i.level > before && i.level <= after).map((i) => i.name);
    p.inbox.push({ type: 'level', level: after, unlocks });
  }
  return gain;
}

// ─── Boutique ────────────────────────────────────────────────────────────────
// Seuls les boosts s'achètent : XP ×2, ou recharge de pochettes (+3 pour la journée, voir cards.js).
export function buyItem(id) {
  const item = itemById(id);
  const p = currentPlayer(getState());
  if (!item || item.kind !== 'boost' || !p) throw new Error(t('Objet introuvable.'));
  const price = priceOf(item);
  if (p.balance < price) throw new Error(t('Il te manque {n} Gold.', { n: (price - p.balance).toLocaleString(locale) }));
  update((s) => {
    const me = currentPlayer(s);
    ensureProgress(me);
    me.balance -= price;
    if (item.packs) {
      const day = dayKey(Date.now());
      if (me.packDay?.day !== day) me.packDay = { day, opened: 0, extra: 0 };
      me.packDay.extra += item.packs;
    } else me.boostUntil = Math.max(Date.now(), me.boostUntil || 0) + (item.hours || 24) * 3600_000;
  });
  return item;
}

export function equipItem(id) {
  const item = itemById(id);
  update((s) => {
    const me = currentPlayer(s);
    ensureProgress(me);
    if (!item || !owns(me, item)) return;
    me.style[item.kind] = me.style[item.kind] === id ? null : id; // re-cliquer retire l'objet
  });
}
