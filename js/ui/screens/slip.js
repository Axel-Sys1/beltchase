import { CONFIG } from '../../config.js';
import { getState } from '../../store.js';
import { escapeHtml, fmt, fmtOdds } from '../../util.js';
import { potentialGain, slipCheck, COMBO_KEY, COMBO_MIN } from '../../services/bets.js';
import { matchStatus, outcomeLabel } from '../../services/matchInfo.js';
import { coin, icons } from '../icons.js';
import { teamMark } from '../logos.js';
import { t } from '../../i18n.js';

export function renderSlip(s, p, { context = 'page' } = {}) {
  const { items, total, potential, error, combo, comboOdds, comboStake, oddsChanged, hasLive } = slipCheck(s);

  const head = `
    <div class="slip-head">
      <h2>${t('Panier')} ${items.length ? `<span class="count">${items.length}</span>` : ''}</h2>
      ${items.length ? `<button class="link-btn danger" data-action="slip-clear" type="button">${icons.trash} ${t('Vider')}</button>` : ''}
    </div>`;

  if (!items.length) {
    return `
    <div class="slip slip-${context}">
      ${head}
      <div class="empty slip-empty">
        <div class="empty-icon">${icons.ticket}</div>
        <p><strong>${t('Ton panier est vide')}</strong></p>
        <p class="muted">${t("Touche une cote sur un combat pour l'ajouter ici.")}</p>
        ${context === 'page' ? `<button class="btn btn-ghost" data-action="go" data-route="matchs" type="button">${t('Voir les combats')}</button>` : ''}
      </div>
    </div>`;
  }

  const modes = items.length >= COMBO_MIN && hasLive ? `
    <p class="muted slip-note">${icons.bolt} ${t('Les paris en direct se jouent en simple.')}</p>` : items.length >= COMBO_MIN ? `
    <div class="tabs slip-modes" role="tablist">
      <button class="tab ${combo ? '' : 'active'}" data-action="slip-mode" data-mode="single" role="tab" type="button">${t('Simples')}</button>
      <button class="tab ${combo ? 'active' : ''}" data-action="slip-mode" data-mode="combo" role="tab" type="button">${t('Combiné')}</button>
    </div>` : '';

  return `
  <div class="slip slip-${context}">
    ${head}
    ${modes}
    <div class="slip-items">
      ${items.map((x) => {
        const m = x.match;
        const { odds } = x;
        const started = !x.live && matchStatus(m) !== 'upcoming';
        const moved = x.live && x.current && x.current !== odds;
        const inputId = `stake-${context}-${m.id}`;
        return `
        <div class="slip-item ${started ? 'expired' : ''} ${x.live ? 'is-live' : ''}" data-slip-item="${escapeHtml(m.id)}">
          <div class="slip-top">
            <div class="grow">
              ${x.live ? `<div class="slip-live"><span class="live-pill">${t('EN DIRECT')}</span>${m.liveScore ? ` <strong>${escapeHtml(m.liveScore)}</strong>` : ''}${m.clock ? ` <span class="muted">${escapeHtml(m.clock)}</span>` : ''}</div>` : ''}
              <div class="slip-match">${teamMark(m.home, 'logo-img logo-sm')} ${escapeHtml(m.home.name)} – ${teamMark(m.away, 'logo-img logo-sm')} ${escapeHtml(m.away.name)}</div>
              <div class="slip-pick">${escapeHtml(outcomeLabel(m, x.outcome))}</div>
            </div>
            <div class="slip-odd ${moved ? 'is-moved' : ''}">${moved
              ? `<s>${fmtOdds(odds)}</s> <span class="${x.current > odds ? 'up' : 'down'}">${fmtOdds(x.current)}</span>`
              : x.live && !x.current ? `<span class="muted slip-suspended">${icons.lock} ${t('Suspendu')}</span>` : fmtOdds(odds)}</div>
            <button class="icon-btn" data-action="slip-remove" data-match="${escapeHtml(m.id)}" type="button" aria-label="${t('Retirer')}">${icons.close}</button>
          </div>
          ${started ? `<p class="warn">${t('Ce combat a commencé.')}</p>` : combo ? '' : `
          <div class="stake-row">
            <label class="stake-input" for="${inputId}">
              <span class="sr-only">${t('Mise')}</span>
              <input id="${inputId}" data-stake="${escapeHtml(m.id)}" inputmode="numeric" autocomplete="off" value="${escapeHtml(x.stake)}">
              ${coin('coin coin-sm')}
            </label>
            <div class="quick">
              ${CONFIG.QUICK_STAKES.map((a) => `<button type="button" data-action="slip-quick" data-match="${escapeHtml(m.id)}" data-amount="${a}">+${a}</button>`).join('')}
              <button type="button" data-action="slip-quick" data-match="${escapeHtml(m.id)}" data-amount="max">${t('Max')}</button>
            </div>
          </div>
          <div class="gain-line">
            <span class="muted">${t('Gain potentiel')}</span>
            <strong class="gain" data-gain="${escapeHtml(m.id)}">${fmt(potentialGain(x.stake, odds))}</strong>
          </div>`}
        </div>`;
      }).join('')}
    </div>

    <div class="slip-foot">
      ${combo ? comboBox(context, comboOdds, comboStake) : ''}
      <div class="slip-sum"><span>${t('Mise totale')}</span><strong><span data-slip-total>${fmt(total)}</span> ${coin('coin coin-sm')}</strong></div>
      <div class="slip-sum big"><span>${t('Gain potentiel')}</span><strong class="gain"><span data-slip-potential>${fmt(potential)}</span> ${coin('coin coin-sm')}</strong></div>
      <p class="slip-error" data-slip-error ${error ? '' : 'hidden'}>${escapeHtml(error || '')}</p>
      ${oddsChanged ? `
      <button class="btn btn-primary btn-lg btn-block" data-action="slip-accept" type="button">${t('Accepter les nouvelles cotes')}</button>` : `
      <button class="btn btn-primary btn-lg btn-block" data-action="slip-place" data-slip-submit type="button" ${error ? 'disabled' : ''}>
        ${combo ? t('Valider le combiné ({n} combats)', { n: items.length }) : items.length > 1 ? t('Valider {n} paris', { n: items.length }) : t('Valider le pari')}
      </button>`}
      ${hasLive && items.some((x) => x.live && x.match.real) ? `<p class="muted slip-note">${t('Pari en direct sur un vrai combat : validé si le score ne bouge pas pendant {n} s, sinon remboursé.', { n: Math.round(CONFIG.LIVE.CONFIRM_MS / 1000) })}</p>` : ''}
    </div>
  </div>`;
}

