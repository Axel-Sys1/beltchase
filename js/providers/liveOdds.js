// Paris en direct : aucun sur les sports de combat pour l'instant (pas de score suivi coup par coup,
// le marché d'un combat commencé reste fermé). Le moteur des sports d'équipe (foot, basket, tennis…)
// a été retiré avec l'ancienne version ; il est dans l'historique git si un jour il faut s'en inspirer.
export const LIVE_SPORTS = new Set();

// { open, reason, odds: { clé: null }, state } : marché fermé, mêmes clés que les cotes d'avant-combat.
export function liveMarket(m) {
  const keys = Object.keys(m.odds || { 1: 0, 2: 0 });
  return { open: false, reason: 'Pas de paris en direct sur ce sport', odds: Object.fromEntries(keys.map((k) => [k, null])), state: null };
}
