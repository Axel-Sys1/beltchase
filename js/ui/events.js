// Délégation d'événements : les boutons portent data-action, les formulaires data-form.
import { resetAll, update } from '../store.js';
import { claimBonus, currentPlayer, login, logout, register, renamePlayer } from '../services/players.js';
import { acceptOdds, clearSlip, placeSlip, quickStake, removeSelection, setSlipMode, setStake, toggleSelection } from '../services/bets.js';
import { fastForward, refreshReal, syncAll } from '../services/matches.js';
import { createLeague, joinLeague, leaveLeague, noteLeagueCreated } from '../services/leagues.js';
import { go, render } from './app.js';
import { betStamp, flyToSlip, replay, toast } from './effects.js';
import { getState } from '../store.js';
import { slipCheck } from '../services/bets.js';
import { confirmDialog } from './dialog.js';
import { showCardSheet } from './cardSheet.js';
import { refreshSlipNumbers } from './screens/slip.js';
import { ui } from './uiState.js';
import { shareBet } from './share.js';
import { play, setSound, soundOn } from './sounds.js';
import { buyItem, equipItem } from '../services/progress.js';
import { buyCard, favoriteCard, openPack } from '../services/cards.js';
import { showPack } from './cards.js';
import { applyReferral, referralLink, REWARD } from '../services/referral.js';
import { CONFIG } from '../config.js';
import { cloud, deleteAccount, isGuest, createOnlineLeague, joinOnlineLeague, leaveOnlineLeague, loadDivision, loadMyLeagues, loadTop, loadSeason, resetPassword, signInWithEmail, signInWithGoogle, signOutCloud } from '../services/cloud.js';
import { playerRR } from '../services/ranks.js';
import { shareLeague } from '../services/invite.js';
import { adsLeft, rewardAdWatched } from '../services/rewardAd.js';
import { watchRewardAd } from './rewardAd.js';
import { openCookieSettings } from './ads.js';
import { readFights } from '../providers/beltchase.js';
import { saveFight, deleteFight, listPreregistrations } from '../services/cloud.js';
import { uid } from '../util.js';
import { loadNews } from '../services/news.js';
import { locale, setLang, t } from '../i18n.js';

// ─── Page admin : combats saisis à la main ───────────────────────────────────
async function loadAdminFights() {
  if (ui.adminLoading) return;
  ui.adminLoading = true;
  try {
    ui.adminFights = await readFights(Date.now() - 60 * 86_400_000);
  } catch (err) {
    ui.adminFights = [];
    toast(`Combats illisibles : ${err.message}`, 'error');
  } finally {
    ui.adminLoading = false;
    render();
  }
}
ui.adminLoad = loadAdminFights;

// Après une écriture : liste relue, et le jeu reprend tout de suite les combats saisis.
async function afterAdminWrite() {
  ui.adminFights = null;
  await loadAdminFights();
  syncAll({ force: true, only: (p) => p.id === 'bc' });
}
const adminFight = (id) => (ui.adminFights || []).find((f) => f.id === id);

