import { t } from './i18n.js';
// Catalogue des sports de l'appli : uniquement des sports de combat.
// hasDraw : le match nul est un résultat pariable (1 / N / 2). Sinon, pari à 2 issues
// et un nul éventuel est remboursé. methods : paris « méthode » et « round » proposés
// (le résultat d'un combat donne sa méthode et son round, voir services/markets.js).
export const SPORTS = {
  mma: { label: t('MMA'), icon: '🥋', hasDraw: false, methods: ['KO', 'SUB', 'DEC'] },
  boxing: { label: t('Boxe'), icon: '🥊', hasDraw: false, methods: ['KO', 'DEC'] },
  kickboxing: { label: t('Kick / Muay Thaï'), icon: '🦵', hasDraw: false, methods: ['KO', 'DEC'] },
  bjj: { label: t('JJB / Grappling'), icon: '🤼', hasDraw: false, methods: ['SUB', 'DEC'] },
  wrestling: { label: t('Lutte'), icon: '🤼‍♂️', hasDraw: false, methods: ['FALL', 'DEC'] },
};

export const SPORT_ORDER = Object.keys(SPORTS);
export const isCombat = (key) => key in SPORTS;


export const sportMeta = (key) => SPORTS[key] || { label: key, icon: '🏅', hasDraw: false };
