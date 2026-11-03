// Bandeau défilant « Dernière minute », façon chaîne info, sous l'en-tête : combats en direct,
// résultats des dernières 48 h et grosses actus. Il défile en continu (CSS) ; son contenu n'est remplacé
// que s'il change, pour ne pas faire repartir le défilement à chaque redessin.
import { escapeHtml } from '../util.js';
import { realNow } from '../store.js';
import { matchStatus } from '../services/matchInfo.js';
import { headlines, news } from '../services/news.js';
import { loadResults, mergeResults, results } from '../services/results.js';
import { finishText } from './resultText.js';
import { lang, t as tr } from '../i18n.js';

const DAY = 24 * 3600 * 1000;
const last = (name) => String(name).split(/\s+/).filter((w) => !/^(jr|sr)\.?$/i.test(w)).pop();

export function tickerItems(s) {
  const t = realNow();
  const real = Object.values(s.matches).filter((m) => m.real);
  const items = [];

  // En direct : suivi en temps réel (round connu) ou commencé depuis moins de 2 h (la boxe n'a pas de direct).
  const live = real.filter((x) => matchStatus(x, t) === 'live' && (x.clock || t - x.startsAt < 2 * 3600 * 1000));
  for (const m of live.slice(0, 4)) {
    items.push({ kind: 'live', href: '#matchs', text: `${m.home.name} – ${m.away.name}${m.clock ? ` · ${m.clock}` : ''}` });
  }

  loadResults();
  const done = mergeResults(results.items, real.filter((m) => m.status === 'finished'))
    .filter((m) => t - m.startsAt < 2 * DAY).slice(0, 8);
  for (const m of done) {
    const [w, l] = m.outcome === '2' ? [m.away, m.home] : [m.home, m.away];
    const how = finishText(m.score);
    items.push({ kind: 'result', href: '#matchs', text: m.outcome === 'X' ? `${m.home.name} – ${m.away.name} : ${tr('match nul')}` : `${tr('{w} bat {l}', { w: w.name, l: last(l.name) })}${how ? ` ${how}` : ''}` });
  }

  // Les actus viennent de sources françaises : seulement pour les joueurs en français.
  if (lang === 'fr') for (const a of headlines(news.items, 4)) items.push({ kind: 'news', href: a.link, text: a.title, external: true });
  return items;
}

const LABEL = { live: tr('En direct'), result: tr('Résultat'), news: tr('Actu') };

export function tickerHtml(s) {
  const items = tickerItems(s);
  if (!items.length) return '';
  const row = items.map((i) => `
    <a class="tk-item tk-${i.kind}" href="${escapeHtml(i.href)}"${i.external ? ' target="_blank" rel="noopener"' : ''}>
      <b>${LABEL[i.kind]}</b><span>${escapeHtml(i.text)}</span>
    </a>`).join('<i class="tk-sep" aria-hidden="true">◆</i>');
  // Contenu doublé : le défilement boucle sans trou. Vitesse constante (≈ 70 px/s) quelle que soit la longueur.
  const secs = Math.max(30, Math.round(items.reduce((n, i) => n + i.text.length + 12, 0) * 0.13));
  return `
    <div class="tk-flag">${tr('Dernière minute')}</div>
    <div class="tk-window"><div class="tk-track" style="--tk-dur:${secs}s">${row}<i class="tk-sep" aria-hidden="true">◆</i><span class="tk-copy" aria-hidden="true">${row}<i class="tk-sep">◆</i></span></div></div>`;
}