const actions = {
  login: (el) => login(el.dataset.id),
  logout: () => logout(),
  go: (el) => go(el.dataset.route),

  'claim-bonus': () => claimBonus(),
  'watch-ad': async () => {
    if (!adsLeft(currentPlayer())) throw new Error(t("Plus de bonus vidéo aujourd'hui. Reviens demain !"));
    const result = await watchRewardAd();
    if (result === 'viewed') rewardAdWatched();
    else if (result === 'dismissed') toast(t('Vidéo fermée avant la fin : pas de Gold cette fois.'), 'info');
    else if (result === 'unavailable') toast(t('Aucune vidéo disponible pour le moment. Réessaie dans quelques minutes.'), 'info');
  },

  'profile-tab': (el) => { ui.profileTab = el.dataset.tab === 'settings' ? 'settings' : 'stats'; render(); },
  'go-account': () => { ui.profileTab = 'settings'; cloud.mode = 'signup'; go('profil'); },
  'install-app': async () => {
    const prompt = ui.installPrompt;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => null);
    ui.installPrompt = null;
    render();
  },
  'delete-account': async () => {
    const ok = await confirmDialog({
      title: t('Supprimer ton compte ?'),
      message: t("Ton compte, ta partie en ligne, ta place dans les classements et tes ligues seront effacés définitivement. C'est irréversible."),
      confirmLabel: t('Supprimer définitivement'),
      danger: true,
    });
    if (!ok) return;
    await deleteAccount();
    toast(t('Ton compte a été supprimé.'), 'info');
    location.hash = '';
    location.reload();
  },
  'cloud-mode': (el) => { cloud.mode = el.dataset.mode === 'signup' ? 'signup' : 'login'; render(); },
  'cloud-google': () => signInWithGoogle(),
  'admin-edit': (el) => { ui.adminEdit = adminFight(el.dataset.id) || null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  'admin-cancel': () => { ui.adminEdit = null; render(); },
  'admin-refresh': () => { ui.adminFights = null; loadAdminFights(); },
  'admin-prelaunch-csv': async () => {
    const rows = await listPreregistrations();
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['email,langue,source,date', ...rows.map((r) => [r.email, r.lang, r.src, r.at?.toDate?.().toISOString() || ''].map(cell).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `preinscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`${rows.length} pré-inscrit${rows.length > 1 ? 's' : ''}.`, 'success');
  },
  'admin-delete': async (el) => {
    const f = adminFight(el.dataset.id);
    if (!f) return;
    const ok = await confirmDialog({ title: 'Supprimer ce combat ?', message: `${f.home.name} vs ${f.away.name} : les paris placés dessus seront remboursés.`, confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    await deleteFight(f.id);
    toast('Combat supprimé.', 'info');
    await afterAdminWrite();
  },
  'cookie-settings': () => {
    if (!openCookieSettings()) toast(t('Aucun cookie publicitaire pour le moment : BeltChase garde seulement ta partie et ta connexion, indispensables au jeu.'), 'info');
  },
  'email-open': () => { ui.emailOpen = !ui.emailOpen; render(); if (ui.emailOpen) document.getElementById('email-input')?.focus(); },
  'cloud-reset': async () => {
    const email = await resetPassword(document.getElementById('email-input')?.value);
    toast(t('Si un compte existe pour {e}, un email pour changer ton mot de passe vient de partir. Pense aux spams.', { e: email }), 'info');
  },
  'cloud-logout': async () => {
    const ok = await confirmDialog({
      title: t('Se déconnecter ?'),
      message: t('Ta partie reste sauvegardée sur ton compte. Elle sera retirée de cet appareil.'),
      confirmLabel: t('Se déconnecter'),
    });
    if (!ok) return;
    await signOutCloud();
    location.hash = '';
    location.reload();
  },

  // Visiteur sans pseudo : on l'envoie vers l'inscription ; sa cote ira dans le panier ensuite.
  'guest-pick': (el) => {
    const { match, outcome } = el.dataset;
    ui.pendingPick = match ? { match, outcome } : null;
    const target = document.querySelector('.signup-first') || document.getElementById('pseudo-input');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target?.id === 'pseudo-input') target.focus({ preventScroll: true });
    toast(match ? t('Crée ton compte : ta cote ira directement dans ton panier.') : t('Crée ton compte pour parier.'), 'info');
  },
  pick: (el) => {
    const { match, outcome } = el.dataset;
    const from = el.getBoundingClientRect();
    const label = (el.querySelector('.odd-val')?.textContent || '').replace(/[▲▼]/g, '');
    toggleSelection(match, outcome);
    // L'écran vient d'être redessiné : on anime les nouveaux boutons.
    const picked = getState().players[getState().currentPlayerId]?.slip.some((x) => x.matchId === match && x.outcome === outcome);
    const sel = `[data-action="pick"][data-match="${CSS.escape(match)}"][data-outcome="${CSS.escape(outcome)}"]`;
    document.querySelectorAll(sel).forEach((b) => replay(b, picked ? 'just-picked' : 'just-unpicked'));
    play(picked ? 'pick' : 'unpick');
    if (picked) {
      flyToSlip(from, label);
      document.querySelectorAll(`[data-slip-item="${CSS.escape(match)}"]`).forEach((it) => replay(it, 'is-new'));
    }
  },
  'filter-sport': (el) => { ui.sport = el.dataset.sport; ui.gender = 'all'; render(); window.scrollTo({ top: 0 }); },
  'toggle-markets': (el) => { const id = el.dataset.match; if (ui.openMarkets.has(id)) ui.openMarkets.delete(id); else ui.openMarkets.add(id); render(); },
  'filter-day': (el) => { ui.day = el.dataset.day; render(); },
  'real-view': (el) => { ui.realView = el.dataset.view; render(); window.scrollTo({ top: 0 }); },
  'cal-open': (el) => { ui.realView = 'paris'; ui.day = el.dataset.day; render(); document.querySelector('.day-chips')?.scrollIntoView({ block: 'start' }); },
  'news-filter': (el) => { ui.newsSport = el.dataset.sport; render(); },
  'news-reload': () => { loadNews({ force: true }); },
  'set-mode': (el) => {
    ui.sport = 'all';
    update((s) => { s.prefs.mode = el.dataset.mode === 'fake' ? 'fake' : 'real'; });
  },
  'refresh-real': async () => {
    await refreshReal();
    toast(t('Vrais combats actualisés'), 'info');
  },

  'slip-remove': (el) => removeSelection(el.dataset.match),
  'slip-clear': () => clearSlip(),
  'slip-mode': (el) => setSlipMode(el.dataset.mode),
  'slip-accept': () => acceptOdds(),
  'slip-quick': (el) => {
    quickStake(el.dataset.match, el.dataset.amount);
    document.querySelectorAll(`[data-stake="${CSS.escape(el.dataset.match)}"]`).forEach((i) => replay(i, 'bumped'));
  },
  'slip-place': async () => {
    const { error, combo } = slipCheck(getState());
    if (error) throw new Error(error);
    // Les sélections glissent hors du panier, puis le ticket est tamponné.
    const lists = document.querySelectorAll('.slip-items');
    lists.forEach((l) => l.classList.add('sending'));
    await new Promise((r) => setTimeout(r, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280));
    let n;
    try { n = placeSlip(); } finally { lists.forEach((l) => l.classList.remove('sending')); }
    betStamp({ count: n, combo });
    play('place');
    toast(combo ? t('Combiné validé. Bonne chance !') : n > 1 ? t('{n} paris validés. Bonne chance !', { n }) : t('Pari validé. Bonne chance !'), 'success');
  },

  'bets-tab': (el) => { ui.betsTab = el.dataset.tab; render(); },
  'toggle-sound': () => { setSound(!soundOn()); render(); },
  'shop-buy': (el) => {
    const item = buyItem(el.dataset.id);
    play('bonus');
    toast(item.packs ? t("+{n} pochettes pour aujourd'hui !", { n: item.packs }) : item.kind === 'boost' ? t('Boost activé : XP ×2 pendant {d} !', { d: item.hours >= 48 ? t('{n} jours', { n: item.hours / 24 }) : `${item.hours} h` }) : t('{name} : acheté et équipé !', { name: item.name }), 'success');
  },
  'shop-equip': (el) => equipItem(el.dataset.id),
  'card-buy': (el) => {
    const card = buyCard(el.dataset.id);
    play('bonus');
    toast(t('{name} rejoint ton album !', { name: card.name }), 'success');
  },
  'pack-open': () => {
    const results = openPack();
    play('win');
    showPack(results);
  },
  'card-fav': (el) => favoriteCard(el.dataset.id),
  'card-open': (el) => showCardSheet(el.dataset.id),
  'set-lang': (el) => setLang(el.dataset.lang),
  'album-set': (el) => { ui.albumSet = el.dataset.set; render(); },
  'album-rarity': (el) => { ui.albumRarity = el.dataset.rarity; render(); },
  'open-album': () => { ui.shopTab = 'album'; go('boutique'); },
  'shop-tab': (el) => { ui.shopTab = el.dataset.tab; render(); },
  'coach-done': () => update((s) => { const p = s.players[s.currentPlayerId]; if (p) p.tutorialDone = true; }),
  'coach-account': () => { update((s) => { const p = s.players[s.currentPlayerId]; if (p) p.tutorialDone = true; }); cloud.mode = 'signup'; go('profil'); },
  'coach-shop': () => { update((s) => { const p = s.players[s.currentPlayerId]; if (p) p.tutorialDone = true; }); go('boutique'); },
  'toggle-challenges': () => { ui.challengesOpen = !ui.challengesOpen; render(); },
  'share-referral': async () => {
    const p = currentPlayer();
    const url = referralLink(p.pseudo);
    const text = t('Rejoins-moi sur BeltChase, le jeu de pronos gratuit : on gagne {n} Gold chacun avec mon lien !', { n: REWARD });
    if (navigator.share) {
      try { await navigator.share({ title: 'BeltChase', text, url }); return; } catch (err) { if (err?.name === 'AbortError') return; }
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(t('Lien copié : colle-le à tes potes !'), 'success');
  },
  'share-bet': async (el) => {
    el.disabled = true;
    try {
      const res = await shareBet(el.dataset.id);
      if (res === 'downloaded') toast(t('Image enregistrée : envoie-la à tes potes !'), 'success');
    } finally { el.disabled = false; }
  },
  'fast-forward': async () => {
    await fastForward();
    toast(t('+{n} minutes pour les combats éclair', { n: CONFIG.FAST_FORWARD_MIN }), 'info');
  },

  'rank-tab': (el) => { ui.rankTab = el.dataset.tab; render(); },
  'top-scope': (el) => { ui.topScope = el.dataset.scope === 'all' ? 'all' : 'season'; render(); },
  'season-refresh': () => loadSeason({ force: true }),
  'top-refresh': async () => {
    const s = getState();
    await loadTop(playerRR(s.currentPlayerId, s), { force: true });
  },
  'division-refresh': async () => {
    const s = getState();
    await loadDivision(playerRR(s.currentPlayerId, s), { force: true });
  },
  'league-leave': async (el) => {
    const ok = await confirmDialog({ title: t('Quitter cette ligue ?'), message: t('Tu pourras la rejoindre à nouveau avec son code.'), confirmLabel: t('Quitter'), danger: true });
    if (!ok) return;
    if (cloud.user) await leaveOnlineLeague(el.dataset.code);
    else leaveLeague(el.dataset.code);
  },
  'leagues-refresh': () => loadMyLeagues({ force: true }),
  'league-invite': async (el) => {
    const res = await shareLeague(el.dataset.code, el.dataset.name);
    if (res === 'copied') toast(t("Lien d'invitation copié : colle-le dans WhatsApp, Discord ou Snap !"), 'success');
  },
  'copy-code': async (el) => {
    const code = el.dataset.code;
    try {
      await navigator.clipboard.writeText(code);
      toast(t('Code {c} copié ! Partage-le avec tes amis.', { c: code }), 'success');
    } catch {
      toast(t('Code de la ligue : {c}', { c: code }), 'info');
    }
  },

  'reset-app': async () => {
    const ok = await confirmDialog({
      title: t('Réinitialiser BeltChase ?'),
      message: t('Tous les joueurs, paris et ligues de cet appareil seront effacés.'),
      confirmLabel: t('Tout effacer'),
      danger: true,
    });
    if (!ok) return;
    resetAll();
    location.hash = '';
    location.reload();
  },
};

const forms = {
  'fight-save': async (data, form) => {
    const prev = data.get('id') ? adminFight(data.get('id')) : null;
    const startsAt = new Date(String(data.get('startsAt'))).getTime();
    if (!Number.isFinite(startsAt)) throw new Error('Date invalide.');
    const name = (k) => String(data.get(k) || '').trim().replace(/\s+/g, ' ');
    const record = (k) => name(k) || undefined;
    if (!name('home') || !name('away')) throw new Error('Il faut les deux combattants.');
    const f = {
      ...(prev || {}),
      id: prev?.id || uid('f'),
      sport: String(data.get('sport')),
      event: name('event'),
      label: name('label') || undefined,
      home: { name: name('home'), record: record('homeRecord') },
      away: { name: name('away'), record: record('awayRecord') },
      startsAt,
      rounds: Math.max(0, Math.min(12, Number(data.get('rounds')) || 0)),
      p1: Math.max(0.05, Math.min(0.95, (Number(data.get('p1')) || 50) / 100)),
      amateur: data.get('amateur') === 'on' || undefined,
      status: prev?.status || 'scheduled',
    };
    await saveFight(f);
    ui.adminDraft = { event: f.event, sport: f.sport, startsAt: String(data.get('startsAt')), rounds: f.rounds, amateur: !!f.amateur };
    ui.adminEdit = null;
    form.reset();
    toast(prev ? 'Combat modifié.' : `Combat ajouté : ${f.home.name} vs ${f.away.name}.`, 'success');
    await afterAdminWrite();
  },
  'fight-result': async (data, form) => {
    const f = adminFight(form.dataset.id);
    if (!f) return;
    const outcome = String(data.get('outcome') || '');
    if (!outcome) throw new Error('Choisis le vainqueur.');
    const method = String(data.get('method') || '');
    const round = Number(data.get('round')) || null;
    const next = outcome === 'void'
      ? { ...f, status: 'void', outcome: null, result: null }
      : { ...f, status: 'finished', outcome, result: outcome !== 'X' && method ? { method, round: method === 'DEC' ? f.rounds || null : round } : null };
    if (next.result && method !== 'DEC' && f.rounds && !round) throw new Error('Choisis le round de l\'arrêt.');
    await saveFight(next);
    toast('Résultat enregistré : les paris seront réglés dans quelques minutes.', 'success');
    await afterAdminWrite();
  },
  referral: async (data) => {
    const name = await applyReferral(data.get('pseudo'));
    toast(t('Parrain enregistré : {name}. +{n} Gold !', { name, n: REWARD }), 'success');
  },
  register: async (data) => {
    await register(data.get('pseudo'));
    const pick = ui.pendingPick;
    ui.pendingPick = null;
    if (pick && currentPlayer()) { toggleSelection(pick.match, pick.outcome); location.hash = 'matchs'; }
  },
  rename: async (data, form) => {
    const free = cloud.pseudoConflict === currentPlayer()?.pseudo;
    const pseudo = String(data.get('pseudo') || '').trim();
    if (!free) {
      const ok = await confirmDialog({
        title: t('Changer de pseudo ?'),
        message: t('Ton pseudo deviendra « {p} » pour {n} Gold.', { p: pseudo, n: CONFIG.RENAME_COST.toLocaleString(locale) }),
        confirmLabel: t('Payer et changer'),
      });
      if (!ok) return;
    }
    await renamePlayer(pseudo, { free });
    cloud.pseudoConflict = null;
    cloud.pseudoBanned = false;
    form.reset();
    render();
    toast(free ? t('Pseudo changé !') : t('Pseudo changé (−{n} Gold)', { n: CONFIG.RENAME_COST.toLocaleString(locale) }), 'success');
  },
  'cloud-auth': async (data, form) => {
    const btn = form.querySelector('button[type="submit"]');
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = t('Connexion…'); }
    try {
      await signInWithEmail(data.get('email'), data.get('password'), cloud.mode);
      toast(cloud.mode === 'signup' ? t('Compte créé ! Ta partie est sauvegardée en ligne.') : t('Connecté ! Ta partie est récupérée.'), 'success');
    } finally {
      if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; }
    }
  },

  'league-create': async (data, form) => {
    let code;
    if (cloud.user) {
      code = await createOnlineLeague(data.get('name'));
      noteLeagueCreated();
    } else {
      code = createLeague(data.get('name'));
    }
    form.reset();
    toast(t('Ligue créée ! Code à partager : {c}', { c: code }), 'success');
  },
  'league-join': async (data, form) => {
    const name = cloud.user ? await joinOnlineLeague(data.get('code')) : joinLeague(data.get('code'));
    form.reset();
    toast(t('Bienvenue dans « {name} » !', { name }), 'success');
  },
};

// Sans compte, on parie, rien de plus : ces actions (et formulaires) envoient vers l'inscription.
const ACCOUNT_ONLY = new Set([
  'claim-bonus', 'watch-ad', 'shop-buy', 'shop-equip', 'card-buy', 'pack-open', 'card-fav', 'share-referral',
  'league-leave', 'league-invite', 'referral', 'rename', 'league-create', 'league-join',
]);
function needsAccount(name) {
  if (!ACCOUNT_ONLY.has(name) || !isGuest()) return false;
  cloud.mode = 'signup';
  toast(t('Crée ton compte gratuit pour débloquer ça. Tes paris et tes Gold te suivent.'), 'info');
  go('profil');
  return true;
}

async function safely(fn) {
  try { await fn(); } catch (err) { toast(err.message || t('Oups, une erreur est survenue.'), 'error'); }
}

export function bindEvents() {
  // Blocs dépliants redessinés toutes les quelques secondes (cotes, scores) : on retient s'ils sont ouverts.
  // « toggle » ne remonte pas : écouté en phase de capture.
  document.addEventListener('toggle', (e) => {
    if (e.target.matches?.('details.guest-play')) ui.guestOpen = e.target.open;
  }, true);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    if (needsAccount(el.dataset.action)) return;
    safely(() => fn(el));
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fn = forms[form.dataset.form];
    if (fn && !needsAccount(form.dataset.form)) safely(() => fn(new FormData(form), form));
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches?.('select[data-lang-select]')) setLang(e.target.value);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-stake]')) {
      const clean = el.value.replace(/\D/g, '').slice(0, 7);
      if (clean !== el.value) el.value = clean;
      setStake(el.dataset.stake, clean === '' ? '' : Number(clean), { silent: true });
      refreshSlipNumbers();
    } else if (el.matches('.code-input')) {
      el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
  });
}
