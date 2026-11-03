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
import { LANGS, lang, langInfo, locale, ordinal, setLang, t, tn } from './i18n.js';
import { beltLogo, rankEmblem } from './ui/icons.js';
import { RADIANT, TIERS } from './services/ranks.js';
import { escapeHtml } from './util.js';
import { isOffensivePseudo } from './services/moderation.js';
import { startSparks } from './ui/backdrop.js';
import { fightCardHtml } from './ui/fightCard.js';
import { CARDS } from './data/cards.js';
import { headlines, loadNews, news } from './services/news.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const LAUNCH = new Date(CONFIG.LAUNCH_AT).getTime();
const DONE_KEY = 'beltchase:preinscrit'; // { email, code } de l'inscription faite sur cet appareil
const REF_KEY = 'beltchase:ref';
const CODES_KEY = 'beltchase:mescodes'; // codes des inscriptions faites ici : pas de parrainage de soi-même
const COUNT_EVERY_MS = 60_000; // nombre d'inscrits relu toutes les minutes (1 lecture Firestore)
const SHOW_COUNT_FROM = 50; // en dessous, le compteur ferait vide : on ne l'affiche pas
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
    if (done) {
      const inBoard = board.find((r) => r.code === done.code);
      let count = inBoard?.count;
      if (count == null) {
        const mine = await F.getDoc(F.doc(d, 'parrains', done.code));
        count = mine.exists() ? mine.data().count : 0;
      }
      done.count = count;
      // Rang : 1 + nombre de parrains devant (égalités : le premier arrivé passe devant, approximation).
      const ahead = count ? (await F.getCount(F.query(F.collection(d, 'parrains'), F.where('count', '>', count)))).data().count : 0;
      const third = board[2]?.count ?? 0;
      me = { count, rank: ahead + 1, need: Math.max(1, third - count + 1) };
      const el = root.querySelector('.pre-me');
      if (el) el.innerHTML = meHtml();
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
    if (!el || n < SHOW_COUNT_FROM) return;
    el.innerHTML = `<span class="pre-count-dot" aria-hidden="true"></span>${tn(n, '<b>{n}</b> fan déjà pré-inscrit', '<b>{n}</b> fans déjà pré-inscrits', { n: fmt(n) })}`;
    el.hidden = false;
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
    <p class="pre-me" role="status">${meHtml()}</p>
    <div class="pre-share">${shareButtons()}</div>
    <div class="pre-link-row">
      <input class="pre-link-input" type="text" readonly value="${escapeHtml(myLink())}" aria-label="${t('Ton lien de parrainage')}">
      <button class="pre-btn pre-btn-ghost" type="button" data-act="copy">${t('Copier')}</button>
    </div>
    <p class="pre-link-help">${t('Pour Instagram : copie le lien et colle-le dans ta story (sticker Lien) ou ta bio.')}</p>
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

// Actus (js/services/news.js, comme l'écran Actus du jeu) : seulement les 3 « à la une » du moment.
// Seulement le titre, la source et un lien vers l'article d'origine.
// Titres avec un gros mot (citations) : pas sur la page d'accueil.
const VULGAR = /\b(putain|merde|connard|conne?s?|encul\w*|salope|pute|niqu\w*|batard|fuck\w*|shit|bitch)\b/i;
const ago = (ts) => {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return m < 60 ? rtf.format(-m, 'minute') : m < 1440 ? rtf.format(-Math.round(m / 60), 'hour') : rtf.format(-Math.round(m / 1440), 'day');
  } catch { return ''; }
};
function newsHtml() {
  if (!news.items.length) return `<p class="pre-board-empty">${news.error ? t('Les actus sont momentanément indisponibles.') : t('Chargement…')}</p>`;
  const top = headlines(news.items.filter((a) => !VULGAR.test(a.title)), 3);
  const link = (a, inner, cls) => `<a class="${cls}" href="${escapeHtml(a.link)}" target="_blank" rel="noopener">${inner}</a>`;
  return `
    <div class="pn-top">${top.map((a) => link(a, `
      <img src="${escapeHtml(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">
      <span class="pn-meta">${escapeHtml(a.source)} · ${ago(a.date)}</span>
      <strong>${escapeHtml(a.title)}</strong>`, 'pn-card')).join('')}</div>`;
}
function renderNews() {
  const el = root.querySelector('.pre-news-body');
  if (el) el.innerHTML = newsHtml();
}

