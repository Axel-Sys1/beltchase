import { t } from '../i18n.js';
// Badges : chaque badge a un test sur le joueur. checkBadges() est appelé
// après chaque événement (pari placé, pari réglé, bonus, ligue créée).
export const BADGES = [
  { id: 'first_bet', icon: 'target', name: t('Premier pari'), desc: t('Placer ton tout premier pari.'), test: (p) => p.stats.betsPlaced >= 1 },
  { id: 'first_win', icon: 'trophy', name: t('Première victoire'), desc: t('Gagner ton premier pari.'), test: (p) => p.stats.wins >= 1 },
  { id: 'streak_5', icon: 'flame', name: t('En feu'), desc: t('Gagner 5 paris d\'affilée.'), test: (p) => p.stats.bestStreak >= 5 },
  { id: 'big_odds', icon: 'star', name: t('Coup de génie'), desc: t('Gagner un pari à une cote de plus de 5.'), test: (p) => p.stats.maxOddsWon > 5 },
  { id: 'high_roller', icon: 'diamond', name: t('Flambeur'), desc: t('Miser 100 Gold ou plus sur un seul pari.'), test: (p) => p.stats.maxStake >= 100 },
  { id: 'all_sports', icon: 'globe', name: t('Touche-à-tout'), desc: t('Parier sur 3 sports de combat différents.'), test: (p) => Object.keys(p.stats.sports).length >= 3 },
  { id: 'real_win', icon: 'stadium', name: t('Dans le vrai'), desc: t('Gagner un pari sur un vrai combat.'), test: (p) => (p.stats.realWins || 0) >= 1 },
  { id: 'fighter', icon: 'glove', name: t('Au tapis'), desc: t('Parier sur un combat de MMA ou de boxe.'), test: (p) => !!(p.stats.sports.mma || p.stats.sports.boxing) },
  { id: 'regular', icon: 'chart', name: t('Habitué'), desc: t('Placer 10 paris.'), test: (p) => p.stats.betsPlaced >= 10 },
  { id: 'loyal', icon: 'calendar', name: t('Fidèle'), desc: t('Récupérer le bonus quotidien 5 fois.'), test: (p) => p.stats.bonusClaims >= 5 },
  { id: 'founder', icon: 'crown', name: t('Fondateur'), desc: t('Créer une ligue privée.'), test: (p) => p.stats.leaguesCreated >= 1 },
  { id: 'tycoon', icon: 'coins', name: t('Magnat'), desc: t('Atteindre 1 000 Gold.'), test: (p) => p.balance >= 1000 },
];

export function checkBadges(player) {
  for (const b of BADGES) {
    if (!player.badges[b.id] && b.test(player)) {
      player.badges[b.id] = Date.now();
      player.inbox.push({ type: 'badge', id: b.id });
    }
  }
}
