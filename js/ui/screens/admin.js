// Page admin (#admin, réservée aux comptes CONFIG.ADMIN_EMAILS) : ajouter les combats des soirées
// sans source automatique (JJB, lutte, kick, Muay Thaï, ONE, ARES, Hexagone…) et saisir leurs résultats.
// Les combats vont dans Firestore (cloud.saveFight) et le provider BeltChase les met dans le jeu.
import { escapeHtml } from '../../util.js';
import { SPORTS, SPORT_ORDER, sportMeta } from '../../sports.js';
import { METHOD_LABEL, resultText } from '../../services/markets.js';
import { cloud, isAdmin } from '../../services/cloud.js';
import { ui } from '../uiState.js';
import { locale } from '../../i18n.js';

// Rounds proposés par défaut selon la discipline (0 : pas de rounds, comme en JJB).
export const DEFAULT_ROUNDS = { mma: 3, boxing: 10, kickboxing: 3, bjj: 0, wrestling: 0 };
const LABELS = ['', 'Main event', 'Co-main event', 'Combat pour le titre'];

const pad = (n) => String(n).padStart(2, '0');
// ms → valeur d'un <input type="datetime-local"> (heure locale).
export const toLocalInput = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const when = (ts) => new Date(ts).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function fightForm(events) {
  const e = ui.adminEdit;
  const d = ui.adminDraft || {};
  const sport = e?.sport || d.sport || 'mma';
  const v = (x) => escapeHtml(x ?? '');
  return `
    <form class="card admin-form" data-form="fight-save" autocomplete="off">
      <h2>${e ? 'Modifier le combat' : 'Ajouter un combat'}</h2>
      ${e ? `<input type="hidden" name="id" value="${v(e.id)}">` : ''}
      <div class="admin-grid">
        <label>Soirée<input name="event" list="admin-events" required maxlength="60" placeholder="ex. ARES 32, ADCC Paris" value="${v(e?.event ?? d.event)}"></label>
        <datalist id="admin-events">${events.map((x) => `<option value="${v(x)}">`).join('')}</datalist>
        <label>Discipline
          <select name="sport">${SPORT_ORDER.map((k) => `<option value="${k}" ${k === sport ? 'selected' : ''}>${SPORTS[k].icon} ${escapeHtml(SPORTS[k].label)}</option>`).join('')}</select>
        </label>
        <label>Date et heure<input name="startsAt" type="datetime-local" required value="${v(e ? toLocalInput(e.startsAt) : d.startsAt)}"></label>
        <label>Rounds (0 = sans rounds)<input name="rounds" type="number" min="0" max="12" value="${v(e?.rounds ?? d.rounds ?? DEFAULT_ROUNDS[sport])}"></label>
        <label>Combattant 1<input name="home" required maxlength="40" value="${v(e?.home.name)}"></label>
        <label>Bilan 1 (facultatif)<input name="homeRecord" maxlength="12" placeholder="12-2-0" value="${v(e?.home.record)}"></label>
        <label>Combattant 2<input name="away" required maxlength="40" value="${v(e?.away.name)}"></label>
        <label>Bilan 2 (facultatif)<input name="awayRecord" maxlength="12" placeholder="9-3-0" value="${v(e?.away.record)}"></label>
        <label>Chances du combattant 1 (%)<input name="p1" type="number" min="5" max="95" step="5" value="${Math.round((e?.p1 ?? 0.5) * 100)}"></label>
        <label>Étiquette
          <select name="label">${LABELS.map((l) => `<option value="${v(l)}" ${l === (e?.label || '') ? 'selected' : ''}>${l || '—'}</option>`).join('')}</select>
        </label>
        <label class="admin-check"><input name="amateur" type="checkbox" ${(e ? e.amateur : d.amateur) ? 'checked' : ''}> Combat amateur (gala, championnat amateur)</label>
      </div>
      <p class="muted admin-hint">Les cotes se calculent toutes seules : 50 % = combat serré, 70 % = favori net. Méthode et round sont proposés automatiquement.</p>
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">${e ? 'Enregistrer' : 'Ajouter le combat'}</button>
        ${e ? '<button class="btn btn-ghost" data-action="admin-cancel" type="button">Annuler</button>' : ''}
      </div>
    </form>`;
}

