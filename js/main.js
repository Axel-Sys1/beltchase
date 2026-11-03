import { CONFIG } from './config.js';
import { getState, subscribe, update } from './store.js';
import { ensureBots } from './services/bots.js';
import { ensureProgress } from './services/progress.js';
import { startSync, syncAll } from './services/matches.js';
import { render, tick } from './ui/app.js';
import { bindEvents } from './ui/events.js';
import { toast } from './ui/effects.js';
import { cloud, initCloud, loadHallOfFame } from './services/cloud.js';
import { joinPendingInvite, readInviteFromUrl } from './services/invite.js';
import { ui } from './ui/uiState.js';
import { activeEvent } from './ui/season.js';
import { startAdsTag } from './ui/ads.js';
import { loadNews, subscribeNews } from './services/news.js';
import { fightFlash, flashFor } from './ui/effects.js';
import { resultText } from './ui/resultText.js';
import { lang, t } from './i18n.js';

if (lang !== 'fr') document.title = t('BeltChase · Pronos MMA, UFC et boxe pour le fun');
import { realNow } from './store.js';
import { subscribeResults } from './services/results.js';
import { subscribeFighters } from './services/fighters.js';
import { DEMO, seedDemo } from './services/demo.js';
import { CARDS } from './services/cards.js';
import { levelOf } from './services/progress.js';
import { applyPendingReferral, claimReferralRewards, readReferralFromUrl } from './services/referral.js';
import { claimPrelaunchBonus } from './services/prelaunch.js';

// Habillage saisonnier (Halloween, Noël…) : celui dont la période contient aujourd'hui.
const season = activeEvent();
if (season) document.documentElement.dataset.event = season.id;

readInviteFromUrl();
readReferralFromUrl();
update((s) => { ensureBots(s); Object.values(s.players).forEach(ensureProgress); }, { silent: true });

bindEvents();
subscribe(render);
subscribeNews(render); // actus arrivées : écran Actus et bandeau « À la une » des Combats redessinés
// Fin d'un vrai combat pendant la visite : « KO ! », « Soumission ! »… (pas pour ceux déjà finis à l'ouverture).
const seenStatus = new Map();
let statusReady = false;
subscribe(() => {
  const t = realNow();
  for (const m of Object.values(getState().matches)) {
    if (!m.real) continue;
    const prev = seenStatus.get(m.id);
    seenStatus.set(m.id, m.status);
    if (statusReady && prev && prev !== 'finished' && m.status === 'finished' && m.outcome && t - m.startsAt < 12 * 3600 * 1000) {
      fightFlash(flashFor(m, resultText(m)));
    }
  }
  statusReady = true;
});
subscribeResults(render); // résultats ESPN arrivés (vue Résultats de l'écran Combats)
subscribeFighters(() => { if (location.hash.startsWith('#combattant/')) render(); }); // fiche arrivée
window.addEventListener('hashchange', render);
render();

// Compte en ligne (facultatif) : connexion par email et sauvegarde de la partie.
initCloud({ notify: toast });

// Mode démo (localhost/?demo) : cadeau de départ dès qu'un profil existe.
if (DEMO) {
  const seed = () => {
    const s = getState();
    const p = s.players[s.currentPlayerId];
    if (p && !p.demoSeeded) update((st) => { const q = st.players[st.currentPlayerId]; ensureProgress(q); seedDemo(q, { cards: CARDS, levelOf }); });
  };
  subscribe(seed);
  seed();
}

// Pubs : message de consentement de Google (cookies) dès l'ouverture, sur le site validé.
startAdsTag();

// Lien d'invitation à une ligue : on la rejoint dès que le joueur est connecté.
subscribe(async () => {
  const res = await joinPendingInvite();
  if (!res) return;
  if (res.joined) {
    toast(`Bienvenue dans la ligue « ${res.name} » !`, 'success');
    ui.rankTab = 'leagues';
    location.hash = 'classement';
  } else if (res.error && !/déjà/.test(res.error)) {
    toast(`Invitation ${res.code} : ${res.error}`, 'error');
  }
});

// Parrainage : parrain venu par un lien (appliqué dès le compte et le pseudo prêts), et récompenses
// des filleuls réclamées une fois par session de compte ; bonus des pré-inscrits (prelaunch.js).
let claimedFor = null;
let hofChecked = null;
subscribe(async () => {
  const res = await applyPendingReferral();
  if (res?.error && !/déjà/.test(res.error)) toast(`Parrainage : ${res.error}`, 'error');
  const s = getState();
  const key = cloud.user && s.currentPlayerId ? `${cloud.user.uid}|${s.currentPlayerId}` : null;
  if (key && key !== claimedFor) { claimedFor = key; claimReferralRewards(); loadHallOfFame(); claimPrelaunchBonus(); }
  // Top 3 de la saison terminée : cadre et titre exclusifs, une fois par saison.
  const hof = cloud.hof;
  const me = s.players[s.currentPlayerId];
  if (hof && me && cloud.user && hofChecked !== `${hof.key}|${me.id}`) {
    hofChecked = `${hof.key}|${me.id}`;
    const place = hof.rows.findIndex((r) => r.uid === cloud.user.uid) + 1;
    if (place && !me.hof?.[hof.key]) {
      update((st) => {
        const p = st.players[st.currentPlayerId];
        ensureProgress(p);
        p.hof = { ...p.hof, [hof.key]: place };
        p.owned['frame-champion'] = Date.now();
        p.owned['title-champion'] = Date.now();
        p.balance += 1000;
        p.inbox.push({ type: 'reward', amount: 1000, text: `Hall of Fame : ${place === 1 ? '1er' : `${place}e`} de la saison ! Cadre et titre Champion débloqués, +1 000 Gold.` });
      });
    }
  }
});

// Choix des sources (direct ou instantané), puis chaque provider décide lui-même
// s'il doit être rappelé (voir services/matches.js).
startSync();
setInterval(syncAll, CONFIG.TICK_MS);
setInterval(tick, 1000);
// Actus relues toutes les 10 min, même si rien d'autre ne bouge (onglet visible seulement).
setInterval(() => { if (!document.hidden) loadNews(); }, 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncAll();
});

// Application installable (écran d'accueil du téléphone) et utilisable hors ligne.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installPrompt = e; render(); });
window.addEventListener('appinstalled', () => { ui.installPrompt = null; toast('BeltChase est installé sur ton écran d\'accueil !', 'success'); });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
