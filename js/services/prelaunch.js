// Bonus des pré-inscrits (bientot.html) : à la première connexion avec l'adresse pré-inscrite,
// CONFIG.PRELAUNCH_BONUS Gold, le cadre et le titre exclusifs « OG », une seule fois par joueur. Son lien de
// parrainage de la pré-inscription (?ref=CODE) est relié à son compte, pour qu'il serve encore.
import { CONFIG } from '../config.js';
import { cloud, linkPrelaunchCode, prelaunchCode } from './cloud.js';
import { getState, update } from '../store.js';
import { currentPlayer } from './players.js';
import { ensureProgress } from './progress.js';
import { t } from '../i18n.js';

let checked = null;

export async function claimPrelaunchBonus() {
  const p = currentPlayer(getState());
  const key = cloud.user && p ? `${cloud.user.uid}|${p.id}` : null;
  if (!key || key === checked) return;
  checked = key;
  const code = await prelaunchCode();
  if (!code) return;
  linkPrelaunchCode(code);
  if (p.owned?.['title-pionnier']) return;
  update((s) => {
    const me = currentPlayer(s);
    if (!me) return;
    ensureProgress(me);
    if (me.owned['title-pionnier']) return; // déjà donné sur un autre appareil
    me.owned['title-pionnier'] = Date.now();
    me.owned['frame-pionnier'] = Date.now();
    me.balance += CONFIG.PRELAUNCH_BONUS;
    me.inbox.push({ type: 'reward', amount: CONFIG.PRELAUNCH_BONUS, text: t('Merci d\'avoir été là avant le lancement ! +{n} Gold, le cadre et le titre OG.', { n: CONFIG.PRELAUNCH_BONUS.toLocaleString() }) });
  });
}
