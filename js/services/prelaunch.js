// Bonus des pré-inscrits (bientot.html) : à la première connexion avec l'adresse pré-inscrite,
// CONFIG.PRELAUNCH_BONUS Gold et le titre exclusif « Pionnier », une seule fois par joueur.
import { CONFIG } from '../config.js';
import { cloud, isPreregistered } from './cloud.js';
import { getState, update } from '../store.js';
import { currentPlayer } from './players.js';
import { ensureProgress } from './progress.js';
import { t } from '../i18n.js';

let checked = null;

export async function claimPrelaunchBonus() {
  const p = currentPlayer(getState());
  const key = cloud.user && p ? `${cloud.user.uid}|${p.id}` : null;
  if (!key || key === checked || p.owned?.['title-pionnier']) return;
  checked = key;
  if (!(await isPreregistered())) return;
  update((s) => {
    const me = currentPlayer(s);
    if (!me) return;
    ensureProgress(me);
    if (me.owned['title-pionnier']) return; // déjà donné sur un autre appareil
    me.owned['title-pionnier'] = Date.now();
    me.balance += CONFIG.PRELAUNCH_BONUS;
    me.inbox.push({ type: 'reward', amount: CONFIG.PRELAUNCH_BONUS, text: t('Merci d\'avoir été là avant le lancement ! +{n} Gold et le titre Pionnier.', { n: CONFIG.PRELAUNCH_BONUS.toLocaleString() }) });
  });
}
