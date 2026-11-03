// Page de pré-inscription (bientot.html) : compte à rebours jusqu'au lancement, inscription par e-mail.
// Firestore : preinscriptions/<e-mail en minuscules> = { email, lang, src, at } (création seulement) et
// stats/preinscriptions = { count, last } (+1 à chaque inscription, dans la même écriture). Les règles
// sont dans README.md (« Pré-inscription »). Le bonus est donné dans le jeu (js/services/prelaunch.js).
import { CONFIG } from './config.js';
import { LANGS, lang, langInfo, locale, setLang, t } from './i18n.js';
import { beltLogo } from './ui/icons.js';
import { escapeHtml } from './util.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const LAUNCH = new Date(CONFIG.LAUNCH_AT).getTime();
const DONE_KEY = 'beltchase:preinscrit';
const SHOW_COUNT_FROM = 50; // compteur affiché à partir de ce nombre d'inscrits
const EMAIL = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/; // pas de « / » : l'adresse sert d'identifiant de document
const FLAG = { fr: 'fr', en: 'gb', es: 'es', pt: 'br', ru: 'ru', ar: 'sa', zh: 'cn', hi: 'in', bn: 'bd', ur: 'pk' };
const CODE = { pt: 'pt-BR', zh: 'zh-Hans' };

const root = document.getElementById('pre');
const fmt = (n) => n.toLocaleString(locale);
const src = new URLSearchParams(location.search).get('src')?.slice(0, 20) || (document.referrer.includes('instagram') ? 'instagram' : '');
let done = (() => { try { return localStorage.getItem(DONE_KEY); } catch { return null; } })();

document.documentElement.lang = lang;
if (langInfo.rtl) document.documentElement.dir = 'rtl';
document.title = `BeltChase · ${t('Lancement le 1er décembre')}`;

let fb = null;
async function db() {
  if (fb) return fb;
  const [app, F] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore-lite.js`)]);
  fb = { F, db: F.getFirestore(app.initializeApp(CONFIG.FIREBASE, 'prelaunch')) };
  return fb;
}

// 'ok' | 'already' | 'error'. Refus des règles : adresse déjà inscrite (sa fiche ne se réécrit pas), ou
// compteur périmé par l'inscription simultanée d'un autre fan : on relit le compteur et on réessaie une fois.
async function register(email, retry = true) {
  try {
    const { F, db: d } = await db();
    const counter = F.doc(d, 'stats', 'preinscriptions');
    const cur = await F.getDoc(counter); // lecture publique : si elle échoue, ce n'est pas un doublon
    const batch = F.writeBatch(d);
    batch.set(F.doc(d, 'preinscriptions', email), { email, lang, src, at: F.serverTimestamp() });
    batch.set(counter, { count: (cur.exists() ? cur.data().count : 0) + 1, last: email });
    try {
      await batch.commit();
      return 'ok';
    } catch (err) {
      if (err?.code === 'permission-denied') return retry ? register(email, false) : 'already';
      throw err;
    }
  } catch (err) {
    console.warn('BeltChase : pré-inscription impossible', err);
    return 'error';
  }
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
      <strong>${t('Tu es sur la liste !')}</strong>
      <p>${t('Rendez-vous le {d}. Crée ton compte avec <b>{e}</b> pour recevoir ton bonus.', { d: launchDay, e: escapeHtml(done) })}</p>
    </div>
  </div>
  <div class="pre-actions">
    <button class="pre-btn" type="button" data-act="share">${t('Invite tes potes')}</button>
    <button class="pre-link" type="button" data-act="other">${t('Inscrire une autre adresse')}</button>
  </div>` : `
  <form class="pre-form" novalidate>
    <label class="sr" for="pre-email">${t('Ton adresse e-mail')}</label>
    <input id="pre-email" type="email" inputmode="email" autocomplete="email" maxlength="120" required placeholder="${t('ton@email.com')}">
    <button class="pre-btn" type="submit">${t('Je me pré-inscris')}</button>
  </form>
  <p class="pre-msg" role="alert" hidden></p>`);

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

      <div class="cd" role="timer" aria-label="${t('Compte à rebours avant le lancement')}">
        ${[t('Jours'), t('Heures'), t('Min'), t('Sec')].map((l) => `<div class="cd-cell"><span class="cd-num">–</span><span class="cd-lbl">${l}</span></div>`).join('')}
      </div>

      <div class="pre-card">
        <p class="pre-gift"><span aria-hidden="true">🎁</span> ${t('Pré-inscris-toi : <b>{n} Gold</b> et le titre exclusif <b>Pionnier</b> offerts au lancement.', { n: fmt(CONFIG.PRELAUNCH_BONUS) })}</p>
        <div class="pre-form-slot">${formHtml()}</div>
        <p class="pre-count" hidden></p>
      </div>
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
  const input = form.querySelector('input');
  const msg = root.querySelector('.pre-msg');
  const email = input.value.trim().toLowerCase();
  const say = (text) => { msg.textContent = text; msg.hidden = false; };
  if (!EMAIL.test(email) || email.length > 120) { say(t('Entre une adresse e-mail valide.')); input.focus(); return; }
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = t('Un instant…');
  const res = await register(email);
  if (res === 'error') {
    btn.disabled = false;
    btn.textContent = t('Je me pré-inscris');
    say(t('Impossible de t\'inscrire pour le moment. Réessaie dans un instant.'));
    return;
  }
  done = email;
  try { localStorage.setItem(DONE_KEY, email); } catch { /* ignoré */ }
  renderForm();
  if (res === 'already') root.querySelector('.pre-done strong').textContent = t('Tu étais déjà sur la liste !');
  else loadCount();
});

root.addEventListener('click', async (e) => {
  const l = e.target.closest('[data-lang]');
  if (l) { setLang(l.dataset.lang); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'other') {
    done = null;
    try { localStorage.removeItem(DONE_KEY); } catch { /* ignoré */ }
    renderForm();
    root.querySelector('#pre-email')?.focus();
  } else if (act === 'share') {
    const data = { title: 'BeltChase', text: t('BeltChase, le jeu de pronos des fans de combat, ouvre le {d}. Pré-inscris-toi : {n} Gold offerts !', { d: launchDay, n: fmt(CONFIG.PRELAUNCH_BONUS) }), url: 'https://beltchase.com/?src=partage' };
    const btn = e.target.closest('button');
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(`${data.text} ${data.url}`); btn.textContent = t('Lien copié !'); }
    } catch { /* partage annulé */ }
  }
});

render();
setInterval(tick, 1000);
loadCount();