function resultForm(f) {
  const methods = sportMeta(f.sport).methods || [];
  const name = (x) => escapeHtml(x.name);
  return `
    <form class="admin-result" data-form="fight-result" data-id="${escapeHtml(f.id)}">
      <select name="outcome" aria-label="Vainqueur" required>
        <option value="">Vainqueur…</option>
        <option value="1">${name(f.home)}</option>
        <option value="2">${name(f.away)}</option>
        <option value="X">Nul</option>
        <option value="void">Annulé / no contest</option>
      </select>
      <select name="method" aria-label="Méthode">
        <option value="">Méthode…</option>
        ${methods.map((k) => `<option value="${k}">${METHOD_LABEL[k] || k}</option>`).join('')}
      </select>
      ${f.rounds ? `<select name="round" aria-label="Round"><option value="">Round…</option>${Array.from({ length: f.rounds }, (_, i) => `<option value="${i + 1}">R${i + 1}</option>`).join('')}</select>` : ''}
      <button class="btn btn-primary btn-sm" type="submit">Valider</button>
    </form>`;
}

function fightRow(f, now) {
  const done = f.status === 'finished' || f.status === 'void';
  const status = f.status === 'void' ? 'Annulé'
    : f.status === 'finished' ? `${f.outcome === 'X' ? 'Nul' : `Victoire ${escapeHtml((f.outcome === '1' ? f.home : f.away).name)}`}${f.result ? ` · ${escapeHtml(resultText(f.result))}` : ''}`
      : f.startsAt <= now ? '<b class="admin-due">Résultat à saisir</b>' : `${when(f.startsAt)}`;
  return `
    <li class="admin-fight">
      <div class="admin-fight-head">
        <span>${sportMeta(f.sport).icon} <strong>${escapeHtml(f.home.name)}</strong> vs <strong>${escapeHtml(f.away.name)}</strong>${f.label ? ` <small>${escapeHtml(f.label)}</small>` : ''}</span>
        <span class="muted">${status}</span>
      </div>
      ${!done && f.startsAt <= now + 3_600_000 ? resultForm(f) : ''}
      <div class="admin-row-actions">
        <button class="link-btn" data-action="admin-edit" data-id="${escapeHtml(f.id)}" type="button">Modifier</button>
        <button class="link-btn danger" data-action="admin-delete" data-id="${escapeHtml(f.id)}" type="button">Supprimer</button>
      </div>
    </li>`;
}

export function renderAdmin() {
  if (!cloud.user || !isAdmin()) {
    return '<div class="empty"><p><strong>Page réservée à l\'admin.</strong></p><p class="muted">Connecte-toi avec le compte admin.</p></div>';
  }
  const list = ui.adminFights;
  if (!list) {
    ui.adminLoad?.();
    return '<div class="skeletons" aria-busy="true"><div class="skeleton"></div></div>';
  }
  const now = Date.now();
  const events = [...new Set(list.map((f) => f.event))];
  const groups = new Map();
  for (const f of [...list].sort((a, b) => a.startsAt - b.startsAt)) {
    if (!groups.has(f.event)) groups.set(f.event, []);
    groups.get(f.event).push(f);
  }
  const due = list.filter((f) => f.status !== 'finished' && f.status !== 'void' && f.startsAt <= now).length;
  return `
    <h1 class="page-title">Admin des combats</h1>
    <p class="muted">Soirées ajoutées à la main (JJB, lutte, kick, Muay Thaï, ONE, ARES, Hexagone…). Elles apparaissent dans « Vrais combats » quelques minutes après.${due ? ` <b>${due} résultat${due > 1 ? 's' : ''} à saisir.</b>` : ''}</p>
    ${fightForm(events)}
    <section class="admin-list">
      <div class="section-row">
        <h2 class="section-title">Combats</h2>
        <button class="link-btn" data-action="admin-refresh" type="button">Actualiser</button>
      </div>
      ${groups.size ? [...groups.entries()].map(([event, fights]) => `
        <div class="card admin-event">
          <h3>${escapeHtml(event)} <small class="muted">${when(fights[0].startsAt)}</small></h3>
          <ul>${fights.map((f) => fightRow(f, now)).join('')}</ul>
        </div>`).join('') : '<p class="muted">Aucun combat pour l\'instant : ajoute le premier ci-dessus.</p>'}
    </section>`;
}
