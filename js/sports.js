// Catalogue des sports de l'appli : uniquement des sports de combat.
// hasDraw : le match nul est un résultat pariable (1 / N / 2). Sinon, pari à 2 issues
// et un nul éventuel est remboursé. methods : paris « méthode » et « round » proposés
// (le résultat d'un combat donne sa méthode et son round, voir services/markets.js).
export const SPORTS = {
  mma: { label: 'MMA', icon: '🥋', hasDraw: false, methods: ['KO', 'SUB', 'DEC'] },
  boxing: { label: 'Boxe', icon: '🥊', hasDraw: false, methods: ['KO', 'DEC'] },
  kickboxing: { label: 'Kick / Muay Thaï', icon: '🦵', hasDraw: false, methods: ['KO', 'DEC'] },
  bjj: { label: 'JJB / Grappling', icon: '🤼', hasDraw: false, methods: ['SUB', 'DEC'] },
  wrestling: { label: 'Lutte', icon: '🤼‍♂️', hasDraw: false, methods: ['FALL', 'DEC'] },
};

export const SPORT_ORDER = Object.keys(SPORTS);
export const isCombat = (key) => key in SPORTS;

// Anciens sports (avant BeltChase) : seulement pour afficher l'historique des paris.
const LEGACY = {
  football: { label: 'Football', icon: '⚽', hasDraw: true },
  basketball: { label: 'Basket', icon: '🏀', hasDraw: false },
  tennis: { label: 'Tennis', icon: '🎾', hasDraw: false },
  rugby: { label: 'Rugby', icon: '🏉', hasDraw: true },
  hockey: { label: 'Hockey', icon: '🏒', hasDraw: false },
  americanfootball: { label: 'Foot US', icon: '🏈', hasDraw: false },
};

export const sportMeta = (key) => SPORTS[key] || LEGACY[key] || { label: key, icon: '🏅', hasDraw: false };
