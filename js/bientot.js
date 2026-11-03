// Page de pré-inscription (bientot.html) : compte à rebours jusqu'au lancement, inscription (pseudo +
// e-mail) et classement des meilleurs parrains : chacun a son lien (beltchase.com/?ref=CODE) et ne
// gagne une place que pour les amis qui se pré-inscrivent avec, pas pour un simple partage.
//
// Firestore (règles dans README.md, « Pré-inscription ») ; tout est écrit d'un coup à l'inscription :
// - emails/<e-mail en minuscules> = { id, code } : une seule inscription par adresse (lisible si on
//   connaît l'adresse : retrouver son lien sur un autre appareil) ;
// - preinscriptions/<id> = { email, pseudo, code, ref, lang, src, at } : privé (admin seulement) ;
// - prepseudos/<pseudo en minuscules> = { code } : un pseudo par pré-inscrit, réservé pour le jeu au lancement ;
// - parrains/<code> = { pseudo, count, last } : public, le classement ; count +1 seulement avec la
//   création d'une pré-inscription dont ref = code ;
// - stats/preinscriptions = { count, last } : nombre total d'inscrits.
// Le bonus est donné dans le jeu (js/services/prelaunch.js).
import { CONFIG } from './config.js';
import { LANGS, lang, langInfo, locale, setLang, t } from './i18n.js';
import { beltLogo } from './ui/icons.js';
import { escapeHtml } from './util.js';
import { isOffensivePseudo } from './services/moderation.js';
import { startSparks } from './ui/backdrop.js';
import { fightCardHtml } from './ui/fightCard.js';
import { CARDS } from './data/cards.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const LAUNCH = new Date(CONFIG.LAUNCH_AT).getTime();
const DONE_KEY = 'beltchase:preinscrit'; // { email, code } de l'inscription faite sur cet appareil
const REF_KEY = 'beltchase:ref';
const CODES_KEY = 'beltchase:mescodes'; // codes des inscriptions faites ici : pas de parrainage de soi-même
const SHOW_COUNT_FROM = 50; // compteur affiché à partir de ce nombre d'inscrits
const TOP = 10; // lignes du classement des parrains
const EMAIL = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/; // pas de « / » : l'adresse sert d'identifiant de document
const PSEUDO = /^[\p{L}\p{N} _.-]{2,16}$/u;
// Cartes montrées en éventail (au centre : la plus rare) et leur drapeau.
const SHOWCASE = [['boxe-tyson-fury', '🇬🇧'], ['mma-ilia-topuria', '🇬🇪'], ['boxe-oleksandr-usyk', '🇺🇦']];
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // codes de parrainage : sans 0/o, 1/l/i
const FLAG = { fr: 'fr', en: 'gb', es: 'es', pt: 'br', ru: 'ru', ar: 'sa', zh: 'cn', hi: 'in', bn: 'bd', ur: 'pk' };
const CODE = { pt: 'pt-BR', zh: 'zh-Hans' };

