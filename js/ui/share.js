// « Partager mon pari » : une image carrée (1080 × 1080) dessinée dans un canvas, envoyée par le
// partage du téléphone (WhatsApp, Insta, Snap…) ou téléchargée si le navigateur ne sait pas partager.
import { betsOf } from '../services/bets.js';
import { outcomeLabel } from '../services/matchInfo.js';
import { getState } from '../store.js';
import { fmt, fmtOdds } from '../util.js';
import { t, tParts } from '../i18n.js';

const SITE = 'beltchase.com';
const C = { bg: '#08122a', bg2: '#0f1f40', line: '#20365f', text: '#edf2fb', muted: '#8a9abb', accent: '#f2b630', green: '#3ddc84', red: '#ff4d63' };
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const BODY = 'Barlow, system-ui, sans-serif';

// Texte réduit jusqu'à tenir dans la largeur donnée.
function fit(ctx, text, maxW, size, weight, family, italic = '') {
  let s = size;
  do { ctx.font = `${italic} ${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20);
  return text;
}

function legsOf(b) {
  return b.legs ? b.legs.map((l) => ({ match: l.match, outcome: l.outcome, odds: l.odds })) : [{ match: b.match, outcome: b.outcome, odds: b.odds }];
}

async function drawBet(b) {
  await document.fonts?.ready;
  const W = 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = W;
  const ctx = c.getContext('2d');

  // Fond et bandes obliques, comme l'image de partage du site.
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = 'rgba(255,107,26,0.14)';
  ctx.beginPath(); ctx.moveTo(760, 0); ctx.lineTo(880, 0); ctx.lineTo(560, W); ctx.lineTo(440, W); ctx.fill();
  ctx.fillStyle = 'rgba(255,107,26,0.07)';
  ctx.beginPath(); ctx.moveTo(920, 0); ctx.lineTo(980, 0); ctx.lineTo(660, W); ctx.lineTo(600, W); ctx.fill();

  // Logo.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 800 72px ${DISPLAY}`;
  ctx.fillStyle = C.text; ctx.fillText('BELT', 80, 150);
  ctx.fillStyle = C.accent; ctx.fillText('CHASE', 80 + ctx.measureText('BELT').width, 150);

  // Bandeau d'état.
  const status = { won: [t('PARI GAGNÉ'), C.green], lost: [t('PARI PERDU'), C.red], void: [t('REMBOURSÉ'), C.muted], pending: [b.live ? t('MON PRONO EN DIRECT') : t('MON PRONO'), C.accent] }[b.status];
  ctx.font = `800 40px ${DISPLAY}`;
  const tagW = ctx.measureText(status[0]).width + 48;
  ctx.fillStyle = status[1]; ctx.beginPath(); ctx.roundRect(80, 200, tagW, 64, 12); ctx.fill();
  ctx.fillStyle = b.status === 'void' ? C.bg : '#1a0800'; ctx.fillText(status[0], 104, 247);

  // Sélections (3 au plus, puis « + N autres »).
  const legs = legsOf(b);
  let y = 350;
  const shown = legs.slice(0, 3);
  for (const l of shown) {
    const m = l.match;
    ctx.fillStyle = C.bg2; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(80, y, W - 160, legs.length > 1 ? 150 : 230, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.muted;
    fit(ctx, tParts(m.competition), W - 240, 30, 600, BODY);
    ctx.fillText(tParts(m.competition), 112, y + 50);
    ctx.fillStyle = C.text;
    const teams = `${m.home.name} – ${m.away.name}`;
    fit(ctx, teams, W - 240, legs.length > 1 ? 44 : 58, 800, DISPLAY, 'italic');
    ctx.fillText(teams, 112, y + (legs.length > 1 ? 100 : 120));
    ctx.fillStyle = C.accent;
    const pick = `${outcomeLabel(m, l.outcome)}  @ ${fmtOdds(l.odds)}`;
    fit(ctx, pick, W - 240, legs.length > 1 ? 34 : 46, 700, BODY);
    ctx.fillText(pick, 112, y + (legs.length > 1 ? 136 : 190));
    y += (legs.length > 1 ? 150 : 230) + 20;
  }
  if (legs.length > shown.length) {
    ctx.fillStyle = C.muted; ctx.font = `600 32px ${BODY}`;
    ctx.fillText(t(legs.length - shown.length > 1 ? '+ {n} autres combats' : '+ {n} autre combat', { n: legs.length - shown.length }), 112, y + 30);
  }

  // Chiffres en bas.
  const odds = b.finalOdds || b.odds;
  const gain = b.status === 'won' ? `+${fmt(b.payout)}` : fmt(b.potential);
  const cols = [
    [b.legs ? `${t('Combiné')} · ${t('{n} combats', { n: legs.length })}` : t('Cote'), fmtOdds(odds), C.text],
    [t('Mise'), `${fmt(b.stake)} G`, C.text],
    [b.status === 'won' ? t('Gain') : t('Gain potentiel'), `${gain} G`, b.status === 'won' ? C.green : C.accent],
  ];
  cols.forEach(([label, value, color], i) => {
    const x = 80 + i * 320;
    ctx.fillStyle = C.muted; ctx.font = `600 30px ${BODY}`; ctx.fillText(label, x, 900);
    ctx.fillStyle = color; fit(ctx, value, 290, 64, 800, DISPLAY, 'italic'); ctx.fillText(value, x, 970);
  });

  ctx.fillStyle = C.muted; ctx.font = `600 28px ${BODY}`;
  ctx.fillText(t('Joue gratuitement sur {s} · sans argent réel', { s: SITE }), 80, 1040);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

// Partage le pari id. Renvoie 'shared' | 'downloaded' | 'cancelled'.
export async function shareBet(id) {
  const s = getState();
  const b = betsOf(s.currentPlayerId, s).find((x) => x.id === id);
  if (!b) throw new Error(t('Pari introuvable.'));
  const blob = await drawBet(b);
  const file = new File([blob], 'mon-pari-beltchase.png', { type: 'image/png' });
  const text = b.status === 'won'
    ? t('Pari gagné sur BeltChase : +{n} Gold ! Viens me défier : {url}', { n: fmt(b.payout), url: `https://${SITE}` })
    : t('Mon prono sur BeltChase, tu suis ? {url}', { url: `https://${SITE}` });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'downloaded';
}