function comboBox(context, odds, stake) {
  const inputId = `stake-${context}-combo`;
  return `
    <div class="combo-box">
      <div class="slip-sum"><span>${t('Cote du combiné')}</span><strong class="combo-odds">${fmtOdds(odds)}</strong></div>
      <p class="muted combo-rule">${t('Tous tes pronostics doivent être bons. Un combat remboursé compte pour une cote de 1.')}</p>
      <div class="stake-row">
        <label class="stake-input" for="${inputId}">
          <span class="sr-only">${t('Mise du combiné')}</span>
          <input id="${inputId}" data-stake="${COMBO_KEY}" inputmode="numeric" autocomplete="off" value="${escapeHtml(stake)}">
          ${coin('coin coin-sm')}
        </label>
        <div class="quick">
          ${CONFIG.QUICK_STAKES.map((a) => `<button type="button" data-action="slip-quick" data-match="${COMBO_KEY}" data-amount="${a}">+${a}</button>`).join('')}
          <button type="button" data-action="slip-quick" data-match="${COMBO_KEY}" data-amount="max">${t('Max')}</button>
        </div>
      </div>
    </div>`;
}

// Met à jour les montants du panier pendant la saisie, sans redessiner l'écran.
export function refreshSlipNumbers() {
  const { items, total, potential, error, combo } = slipCheck(getState());
  for (const x of combo ? [] : items) {
    const g = potentialGain(x.stake, x.odds);
    document.querySelectorAll(`[data-gain="${CSS.escape(x.matchId)}"]`).forEach((el) => { el.textContent = fmt(g); });
  }
  document.querySelectorAll('[data-slip-total]').forEach((el) => { el.textContent = fmt(total); });
  document.querySelectorAll('[data-slip-potential]').forEach((el) => { el.textContent = fmt(potential); });
  document.querySelectorAll('[data-slip-error]').forEach((el) => { el.hidden = !error; el.textContent = error || ''; });
  document.querySelectorAll('[data-slip-submit]').forEach((el) => { el.disabled = !!error; });
}