// Aperçu du jeu : un prono comme dans l'appli (maquette statique, cotes d'exemple).
const oct = (code, initials) => `<span class="pv-oct" style="background-image:url(https://flagcdn.com/w160/${code}.png)"><b>${initials}</b></span>`;
function previewHtml() {
  return `
  <div class="pv" aria-label="${t('Exemple de prono')}">
    <p class="pv-ev">UFC · ${t('Combat principal')} · ${t('Poids lourds')}</p>
    <div class="pv-fight">
      <div class="pv-f">${oct('fr', 'CG')}<strong>Gane</strong></div>
      <span class="pv-vs">VS</span>
      <div class="pv-f">${oct('us', 'JH')}<strong>Hokit</strong></div>
    </div>
    <div class="pv-odds"><span class="is-on">Gane <b>2,18</b></span><span>Hokit <b>1,63</b></span></div>
    <div class="pv-meth"><span class="is-on">KO / TKO</span><span>${t('Soumission')}</span><span>${t('Décision')}</span></div>
    <div class="pv-slip"><span>${t('Ton prono : Gane par KO')}</span><b>× 4,40</b></div>
  </div>`;
}

// ---------- Partage du lien (après l'inscription) ----------
const shareText = () => t('Je tente de gagner des gants dédicacés par Axel Sola sur BeltChase 🥊 Inscris-toi avec mon lien, lancement le {d} :', { d: launchDay });
const enc = encodeURIComponent;
const ICON = {
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
  snapchat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c3 0 5.3 2.3 5.3 5.4v2.1l1.4-.5c.6-.1 1.1.4.8 1-.3.5-1.6 1-2.3 1.3.4 1.6 2 3.4 4 3.9.4.1.5.6.2.9-.6.6-1.8.8-2.6.9-.2.5-.2 1.2-.7 1.3-.9.1-1.8-.3-2.8.1-1.1.5-1.8 1.6-3.3 1.6s-2.2-1.1-3.3-1.6c-1-.4-1.9 0-2.8-.1-.5-.1-.5-.8-.7-1.3-.8-.1-2-.3-2.6-.9-.3-.3-.2-.8.2-.9 2-.5 3.6-2.3 4-3.9-.7-.3-2-.8-2.3-1.3-.3-.6.2-1.1.8-1l1.4.5V7.4C6.7 4.3 9 2 12 2z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 12.6l-4.9-1.5c-1-.3-1.1-1 .2-1.5L20.5 2.4c.9-.3 1.7.2 1.4 1.9z"/></svg>',
};
function shareButtons() {
  const url = myLink();
  const text = shareText();
  const links = [
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${enc(`${text} ${url}`)}`],
    ['snapchat', 'Snapchat', `https://www.snapchat.com/scan?attachmentUrl=${enc(url)}`],
    ['x', 'X', `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`],
    ['telegram', 'Telegram', `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`],
  ];
  // Instagram n'a pas de lien de partage pour le web : on copie le lien puis on ouvre l'appli (story).
  return `${links.map(([id, name, href]) => `<a class="pre-sh pre-sh-${id}" href="${escapeHtml(href)}" target="_blank" rel="noopener">${ICON[id]}<span>${name}</span></a>`).join('')}
    <button class="pre-sh pre-sh-instagram" type="button" data-act="insta">${ICON.instagram}<span>Instagram</span></button>
    ${typeof navigator !== 'undefined' && navigator.share ? `<button class="pre-sh pre-sh-more" type="button" data-act="share">${t('Autre…')}</button>` : ''}`;
}

