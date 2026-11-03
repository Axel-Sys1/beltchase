// Parrainage : un joueur avec un compte donne le pseudo de son parrain (ou arrive par le lien
// https://beltchase.com/?parrain=PSEUDO) et chacun reçoit REWARD Gold. Les liens de la pré-inscription
// (https://beltchase.com/?ref=CODE, js/bientot.js) marchent aussi : le code mène au compte de son
// propriétaire dès qu'il a joué (codes/<code>, cloud.linkPrelaunchCode).
// En ligne : referrals/<uid du filleul> = { parrain: uid, pseudo, at, claimed } ; créé une seule fois
// par le filleul (règles Firestore), puis « réclamé » par le parrain à sa prochaine visite.
import { cloud, prelaunchCodeOwner, prelaunchPseudo, referralDb } from './cloud.js';
import { getState, update } from '../store.js';
import { currentPlayer } from './players.js';
import { addXp, XP } from './progress.js';
import { t } from '../i18n.js';

export const REWARD = 200;
const KEY = 'beltchase:parrain';
const CODE_KEY = 'beltchase:parrainCode'; // code d'un lien de pré-inscription (?ref=)
const CODE_NAME_KEY = 'beltchase:parrainCodeNom'; // son pseudo de pré-inscription, pour l'affichage
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignoré */ } },
};
const SITE = 'https://beltchase.com/';
let busy = false;

export const referralLink = (pseudo) => `${SITE}?parrain=${encodeURIComponent(pseudo)}`;

// Au démarrage : mémorise le parrain de l'adresse puis le retire de la barre d'adresse.
export function readReferralFromUrl() {
  const params = new URLSearchParams(location.search);
  const name = (params.get('parrain') || '').trim().slice(0, 16);
  const code = (params.get('ref') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  if (name) store.set(KEY, name);
  if (code && !name) {
    store.set(CODE_KEY, code);
    store.set(CODE_NAME_KEY, null);
    if (cloud.enabled) prelaunchPseudo(code).then((n) => { if (n) store.set(CODE_NAME_KEY, n); }).catch(() => {});
  }
  if (params.has('parrain') || params.has('ref')) {
    params.delete('parrain');
    params.delete('ref');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }
}

// Nom du parrain en attente (pour « X t'invite »), ou null.
export const pendingReferral = () => store.get(KEY) || (store.get(CODE_KEY) && (store.get(CODE_NAME_KEY) || t('Un ami'))) || null;
const clearPending = () => { store.set(KEY, null); store.set(CODE_KEY, null); store.set(CODE_NAME_KEY, null); };

// Le joueur actuel peut-il encore déclarer un parrain ?
export const canBeReferred = (p = currentPlayer(getState())) => !!p && !p.referredBy && !!cloud.user;

function credit(amount, text, patch = () => {}) {
  update((s) => {
    const p = currentPlayer(s);
    if (!p) return;
    p.balance += amount;
    addXp(p, XP.referral, { boostable: false });
    patch(p);
    p.inbox.push({ type: 'reward', amount, text });
  });
}

// Déclare `pseudo` comme parrain du joueur actuel. Lève une erreur lisible si c'est impossible.
export async function applyReferral(rawPseudo) {
  const pseudo = String(rawPseudo || '').trim();
  const p = currentPlayer(getState());
  if (!cloud.user) throw new Error(t('Crée ton compte pour utiliser un parrainage.'));
  if (!p) throw new Error(t('Choisis d\'abord ton pseudo.'));
  if (p.referredBy) throw new Error(t('Tu as déjà un parrain.'));
  if (pseudo.length < 2) throw new Error(t('Entre le pseudo de ton parrain.'));
  if (pseudo.toLowerCase() === p.pseudo.toLowerCase()) throw new Error(t('Tu ne peux pas être ton propre parrain.'));
  const res = await referralDb.create(pseudo);
  if (res === 'unknown') throw new Error(t('Aucun joueur « {p} » avec un compte.', { p: pseudo }));
  if (res === 'self') throw new Error(t('Tu ne peux pas être ton propre parrain.'));
  if (res === 'already') {
    update((s) => { const me = currentPlayer(s); if (me) me.referredBy = me.referredBy || '?'; });
    throw new Error(t('Ce compte a déjà un parrain.'));
  }
  credit(REWARD, `Parrainage : +${REWARD} Gold grâce à ${pseudo} !`, (me) => { me.referredBy = pseudo; });
  clearPending();
  return pseudo;
}

// Parrain venu par un lien : appliqué dès que le joueur a un compte et un pseudo. Lien de pré-inscription
// dont le propriétaire n'a pas encore joué : gardé, on réessaie à la visite suivante.
let codeTried = false;
export async function applyPendingReferral() {
  const name = store.get(KEY);
  const code = !name && store.get(CODE_KEY);
  if ((!name && !code) || busy || !canBeReferred()) return null;
  if (code && codeTried) return null;
  busy = true;
  try {
    if (name) return { ok: await applyReferral(name) };
    codeTried = true;
    const owner = await prelaunchCodeOwner(code);
    if (!owner) return null;
    return { ok: await applyReferralTo(owner) };
  } catch (err) {
    clearPending();
    return { error: err.message };
  } finally {
    busy = false;
  }
}

// Parrainage par un lien de pré-inscription : `owner` = { uid, pseudo } du compte de jeu du parrain.
async function applyReferralTo(owner) {
  const p = currentPlayer(getState());
  const res = await referralDb.createFor(owner.uid);
  if (res === 'self') { clearPending(); return null; }
  if (res === 'already') {
    update((s) => { const me = currentPlayer(s); if (me) me.referredBy = me.referredBy || '?'; });
    throw new Error(t('Ce compte a déjà un parrain.'));
  }
  if (res !== 'ok') throw new Error(t('Aucun joueur « {p} » avec un compte.', { p: owner.pseudo }));
  credit(REWARD, `Parrainage : +${REWARD} Gold grâce à ${owner.pseudo} !`, (me) => { me.referredBy = owner.pseudo; });
  clearPending();
  return owner.pseudo || p?.pseudo;
}

// Parrain : récupère les récompenses de ses nouveaux filleuls (une fois chacun, sur un seul appareil).
export async function claimReferralRewards() {
  if (busy || !cloud.user || !currentPlayer(getState())) return 0;
  busy = true;
  try {
    const names = await referralDb.claimAll();
    for (const name of names) {
      credit(REWARD, `Parrainage : ${name} a rejoint BeltChase avec ton lien, +${REWARD} Gold !`, (me) => {
        me.stats.referrals = (me.stats.referrals || 0) + 1;
      });
    }
    return names.length;
  } catch (err) {
    console.warn('Gold : parrainages indisponibles', err);
    return 0;
  } finally {
    busy = false;
  }
}
