// Résultats récents pour la vue « Résultats » de l'écran Combats : combats UFC / PFL terminés des
// 30 derniers jours (ESPN, une requête par organisation, sans la méthode), complétés par les combats
// terminés encore gardés dans la partie (boxe, combats saisis : 36 h, avec la méthode quand elle est connue).
import { createMmaAdapter } from '../providers/espn/mma.js';
import { defaultGetJson } from '../providers/espn/common.js';

export const RESULTS_DAYS = 30;
const TTL = 30 * 60 * 1000;

export const results = { items: [], loading: false, error: null, at: 0 };
const listeners = new Set();
export const subscribeResults = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

// Relit ESPN si la liste a plus de 30 min (appelé pendant le dessin : pas d'emit avant la réponse).
export async function loadResults({ now = Date.now(), getJson = defaultGetJson, force = false } = {}) {
  if (results.loading || (!force && results.at && now - results.at < TTL)) return results;
  results.loading = true;
  results.error = null;
  try {
    results.items = await createMmaAdapter({ getJson }).past({ now, days: RESULTS_DAYS });
    results.at = now;
  } catch (err) {
    results.error = 'Résultats UFC / PFL momentanément indisponibles.';
    results.at = now; // pas de nouvel essai à chaque dessin
    console.warn('[résultats]', err);
  }
  results.loading = false;
  emit();
  return results;
}

// Résultats ESPN + combats terminés de la partie, sans doublon (la version de la partie passe devant :
// elle a la méthode), du plus récent au plus ancien.
export function mergeResults(espn, local) {
  const byId = new Map(espn.map((m) => [m.id, m]));
  for (const m of local) byId.set(m.id, m);
  return [...byId.values()].filter((m) => m.status === 'finished' && m.outcome).sort((a, b) => b.startsAt - a.startsAt);
}