// Ma position dans le classement des parrains et ce qu'il me manque pour le top 3.
let me = null; // { count, rank, need }
function meHtml() {
  if (!me) return '';
  if (!me.count) return t('Fais inscrire ton premier ami pour entrer dans le classement.');
  const amis = tn(me.count, '{n} ami inscrit', '{n} amis inscrits', { n: fmt(me.count) });
  return me.rank <= 3
    ? t('Tu es <b>{r}</b> du classement avec {a}. Garde ta place !', { r: ordinal(me.rank), a: amis })
    : t('Tu es <b>{r}</b> avec {a}. Encore <b>{k}</b> pour entrer dans le top 3.', { r: ordinal(me.rank), a: amis, k: fmt(me.need) });
}

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
      <p class="pre-kicker">${t('Lancement le {d}', { d: escapeHtml(launchDay) })}</p>
      <h1 class="pre-title">${t('L\'actu et les pronos <b>des fans de combat</b>')}</h1>
      <p class="pre-tagline">${t('Pronostique les vrais combats, collectionne les cartes et suis toute l\'actu MMA et boxe.')}</p>
      ${CONFIG.CONTEST_PRIZE ? `<a class="pre-prize-top" href="#pre-board"><span class="pre-prize-ico" aria-hidden="true">🥊</span><span>${t('Fais inscrire le plus d\'amis et gagne <b>des gants dédicacés par Axel Sola</b>, combattant de l\'UFC')}</span></a>` : ''}

      <div class="pre-card">
        <p class="pre-gift"><span aria-hidden="true">🎁</span> ${t('Pré-inscris-toi : ton <b>pseudo réservé</b>, <b>{n} Gold</b>, le cadre et le titre exclusifs <b>OG</b> au lancement.', { n: fmt(CONFIG.PRELAUNCH_BONUS) })}</p>
        <div class="pre-form-slot">${formHtml()}</div>
      </div>

      <div class="cd" role="timer" aria-label="${t('Compte à rebours avant le lancement')}">
        ${[t('Jours'), t('Heures'), t('Min'), t('Sec')].map((l) => `<div class="cd-cell"><span class="cd-num">–</span><span class="cd-lbl">${l}</span></div>`).join('')}
      </div>
      <p class="pre-count" role="status" hidden></p>
    </section>

    <section class="pre-game" aria-labelledby="pre-game-title">
      <h2 id="pre-game-title">${t('Le jeu en un coup d\'œil')}</h2>
      <div class="pre-trio">
        <article class="pre-col">
          <h3><span aria-hidden="true">🎯</span> ${t('Pronostique')}</h3>
          ${previewHtml()}
        </article>
        <article class="pre-col">
          <h3><span aria-hidden="true">🃏</span> ${t('Collectionne')}</h3>
          <div class="pre-cards" aria-label="${t('Exemples de cartes à collectionner')}">
            ${SHOWCASE.map(([id, flag], i) => { const c = CARDS.find((x) => x.id === id); return c ? `<div class="lc lc-${i}">${fightCardHtml(c, { flag })}</div>` : ''; }).join('')}
          </div>
          <p class="pre-col-txt">${t('{n} cartes à collectionner · MMA, boxe, kick, JJB…', { n: CARDS.length })}</p>
        </article>
        <article class="pre-col">
          <h3><span aria-hidden="true">🏆</span> ${t('Chasse la ceinture')}</h3>
          <ol class="pre-ladder">
            ${[...TIERS, RADIANT].map((r, i) => `<li style="--i:${i}">${rankEmblem({ ...r, division: r.id === 'radiant' ? null : 3, label: r.name }, 'rank-emblem pre-emblem')}<span style="color:${r.color}">${escapeHtml(r.name)}</span></li>`).join('')}
          </ol>
          <p class="pre-col-txt">${t('Bon prono : tu montes. Mauvais : tu descends. Chaque mois, le top 3 entre au Hall of Fame.')}</p>
        </article>
      </div>
    </section>

    <section class="pre-board" id="pre-board" aria-labelledby="pre-board-title">
      <h2 id="pre-board-title">${t('Classement des parrains')}</h2>
      ${CONFIG.CONTEST_PRIZE ? `<p class="pre-prize"><span aria-hidden="true">🥊</span> ${t('Le n°1 le {d} à minuit gagne <b>des gants dédicacés par Axel Sola</b>, combattant de l\'UFC, livrés chez lui !', { d: launchDay })} <a href="/legal#concours">${t('Règlement')}</a></p>` : ''}
      <p class="pre-board-sub">${t('Seuls comptent les amis qui se pré-inscrivent avec ton lien. Partager ne suffit pas.')}</p>
      <div class="pre-board-body">${boardHtml()}</div>
    </section>

    <section class="pre-news" id="pre-news" aria-labelledby="pre-news-title">
      <h2 id="pre-news-title"><span class="pre-live">${t('En direct')}</span>${t('L\'actu du moment')}</h2>
      <div class="pre-news-body">${newsHtml()}</div>
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
    try { await navigator.share({ title: 'BeltChase', text: shareText(), url: myLink() }); } catch { /* partage annulé */ }
  } else if (act === 'insta') {
    const btn = e.target.closest('button');
    try { await navigator.clipboard.writeText(myLink()); } catch { /* copie impossible : le lien reste affiché */ }
    btn.querySelector('span').textContent = t('Lien copié !');
    const help = root.querySelector('.pre-link-help');
    if (help) help.innerHTML = `<b>${t('Lien copié !')}</b> ${t('Dans ta story Instagram, ajoute le sticker « Lien » et colle-le.')}`;
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    window.open(mobile ? 'instagram://story-camera' : 'https://www.instagram.com/', '_blank', 'noopener');
  } else if (act === 'copy') {
    const btn = e.target.closest('button');
    try { await navigator.clipboard.writeText(myLink()); btn.textContent = t('Lien copié !'); } catch { root.querySelector('.pre-link-input')?.select(); }
  } else if (e.target.matches('.pre-link-input')) {
    e.target.select();
    try {
      await navigator.clipboard.writeText(e.target.value);
      const btn = root.querySelector('[data-act="copy"]');
      if (btn) btn.textContent = t('Lien copié !');
    } catch { /* partage annulé */ }
  }
});

// Intro : retirée à la fin de son animation, ou tout de suite au clic.
const intro = document.querySelector('.bc-intro');
if (intro) {
  const end = () => intro.remove();
  intro.addEventListener('animationend', (e) => { if (e.animationName === 'intro-out') end(); });
  intro.addEventListener('click', end);
  setTimeout(end, 3000);
}

render();
startSparks(document.querySelector('.bc-sparks'));
setInterval(() => { if (!document.hidden) loadCount(); }, COUNT_EVERY_MS);
setInterval(tick, 1000);
loadCount();
loadBoard();
loadReferrer();
loadNews().then(renderNews);
setInterval(() => { if (!document.hidden) loadNews().then(renderNews); }, 10 * 60_000);