const root = document.getElementById('pre');
const fmt = (n) => n.toLocaleString(locale);
const params = new URLSearchParams(location.search);
const src = params.get('src')?.slice(0, 20) || (document.referrer.includes('instagram') ? 'instagram' : '');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignoré */ } },
};
let done = (() => { try { const d = JSON.parse(store.get(DONE_KEY)); return d?.email && d?.code ? d : null; } catch { return null; } })();
// Parrain : code du lien d'arrivée, gardé si le visiteur revient plus tard sans le lien.
const urlRef = (params.get('ref') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
if (urlRef) store.set(REF_KEY, urlRef);
let ref = store.get(REF_KEY) || '';
let referrer = null; // pseudo du parrain, une fois vérifié
let board = null; // [{ code, pseudo, count }]
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join('');
const myLink = () => `https://beltchase.com/?ref=${done.code}`;

document.documentElement.lang = lang;
if (langInfo.rtl) document.documentElement.dir = 'rtl';
document.title = `BeltChase · ${t('Lancement le 3 décembre')}`;

let fb = null;
async function db() {
  if (fb) return fb;
  const [app, F] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore-lite.js`)]);
  fb = { F, db: F.getFirestore(app.initializeApp(CONFIG.FIREBASE, 'prelaunch')) };
  return fb;
}

// → { status: 'ok' | 'already', code } | { status: 'taken' } (pseudo déjà pris) | { status: 'error' }. Adresse déjà inscrite : on renvoie son code
// (son lien de parrainage). Refus des règles à l'écriture : compteur ou fiche de parrain modifiés entre-temps
// par l'inscription simultanée d'un autre fan → on relit tout et on réessaie une fois.
async function register(email, pseudo, retry = true) {
  try {
    const { F, db: d } = await db();
    const lock = F.doc(d, 'emails', email);
    const known = await F.getDoc(lock);
    if (known.exists()) return { status: 'already', code: known.data().code };
    const nameLock = F.doc(d, 'prepseudos', pseudo.toLowerCase());
    if ((await F.getDoc(nameLock)).exists()) return { status: 'taken' };
    let code = newCode();
    while ((await F.getDoc(F.doc(d, 'parrains', code))).exists()) code = newCode();
    const counter = F.doc(d, 'stats', 'preinscriptions');
    const cur = await F.getDoc(counter);
    const mine = (store.get(CODES_KEY) || '').split(',');
    const parrain = ref && ref !== code && !mine.includes(ref) ? await F.getDoc(F.doc(d, 'parrains', ref)) : null;
    const viaRef = parrain?.exists() ? ref : '';
    const id = F.doc(F.collection(d, 'preinscriptions')).id;
    const batch = F.writeBatch(d);
    batch.set(lock, { id, code });
    batch.set(F.doc(d, 'preinscriptions', id), { email, pseudo, code, ref: viaRef, lang, src, at: F.serverTimestamp() });
    batch.set(nameLock, { code });
    batch.set(F.doc(d, 'parrains', code), { pseudo, count: 0, last: id });
    if (viaRef) batch.set(F.doc(d, 'parrains', viaRef), { pseudo: parrain.data().pseudo, count: parrain.data().count + 1, last: id });
    batch.set(counter, { count: (cur.exists() ? cur.data().count : 0) + 1, last: id });
    try {
      await batch.commit();
      return { status: 'ok', code };
    } catch (err) {
      if (err?.code === 'permission-denied' && retry) return register(email, pseudo, false);
      throw err;
    }
  } catch (err) {
    console.warn('BeltChase : pré-inscription impossible', err);
    return { status: 'error' };
  }
}

// Classement des parrains (amis pré-inscrits avec leur lien) et parrain du lien d'arrivée.
async function loadBoard() {
  try {
    const { F, db: d } = await db();
    const snap = await F.getDocs(F.query(F.collection(d, 'parrains'), F.where('count', '>', 0), F.orderBy('count', 'desc'), F.limit(TOP)));
    board = snap.docs.map((x) => ({ code: x.id, ...x.data() })).filter((r) => !isOffensivePseudo(r.pseudo));
    if (done && !board.some((r) => r.code === done.code)) {
      const mine = await F.getDoc(F.doc(d, 'parrains', done.code));
      if (mine.exists()) done.count = mine.data().count;
    }
  } catch (err) {
    console.warn('BeltChase : classement indisponible', err);
    board = board || [];
  }
  renderBoard();
}

async function loadReferrer() {
  if (!ref || done) return;
  try {
    const { F, db: d } = await db();
    const snap = await F.getDoc(F.doc(d, 'parrains', ref));
    if (!snap.exists()) { ref = ''; store.set(REF_KEY, null); return; }
    referrer = snap.data().pseudo;
    const el = root.querySelector('.pre-invited');
    if (el && !isOffensivePseudo(referrer)) {
      el.innerHTML = t('Invité par <b>{p}</b>', { p: escapeHtml(referrer) });
      el.hidden = false;
    }
  } catch { /* facultatif */ }
}

async function loadCount() {
  try {
    const { F, db: d } = await db();
    const snap = await F.getDoc(F.doc(d, 'stats', 'preinscriptions'));
    const n = snap.exists() ? snap.data().count : 0;
    const el = root.querySelector('.pre-count');
    if (el && n >= SHOW_COUNT_FROM) {
      el.innerHTML = t('<b>{n}</b> fans déjà pré-inscrits', { n: fmt(n) });
      el.hidden = false;
    }
  } catch { /* compteur facultatif */ }
}

// ---------- Compte à rebours ----------
const pad = (n) => String(n).padStart(2, '0');
function tick() {
  const left = Math.max(0, LAUNCH - Date.now());
  if (!left) { location.replace('/'); return; } // c'est ouvert
  const s = Math.floor(left / 1000);
  const parts = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
  root.querySelectorAll('.cd-num').forEach((el, i) => {
    const v = i ? pad(parts[i]) : String(parts[i]);
    if (el.textContent !== v) {
      el.textContent = v;
      el.classList.remove('flip');
      void el.offsetWidth; // relance l'animation
      el.classList.add('flip');
    }
  });
}

// ---------- Langue ----------
let names = null;
function langName(id) {
  try {
    names ||= new Intl.DisplayNames([locale], { type: 'language' });
    return names.of(CODE[id] || id) || id;
  } catch { return LANGS.find((l) => l.id === id).name; }
}
const flag = (id) => `<img src="https://flagcdn.com/w40/${FLAG[id]}.png" alt="" width="20" height="15">`;
const langMenu = () => `
  <details class="pre-lang">
    <summary aria-label="${t('Langue')}">${flag(lang)}<span>${escapeHtml(langName(lang))}</span><i aria-hidden="true">▾</i></summary>
    <ul>${LANGS.map((l) => `<li><button type="button" data-lang="${l.id}" ${l.id === lang ? 'aria-current="true"' : ''}>${flag(l.id)}<span>${escapeHtml(langName(l.id))}</span></button></li>`).join('')}</ul>
  </details>`;

// ---------- Page ----------
const launchDay = new Date(LAUNCH).toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
  .replace(/^1 /, lang === 'fr' ? '1er ' : '1 ');

const formHtml = () => (done ? `
  <div class="pre-done" role="status">
    <div class="pre-done-ico" aria-hidden="true">✓</div>
    <div>
      <strong>${done.already ? t('Tu étais déjà sur la liste !') : t('Tu es sur la liste !')}</strong>
      <p>${t('Rendez-vous le {d}. Crée ton compte avec <b>{e}</b> pour recevoir ton bonus.', { d: launchDay, e: escapeHtml(done.email) })}</p>
    </div>
  </div>
  <div class="pre-link-box">
    <p class="pre-link-lbl">${t('Ton lien de parrainage')}</p>
    <div class="pre-link-row">
      <input class="pre-link-input" type="text" readonly value="${escapeHtml(myLink())}" aria-label="${t('Ton lien de parrainage')}">
      <button class="pre-btn" type="button" data-act="share">${t('Partager')}</button>
    </div>
    <p class="pre-link-help">${t('Chaque ami qui se pré-inscrit avec ton lien te fait monter dans le classement.')}</p>
  </div>
  <button class="pre-link" type="button" data-act="other">${t('Inscrire une autre adresse')}</button>` : `
  <p class="pre-invited" hidden></p>
  <form class="pre-form" novalidate>
    <label class="sr" for="pre-pseudo">${t('Ton pseudo')}</label>
    <input id="pre-pseudo" type="text" autocomplete="nickname" maxlength="16" required placeholder="${t('Ton pseudo')}">
    <label class="sr" for="pre-email">${t('Ton adresse e-mail')}</label>
    <input id="pre-email" type="email" inputmode="email" autocomplete="email" maxlength="120" required placeholder="${t('ton@email.com')}">
    <button class="pre-btn" type="submit">${t('Je me pré-inscris')}</button>
  </form>
  <p class="pre-msg" role="alert" hidden></p>`);

function boardHtml() {
  if (!board) return `<p class="pre-board-empty">${t('Chargement…')}</p>`;
  const rows = board.map((r, i) => ({ ...r, rank: i + 1 }));
  const mine = done && rows.find((r) => r.code === done.code);
  if (!rows.length) return `<p class="pre-board-empty">${t('Personne pour l\'instant : sois le premier à faire inscrire un ami !')}</p>`;
  const row = (r) => `
    <li class="${done && r.code === done.code ? 'is-me' : ''}">
      <span class="pb-rank">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
      <span class="pb-name">${escapeHtml(r.pseudo)}${done && r.code === done.code ? ` <em>${t('toi')}</em>` : ''}</span>
      <span class="pb-count"><b>${fmt(r.count)}</b> ${r.count > 1 ? t('inscrits') : t('inscrit')}</span>
    </li>`;
  return `<ol class="pre-board-list">${rows.map(row).join('')}</ol>
    ${done && !mine ? `<p class="pre-board-me">${t('Toi : <b>{n}</b> ami(s) inscrit(s) avec ton lien.', { n: fmt(done.count || 0) })}</p>` : ''}`;
}

function renderBoard() {
  const el = root.querySelector('.pre-board-body');
  if (el) el.innerHTML = boardHtml();
}

function render() {
  root.innerHTML = `
    <header class="pre-top">
      <span class="pre-brand">${beltLogo}<span>Belt<b>Chase</b></span></span>
      ${langMenu()}
    </header>

    <section class="pre-hero">
      <p class="pre-kicker">${t('Lancement officiel')}</p>
      <h1 class="pre-title">${t('Le jeu de pronos <b>des fans de combat</b>')}</h1>
      <p class="pre-date">${escapeHtml(launchDay).replace(/^1er /, '1<sup>er</sup> ')}</p>

      <div class="pre-cards" aria-label="${t('Exemples de cartes à collectionner')}">
        ${SHOWCASE.map(([id, flag], i) => { const c = CARDS.find((x) => x.id === id); return c ? `<div class="lc lc-${i}">${fightCardHtml(c, { flag })}</div>` : ''; }).join('')}
      </div>
      <p class="pre-cards-cap">${t('{n} cartes à collectionner · MMA, boxe, kick, JJB…', { n: CARDS.length })}</p>

      <div class="cd" role="timer" aria-label="${t('Compte à rebours avant le lancement')}">
        ${[t('Jours'), t('Heures'), t('Min'), t('Sec')].map((l) => `<div class="cd-cell"><span class="cd-num">–</span><span class="cd-lbl">${l}</span></div>`).join('')}
      </div>

      <div class="pre-card">
        <p class="pre-gift"><span aria-hidden="true">🎁</span> ${t('Pré-inscris-toi : ton <b>pseudo réservé</b>, <b>{n} Gold</b>, le cadre et le titre exclusifs <b>OG</b> au lancement.', { n: fmt(CONFIG.PRELAUNCH_BONUS) })}</p>
        <div class="pre-form-slot">${formHtml()}</div>
        <p class="pre-count" hidden></p>
      </div>
    </section>

    <section class="pre-board" aria-labelledby="pre-board-title">
      <h2 id="pre-board-title">${t('Classement des parrains')}</h2>
      ${CONFIG.CONTEST_PRIZE ? `<p class="pre-prize"><span aria-hidden="true">🥊</span> ${t('Le n°1 le {d} à minuit gagne <b>des gants dédicacés par Axel Sola</b>, combattant de l\'UFC, livrés chez lui !', { d: launchDay })} <a href="/legal#concours">${t('Règlement')}</a></p>` : ''}
      <p class="pre-board-sub">${t('Seuls comptent les amis qui se pré-inscrivent avec ton lien. Partager ne suffit pas.')}</p>
      <div class="pre-board-body">${boardHtml()}</div>
    </section>

    <section class="pre-feats">
      ${[
    ['🎯', t('Pronostique'), t('Vainqueur, méthode, round : sur les vrais combats de MMA, boxe, kick et JJB.')],
    ['🃏', t('Collectionne'), t('151 cartes de combattants, de commune à légendaire.')],
    ['🏆', t('Chasse la ceinture'), t('Grimpe les rangs et décroche la ceinture du mois.')],
  ].map(([ico, h, p]) => `<article class="pre-feat"><span class="pre-feat-ico" aria-hidden="true">${ico}</span><h2>${h}</h2><p>${p}</p></article>`).join('')}
    </section>

    <a class="pre-insta" href="${CONFIG.INSTAGRAM}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>
      ${t('Suis-nous sur Instagram')} <b>@beltchase.officiel</b>
    </a>

    <footer class="pre-foot">
      <p>${t('Gratuit · 100 % virtuel · sans argent réel. Le Gold ne s\'achète pas et ne s\'échange pas.')}</p>
      <p>${t('Ton e-mail sert seulement à te prévenir du lancement et à te donner ton bonus. Jamais revendu. Pour te désinscrire : {c}.', { c: `<a href="mailto:${CONFIG.CONTACT_EMAIL}">${CONFIG.CONTACT_EMAIL}</a>` })}
        <a href="/legal#confidentialite">${t('Confidentialité')}</a></p>
    </footer>`;
  tick();
}

function renderForm() {
  root.querySelector('.pre-form-slot').innerHTML = formHtml();
}

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const pseudoIn = form.querySelector('#pre-pseudo');
  const input = form.querySelector('#pre-email');
  const msg = root.querySelector('.pre-msg');
  const pseudo = pseudoIn.value.trim().replace(/\s+/g, ' ');
  const email = input.value.trim().toLowerCase();
  const say = (text) => { msg.textContent = text; msg.hidden = false; };
  if (!PSEUDO.test(pseudo)) { say(t('Ton pseudo doit faire entre 2 et 16 caractères (lettres, chiffres, espaces, _ . -).')); pseudoIn.focus(); return; }
  if (isOffensivePseudo(pseudo)) { say(t('Ce pseudo n\'est pas autorisé. Choisis-en un autre.')); pseudoIn.focus(); return; }
  if (!EMAIL.test(email) || email.length > 120) { say(t('Entre une adresse e-mail valide.')); input.focus(); return; }
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = t('Un instant…');
  const res = await register(email, pseudo);
  if (res.status === 'taken') {
    btn.disabled = false;
    btn.textContent = t('Je me pré-inscris');
    say(t('Ce pseudo est déjà réservé. Choisis-en un autre.'));
    pseudoIn.focus();
    return;
  }
  if (res.status === 'error') {
    btn.disabled = false;
    btn.textContent = t('Je me pré-inscris');
    say(t('Impossible de t\'inscrire pour le moment. Réessaie dans un instant.'));
    return;
  }
  done = { email, code: res.code, already: res.status === 'already' };
  store.set(DONE_KEY, JSON.stringify({ email, code: res.code }));
  store.set(CODES_KEY, [...new Set([...(store.get(CODES_KEY) || '').split(','), res.code])].filter(Boolean).join(','));
  renderForm();
  loadBoard();
  if (res.status === 'ok') loadCount();
});

root.addEventListener('click', async (e) => {
  const l = e.target.closest('[data-lang]');
  if (l) { setLang(l.dataset.lang); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'other') {
    done = null;
    store.set(DONE_KEY, null);
    renderForm();
    renderBoard();
    loadReferrer();
    root.querySelector('#pre-pseudo')?.focus();
  } else if (act === 'share') {
    const data = { title: 'BeltChase', text: t('BeltChase, le jeu de pronos des fans de combat, ouvre le {d}. Pré-inscris-toi : {n} Gold offerts !', { d: launchDay, n: fmt(CONFIG.PRELAUNCH_BONUS) }), url: myLink() };
    const btn = e.target.closest('button');
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(`${data.text} ${data.url}`); btn.textContent = t('Lien copié !'); }
    } catch { /* partage annulé */ }
  } else if (e.target.matches('.pre-link-input')) {
    e.target.select();
    try {
      await navigator.clipboard.writeText(e.target.value);
      const btn = root.querySelector('[data-act="share"]');
      if (btn && !navigator.share) btn.textContent = t('Lien copié !');
    } catch { /* partage annulé */ }
  }
});

render();
startSparks(document.querySelector('.bc-sparks'));
setInterval(tick, 1000);
loadCount();
loadBoard();
loadReferrer();
